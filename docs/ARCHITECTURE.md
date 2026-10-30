# Paglora architecture

Paglora is a local-first documentation studio with a Tauri 2 desktop shell, React + TypeScript frontend, Rust file I/O and static website publishing.

## Workspace

- `apps/desktop`: desktop UI with project dashboard, Tiptap Markdown editor, pages sidebar, visual block tools, site designer and live site preview.
- `apps/desktop/src-tauri`: scoped Rust commands for project storage, page operations, site settings and generation of static HTML.
- `packages/core`: internal `@paglora/core` package with shared project types and validation.
- `packages/cli`: public npm package `paglora`, currently implementing read-only `inspect` and `validate` commands. Its static build command is not implemented yet.

## Local persistence and backwards compatibility

The previous application was called Pageo. For v1 project format compatibility, existing directories still contain:

```text
pageo.json
pages.json
site.json
docs/index.md
docs/<page-id>.md
```

The unchanged Tauri app identifier `com.m1nsook.pageo` controls its per-user application-data path on Windows. Changing that identifier without a careful migration would hide existing user projects under a different folder. The visible desktop title, Rust crate, npm package and UI brand are Paglora; the storage key and project manifest filename remain intentionally legacy.

The project format version is still 1. All existing page IDs, Markdown contents, and site settings are retained. Do not change the on-disk filename or app identifier in routine brand edits. See [REBRANDING.md](REBRANDING.md).

## Editor and backend

Tiptap with the Markdown extension edits a selected Markdown file. The React editor debounces updates and uses an ordered save queue before navigating, exporting or previewing. The pages manifest tracks titles and publication flags. Rust validates project/page identifiers before opening files.

## Publishing

`build_site` reads public page metadata, validates the content set and settings, and produces a static HTML/CSS folder under application data. The frontend uses Marked plus a restricted sanitization allowlist before passing rendered page markup to Rust. `preview_site_page` uses the **same Rust site renderer and CSS** but returns an HTML string instead of writing to disk. The site designer previews unsaved settings using that command; only Save persists them.

Private pages are excluded from the HTML output; privacy is not an access-control policy for manually uploaded source files. No publishing service is contacted.

## Current limits

The public site layout offers configurable header/footer/nav and limited links; it is not yet a fully freeform React/shadcn builder. Local assets are not copied during export, and interactive shadcn components do not currently survive conversion to plain Markdown static HTML. A future structured document format will be required, with backward compatibility.
