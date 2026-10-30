#!/usr/bin/env node
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"));
const ID = /^[a-z0-9-]{1,80}$/;

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`Could not read ${file}: ${error.message}`);
  }
}

/** Create a standalone Paglora project in a fresh folder.
 * The target must not exist, so this command never overwrites user files.
 */
export function initProject(folder, name = basename(resolve(folder))) {
  const directory = resolve(folder);
  const id = basename(directory);
  const projectName = name.trim();
  if (!ID.test(id)) throw new Error("Project folder must be a lowercase slug (1–80 letters, digits or hyphens).");
  if (!projectName || [...projectName].length > 80 || /[\x00-\x1f\x7f]/.test(projectName)) {
    throw new Error("Project name must be 1–80 characters without control characters.");
  }
  if (existsSync(directory)) throw new Error("Project directory already exists. Choose a new directory.");
  mkdirSync(directory);
  try {
    const seconds = Math.floor(Date.now() / 1000);
    const metadata = { formatVersion: 1, id, name: projectName, createdAt: seconds, updatedAt: seconds };
    const manifest = { formatVersion: 1, pages: [
      { id: "index", title: "Overview", isPublic: true, layout: "docs", navGroup: "Documentation" },
    ] };
    mkdirSync(join(directory, "docs"));
    mkdirSync(join(directory, "theme"));
    writeFileSync(join(directory, "paglora.json"), JSON.stringify(metadata, null, 2) + "\n", { flag: "wx" });
    writeFileSync(join(directory, "pages.json"), JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" });
    writeFileSync(join(directory, "docs", "index.md"), "# " + projectName + "\n\nWelcome to your documentation. Start writing here.\n", { flag: "wx" });
    writeFileSync(join(directory, "theme", "custom.css"), "/* Paglora project theme. Override site styles here. */\n", { flag: "wx" });
    return inspectProject(directory);
  } catch (error) {
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

export function inspectProject(folder) {
  const directory = resolve(folder);
  const configFile = join(directory, "paglora.json");
  if (!existsSync(configFile)) throw new Error("No paglora.json found. Pass a Paglora project directory.");
  const config = readJson(configFile);
  if (config.formatVersion !== 1 || typeof config.id !== "string" || !ID.test(config.id) ||
    config.id !== basename(directory) || typeof config.name !== "string" || !config.name.trim()) {
    throw new Error("Invalid paglora.json: expected format version 1 and matching project identifier.");
  }
  const manifestFile = join(directory, "pages.json");
  if (!existsSync(manifestFile)) throw new Error("No pages.json found in Paglora project.");
  const pagesManifest = readJson(manifestFile);
  if (pagesManifest.formatVersion !== 1) throw new Error("Unsupported pages.json format version.");
  const pages = pagesManifest.pages;

  if (!Array.isArray(pages) || pages.length < 1 || pages.length > 500 || pages[0]?.id !== "index") {
    throw new Error("Invalid page manifest: Overview must be the first page.");
  }
  const seen = new Set();
  for (const page of pages) {
    if (!page || typeof page.id !== "string" || !ID.test(page.id) || seen.has(page.id) ||
      typeof page.title !== "string" || !page.title.trim() || page.title.length > 100) {
      throw new Error("Invalid page identifier, title or duplicate entry in pages.json.");
    }
    if (typeof page.isPublic !== "boolean") {
      throw new Error(`Invalid public/private flag for page ${page.id}.`);
    }
    if (page.id === "index" && !page.isPublic) {
      throw new Error("Overview must remain public.");
    }
    if (!existsSync(join(directory, "docs", `${page.id}.md`))) {
      throw new Error(`Missing docs/${page.id}.md`);
    }
    if (page.navGroup !== undefined && (typeof page.navGroup !== "string" ||
      !page.navGroup.trim() || page.navGroup !== page.navGroup.trim() ||
      page.navGroup.length > 60)) throw new Error(`Invalid navigation group for ${page.id}.`);
    if (!["docs", "wide", "landing"].includes(page.layout)) {
      throw new Error(`Unsupported page layout for ${page.id}.`);
    }
    seen.add(page.id);
  }
  const siteFile = join(directory, "site.json");
  const site = existsSync(siteFile) ? readJson(siteFile) : null;
  if (site !== null && (typeof site.title !== "string" || !site.title.trim())) {
    throw new Error("Invalid site.json: site title must not be empty.");
  }
  return {
    name: config.name,
    id: config.id,
    folder: directory,
    pageCount: pages.length,
    publicCount: pages.filter(page => page.isPublic).length,
    pages: pages.map(page => ({ id: page.id, title: page.title, isPublic: page.isPublic, layout: page.layout, navGroup: page.navGroup ?? "Documentation" })),
    siteTitle: site?.title ?? config.name,
  };
}

const HELP = `Paglora CLI (early alpha)

Usage:
  paglora init <new-folder> [--name "My Docs"]  Create a Paglora project
  paglora inspect <project-folder> [--json]  Show project and page details
  paglora validate <project-folder>         Check local project structure
  paglora --version                         Print CLI version
  paglora --help                            Show this help

Static site builds currently run through Paglora Desktop.
Documentation: https://github.com/m1nsook/paglora
`;

export function run(args, output = process.stdout, errors = process.stderr) {
  const [command, ...rest] = args;
  if (!command || command === "--help" || command === "-h" || command === "help") {
    output.write(HELP);
    return 0;
  }
  if (command === "--version" || command === "-v") {
    output.write(pkg.version + "\n");
    return 0;
  }
  if (command === "init") {
    const folder = rest.find(value => !value.startsWith("--"));
    const nameIndex = rest.indexOf("--name");
    const name = nameIndex >= 0 ? rest[nameIndex + 1] : undefined;
    if (!folder || (nameIndex >= 0 && (!name || name.startsWith("--")))) {
      errors.write('Usage: paglora init <new-folder> [--name "My Docs"]\n');
      return 1;
    }
    try {
      const details = initProject(folder, name);
      output.write("Created Paglora project: " + details.name + "\nDirectory: " + details.folder + "\n");
      return 0;
    } catch (error) {
      errors.write("Paglora: " + error.message + "\n");
      return 1;
    }
  }
  if (command !== "inspect" && command !== "validate") {
    errors.write(`Unknown command: ${command}\n\n${HELP}`);
    return 1;
  }
  const json = rest.includes("--json");
  const folder = rest.find(value => !value.startsWith("--"));
  if (!folder) {
    errors.write("Missing project directory. Example: paglora inspect ./projects/my-docs\n");
    return 1;
  }
  try {
    const details = inspectProject(folder);
    if (json) output.write(JSON.stringify(details, null, 2) + "\n");
    else if (command === "validate") output.write(`Valid documentation project: ${details.name} (${details.pageCount} pages)\n`);
    else {
      output.write(`Documentation project: ${details.name}\nDirectory: ${details.folder}\nWebsite: ${details.siteTitle}\nPages: ${details.pageCount} (${details.publicCount} public)\n`);
      for (const page of details.pages) {
        output.write(`  ${page.isPublic ? "[public] " : "[private]"} ${page.title} (${page.id}.md) · ${page.navGroup} · ${page.layout}\n`);
      }
    }
    return 0;
  } catch (error) {
    errors.write(`Paglora: ${error.message}\n`);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = run(process.argv.slice(2));
}
