# Paglora site runtime

The small first-party `@paglora/site-runtime` package progressively enhances static HTML exported by Paglora. It uses standard browser APIs and does not require Vue, jQuery, a backend, or a hosted service.

The initial release supports **Light / Dark / System** appearance preferences (stored per site root where storage is allowed) and **active table-of-contents heading** tracking. Navigation and content work without JavaScript; interactive enhancement is optional.

The build exports `paglora.js` alongside every public page, and each exported HTML page loads it with `<script defer src="paglora.js"></script>`. Studio previews intentionally remove that tag because the current same-origin iframe is script-disabled, pending a separate secure interactive-preview design.

Run `node --test packages/site-runtime/test/*.test.mjs` for focused tests.

The runtime is original Paglora source, **informed by VitePress's interaction patterns**, not copied Vue code. VitePress source is MIT-licensed (Copyright 2019–present Yuxi (Evan) You). If actual source is reused in the future, preserve the required notices in the distributed artifacts.

Future PRs will implement static-page search indexing and Ctrl+K command search, and later multilingual navigation/search. This PR does **not** claim search or language switching.
