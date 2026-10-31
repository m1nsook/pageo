# Paglora

<img src="apps/desktop/public/paglora.svg" alt="Paglora logo" width="88" />

**Beautiful documentation, built locally and published anywhere.**

[![npm alpha version](https://img.shields.io/npm/v/paglora/alpha?style=flat-square&logo=npm&label=npm%20alpha)](https://www.npmjs.com/package/paglora?activeTab=versions)
[![npm monthly downloads](https://img.shields.io/npm/dm/paglora?style=flat-square&logo=npm&label=downloads%2Fmonth)](https://www.npmjs.com/package/paglora)
[![GitHub Actions CI](https://img.shields.io/github/actions/workflow/status/m1nsook/paglora/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/m1nsook/paglora/actions/workflows/ci.yml)
[![MIT license](https://img.shields.io/github/license/m1nsook/paglora?style=flat-square)](LICENSE)

Paglora is a **free, open-source, local-first documentation studio** built with Tauri 2, Rust, React, and TypeScript. Edit Markdown, design a responsive documentation website on a visual canvas, and export static files to host wherever you choose.

> [!IMPORTANT]
> **Early development.** The Windows desktop Studio is currently run from source; there is no stable desktop installer release. The published [`paglora` npm package](https://www.npmjs.com/package/paglora) is an **alpha CLI** for creating, inspecting, and validating projects. It does **not** build websites or install the desktop app.

## Features

### Desktop Studio

- **Local projects:** create and reopen documentation projects without accounts or a hosted backend.
- **Markdown editing:** Tiptap rich-text editor with local autosave and multi-page management (create, rename, duplicate, reorder, and delete).
- **Canvas-first workflow:** switch between **Edit**, **Split**, and **Canvas**; preview the actual site at desktop, tablet, and phone sizes with zoom and Fit.
- **Source-aware editing:** select rendered blocks, edit simple unformatted headings/paragraphs, and use the full editor for rich Markdown. The canvas is not yet a freeform layout designer.
- **Page organization:** collapsible navigation groups, page visibility, and Docs / Wide / Landing layouts.
- **Site design:** customize header, navigation position, links, article width, accent, appearance, optional Google Fonts, and project-owned CSS via the Monaco editor.

### Exported websites

- **Static and portable:** responsive HTML, CSS, bundled Geist font files, and two minified browser runtime scripts; no Paglora backend or account required for visitors.
- **Documentation navigation:** grouped/collapsible sidebars, public-page-only links, and active table-of-contents headings.
- **Offline MiniSearch:** Ctrl+K / Cmd+K opens an accessible search dialog backed by a bundled MiniSearch index, with prefix matching, typo-tolerant fallback, and Korean/Japanese/Chinese substring support. `search-index.json` contains **only public pages**.
- **Appearance:** Light / Dark / System switching with a remembered browser preference where storage is available.
- **Content features:** callouts (`NOTE`, `TIP`, `IMPORTANT`, `WARNING`, `CAUTION`), code-block Copy buttons, Unicode heading permalinks, task lists, collapsible disclosures, and Markdown tables.
- **Local images:** import PNG, JPEG, WebP, and GIF files into a project; only images referenced by public pages or the site logo are copied into the static export.
- **Multilingual foundations:** choose the document language from 18 options (including Korean, Polish, Japanese, Chinese, and Arabic); Arabic exports use RTL layout. This does not automatically translate content.
- **SEO for static hosts:** optional HTTPS site root produces per-page canonical URLs and a public-page-only `sitemap.xml`, with page-specific descriptions and social metadata.
- **Safe publication:** Markdown HTML is sanitized before export; pages marked private are excluded from the published site, search index, and sitemap.

**Current limitations:** Studio's inline preview deliberately disables site scripts, so browser interactions must be checked in the exported site. There is no automatic content translation, arbitrary TSX/MDX component execution, one-click hosting deployment, or fully freeform Figma-style canvas yet. The Windows Studio still needs hands-on UI verification.

## Get started

### Run the desktop Studio

Paglora Desktop is currently developed and checked on **Windows**. You'll need [Bun](https://bun.sh/), [Rust](https://rustup.rs/), and the required Windows C++ tools and WebView2 dependencies listed in the [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/). Install [Node.js 20+](https://nodejs.org/) if you also want to run the standalone Node test commands below.

Open the repository in GitHub Desktop, then from the repository root:

```powershell
bun install
bun run desktop
```

Frontend-only development (without Tauri filesystem access):

```powershell
bun run dev
```

Run frontend checks and tests:

```powershell
bun run check
bun run build
node --test apps/desktop/test/*.test.mjs
node --test packages/site-runtime/test/*.test.mjs
```

### Use the npm CLI

The public alpha package supports `init`, `inspect`, and `validate`:

```powershell
bunx --bun paglora@alpha init .\my-docs --name "My Docs"
bunx --bun paglora@alpha inspect .\my-docs
bunx --bun paglora@alpha validate .\my-docs
```

The new directory must not already exist. The CLI never overwrites existing folders. It creates the canonical `paglora.json`, `pages.json`, `docs/index.md`, and `theme/custom.css` files.

> [!NOTE]
> Studio currently discovers projects in its own application data `projects/` directory, shown under **Settings → Local project storage**. A project created elsewhere with the CLI will not appear in Studio automatically. Project import is planned.

CLI checks and package preview from the repository root:

```powershell
cd packages/cli
bun run test
npm.cmd pack --dry-run
```

On Windows, use `npm.cmd` when PowerShell blocks `npm.ps1` under the system's execution policy. This does not require changing security settings. On macOS/Linux use `npm` instead.

## Build and publish a website

1. Open a project in **Paglora Desktop**, write your pages, and set their visibility.
2. Configure the site in **Design site**; review it in **Preview site**.
3. Select **Website → Build static site**.
4. Upload the **entire contents** of the generated output folder to your static host (for example, GitHub Pages).

Typical output:

```text
index.html
getting-started.html
styles.css
paglora.js
paglora-search.js
search-index.json
sitemap.xml           (if an HTTPS site URL is configured)
custom.css            (if configured)
assets/               (if public pages or logo reference local images)
fonts/                (Geist font and license)
licenses/             (MiniSearch MIT license)
```

The site can be read without JavaScript, but search, appearance switching, code copying, and active heading highlighting need the shipped runtime files. Serve the **entire export** over **HTTP(S)** rather than opening `file://` HTML directly: local file restrictions can prevent the search index from loading. For GitHub Pages project sites, configure the canonical HTTPS URL with its repository path (for example, `https://username.github.io/repository/`). The current Studio canvas is a **script-disabled preview**; test interactive features in the exported site.

## Release readiness

**Published npm CLI:** [`paglora@0.0.1-alpha.3`](https://www.npmjs.com/package/paglora?activeTab=versions) is available under the `alpha` dist-tag (confirmed October 31, 2026). Install it with `bun add --global paglora@alpha` or run `bunx --bun paglora@alpha --help`. The npm `latest` tag is intentionally separate and currently points to the original `0.0.1-alpha.0` preview; use `@alpha` for the newer CLI. This release includes stricter argument validation, Unicode-safe project labels, public Overview enforcement, and package checks on Windows and Ubuntu. **Static site builds still require Paglora Desktop**; the CLI does not create websites. Automated tests passed, but Windows Studio and exported site interactions still require hands-on smoke testing. Future prereleases require a new package version and authenticated npm publication; CI does not automatically publish.

## Local project format

Paglora stores its project files locally under the Tauri app identifier `com.m1nsook.paglora`:

```text
paglora.json           Project ID, name, and format version
pages.json             Page order, titles, groups, layouts, visibility
site.json              Site settings (created when saved)
docs/index.md          Public Overview page
docs/<page-id>.md      Additional Markdown pages
theme/custom.css       User-owned CSS overrides
```

**Early-alpha format break:** the old Pageo manifest and application identifier are no longer supported. Existing prototype folders are **not deleted**, but they are not automatically imported into Paglora. Back up earlier test projects before upgrading.

## Repository layout

```text
apps/desktop/          React Studio and Tauri/Rust desktop backend
packages/core/         Shared project format helpers
packages/cli/          Public `paglora` npm alpha CLI
packages/site-runtime/ Browser-side enhancements for exported sites
```

## Documentation

The official documentation is being authored **with Paglora itself** in the separate private `m1nsook/paglora-docs` repository. It includes a real Paglora project that will eventually serve as both the user guide and a live GitHub Pages demo. It is not publicly deployed yet.

## Contributing and license

Paglora is MIT-licensed — see [LICENSE](LICENSE). Created by [m1nsook](https://github.com/m1nsook). Contributions and focused issue reports are welcome: read [CONTRIBUTING.md](CONTRIBUTING.md), [open an issue](https://github.com/m1nsook/paglora/issues), or see [SECURITY.md](SECURITY.md) for private vulnerability reporting.
