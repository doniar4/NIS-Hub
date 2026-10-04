import type { Plugin } from "esbuild";
/** Old layout suites do not assert persistence; the dedicated reader suite does. */
export const readerActionBoundary: Plugin = {
  name: "reader-personal-fixture",
  setup(api) {
    api.onResolve(
      { filter: /^@\/app\/actions\/(highlights|library)$/ },
      (a) => ({ path: a.path, namespace: "reader-personal" }),
    );
    api.onLoad({ filter: /.*/, namespace: "reader-personal" }, () => ({
      loader: "js",
      contents:
        "export const getHighlights=async()=>({ok:true,userId:'fixture',highlights:[]});export const saveHighlight=async()=>({ok:true});export const deleteHighlight=async()=>({ok:true});export const changeLibrary=async()=>({ok:true});",
    }));
  },
};
