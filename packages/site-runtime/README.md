# Paglora site runtime

The small first-party `@paglora/site-runtime` package progressively enhances static HTML exported by Paglora. It uses standard browser APIs and does not require Vue, jQuery, a backend, or a hosted service.

The initial release supports **Light / Dark / System** appearance preferences (stored per site root where storage is allowed) and **active table-of-contents heading** tracking. Navigation and content work without JavaScript; interactive enhancement is optional.

The Rust exporter embeds **minified browser bundles** generated from `src/index.js` and `src/search.js` by `bun packages/site-runtime/build.mjs`. Cargo invokes this build automatically before compiling the desktop backend (Bun is required for Rust builds). The bundles are emitted as `paglora.js` and `paglora-search.js` alongside exported public HTML, and public pages load them with deferred script tags. Studio previews intentionally strip both script tags because the current same-origin iframe is script-disabled, pending a separate secure interactive-preview design. Generated `dist/` bundles remain ignored by Git.

Run `bun packages/site-runtime/build.mjs` followed by `node --test packages/site-runtime/test/*.test.mjs` for focused tests.

The runtime is original Paglora source, **informed by VitePress's interaction patterns**, not copied Vue code. VitePress source is MIT-licensed (Copyright 2019–present Yuxi (Evan) You). If actual source is reused in the future, preserve the required notices in the distributed artifacts.

Static search indexes only public pages and loads locally; multilingual UI labels are planned separately.

## Local documentation search

The exported `paglora-search.js` adds a Ctrl+K / Cmd+K search interface. It lazy-loads `search-index.json`, generated **only from public pages** at build time using sanitized source content. Results link to local `.html` pages; all titles, excerpts and queries are inserted with `textContent`, not raw HTML. No user accounts, external services or JavaScript are required for ordinary page browsing.

Search now bundles **MiniSearch 7.2.0 (MIT)** into the local `paglora-search.js` asset. It ranks title matches, supports word prefixes, and falls back to fuzzy matching for longer Latin queries. A substring fallback preserves CJK queries without spaces. All search is offline; no CDN or search server is contacted. MiniSearch's full license is shipped in `licenses/MiniSearch-MIT.txt` with exported sites.
