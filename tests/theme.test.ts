import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { parseTheme, themeBootstrap } from "../src/lib/theme";
test("theme accepts only light and dark, with a stable light default", () => {
  assert.equal(parseTheme("unknown"), "light");
  assert.equal(parseTheme("system"), "light");
  assert.equal(parseTheme(null), "light");
  assert.equal(parseTheme("light"), "light");
  assert.equal(parseTheme("dark"), "dark");
});
test("pre-paint script selects theme even when local storage is blocked", () => {
  for (const stored of ["light","dark","system","junk",null]) {
    const root = { dataset: {} as Record<string,string>, style: {} as Record<string,string> };
    let persisted: string | undefined;
    runInNewContext(themeBootstrap, { document: { documentElement: root }, localStorage: { getItem: () => stored, setItem: (_key: string, value: string) => { persisted = value; } } });
    assert.equal(root.dataset.theme, stored === "dark" ? "dark" : "light");
    assert.equal(persisted, root.dataset.theme);
    assert.equal(root.style.colorScheme, root.dataset.theme);
  }
  const root = {dataset:{},style:{}};
  assert.doesNotThrow(() => runInNewContext(themeBootstrap, { document:{documentElement:root},localStorage:{getItem(){throw new Error("denied")}},matchMedia:()=>({matches:false}) }));
  assert.deepEqual(root, { dataset: { theme: "light" }, style: { colorScheme: "light" } });
});
test("blocked writes retain a previously saved dark preference", () => {
  const root = { dataset: {}, style: {} };
  runInNewContext(themeBootstrap, { document: { documentElement: root }, localStorage: {
    getItem: () => "dark", setItem: () => { throw new Error("denied"); },
  } });
  assert.deepEqual(root, { dataset: { theme: "dark" }, style: { colorScheme: "dark" } });
});
