# Paglora headless website builder

This workflow **does not start Tauri Desktop**. It uses a Node DOM parser to prepare sanitized Markdown and calls `paglora-build`, a CLI binary that uses **the exact Rust renderer and static exporter** from Studio.

## Build a local documentation site

From the Paglora checkout:

```powershell
npm.cmd install --prefix tools/headless --no-audit --no-fund --package-lock=false
bun install --frozen-lockfile
bun packages/site-runtime/build.mjs
node tools/headless/render.mjs ../paglora-docs/project/paglora-docs ./rendered-pages.json
cargo run --locked --manifest-path apps/desktop/src-tauri/Cargo.toml --bin paglora-build -- ../paglora-docs/project/paglora-docs ../paglora-docs/site ./rendered-pages.json
```

The Node preparer applies the same allowlist and native-card/callout conventions as Studio. The Rust CLI shares the actual templates, color modes, layout renderer, private-page filtering, runtime assets, fonts, CSS and search-index builder. `rendered-pages.json` is a temporary preparation artifact; do not publish it.

Only safe public HTML is fed to the Rust renderer; private project Markdown and raw project files are never included in a public site. This is a development-source capability until formally released as a packaged CLI. Keep using the existing Desktop export for current published releases when a headless build is not verified.
