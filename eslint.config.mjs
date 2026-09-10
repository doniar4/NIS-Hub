import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  // Vendored PDF.js assets are copied from node_modules by predev/prebuild.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "public/pdfjs/**"]),
]);
