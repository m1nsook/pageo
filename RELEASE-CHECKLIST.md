# Paglora Desktop release readiness

This checklist tracks release blockers separately from development milestones. A passing CI run is **not** a verified release, and no stable installer should be published before user acceptance.

## Studio and authoring
- [ ] Windows Tauri Studio: verify component click insertion at chosen position and drag from sidebar and Gallery. Save, reopen, and ensure original Markdown remains intact (PR #213 source-backed composer).
- [ ] Confirm Write/Components/Split/Canvas switches do not flash white, lose focus, or clobber pending Markdown.
- [ ] Check imports, backup restore, public/private page handling, settings and local asset paths in a clean install.

## Publishing
- [ ] Merge publishing PR #214 after all Windows/Ubuntu/Rust checks pass.
- [ ] Build a real project from Windows Studio and from the headless Rust builder; compare rendered page HTML, navigation, color modes, local image URLs, and search.
- [ ] Confirm `_paglora/chunks/*.js` and `_paglora/chunks/css/*.css` are content-addressed, load with a repository subpath, and do not require a Paglora server.
- [ ] Check compact `pages/*.html` mirror: `noindex`, root canonical base, valid relative scripts/assets/links, preserved `<pre>` content.
- [ ] Verify favicon from HTTPS URL and uploaded PNG/JPEG/WebP/GIF, including a local icon on a real hosted page.
- [ ] Confirm exported assets include only images referenced by public content/CSS/logo/favicon, not private drafts.
- [ ] Decide whether to switch canonical HTML URLs to `pages/` in a separate version; do not break existing docs URLs to rush this milestone.
- [ ] Merge dependent `paglora-docs` PR #19 only after #214 and successful live Pages build.

## Languages
- [x] English, Korean, Polish catalogs have 306/306 canonical keys and match bundled Paglora snapshots; placeholders were compared.
- [ ] Native-speaker review and maintainer approval for German/French/Dutch PR #11. Its workflow currently requires action; do not merge based solely on 306/306 JSON coverage.
- [ ] Re-run translation validation before any new bundled locale snapshot.

## Windows distribution — separate project for next phase
- [ ] Review `m1nsook/paglora-i` README and choose modern installer UX without bypassing Windows trust, signing, or Tauri update requirements.
- [ ] Validate installed-app paths, clean uninstalls/upgrades, code signing and stable update signatures with real Windows installs.
- [ ] Confirm update packages can install the same versioned content that was tested.

## Release metadata
- [ ] Confirm desktop version (currently 0.2.0), release date, signed artifacts and checksums.
- [ ] Review `.github/releases/v0.2.0.md` and `CHANGELOG.md` against **merged, tested** work; remove any item that did not ship.
- [ ] Draft GitHub Release; publish only after all checks above and maintainer approval.
- [ ] Keep npm CLI `paglora@0.0.1-alpha.3` versioning independent from Desktop.
