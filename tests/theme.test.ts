import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { parseTheme, resolvedTheme, themeBootstrap } from "../src/lib/theme";
test("theme validates preferences and honors system", () => {
  assert.equal(parseTheme("unknown"), "system");
  assert.equal(resolvedTheme("system", true), "dark");
  assert.equal(resolvedTheme("system", false), "light");
  assert.equal(resolvedTheme("light", true), "light");
  assert.equal(resolvedTheme("dark", false), "dark");
});
test("pre-paint script selects theme even when local storage is blocked", () => {
  for (const stored of ["light","dark","system","junk",null]) {
    const root = { dataset: {} as Record<string,string>, style: {} as Record<string,string> };
    runInNewContext(themeBootstrap, { document: { documentElement: root }, localStorage: { getItem: () => stored }, matchMedia: () => ({matches:true}) });
    assert.equal(root.dataset.theme, stored === "light" ? "light" : "dark");
    assert.equal(root.style.colorScheme, root.dataset.theme);
  }
  const root = {dataset:{},style:{}};
  assert.doesNotThrow(() => runInNewContext(themeBootstrap, { document:{documentElement:root},localStorage:{getItem(){throw new Error("denied")}},matchMedia:()=>({matches:false}) }));
});
