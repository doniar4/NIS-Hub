import {expect,type Page} from "@playwright/test";

/** Exercise the real control and persistence; a bare data-theme write races hydration. */
export async function selectTheme(page:Page, theme:string) {
  const input=page.locator('.theme-switch input[value="'+theme+'"]');
  await expect(input).toBeEnabled();
  if(!await input.isChecked()) await input.locator("..").click();
  await expect(input).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-theme",theme);
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem("nis-theme"))).toBe(theme);
}
