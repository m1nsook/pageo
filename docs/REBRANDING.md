# Paglora rebrand and legacy project compatibility

On October 30, 2026, the project name changed from **Pageo** to **Paglora**, and the official GitHub repository became [m1nsook/paglora](https://github.com/m1nsook/paglora). The unscoped `paglora` npm package was first published as `0.0.1-alpha.0`.

## What changed

- Desktop product name, window title, workspace labels and branding: **Paglora**.
- Rust package and library: `paglora` / `paglora_lib`.
- Internal TypeScript workspace packages: `@paglora/desktop` and `@paglora/core`.
- Public CLI: `paglora`, with executable command `paglora`.
- Repository URLs, docs, issue templates and published-site default footer text.

## What intentionally did not change

- **Tauri identifier: `com.m1nsook.pageo`**. This identifies existing Windows application data. Changing it now could make projects appear missing; keep it until a separately planned, tested storage migration exists.
- **Project format filename: `pageo.json`**. Existing and new v1 projects keep this file for read/write compatibility. Do not manually rename it.
- `pages.json`, `site.json`, `docs/*.md`, project IDs, page IDs, public/private flags and existing site settings.
- Existing projects and exported static sites on disk. An existing saved `footerText` set by a user is not silently rewritten; only the default for projects without saved settings uses Paglora.

The internal `PAGEO_PROJECT_FORMAT_VERSION` export remains as a compatibility alias for `PAGLORA_PROJECT_FORMAT_VERSION`.

## Installation and updates

When you pull the updated source from the renamed repository, run `bun install` to refresh the workspace links. Existing local project files should appear automatically when you launch Paglora Desktop. Verify the project list before deleting any old build directories.

The already-published `paglora@0.0.1-alpha.0` remains unchanged on npm. Updates to the CLI require publishing a **new** npm version; this repository prepares `0.0.1-alpha.1`, which is not automatically published by GitHub merges.

## Future migration policy

If a future release introduces `paglora.json`, a new app identifier, or a new storage location, it must preserve read access to old files and provide a safe, reversible migration with an explicit backup. Do not rename existing user folders or project manifests as part of a visual rebrand.
