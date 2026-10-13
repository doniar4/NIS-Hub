import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";
import { createServer } from "node:http";
import { once } from "node:events";
import { v051Database } from "./helpers/v051-database";
import { fixtureId as id, asUser } from "./helpers/database";
import { profileSchema } from "../src/lib/validation";
import { validSchoolSelection } from "../src/lib/schools";

test("School onboarding: map first, persistent school/profile steps, change-school settings and responsive themes/locales", {timeout:180000}, async () => {
  const db = await v051Database();
  let server: ReturnType<typeof createServer> | undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    await db.exec(`insert into auth.users(id) values('${id(1)}');
      insert into classes(id,name,grade,school_id) values('${id(10)}','9A',9,'oral');
      insert into subjects(id,name,name_ru,name_kz,name_en) values('${id(20)}','Mathematics','Математика','Математика','Mathematics'),('${id(21)}','Physics','Физика','Физика','Physics');`);
    await asUser(db, id(1));
    const bundle = await build({ entryPoints:["tests/browser/school-onboarding-harness.tsx"], bundle:true,write:false,platform:"browser",format:"esm",jsx:"automatic",
      define:{"process.env.NODE_ENV":'"production"'}, plugins:[{name:"school-boundary",setup(api){
        api.onResolve({filter:/^@\/app\/actions\/(schools|profile)$/},args=>({path:args.path,namespace:"fixture"}));
        api.onResolve({filter:/^next\/navigation$/},()=>({path:"navigation",namespace:"fixture"}));
        api.onLoad({filter:/.*/,namespace:"fixture"},({path})=>({contents:path==="navigation"
          ? 'const router={replace(path){history.replaceState({},"",path)},refresh(){location.reload()}};export const useRouter=()=>router;'
          : 'const rpc=async(name,input)=>{const value=input instanceof FormData?{display_name:input.get("display_name"),class_id:input.get("class_id"),bio:input.get("bio"),subjects:input.getAll("subjects").filter(Boolean)}:input;return (await fetch("/rpc",{method:"POST",body:JSON.stringify({name,input:value})})).json()};export const saveSchool=input=>rpc("school",input);export const finishSchoolOnboarding=(_,form)=>rpc("finish",form);export const saveProfile=(_,form)=>rpc("profile",form);'}));
      }}] });
    const css = readdirSync(".next/static/css",{recursive:true}).filter(n=>String(n).endsWith(".css")).map(n=>readFileSync(join(".next/static/css",String(n)),"utf8")).join("\n") + readFileSync("src/styles/school-onboarding.css", "utf8");
    let failSchool=false, schoolCalls=0;
    server=createServer(async(req,res)=>{
      const url=new URL(req.url!,"http://fixture");res.setHeader("Cache-Control","no-store");
      try {
        if(url.pathname==="/bundle.js"){res.setHeader("Content-Type","application/javascript");res.end(bundle.outputFiles[0].contents);return;}
        if(url.pathname==="/style.css"){res.setHeader("Content-Type","text/css");res.end(css+'\n.fixture-header{display:flex;align-items:center;gap:1rem;max-width:1180px;margin:auto;padding:1rem 2rem}.fixture-header strong{margin-right:auto}.fixture-header button{min-height:44px;background:none;border:0;color:var(--text)}');return;}
        if(url.pathname.endsWith(".woff2")){res.end(readFileSync(join(".next/static/media",basename(url.pathname))));return;}
        if(url.pathname==="/favicon.ico"){res.statusCode=204;res.end();return;}
        if(url.pathname==="/rpc"){
          const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(chunk);
          const {name,input}=JSON.parse(Buffer.concat(chunks).toString());
          if(name==="school"){
            schoolCalls++;
            if(failSchool){failSchool=false;res.end(JSON.stringify({error:"Не удалось сохранить школу. Попробуйте ещё раз."}));return;}
            assert.ok(validSchoolSelection(input.city,input.school));
            await db.query("select save_profile_school($1,$2)",[input.city,input.school]);
          }else{
            const v=profileSchema.parse(input);
            await db.query("select save_profile_v053($1,$2,$3,$4)",[v.display_name,v.class_id,v.subjects,v.bio]);
            if(name==="finish")await db.query("select complete_profile_onboarding()");
          }
          res.setHeader("Content-Type","application/json");res.end(JSON.stringify({success:"Сохранено"}));return;
        }
        const profile=(await db.query("select * from profiles where id=$1",[id(1)])).rows[0];
        const classes=(await db.query("select * from classes order by name")).rows;
        const subjects=(await db.query("select * from subjects order by name")).rows;
        const top=(await db.query<{subject_id:string}>("select subject_id from profile_top_subjects where profile_id=$1 order by position",[id(1)])).rows.map(r=>r.subject_id);
        res.setHeader("Content-Type","text/html;charset=utf-8");res.end('<!doctype html><html data-theme="light"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script>window.schoolFixture='+JSON.stringify({profile,classes,subjects,top}).replace(/</g,"\\u003c")+'</script><script type="module" src="/bundle.js"></script></body></html>');
      }catch(error){res.statusCode=500;res.end(JSON.stringify({error:String(error)}));}
    });
    server.listen(0,"127.0.0.1");await once(server,"listening");const address=server.address();assert.ok(address&&typeof address!=="string");const origin=`http://127.0.0.1:${address.port}`;
    browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:900}});
    const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
    const out=join(process.cwd(),"test-results/school-onboarding");mkdirSync(out,{recursive:true});
    await page.goto(origin+"/onboarding");
    await expect(page.getByRole("heading",{name:"Выберите город",exact:true})).toBeVisible();
    await expect(page.locator('#profile-form')).toHaveCount(0);
    await expect(page.getByRole("button",{name:"Продолжить",exact:true})).toBeDisabled();
    await expect(page.locator('.kz-map .kz-city')).toHaveCount(18);
    await expect(page.locator('.kz-relief-light')).toHaveCount(20);
    await expect(page.locator('.kz-city-column')).toHaveCount(18);
    for(const panel of ['.kz-map-pane','.kz-map-stage','.kz-school-pane']){
      const material=await page.locator(panel).evaluate(el=>({background:getComputedStyle(el).backgroundImage,blur:getComputedStyle(el).backdropFilter}));
      assert.ok(material.background.includes('linear-gradient'));assert.ok(material.blur.includes('blur('));
    }
    assert.equal(await page.locator('.kz-view-switch .scene-view-thumb').evaluate(el=>getComputedStyle(el).width),'32px');
    await expect(page.locator('.kz-view-switch').getByRole('button',{name:'3D',exact:true})).toHaveAttribute('aria-pressed','true');
    const stage = page.locator('.kz-map-stage'), mapCamera = page.locator('.kz-map-camera');
    const defaultProjection = await mapCamera.evaluate(el => getComputedStyle(el).transform);
    const initialWall = await page.locator('.kz-relief-light').first().getAttribute('d');
    // Dragging from a city rotates the camera without selecting that city.
    const astana = page.locator('.kz-map').getByRole('button',{name:'Астана',exact:true});
    const cityBox = await astana.boundingBox(); assert.ok(cityBox);
    await page.mouse.move(cityBox.x + cityBox.width / 2, cityBox.y + cityBox.height / 2);
    await page.mouse.down(); await page.mouse.move(cityBox.x + cityBox.width / 2 + 110, cityBox.y + cityBox.height / 2 - 40,{steps:10});
    await expect(page.locator('.kz-school-picker')).toHaveAttribute('data-rotating','true');
    await page.mouse.up();
    await expect(page.locator('.kz-school-picker')).not.toHaveAttribute('data-rotating','true');
    await expect(page.getByRole('radio')).toHaveCount(0);
    await expect.poll(() => mapCamera.evaluate(el => getComputedStyle(el).transform)).not.toBe(defaultProjection);
    assert.notEqual(await page.locator('.kz-relief-light').first().getAttribute('d'),initialWall);
    await page.screenshot({path:join(out,'rotated-map.png'),fullPage:true});
    // City labels remain upright through a camera rotation.
    const matrices = await page.locator('.kz-city-upright').first().evaluate(el => {
      const camera = new DOMMatrix(getComputedStyle(document.querySelector('.kz-map-camera')!).transform);
      const inverse = new DOMMatrix(getComputedStyle(el).transform);
      return camera.multiply(inverse).toFloat64Array().slice(0,6);
    });
    assert.ok(Math.abs(matrices[1])<.00001 && Math.abs(matrices[4])<.00001);
    await page.getByRole('button',{name:'Сбросить вид карты',exact:true}).click();
    await expect.poll(() => mapCamera.evaluate(el => getComputedStyle(el).transform)).toBe(defaultProjection);
    await stage.focus(); await stage.press('ArrowRight');
    await expect.poll(() => mapCamera.evaluate(el => getComputedStyle(el).transform)).not.toBe(defaultProjection);
    await stage.press('Home');
    await expect.poll(() => mapCamera.evaluate(el => getComputedStyle(el).transform)).toBe(defaultProjection);
    // Real touch events follow the same gesture path, including cancellation.
    const touch = await page.context().newCDPSession(page), box = await stage.boundingBox(); assert.ok(box);
    const touchPoint = {x:box.x+box.width/2,y:box.y+box.height/2,id:1};
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touchPoint]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...touchPoint,x:touchPoint.x+90,y:touchPoint.y+45}]});
    await expect(page.locator('.kz-school-picker')).toHaveAttribute('data-rotating','true');
    await touch.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    await expect(page.locator('.kz-school-picker')).not.toHaveAttribute('data-rotating','true');
    await expect.poll(() => mapCamera.evaluate(el => getComputedStyle(el).transform)).not.toBe(defaultProjection);
    await touch.detach();
    await page.getByRole('button',{name:'Сбросить вид карты',exact:true}).click();
    await expect.poll(() => mapCamera.evaluate(el => getComputedStyle(el).transform)).toBe(defaultProjection);
    await page.locator('.kz-view-switch').getByRole('button',{name:'2D',exact:true}).click();
    await expect(page.locator('.kz-school-picker')).toHaveAttribute('data-mode','2d');
    await expect.poll(() => mapCamera.evaluate(el => { const m=new DOMMatrix(getComputedStyle(el).transform); return m.b===0 && m.c===0; })).toBe(true);
    const flatProjection = await mapCamera.evaluate(el => getComputedStyle(el).transform);
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2); await page.mouse.down();
    await page.mouse.move(box.x+box.width/2+60,box.y+box.height/2-30,{steps:5}); await page.mouse.up();
    assert.equal(await mapCamera.evaluate(el=>getComputedStyle(el).transform),flatProjection);
    await page.locator('.kz-view-switch').getByRole('button',{name:'3D',exact:true}).click();
    await page.getByRole('button',{name:'Приблизить карту',exact:true}).click();
    await expect(page.locator('.kz-zoom-controls')).toContainText('120%');
    await page.getByRole('button',{name:'Сбросить вид карты',exact:true}).click();
    await expect(page.locator('.kz-zoom-controls')).toContainText('100%');
    await page.locator('.kz-map').getByRole("button",{name:"Астана",exact:true}).focus();
    await page.locator('.kz-map').getByRole("button",{name:"Астана",exact:true}).press("Enter");
    await expect(page.getByRole("radio")).toHaveCount(2);
    const otherCity=page.locator('.kz-map').getByRole('button',{name:'Алматы',exact:true});
    await page.mouse.move(0,0);await expect(otherCity).toHaveCSS('opacity','0.38');
    await otherCity.hover();await expect(otherCity).toHaveCSS('opacity','1');
    assert.equal(await otherCity.locator('.kz-city-dot').evaluate(el=>getComputedStyle(el).getPropertyValue('r')),'5px');
    await page.getByRole("radio",{name:"НИШ Астана-Нура",exact:true}).check();
    await expect(page.getByRole("button",{name:"Продолжить",exact:true})).toBeEnabled();
    await page.locator('.kz-map').getByRole("button",{name:"Алматы",exact:true}).click();
    await expect(page.getByRole("button",{name:"Продолжить",exact:true})).toBeDisabled();
    assert.equal(await page.getByRole("radio").evaluateAll(items=>items.some(input=>(input as HTMLInputElement).checked)),false);
    await page.getByRole("radio",{name:"НИШ Алматы-Медеу",exact:true}).check();
    failSchool=true;await page.getByRole("button",{name:"Продолжить",exact:true}).click();
    await expect(page.getByRole("alert")).toContainText("Не удалось сохранить школу");
    await expect(page.getByRole("radio",{name:"НИШ Алматы-Медеу",exact:true})).toBeChecked();
    await page.screenshot({path:join(out,"desktop-map-light.png"),fullPage:true});
    await page.getByRole("button",{name:"Продолжить",exact:true}).click();
    await expect(page.getByRole("heading",{name:"Теперь познакомимся",exact:true})).toBeFocused();
    await expect(page.locator('#profile-form')).toBeVisible();
    await expect(page.locator('.school-class-hint')).toContainText("пока не добавлены");
    await page.locator('[name=display_name]').fill("Тестовый ученик");
    await page.locator('.school-selection-summary').getByRole('button',{name:'Изменить',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Выберите город',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Продолжить',exact:true}).click();
    await expect(page.locator('[name=display_name]')).toHaveValue('Тестовый ученик');
    await page.locator('.top-subject-edit').first().click();
    await page.locator('.top-subject-modal-option').filter({hasText:'Математика'}).click();
    await page.getByRole('button',{name:'Открыть NIS Hub',exact:true}).click();
    await expect(page.locator('.fixture-complete')).toContainText('Тестовый ученик');
    const stored=(await db.query<{school_id:string;onboarding_completed_at:string}>("select school_id,onboarding_completed_at from profiles where id=$1",[id(1)])).rows[0];
    assert.equal(stored.school_id,'almaty-medeu');assert.ok(stored.onboarding_completed_at);
    await page.goto(origin+'/profile');await page.locator('.school-settings-summary').getByRole('button',{name:'Изменить',exact:true}).click();
    await page.locator('.kz-map').getByRole('button',{name:'Уральск',exact:true}).click();
    await page.getByRole('radio',{name:'НИШ Уральск',exact:true}).check();
    await page.getByRole('button',{name:'Сохранить школу',exact:true}).click();
    await expect(page.locator('.school-settings-summary')).toContainText('НИШ Уральск');
    assert.equal((await db.query<{school_id:string}>("select school_id from profiles where id=$1",[id(1)])).rows[0].school_id,'oral');
    await page.locator('[name=class_id]').selectOption(id(10));
    await page.locator('#profile-form button[type=submit]').click();
    await expect(page.locator('#profile-form')).toHaveAttribute('data-status','saved');
    await page.reload();
    await page.locator('.school-settings-summary').getByRole('button',{name:'Изменить',exact:true}).click();
    await page.locator('.kz-map').getByRole('button',{name:'Астана',exact:true}).click();
    await page.getByRole('radio',{name:'НИШ Астана',exact:true}).check();
    await expect(page.locator('.school-settings-editor > .school-class-hint')).toContainText('класс нужно будет выбрать заново');
    await page.getByRole('button',{name:'Сохранить школу',exact:true}).click();
    await expect(page.locator('.school-settings-summary')).toContainText('НИШ Астана');
    assert.equal((await db.query<{class_id:string|null}>("select class_id from profiles where id=$1",[id(1)])).rows[0].class_id,null);
    // Reset to a fresh first step for layout and locale verification.
    await db.exec('reset role');await db.query("update profiles set school_id=null,onboarding_completed_at=null where id=$1",[id(1)]);await asUser(db,id(1));
    for(const width of [320,390,768,1366])for(const locale of ['ru','kk','en']){
      await page.setViewportSize({width,height:768});await page.goto(origin+'/onboarding?locale='+locale);
      for(const theme of ['light','dark']){
        await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}/${locale}/${theme}: no overflow`);
        if(width<=680){await page.locator('.kz-city-select select').selectOption('shymkent');await expect(page.getByRole('radio')).toHaveCount(2);}
        else{await page.locator('.kz-map').getByRole('button',{name:locale==='ru'?'Шымкент':locale==='kk'?'Шымкент':'Shymkent',exact:true}).click();}
        await page.getByRole('radio').first().check();
        const button=page.locator('.school-onboarding-footer button');await expect(button).toBeEnabled();
        if(width===1366){
          await page.locator('.kz-view-switch').getByRole('button',{name:'2D',exact:true}).click();
          await expect(page.locator('.kz-map-depth')).toHaveCSS('opacity','0');
          await page.locator('.kz-view-switch').getByRole('button',{name:'3D',exact:true}).click();
          await expect(page.locator('.kz-map-depth')).toHaveCSS('opacity','1');
          await page.waitForTimeout(750);
          const box=await button.boundingBox();if(!box||box.y+box.height>768){
          console.log('LAYOUT',JSON.stringify(await page.evaluate(()=>({scrollX,scrollY,button:{background:getComputedStyle(document.querySelector('.school-continue')!).background,color:getComputedStyle(document.querySelector('.school-continue')!).color},parents:[...document.querySelectorAll('.onboarding-experience,.fixture-header,.school-onboarding,.school-onboarding-heading,.kz-school-picker,.kz-map,.kz-city-select,.kz-city-list,.school-onboarding-footer')].map(el=>({class:el.className,box:el.getBoundingClientRect().toJSON(),display:getComputedStyle(el).display,scrollLeft:el.scrollLeft,scrollTop:el.scrollTop}))}))));
          await page.screenshot({path:join(out,'laptop-layout.png'),fullPage:true});
        }assert.ok(box&&box.y+box.height<=768,'laptop continue button stays in view');}
        if(locale==='ru'&&[390,1366].includes(width))await page.screenshot({path:join(out,`${width}-${theme}.png`),fullPage:true});
      }
    }
    await page.emulateMedia({reducedMotion:'reduce'});await page.goto(origin+'/onboarding');
    assert.equal(await page.locator('.school-onboarding-screen').evaluate(el=>getComputedStyle(el).animationName),'none');
    assert.ok(schoolCalls>=3);assert.deepEqual(errors,[]);
  }finally{await browser?.close();if(server)await new Promise<void>(resolve=>server!.close(()=>resolve()));await db.close();}
});
