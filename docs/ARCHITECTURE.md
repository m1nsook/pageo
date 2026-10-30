# Pageo architecture (v0.1 foundation)

## Local-first and offline

The desktop frontend talks to a small Rust backend using Tauri commands. Only the Rust backend manages project files, and only inside the per-user Pageo application-data directory. Projects are not stored in browser localStorage.

## Packages

- `apps/desktop`: React and Tauri 2 desktop shell; `src/App.tsx` currently includes the starter dashboard and basic single-page editor.
- `packages/core`: Shared TypeScript definitions, format version, and project name validation. No public npm package is being published at v0.1.

## Project format

A directory with `pageo.json` (format v1) and `docs/index.md`. Project IDs are sanitized and validated before being joined into local filesystem paths. In later milestones, a `.pageo` archive will package this directory, but there is no custom archive format yet.

## Persistence

- New projects are created by `create_project` and include a Markdown home page.
- `load_project` reads metadata and Markdown into the visual editor.
- The editor debounces updates before calling `save_document`; leaving via its own back arrow also saves.
- To avoid discarding pending changes, the normal sidebar navigation is disabled while editing.

## Not yet included

Static website generation, a full block editor, file import, backups, Markdown/MDX extension compatibility, code snippets beyond basic code blocks, images, file conflict detection, and multi-user editing.

## Security notes

The desktop backend does not accept unrestricted filesystem paths from the UI. Local data is not sent to a server. For v0.1, project files are directly written; durable atomic writes and backup/version history must be implemented before public release.
