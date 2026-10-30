# Pageo

**Beautiful docs, built your way.**

Pageo is an open-source, local-first documentation studio. Create documentation visually on your desktop, keep the editable source in your own files, and (in a later milestone) export a static website ready to publish anywhere.

> **Early development — v0.1.0 foundation, not a published release.** The editor is intentionally limited to a single Markdown page. Static publishing, `.pageo` project archives, multi-page navigation, and the public npm CLI are **not implemented yet**.

## Currently implemented

- Desktop app foundation with **Tauri 2**, **React**, **TypeScript**, **Vite**, **Tailwind CSS 4** and **shadcn/ui-compatible components**.
- Local project dashboard, project creation and reopening.
- Visual Markdown editor (basic headings, lists, inline formatting and code blocks).
- Debounced autosave, stored in Pageo's application data directory.
- Browser-only UI preview (local file operations require the desktop app).
- Shared `@pageo/core` package for common project types.

## Development on Windows

Install:

- [Bun](https://bun.sh/) (supported project tooling).
- [Rust via rustup](https://rustup.rs/).
- Visual Studio 2022 C++ build tools / **Desktop development with C++** workload and Microsoft Edge WebView2 runtime, if not already available. See [Tauri's Windows prerequisites](https://v2.tauri.app/start/prerequisites/).

In the repository root, open a terminal and run:

```powershell
bun install
bun run desktop
```

Tauri compiles the Rust desktop backend on first launch. This is a development build, not a Windows installer.

To preview the frontend without launching Tauri:

```powershell
bun run dev
```

The browser preview cannot create or edit real projects. It deliberately displays a notice explaining that local filesystem operations need the desktop app.

For checks and a frontend build:

```powershell
bun run check
bun run build
```

After a successful run, commit the generated `bun.lock` and (if produced) `apps/desktop/src-tauri/Cargo.lock` using GitHub Desktop. **Do not** commit `node_modules`, `dist`, or Rust's `target` directory.

## Workspace layout

```text
apps/desktop/       Tauri desktop shell and React visual editor
packages/core/      Shared project types and helpers
```

Projects are stored under Pageo's application data directory in `projects/<project-id>/`:

```text
pageo.json          Project metadata and format version
docs/index.md       Editable Markdown document
```

The actual location is shown in **Settings → Local project storage** inside Pageo Desktop. No account, database, or external service is used.

## Roadmap

- v0.1.x: Stabilize desktop foundation and project saving.
- v0.2: Multi-page visual editor and navigation.
- v0.3: Import/export portable `.pageo` project backups.
- v0.4: Static site generation and publishing wizard.
- v0.5: Published npm package and CLI.

## Development status

This repository is in active early development. The Tiptap Markdown extension used for the editor is currently marked **beta** upstream, so the starter deliberately supports only basic Markdown. Avoid editing complex imported Markdown files until round-trip tests are in place.

## License

[MIT](LICENSE) · Created by [m1nsook](https://github.com/m1nsook).
