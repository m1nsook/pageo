# Changelog

Paglora is in early development. Desktop milestone numbers are separate from the public npm CLI package.

## Unreleased — desktop source (after 0.2.0)

### Studio visual editing
- The Blocks outline now supports duplicating and deleting complete source-owned Markdown blocks, Alt+Up/Down reordering, explicit Undo/Redo, and caret-aware selection after changes. All actions use undoable ProseMirror transactions and existing autosave; no project schema changes.

### Documentation authoring
- Added source-owned `[!ACCORDION]` FAQ questions with Studio insertion, native keyboard-accessible `<details>` behavior, compact adjacent-question groups, and matching headless/Studio static output. Malformed markers remain visible Markdown.
- Added nested Markdown `[!TABS]` / `[!TAB]` content panels with Studio insertion, safe preview/export parity, script-free readable fallback, and keyboard-accessible published tabs (including RTL navigation).
- Added Markdown `[!CODEGROUP]` fenced-code examples with Studio insertion, safe language labels, script-free stacked fallback, and progressively enhanced accessible tabs in published sites. No new project schema.
- Added a source-owned `[!STEPS]` Markdown component with an ordered-list timeline, accessible static HTML, RTL-aware styling, and Studio block insertion. It requires no browser script and preserves existing project files.

## 0.2.0 — desktop development milestone (October 31, 2026)

### Website publishing and verification
- Added a publishing report to Studio, showing exported public pages, excluded private pages, and bundled local image count.
- Warn when a published page links to a **missing or private page**. Warnings do not silently block exporting valid public content.
- Export continues to stage all files before replacing the last successfully built website, preserving the previous working export if a build fails.
- Clarified that browser runtime features must be tested over HTTP(S), rather than opening exported HTML directly with `file://`.

### Features delivered since 0.1.0
- Minified, bundled browser scripts, offline MiniSearch with typo-tolerant/prefix queries, CJK substring support, and accessible keyboard search.
- Light, dark and system appearance switching, respecting the configured accent in all modes.
- Documentation heading permalinks, code-copy controls, callouts, task lists, disclosures and responsive navigation.
- Project-owned image imports (PNG/JPEG/WebP/GIF, up to 5 MiB), with only public-referenced assets included in exported sites.
- Document-language options, Arabic RTL, social metadata, optional canonical URLs and public-only `sitemap.xml`.
- Studio canvas improvements, responsive Tablet/Phone preview, and safeguards against stale project/page state.
- Windows Rust and Windows/Ubuntu frontend regression checks.

### Status
Development milestone only: no stable Windows installer, MDX/TSX source compiler, automated GitHub Pages deployment or general-purpose visual page builder yet. These capabilities remain roadmap work.

## 0.1.0 — initial foundation

- Tauri 2 desktop Studio, local-first project management, Markdown editing, page navigation, website design and static export.

## Public npm CLI (independent version)

- `paglora@0.0.1-alpha.3` was published October 31, 2026 under the npm `alpha` tag.
- Commands: `init`, `inspect`, and `validate`; no CLI website build yet.
