# Paglora architecture

Paglora is a local-first documentation studio with a Tauri 2 desktop shell, React + TypeScript frontend, Rust file I/O and static website publishing.

## Workspace

- `apps/desktop`: desktop UI with project dashboard, Tiptap Markdown editor, pages sidebar, visual block tools, site designer and live site preview.
- `apps/desktop/src-tauri`: scoped Rust commands for project storage, page operations, site settings and generation of static HTML.
- `packages/core`: internal `@paglora/core` package with shared project types and validation.
- `packages/cli`: public npm package `paglora`, currently implementing read-only `inspect` and `validate` commands. Its static build command is not implemented yet.

## Local persistence

Paglora Desktop uses Tauri application identifier `com.m1nsook.paglora` and stores projects in the application's own local data directory under `projects/`.

```text
paglora.json
pages.json
docs/index.md
theme/custom.css
site.json                (written when site settings are saved)
docs/<page-id>.md       (created for additional pages)
```

`paglora.json` contains the project ID, name, format version 1, and timestamps. `pages.json` is created with the project, with an explicit visibility flag and layout for every page. `site.json` is optional until the user saves site settings.

The abandoned prototype's storage identifier and manifest are no longer recognized. Changing to Paglora's application identifier does not delete earlier files on disk, but older projects will not appear automatically in the new app. Because this project is in early development, this is an intentional breaking change, not an automatic migration.

## Editor and backend

Tiptap with the Markdown extension edits a selected Markdown file. The React editor debounces updates and uses an ordered save queue before navigating, exporting or previewing. The pages manifest tracks titles and publication flags. Rust validates project/page identifiers before opening files.

## Publishing

`build_site` reads public page metadata, validates the content set and settings, and produces a static HTML/CSS folder under application data. The frontend uses Marked plus a restricted sanitization allowlist before passing rendered page markup to Rust. `preview_site_page` uses the **same Rust site renderer and CSS** but returns an HTML string instead of writing to disk. The site designer previews unsaved settings using that command; only Save persists them.

Private pages are excluded from the HTML output; privacy is not an access-control policy for manually uploaded source files. No publishing service is contacted.

## Current limits

The public site layout offers configurable header/footer/nav and limited links; it is not yet a fully freeform React/shadcn builder. Local assets are not copied during export, and interactive shadcn components do not currently survive conversion to plain Markdown static HTML. A future structured document format will require an explicit, tested upgrade path.
