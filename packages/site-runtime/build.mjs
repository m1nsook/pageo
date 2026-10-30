import { mkdir, rm, readFile, rename, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const output = join(root, "dist");
const staging = join(root, ".dist-staging");
const backup = join(root, ".dist-previous");
const entries = [
  join(root, "src", "index.js"),
  join(root, "src", "search.js"),
];

async function exists(path) {
  try { await stat(path); return true; }
  catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

// Keep the last known-good production bundle intact if compilation fails.
await rm(staging, { recursive: true, force: true });
await mkdir(staging, { recursive: true });
try {
  const result = await Bun.build({
    entrypoints: entries,
    outdir: staging,
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
    const bytes = await readFile(join(staging, file));
    if (!bytes.length || bytes.length > 65_536) {
      throw new Error(`Unexpected runtime bundle size for ${file}: ${bytes.length} bytes`);
    }
    console.log(`Runtime bundle: ${file} (${bytes.length} bytes)`);
  }

  // Swap only after every entry is verified. Restore the old output if
  // promotion fails, including on Windows where rename may reject open files.
  await rm(backup, { recursive: true, force: true });
  const hadOutput = await exists(output);
  if (hadOutput) await rename(output, backup);
  try {
    await rename(staging, output);
  } catch (error) {
    if (hadOutput) await rename(backup, output);
    throw error;
  }
  await rm(backup, { recursive: true, force: true });
} finally {
  await rm(staging, { recursive: true, force: true });
}
