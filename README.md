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

## Current desktop milestone

**Paglora Desktop 0.2.0 (development source)** expands the 0.1.0 foundation with offline MiniSearch, local image imports, RTL/language metadata, public-only SEO exports, reusable document elements, and a new **website publishing report**. After each build, Studio reports public/private page counts, bundled image count, and warnings for links to missing or private pages.

The version is synchronized across the workspace, Windows Tauri app, and Rust package. **This is not an installer release**; Windows desktop and exported browser interactions still require hands-on testing. The independent npm CLI remains `paglora@0.0.1-alpha.3`. See [CHANGELOG.md](CHANGELOG.md).

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
- **Content features:** callouts (`NOTE`, `TIP`, `IMPORTANT`, `WARNING`, `CAUTION`), responsive cards, guided steps, keyboard-accessible code groups, code-block Copy buttons, Unicode heading permalinks, task lists, collapsible disclosures, and Markdown tables.
- **Local images:** import PNG, JPEG, WebP, and GIF files into a project; only images referenced by public pages or the site logo are copied into the static export.
- **Multilingual foundations:** choose among 18 built-in document languages plus any newly synchronized and reviewed community language packs. Right-to-left direction can come from package metadata (Arabic remains RTL by default). This does not automatically translate content.
- **SEO for static hosts:** optional HTTPS site root produces per-page canonical URLs and a public-page-only `sitemap.xml`, with page-specific descriptions and social metadata.
- **Safe publication:** Markdown HTML is sanitized before export; pages marked private are excluded from the published site, search index, and sitemap.

**Current limitations:** Studio's inline preview deliberately disables site scripts, so browser interactions must be checked in the exported site. There is no automatic content translation, arbitrary TSX/MDX component execution, one-click hosting deployment, or fully freeform Figma-style canvas yet. The Windows Studio still needs hands-on UI verification.

### Guided steps in Markdown

Use the **Steps** block in Studio's Insert palette, or write standard Markdown with a `[!STEPS]` blockquote marker. The ordered list remains accessible and renders without JavaScript in both Studio preview and static exports:

```md
> [!STEPS] Getting started
>
> 1. Install the dependencies.
> 2. Run your first build.
```

The marker only enhances blockquotes containing a real ordered list; other blockquotes remain unchanged. The source stays editable Markdown with no proprietary component schema.


### Code groups in Markdown

Choose **Code group** from Studio's Insert palette, or group two or more fenced code blocks inside a Markdown blockquote headed by `[!CODEGROUP]`:

````md
> [!CODEGROUP] Install
>
> ```bash
> bun install
> ```
>
> ```powershell
> bun install
> ```
````

Studio's script-disabled preview shows **all examples with language labels**, so no content is hidden while editing. Published websites progressively enhance the same safe HTML into tabs, with Left/Right arrows, Home/End, RTL-aware arrow direction, visible keyboard focus and working code-copy buttons. Without JavaScript every example remains readable. Only groups containing 2–12 fenced code blocks are enhanced; malformed markers remain ordinary blockquotes. This is standard Markdown, not executable MDX.

## Localization and translations

