import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { runInNewContext } from "node:vm";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("Google control renders only when enabled, with an accessible label and email fallback", async () => {
  const result = await build({
    entryPoints: [resolve("src/components/welcome-auth.tsx")], write: false, bundle: true,
    platform: "node", format: "cjs", jsx: "automatic", logLevel: "silent",
    external: ["react", "react/jsx-runtime"],
    plugins: [{ name: "oauth-button-boundary", setup(api) {
      api.onResolve({ filter: /^@\/app\/actions\/auth$/ }, () => ({ path: "auth", namespace: "fixture" }));
      api.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "fixture" }));
      api.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
        contents: args.path === "auth"
          ? "export async function startSocialSignIn(){return {error:'disabled'}}"
          : 'import React from "react";export default function Link({href,children}){return React.createElement("a",{href},children)}',
        loader: "js",
      }));
    } }],
  });
  const mod = { exports: {} as { WelcomeAuth: React.ComponentType<Record<string, unknown>> } };
  runInNewContext(result.outputFiles[0].text, { module: mod, exports: mod.exports, require });
  const props = { configured: true, signupForm: React.createElement("span", null, "Email form"), loginForm: React.createElement("span", null, "Password form") };
  const hidden = renderToStaticMarkup(React.createElement(mod.exports.WelcomeAuth, props));
  assert.ok(!hidden.includes("google-sign-in-button"));
  const shown = renderToStaticMarkup(React.createElement(mod.exports.WelcomeAuth, { ...props, googleEnabled: true }));
  assert.match(shown, /google-sign-in-button/);
  assert.match(shown, /Продолжить с Google/);
  assert.match(shown, /или по email/);
  assert.match(shown, /Email form/);
  assert.match(shown, /width="22" height="22"/);
});
