# Paglora

<img src="apps/desktop/public/paglora.svg" alt="Paglora logo" width="88" />

**Beautiful documentation, built locally and published anywhere.**

[![npm alpha version](https://img.shields.io/npm/v/paglora/alpha?style=flat-square&logo=npm&label=npm%20alpha)](https://www.npmjs.com/package/paglora?activeTab=versions)
[![npm monthly downloads](https://img.shields.io/npm/dm/paglora?style=flat-square&logo=npm&label=downloads%2Fmonth)](https://www.npmjs.com/package/paglora)
[![GitHub Actions CI](https://img.shields.io/github/actions/workflow/status/m1nsook/paglora/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/m1nsook/paglora/actions/workflows/ci.yml)
[![MIT license](https://img.shields.io/github/license/m1nsook/paglora?style=flat-square)](LICENSE)

Paglora is a free, open-source, **local-first documentation studio** powered by Tauri, Rust, React and TypeScript. Write Markdown, organize pages, design a responsive documentation website and export static files you can host anywhere. Your projects stay on your computer; no account or hosted Paglora backend is required.

> [!IMPORTANT]
> **Early development.** Paglora Studio is currently available to run from source on Windows; there is no stable desktop installer yet. The published [`paglora` npm package](https://www.npmjs.com/package/paglora) is an **alpha command-line tool** for creating and checking projects. The CLI does not build websites or install Studio.

## What you can do

### Create in Studio

- **Write and organize:** edit Markdown with autosave, manage multiple pages, arrange navigation groups and choose Docs, Wide or Landing page layouts.
- **Design visually:** switch between Edit, Split and Canvas views, select content in the live site canvas, and preview desktop, tablet and phone sizes.
- **Customize your site:** adjust branding, navigation, fonts, appearance, colors and project-owned CSS.
- **Keep files local:** use local images, choose public or private pages, and export or import portable `.paglora` project backups.
- **Work in your language:** Studio has an expanding set of translations, while published websites can use a separately selected document language.

### Publish anywhere

Paglora exports a portable static documentation website with no required server-side runtime. Published sites support:

- Responsive navigation, headings, table of contents and light/dark appearance.
- Offline-capable search, keyboard navigation and code copying.
- Callouts, cards, guided steps, content tabs, code groups, FAQ accordions, task lists and tables.
- Optional canonical URLs, sitemaps and page-specific metadata.
- Public-page-only output: pages marked private are excluded from the website, search index and sitemap.

**Current limitations:** the Studio canvas is a preview rather than a freeform Figma-style layout designer. Interactive site features should be tested in the exported website. The CLI cannot yet build sites, and one-click hosting deployment and automatic content translation are not available.

## Get started

### Windows desktop Studio

To run Studio from source, install [Bun](https://bun.sh/), [Rust](https://rustup.rs/) and the Windows dependencies described in the [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/).

Open the project with GitHub Desktop and run these commands from the repository folder:

```powershell
bun install
bun run desktop
```

The frontend can also run without the Tauri filesystem backend:

```powershell
bun run dev
```

Nightly Windows installers may be available as **experimental test artifacts** under [GitHub Actions](https://github.com/m1nsook/paglora/actions/workflows/nightly-studio.yml). They are not stable releases or automatic updates. Check [Releases](https://github.com/m1nsook/paglora/releases) for published versions when available.

### npm CLI (alpha)

Use the CLI to initialize, inspect or validate a project:

```powershell
bunx --bun paglora@alpha init .\my-docs --name "My Docs"
bunx --bun paglora@alpha inspect .\my-docs
bunx --bun paglora@alpha validate .\my-docs
```

The CLI is separate from the desktop Studio and does not export websites.

## Build and publish

In Studio, open a project, write your pages, configure **Design site**, then select **Website → Build static site**. Upload the entire generated output folder to a static hosting service such as GitHub Pages.

Paglora-built sites include the static HTML, CSS and browser scripts needed for navigation, search and appearance switching. Serve the export over HTTP(S) rather than opening HTML through `file://`, which may block the search index.

Project backups are different from published website exports: a `.paglora` backup can contain **private pages and source files**. Only share backups with people who should have access to all of their contents.

## Documentation and translations

- **[Paglora Docs](https://m1nsook.github.io/paglora-docs/)** — documentation built and published using Paglora itself.
- **[paglora-docs](https://github.com/m1nsook/paglora-docs)** — documentation source.
- **[paglora-lang](https://github.com/m1nsook/paglora-lang)** — community translations and language contributions.
- **[Changelog](CHANGELOG.md)** — development history and notable changes.

Documentation language settings do not machine-translate your Markdown. Content translation remains under the author's control.

## Contributing

Paglora is in active development. Contributions, bug reports and focused feature requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md), [Issues](https://github.com/m1nsook/paglora/issues) and [SECURITY.md](SECURITY.md) for private vulnerability reporting.

**License:** [MIT](LICENSE). Created by [m1nsook](https://github.com/m1nsook).
