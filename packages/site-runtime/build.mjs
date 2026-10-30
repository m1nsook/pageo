import { mkdir, rm, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const output = join(root, "dist");
const entries = [
  join(root, "src", "index.js"),
  join(root, "src", "search.js"),
];
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const result = await Bun.build({
  entrypoints: entries,
  outdir: output,
  target: "browser",
  format: "iife",
  naming: "[name].js",
  minify: { whitespace: true, identifiers: true, syntax: true },
  sourcemap: "none",
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  throw new Error("Paglora site runtime bundling failed");
}
for (const file of ["index.js", "search.js"]) {
  const bytes = await readFile(join(output, file));
  if (!bytes.length || bytes.length > 65_536) {
    throw new Error(`Unexpected runtime bundle size for ${file}: ${bytes.length} bytes`);
  }
  console.log(`Runtime bundle: ${file} (${bytes.length} bytes)`);
}