Paglora now has a community translation source: **[m1nsook/paglora-lang](https://github.com/m1nsook/paglora-lang)**. You can fork it, translate reviewed UTF-8 JSON message values, and submit a pull request. English remains the fallback for untranslated strings, and CI checks placeholder syntax and catalog structure.

- **Studio language:** choose **Settings → Studio language**. Initial offline language packs are English, Polish and Korean; only the migrated Studio screens are translated so far.
- **Website language:** configure **Design site → Document language** separately for each project. Its built-in navigation, appearance/copy controls and documentation callout labels use the relevant reviewed pack when available. Other language choices use English interface text until translated.
- **Document content:** Paglora never automatically translates your `docs/*.md` writing, page titles, navigation groups or custom labels. Authors can write those in their own language.

For a new language, fork [`paglora-lang`](https://github.com/m1nsook/paglora-lang), create a blank language file using `node scripts/new-locale.mjs fr "Français" "French"`, translate the values you know, and open a pull request. A coverage command (`node scripts/coverage.mjs`) reports translated catalog keys; untranslated messages fall back to English. The repository has issue templates for coordination and automated translation labels. After human review, update a local Paglora checkout from a local clone of the translations repository:

```powershell
node scripts/sync-translations.mjs ../paglora-lang
bun run check
```

Translation snapshots are bundled locally with Studio and exported websites. No hosted translation API or account is required, and no untrusted translator code is executed.

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

## Portable .paglora backups

Projects can be backed up and shared **without a hosted account**. On the Projects screen, open a project's context menu and choose **Export .paglora backup**. A timestamped file is saved in the application's `backups/` directory, outside project storage. Its path is shown in Studio for copying into File Explorer.

Choose **Import .paglora** on the Projects screen to restore an editable project. Import never overwrites a project; duplicate IDs are imported under a new ID.

The version 1 `.paglora` format is a portable JSON + base64 archive, not a ZIP. It contains the editable `paglora.json` and `pages.json`, optional `site.json`, Markdown files (including private pages), CSS, and local PNG/JPEG/WebP/GIF images. It excludes generated website exports and trash. Every archive has an explicit version so future formats can evolve.

Only regular allowlisted source files are accepted; unsafe paths, symlinks, duplicates and invalid manifests are rejected. The limit is 64 MiB of original source or 96 MiB per archive.

**Backups can contain private documentation.** Never put a `.paglora` archive in a public website's `site/` folder or commit it to a public GitHub repository unless you intentionally want to disclose every page.
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

## Windows Studio release channels

**Nightly (testing):** Actions → **Studio nightly installer** runs automatically each day or manually. It builds an NSIS Windows installer as a **14-day GitHub Actions artifact**, not a versioned release or an auto-update. Use nightlies only for testing.

**Stable (versioned):** Actions → **Studio versioned release** is manual, requires a real SemVer matching Cargo, Tauri, Desktop and workspace manifests, and requires a matching curated `.github/releases/vX.Y.Z.md` containing Added, Improved, Fixed, Deprecated, Removed and Known limitations. The workflow builds a Windows installer and creates a **draft GitHub Release** for review. No commit automatically publishes a stable release. Run `node scripts/check-desktop-release.mjs 0.2.0` to validate locally.

**Updates:** Tauri's trusted auto-updater requires a permanent signing key pair, the public key embedded in Studio, signed installer artifacts and updater endpoints. **These are not yet configured.** Do not publish this unsigned draft as an auto-update-ready installer; signing credentials and real updater installation must be implemented before the first stable rollout.

## Official repositories and documentation

| Repository | Purpose |
| --- | --- |
| **[m1nsook/paglora](https://github.com/m1nsook/paglora)** | Paglora Desktop, Rust renderer, npm CLI, development, issues and releases |
| **[m1nsook/paglora-docs](https://github.com/m1nsook/paglora-docs)** | Public documentation source project `project/paglora-docs/` and deployed static export `site/` |
| **[m1nsook/paglora-lang](https://github.com/m1nsook/paglora-lang)** | Community translation catalogs, language requests, translation PRs and validation |

**Live website:** [Paglora Docs](https://m1nsook.github.io/paglora-docs/), built using Paglora itself. The source is public, and its `site/` export is hosted through GitHub Pages.

**Important publishing distinction:** Editing documentation Markdown or changing **Design site** in Studio modifies your **local Paglora project only**. GitHub Pages deploys `paglora-docs/site/`, not your local Studio preview or `project/` folder. To update the public website, sync the saved local project to `paglora-docs/project/paglora-docs/`, rebuild in Desktop, copy the **complete static export** to `paglora-docs/site/`, and push both through GitHub Desktop. See the [docs synchronization guide](https://github.com/m1nsook/paglora-docs/blob/main/project/README.md). **Sync the newest repository source into Studio before editing** to avoid overwriting documentation changes with an older local copy.

Use [paglora-lang](https://github.com/m1nsook/paglora-lang) for translation pull requests. The editor language and each generated site's document language are separate settings; neither machine-translates project Markdown.

## Contributing and license

Paglora is MIT-licensed — see [LICENSE](LICENSE). Created by [m1nsook](https://github.com/m1nsook). Contributions and focused issue reports are welcome: read [CONTRIBUTING.md](CONTRIBUTING.md), [open an issue](https://github.com/m1nsook/paglora/issues), or see [SECURITY.md](SECURITY.md) for private vulnerability reporting.
