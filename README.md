# Paglora

<img src="apps/desktop/public/paglora.svg" alt="Paglora official logo" width="88" />

**Beautiful docs, built your way.**

Paglora is an open-source, local-first desktop documentation studio. Write and organize documentation, visually customize the public website, and export a static site you can host anywhere.

> **Early development · 0.1 desktop preview.** There is no stable desktop release yet. The public npm package `paglora` is an early-alpha project inspection CLI, **not** a desktop app installer or static site generator yet.

## What works today

- **Tauri 2 desktop application**, React 19, Vite, TypeScript, Tailwind CSS 4, and official shadcn/ui components.
- **Local project dashboard** with create, reopen and metadata management. Projects require no account, database, telemetry, or cloud service.
- **Multi-page documentation editor** with Markdown persistence, create/rename/duplicate/delete/reorder page actions, formatting toolbar and initial drag-and-drop Markdown block tools.
- **Public/private pages**, with Overview remaining public.
- **Navigation groups** for organizing published sidebar sections, configurable per page in Studio.
- **Static website publishing**: real multi-page HTML with shared responsive CSS, public-page navigation, header, footer and sanitized Markdown.
- **Live public-site preview** with desktop/tablet/mobile widths.
- **Website layout designer** for header alignment, external logo URL, header/footer links, navigation placement and article width.
- **Paglora CLI** (`paglora@alpha` on npm) for inspecting and validating local project folders.

Not implemented yet: fully freeform website design and component property editing; interactive shadcn blocks in published output; local asset packaging; portable project backups; built-in search; automated deployment; production-ready theme presets.

## Development

Use Windows 11 with [Bun](https://bun.sh/) and [Rust](https://rustup.rs/). Tauri also requires the Windows C++ build tools and WebView2; see the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

In the repository root:

```powershell
bun install
bun run desktop
```

Frontend-only development:

```powershell
bun run dev
```

The frontend browser preview cannot open real local projects: filesystem operations require Paglora Desktop.

Checks and frontend build:

```powershell
bun run check
bun run build
```

CLI tests and package preview:

```powershell
cd packages/cli
bun run test
npm pack --dry-run
```

## Project structure

```text
apps/desktop/          Paglora desktop application and Rust Tauri backend
packages/core/         Internal shared types and format helpers
packages/cli/          Published `paglora` npm CLI (early alpha)
docs/                  Architecture, compatibility and publishing instructions
```

## Project source customization

Each project can edit its own `theme/custom.css` through the integrated **Monaco Code Editor** in **Source**. This is a real local stylesheet applied after the built-in styles in both site preview and static export. TSX component and layout compilation is not yet implemented. See [source workspace](docs/source-workspace.md).

## Project files and application storage

Paglora uses its own Tauri application identifier, `com.m1nsook.paglora`. New projects are stored in the app-specific local data folder. In **Settings → Local project storage**, you can see the exact folder on your machine.

Each project contains:

```text
paglora.json          Project metadata (format version 1)
pages.json            Page IDs, titles, layouts, order, and visibility
site.json             Website settings (created when saved)
docs/index.md         Overview Markdown
docs/<page-id>.md     Additional Markdown pages
theme/custom.css      User-owned site stylesheet
```

**Breaking change during early development:** Paglora no longer reads the former prototype's project manifest or application storage location. Existing local files in that older directory are not deleted, but are not automatically imported into the new app. Back up any earlier test projects before switching. The previously published npm alpha package may use the old format until a new version is published.

See the [architecture](docs/ARCHITECTURE.md) and [static site publishing](docs/static-site-publishing.md) guides.

## Static site workflow

Open a project → choose which pages are public → **Design site** → **Preview site** → **Website → Build static site**. Upload the generated directory contents to a static host. No Paglora server runtime or account is needed for the published site. Optional Google Fonts and external resources work when the hosting/visitor network allows them.

## CLI

The `paglora` npm package is published as an early alpha. The initial release was `0.0.1-alpha.0`; the CLI in this repository may represent a later prerelease until published.

```powershell
bunx --bun paglora@alpha --help
bunx --bun paglora@alpha inspect "C:\path\to\projects\my-docs"
```

CLI support for generating sites is planned but not available in the published alpha.

## License

[MIT](LICENSE) · Created by [m1nsook](https://github.com/m1nsook). Contributions are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md).
