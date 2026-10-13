import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { build } from 'esbuild';
import { chromium, firefox, webkit, expect } from '@playwright/test';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';
import sharp from 'sharp';
import { normalizeAvatar } from '../src/lib/avatar';

// These fixtures exercise actual components and image normalization without production accounts.
test('registration, profile edits, avatar crop, search and mobile drawer across browsers', { timeout: 600_000 }, async () => {
  const [bundle, css] = await Promise.all([
    build({ entryPoints: ['tests/browser/compatibility-harness.tsx'], bundle: true, write: false, platform: 'browser', format: 'esm', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'boundaries', setup(api) {
      const stubs: Record<string, string> = {
        'next/link': 'export default function Link({prefetch,...props}){return <a {...props}/>}',
        'next/image': 'export default function Image({unoptimized,...props}){return <img {...props}/>}',
        'next/navigation': 'export const usePathname=()=>location.pathname;export const useRouter=()=>({prefetch(){},refresh(){window.fixtureRefreshes=(window.fixtureRefreshes||0)+1}});',
        '@/app/actions/auth': 'export async function startSocialSignIn(){return {}}',
        '@/app/actions/profile': 'export async function saveProfile(_,form){return (await fetch("/fixture/profile",{method:"POST",body:JSON.stringify(Object.fromEntries(form))})).json()}',
      };
      api.onResolve({filter:/.*/}, args => args.path in stubs ? { path: args.path, namespace: 'fixture' } : undefined);
      api.onLoad({filter:/.*/,namespace:'fixture'}, args => ({ contents: stubs[args.path], loader: 'jsx', resolveDir: process.cwd() }));
    } }] }),
    postcss([tailwindcss()]).process(readFileSync('src/app/globals.css', 'utf8') + '\n' + readFileSync('src/styles/profile.css','utf8') + '\n' + readFileSync('src/styles/mobile.css','utf8'), { from: 'src/app/globals.css' }),
  ]);
  let bio = '', avatar: Buffer | null = null, activeWrites = 0, maximumWrites = 0, writes = 0, authAttempts = 0;
  const server = createServer(async (req, res) => {
    const path = new URL(req.url!, 'http://localhost').pathname;
    try {
      if (path === '/bundle.js') { res.setHeader('Content-Type','application/javascript'); res.end(bundle.outputFiles[0].contents); }
      else if (path === '/style.css') { res.setHeader('Content-Type','text/css'); res.end(css.css); }
      else if (path.startsWith('/fixture/')) {
        const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(chunk);
        const bytes = Buffer.concat(chunks); res.setHeader('Content-Type','application/json');
        if (path === '/fixture/profile') {
          activeWrites++; maximumWrites = Math.max(maximumWrites,activeWrites);
          const data = JSON.parse(bytes.toString());
          await new Promise(resolve => setTimeout(resolve, 900));
          bio = data.bio; activeWrites--; writes++; res.end(JSON.stringify({success:'Сохранено'}));
        } else if (path === '/fixture/avatar') {
          avatar = await normalizeAvatar(new File([new Uint8Array(bytes)], 'avatar.jpg', {type:'image/jpeg'}));
          res.end(JSON.stringify({success:'Аватар сохранён.'}));
        } else {
          const data = JSON.parse(bytes.toString()); authAttempts++;
          assert.equal(data.email,'fixture@example.org'); assert.equal(data.password,'fixture-password'); assert.equal(data.terms,'on');
          res.end(JSON.stringify(authAttempts % 2 ? {error:'Лимит писем подтверждения',retryAfterSeconds:2} : {success:'Подтвердите почту'}));
        }
      } else {
        res.setHeader('Content-Type','text/html;charset=utf-8');
        res.end(`<!doctype html><html data-theme="${new URL(req.url!,'http://localhost').searchParams.get('theme') === 'dark' ? 'dark' : 'light'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script>window.fixture=${JSON.stringify({bio,hasAvatar:!!avatar}).replace(/</g,'\\u003c')}</script><script type="module" src="/bundle.js"></script></body></html>`);
      }
    } catch (error) { res.statusCode=500; res.end(JSON.stringify({error:String(error)})); }
  });
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  const image = await sharp({create:{width:600,height:400,channels:3,background:'#ff0000'}}).composite([{input:await sharp({create:{width:300,height:400,channels:3,background:'#0000ff'}}).png().toBuffer(),left:300,top:0}]).png().toBuffer();
  mkdirSync('test-results/compatibility',{recursive:true});
  const engines = process.env.NIS_BROWSER_ENGINES?.split(',') ?? ['chromium','firefox','webkit'];
  try {
    for (const name of engines) {
      const engine = name === 'firefox' ? firefox : name === 'webkit' ? webkit : chromium;
      const executablePath = name === 'webkit' ? process.env.NIS_WEBKIT_EXECUTABLE : name === 'chrome' ? process.env.NIS_CHROME_EXECUTABLE : undefined;
      const browser = await engine.launch({ headless: true, executablePath });
      try {
        for (const width of [320,390,1280]) for (const theme of ['light','dark']) {
          bio=''; avatar=null; writes=0; authAttempts=0; maximumWrites=0;
          const page = await browser.newPage({viewport:{width,height:844},hasTouch:width<768});
          const errors: string[]=[]; page.on('pageerror',error=>errors.push(error.message));
          page.setDefaultTimeout(10000);
          await page.goto(`${origin}/profile?theme=${theme}`);
          await expect(page.locator('#profile-form')).toBeVisible();
          const textarea = page.locator('[name="bio"]');
          await textarea.fill('Первая версия');
          await page.locator('#profile-form button[type="submit"]').evaluate(el=>el.scrollIntoView({block:'center'}));
          await page.locator('#profile-form button[type="submit"]').click();
          await expect(page.locator('#profile-form')).toHaveAttribute('data-status','saving');
          await textarea.fill('Последняя версия 🙂');
          await expect.poll(()=>bio,{timeout:8000}).toBe('Последняя версия 🙂');
          assert.equal(maximumWrites,1,'profile saves must be serialized'); assert.equal(writes,2);
          await page.reload(); await expect(textarea).toHaveValue('Последняя версия 🙂');
          await page.getByRole('button',{name:'KZ',exact:true}).click();
          await expect(page.locator('.profile-save-status')).toContainText('Өзгерістер');
          await page.getByRole('button',{name:'RU',exact:true}).click();
          const picker = page.locator('.avatar-settings input[type="file"]');
          await picker.setInputFiles({ name: 'invalid.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('invalid') });
          await expect(page.locator('.avatar-settings [role="alert"]')).toBeVisible();
          await picker.setInputFiles({ name: 'portrait.png', mimeType: 'image/png', buffer: image });
          await expect(page.locator('.avatar-crop-preview')).toBeVisible();
          await page.getByRole('slider',{name:'Масштаб',exact:true}).fill('2');
          await page.getByRole('slider',{name:'По горизонтали',exact:true}).fill('1');
          await page.getByRole('button',{name:'Сохранить аватар',exact:true}).click();
          await expect(page.locator('.avatar-settings [role="status"]')).toHaveText('Аватар сохранён.');
          assert.ok(avatar); const {data,info} = await sharp(avatar).raw().toBuffer({resolveWithObject:true});
          const middle=(128*info.width+128)*info.channels; assert.ok(data[middle+2]>200 && data[middle]<30,'export preserves selected blue crop');
          assert.ok(await page.evaluate(()=> (window as unknown as {fixtureRefreshes:number}).fixtureRefreshes)>=1);
          for (const format of ['jpeg','webp','gif','avif'] as const) {
            const file=await sharp(image).toFormat(format).toBuffer();
            await picker.setInputFiles({name:format==='jpeg'?'photo.jpg':`photo.${format}`,mimeType:`image/${format}`,buffer:file});
            await expect(page.locator('.avatar-crop-preview')).toBeVisible();
            await page.getByRole('button',{name:'Отмена',exact:true}).click();
          }
          const auth = page.locator('[role="tabpanel"]:visible form');
          await auth.locator('[name="email"]').fill('fixture@example.org'); await auth.locator('[name="password"]').fill('fixture-password');
          await auth.locator('button[type="submit"]').click(); assert.equal(authAttempts,0,'terms required');
          await auth.locator('[name="terms"]').check(); await auth.locator('button[type="submit"]').click();
          await expect(auth.locator('[role="alert"]')).toHaveText('Лимит писем подтверждения');
          await expect(auth.locator('[name="email"]')).toHaveValue('fixture@example.org');
          await expect(auth.locator('[name="password"]')).toHaveValue('fixture-password');
          await expect(auth.locator('[name="terms"]')).toBeChecked();
          await expect(auth.locator('button[type="submit"]')).toBeDisabled();
          await expect(auth.locator('button[type="submit"]')).toBeEnabled({timeout:4000});
          await auth.locator('button[type="submit"]').click(); await expect(auth.locator('[role="status"]')).toHaveText('Подтвердите почту');
          assert.equal(authAttempts,2);
          if(width<768) {
            await page.locator('.mobile-menu').click(); await expect(page.locator('.mobile-drawer')).toHaveAttribute('open','');
            await page.locator('.mobile-drawer-close').click(); await expect(page.locator('.mobile-drawer')).not.toHaveAttribute('open','');
            await expect(page.locator('.mobile-menu')).toBeFocused();
            await expect(page.locator('body')).not.toHaveAttribute('data-mobile-navigation-open','');
          }
          await page.locator('.global-search button').click();
          assert.equal(new URL(page.url()).pathname,'/profile','first search click must not navigate');
          await expect(page.locator('#global-search')).toBeFocused();
          await expect(page.locator('.global-search')).toHaveAttribute('data-expanded','true');
          assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');
          await page.screenshot({path:`test-results/compatibility/${name}-${width}-${theme}.png`});
          await page.locator('#global-search').fill('Физика'); await page.locator('.global-search button').click();
          await page.waitForURL('**/library?q=*'); assert.equal(new URL(page.url()).searchParams.get('q'),'Физика');
          assert.deepEqual(errors,[]);
          console.log(`${name} ${width}px ${theme}: passed`);
          await page.close();
        }
      } finally { await browser.close(); }
    }
  } finally { await new Promise<void>(resolve=>server.close(()=>resolve())); }
});
