# Paglora product roadmap — open-source Mintlify alternative

**North star:** a beautiful documentation platform with the breadth of Mintlify, but built around local-first source ownership, no mandatory account, no Paglora pricing tiers, and no required cloud services.

This is an **aspirational feature-parity roadmap, not a claim that features already exist**. We will not implement Mintlify's proprietary code or copy its assets. Priorities follow dependencies, not comparison marketing.

## Principles

1. **No Paglora authentication or subscription:** creating, editing, previewing, building and deploying a site must work without registering an account or paying Paglora.
2. **Users own source:** Markdown/MDX, React/TSX themes, CSS, config and assets remain user-accessible files. `dist/` is disposable build output.
3. **Visual + source must agree:** save, preview and export use the same project source. A visual change must never silently overwrite arbitrary hand-written source.
4. **Static-first and portable:** sites can be deployed to any static host and run without a Paglora server; any dynamic/AI features are optional add-ons.
5. **Free feature availability:** no gated Pro/Enterprise variants, artificial usage quotas, license activation or features reserved for hosted users.
6. **Trust boundaries:** custom TSX/JS must compile and run in an isolated project build/preview process, never with the Tauri editor's privileged filesystem access.

Users may still choose paid third-party hosting, model APIs, domains, or external analytics. Those are not Paglora charges. Private visitor authentication and centralized analytics necessarily require user-provided hosting/backends; Paglora itself won't demand a login.

## Capability checklist

| Capability | Paglora status (October 2026) | Planned work |
|---|---|---|
| Local projects, pages, Markdown | Working | Retain backwards compatibility |
| Static HTML export and real preview | Working | Production Vite/React renderer, asset pipeline |
| Custom header / nav / footer controls | Limited | Freeform reusable layouts and theme overrides |
| Beautiful published default, mobile and dark themes | Limited | Premium responsive site shell and theme gallery |
| Editing the project's source code | First CSS milestone in progress | File tree, CodeMirror or Monaco, TSX and MDX |
| Rich components (cards, tabs, steps, accordions, code groups) | Not built as exportable components | MDX + built-in component library, block visual editing |
| Hierarchical docs navigation, versioning, localization | Not implemented | Nested tree, translations, product/version switchers |
| Local images, downloadable files and asset bundles | Not implemented | Native asset manager, hashed assets and build copies |
| API reference generation | Not implemented | OpenAPI first, then AsyncAPI and GraphQL SDL |
| Interactive API playground | Not implemented | HTTP request editor, auth headers local to visitor, CORS guidance |
| Full-text search | Not implemented | Static local indexes first; optional semantic search |
| AI assistant for documentation readers | Not implemented | Optional self-hosted model or BYO API key; no mandatory service |
| `llms.txt`, Markdown routes, agent skills and MCP | Not implemented | Generated machine-readable assets; optional MCP service |
| Custom metadata, sitemap, canonical, redirects and OG | Not implemented | SEO pipeline and site options |
| Git version control / pull requests / preview deployments | Not implemented | Local Git tooling, optional GitHub integration and CI templates |
| Changelogs, feedback, templates and analytics | Not implemented | Static changelog templates, optional privacy-conscious analytics integrations |
| Hosting and custom domains | Manual static-folder upload | GitHub Pages / Cloudflare Pages / Netlify adapters; any static host |
| Publishing authentication/roles | Deliberately not core | Optional self-hosted access-control integration, never a Paglora account |

## Engineering order

### Phase 1 — Source ownership and renderer
- **Source CSS**: real project-local `theme/custom.css`, edit in Paglora, apply in preview and export.
- Project file-tree view for docs, theme, components and assets.
- Integrated code editor with safe save and external file-change detection.
- MDX + React theme/component compiler driven by the user's project source; bundle in an isolated process with the same output for preview and production.
- Legacy `pageo.json` import/read compatibility and non-destructive project migration; keep the app-data ID until a verified migration exists.

### Phase 2 — Beautiful published sites
- Premium default documentation theme: responsive navigation, TOC, breadcrumbs, search trigger, footer, previous/next, mobile layout.
- Fully editable header, landing pages, nav hierarchy, footer, themes, light/dark styling, typography, spacing and branding.
- Local media/asset handling that survives build and deployment.
- Visual property inspector and block editor, maintaining a coherent source representation.

### Phase 3 — Docs and APIs
- MDX components: callouts, cards, steps, tabs, accordions, code groups, tables, diagrams, videos and embedded examples.
- API references generated from OpenAPI with schema docs and client-language snippets; interactive playground with explicit HTTP request handling.
- Versions, multi-language navigation, redirects and rich SEO metadata.
- Search and agent-readable `llms.txt`/sitemap/Markdown route outputs.

### Phase 4 — Publishing and ecosystem
- `paglora dev`, `paglora build`, `paglora preview` commands backed by the same site compiler.
- Build artifact and deploy adapters for common hosts without a Paglora account.
- Local Git workflows, importers, custom templates and extensions.
- Optional AI Q&A, MCP endpoint integration and analytics under user control.

## Release acceptance criteria

A feature only counts as shipped if it works in **editor, local preview and exported site** where applicable, passes Windows Rust and Windows/Ubuntu TypeScript/CLI CI, and doesn't break existing local projects. Add visual regression checks for desktop and mobile layouts. Avoid feature claims based solely on compiling a placeholder or installing a dependency.

## Competitive reference

Source documents (checked October 2026):
- [Mintlify docs](https://mintlify.com/docs)
- [Themes](https://mintlify.com/docs/themes)
- [Components](https://mintlify.com/docs/components)
- [Navigation](https://mintlify.com/docs/navigation)
- [API playground](https://mintlify.com/docs/api-playground/overview)

This roadmap describes our own implementation and priorities, not an affiliation with Mintlify.
