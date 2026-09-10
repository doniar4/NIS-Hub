import { cpSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const source = dirname(require.resolve("pdfjs-dist/package.json"));
const destination = fileURLToPath(new URL("../public/pdfjs/", import.meta.url));
mkdirSync(destination, { recursive: true });
for (const directory of ["cmaps", "standard_fonts", "wasm", "iccs"]) {
  cpSync(join(source, directory), join(destination, directory), { recursive: true });
}
cpSync(join(source, "LICENSE"), join(destination, "LICENSE"));
