# Paglora roadmap — beautiful, visual, source-owned documentation

## What we are building

Paglora is a **free, open-source, local-first documentation website studio**. Mintlify is our **quality benchmark for the editor, published page design, navigation, components, and experience**, not a requirement to reproduce its AI services, accounts, analytics business or enterprise backend.

Paglora must work without login, cloud services, subscriptions or artificial feature tiers. Websites and their source belong to the user. Optional third-party deployment services may have their own fees, but Paglora does not.

The goal is not to imitate Mintlify's proprietary code, assets or exact UI. Our own implementation should be comparably polished while adding something more flexible: a visual builder **and** direct project source editing.

## North-star experience

Open Paglora, create a site, choose a polished template, and immediately see **a real website**, not a blank Markdown document or developer dashboard.

- **Unified studio:** file/navigation tree on the left, actual site page in the center, contextual properties and page outline on the right.
- **Visual / Code / Split modes:** edit a block directly, edit its Markdown/MDX/TSX/CSS, or see code and the actual rendered website side by side.
- **Inline editing:** click the title to edit; select text for formatting; slash-menu to add cards, callouts, steps, tabs, code groups, tables and other exportable blocks.
- **Drag and drop:** reorder page navigation, nested sections and content blocks; clear handles, indicators, keyboard equivalents and undo.
- **Professional defaults:** elegant typography, spacing, accessible interaction states, responsive components, light/dark site themes, search, and fast navigation.
- **Project theme ownership:** files such as `theme/Layout.tsx`, `theme/custom.css`, `components/*.tsx`, page source and public assets remain editable and survive rebuilds.
- **One source of truth:** edits must not silently erase hand-written TSX/MDX; preview and export must use the same renderer.

## Priority roadmap

### P0 — One excellent public documentation theme
- Replace the basic fixed site layout with a refined, responsive topbar, readable article column, collapsible left nav, right-side table of contents, breadcrumbs, mobile menu, previous/next page links, footer, and keyboard-accessible search entry.
- Design polished styles for headings, lists, code, tables, links, quotes, images, callouts and empty states.
- Add public-site light/dark/system preference independent of desktop appearance.
- Introduce page modes: **Docs** (sidebar + TOC), **Wide** (no TOC), **Landing** (hero, feature sections, cards, minimal chrome). Every mode must export reliably.
- Provide a real demo site and desktop/mobile screenshot regression checks. Default theme must look good without manual CSS.

### P1 — Studio redesign and editing interactions
- Consolidate separate preview, designer, and editor dialogs into a **single unified site studio**. Fewer modal interruptions; editing happens on the rendered page.
- Interactive hierarchy/file navigation with nested groups and drag/drop; configurable navigation links, page icons, tags and sidebar titles.
- A contextual inspector for the selected page, section or block (layout, spacing, typography, colors, image, links and visibility).
- Source pane using a proper code editor (Monaco or CodeMirror) with syntax highlighting, autocomplete, diagnostics and safe saving. Visual ↔ source switching must not lose supported content.
- Unsaved changes indicators, reliable keyboard shortcuts, undo/redo, and helpful empty/error states.

### P2 — Page builder and reusable components
- MDX/structured blocks that preserve cards, columns, tabs, steps, accordions, callouts, code groups, banners, tables and media without flattening them into plain Markdown.
- Component gallery, slash-command insertion, drag handles, per-component properties, reusable snippets, and export parity.
- Visual landing-page builder with editable hero, CTA, logos, grids, feature cards and custom layout sections.
- Per-page metadata/frontmatter: title, summary, sidebar label, icon, tag, slug, SEO and mode.
- Drag/drop local asset manager for logos, screenshots, SVGs, attachments and other static files; copy/hash on build.

### P3 — Source-based themes and portable production build
- Real project structure with `content/`, `theme/`, `components/`, `public/`, config and source files.
- Users can override themes and React components in TSX and CSS **before** compilation, similar to VitePress theme customization.
- Isolated Vite/React project compiler for preview and static output. Custom project code never runs with privileged Tauri filesystem access.
- CLI parity: `paglora dev`, `paglora build`, `paglora preview`; project can be built without opening the desktop GUI.
- Use `paglora.json`, `pages.json`, `site.json` and Markdown as the canonical format; test future format upgrades explicitly.

### P4 — Documentation completeness and easy publishing
- Local full-text search using a static index, doc versioning, localized navigation, redirects, sitemap, metadata, custom links.
- OpenAPI reference pages and interactive request examples if demand justifies them; no hosted service required for displaying docs.
- Template gallery: product docs, API reference, changelog, developer portal, getting-started guide.
- Deploy-ready output with GitHub Pages / Cloudflare Pages / Netlify instructions and optional integrations; no Paglora account.
- Local Git workflow and project export/import.

## Explicit non-goals for now

We are **not** prioritizing AI chat/search, LLM integrations, MCP services, agent features, centralized analytics, cloud collaboration, accounts, paywalls, or enterprise administration. Those are not necessary to achieve Mintlify-level **visual and editorial quality**.

## Dependencies: earn them with real features

Keep the existing **Tauri 2 + Rust, React 19, Tailwind 4, official shadcn/ui Radix Nova, Tiptap 3, Shiki, and Vite**.

Consider libraries only when their features are being implemented:
- **Monaco or CodeMirror 6** for the actual project source editor (avoid shipping a large editor dependency for a simple textarea).
- **dnd-kit** for accessible, reliable navigation and block reordering.
- **Zod** for versioned component and theme configuration schemas.
- **Tiptap's official extensions** for block handles, tables, and rich structural editing.
- **Tauri dialog plugin** for local asset import.
- **Playwright** for visual and interaction regression tests.

Install the exact supported versions when each implementation begins; preserve all existing official shadcn components.

## Quality bar for every PR

- A website feature is shipped only when it works in **visual editor, preview, and exported static site** where relevant.
- Desktop UI must have sensible defaults and no unnecessary developer-facing labels.
- Verify keyboard accessibility, mobile layouts, light/dark appearance, error handling, and project persistence.
- Keep Windows Rust checks and Windows/Ubuntu TypeScript/CLI checks green.
- Do not break current project data, and do not claim a source override works until it appears in the real export.
- Prefer a few coherent PRs with real features over many PRs that only add scaffolding.

## References for experience goals

- [Mintlify editor improvements](https://www.mintlify.com/blog/improved-web-editor) — unified configuration, navigation, writing, and live preview.
- [Mintlify editor workflow](https://www.mintlify.com/blog/5-editor-features-you-should-know) — visual/source switching, drag/drop navigation, and real-time preview.
- [Mintlify pages](https://mintlify.com/docs/pages) — page metadata, page modes, and layouts.
- [Mintlify components](https://mintlify.com/docs/components) — common building blocks for documentation pages.

These are product references only; Paglora is independently designed and implemented.
