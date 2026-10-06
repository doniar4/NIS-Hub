import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { build } from "esbuild";

test("Actual Velaris redraws a cleared resize buffer before observer returns and ignores unchanged dimensions", async () => {
  const output = await build({ entryPoints: ["src/components/ui/velaris.tsx"], bundle: true, write: false,
    platform: "node", format: "cjs", jsx: "automatic", plugins: [{ name: "lifecycle-boundary", setup(api) {
      api.onResolve({ filter: /^react(?:\/jsx-runtime)?$/ }, ({ path }) => ({ path, namespace: "fixture" }));
      api.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({ loader: "js", contents: path === "react"
        ? "export const useRef=()=>globalThis.nextRef();export const useEffect=fn=>globalThis.mount(fn);"
        : "export const jsx=(type,props)=>({type,props});export const jsxs=jsx;" }));
    } }] });
  const operations: unknown[][] = [];
  const gl = new Proxy({}, { get: (_, key) => {
    if (key === "TRIANGLE_STRIP") return 5;
    if (key === "getUniformLocation") return (_program: unknown, name: string) => name;
    return (...args: unknown[]) => { operations.push([key, ...args]); return {}; };
  } });
  let width = 300, height = 150;
  const canvas = { getContext: () => gl,
    get width() { return width; }, set width(value: number) { width = value; operations.push(["clear-width", value]); },
    get height() { return height; }, set height(value: number) { height = value; operations.push(["clear-height", value]); } };
  const container = { clientWidth: 390, clientHeight: 844 };
  const refs = [{ current: canvas }, { current: container }];
  let refIndex = 0, observerCallback = () => {}, cleanup = () => {}, disconnected = false;
  const frames: FrameRequestCallback[] = [];
  const context = vm.createContext({ module: { exports: {} }, exports: {},
    nextRef: () => refs[refIndex++], mount: (effect: () => () => void) => { cleanup = effect(); },
    ResizeObserver: class {
      constructor(callback: () => void) { observerCallback = callback; }
      observe() {} disconnect() { disconnected = true; }
    },
    requestAnimationFrame: (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; },
    cancelAnimationFrame() {}, window: { devicePixelRatio: 2, addEventListener() {}, removeEventListener() {} },
  });
  vm.runInContext(output.outputFiles[0].text, context);
  const component = context.module.exports.default;
  component({});
  observerCallback();
  assert.equal(width, 585); assert.equal(height, 1266, "DPR remains capped at 1.5");
  assert.equal(operations.filter(op => op[0] === "drawArrays").length, 0, "do not draw with uninitialized uniforms");
  frames.shift()!(16);
  assert.equal(operations.filter(op => op[0] === "drawArrays").length, 1);
  operations.length = 0;
  container.clientHeight = 700;
  observerCallback();
  assert.deepEqual(operations, [["clear-width", 585], ["clear-height", 1050], ["viewport", 0, 0, 585, 1050],
    ["uniform2f", "u_resolution", 585, 1050], ["drawArrays", 5, 0, 4]], "resize redraw is synchronous, not deferred to next rAF");
  operations.length = 0;
  observerCallback(); assert.deepEqual(operations, [], "unchanged observer notifications cannot clear the buffer");
  frames.shift()!(32); assert.ok(operations.some(op => op[0] === "drawArrays"), "ambient animation continues");
  cleanup(); assert.equal(disconnected, true);
});
