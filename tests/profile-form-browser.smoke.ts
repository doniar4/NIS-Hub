import test from "node:test";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";

test("profile saves explicitly and retains edits after error and success", { timeout: 60_000 }, async () => {
  const bundle = await build({
    stdin: { contents: `
      import { createRoot } from 'react-dom/client';
      import { ActionForm } from './src/components/action-form';
      window.saves = [];
      async function save(state, form) {
        window.saves.push(Object.fromEntries(form));
        await new Promise(resolve => setTimeout(resolve, 100));
        return window.saves.length === 1 ? { error: 'Name taken' } : { success: 'Saved' };
      }
      createRoot(document.getElementById('root')).render(
        <ActionForm action={save} label="Save profile" manualSubmit>
          <input name="display_name" defaultValue="Original" required />
          <textarea name="bio" defaultValue="Original bio" />
          <select name="class_id" defaultValue="a"><option value="a">A</option><option value="b">B</option></select>
        </ActionForm>
      );`, resolveDir: process.cwd(), loader: "tsx" },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    plugins: [{ name: "fixtures", setup(api) {
      api.onResolve({ filter: /^@\/components\/(locale-provider|ui\/flame-button)$/ }, args => ({ path: args.path, namespace: "fixture" }));
      api.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({
        contents: args.path.endsWith("locale-provider")
          ? 'export const useI18n = () => ({ t: { pending: "Saving" } });'
          : 'export const FlameButton = () => null;', loader: "js",
      }));
    } }],
  });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.NIS_BROWSER_EXECUTABLE });
  try {
    const page = await browser.newPage();
    await page.setContent('<div id="root"></div>');
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const name = page.locator('[name="display_name"]');
    await name.fill("Edited");
    await page.locator('[name="bio"]').fill("Edited bio");
    await page.locator('[name="class_id"]').selectOption("b");
    await name.press("Enter");
    expect(await page.evaluate(() => (window as unknown as { saves: unknown[] }).saves)).toEqual([]);
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByRole("alert")).toHaveText("Name taken");
    await expect(name).toHaveValue("Edited");
    await expect(page.locator('[name="bio"]')).toHaveValue("Edited bio");
    await expect(page.locator('[name="class_id"]')).toHaveValue("b");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByRole("status")).toHaveText("Saved");
    await expect(name).toHaveValue("Edited");
    expect(await page.evaluate(() => (window as unknown as { saves: unknown[] }).saves)).toEqual([
      { display_name: "Edited", bio: "Edited bio", class_id: "b" },
      { display_name: "Edited", bio: "Edited bio", class_id: "b" },
    ]);
  } finally { await browser.close(); }
});
