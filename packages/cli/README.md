# Paglora CLI

<img src="https://raw.githubusercontent.com/m1nsook/paglora/main/apps/desktop/src-tauri/icons/icon.png" alt="Paglora official logo" width="88" />

The official npm package for [Paglora](https://github.com/m1nsook/paglora), an open-source local-first documentation studio.

The **early alpha** CLI creates, inspects and validates local project folders. Static site building still uses Paglora Desktop.

```powershell
bun add --global paglora@alpha
paglora --help
paglora init .\\my-docs --name "My Docs"
paglora inspect "C:\path\to\projects\my-docs"
paglora validate "C:\path\to\projects\my-docs"
```

Or without installing:

```powershell
bunx --bun paglora@alpha inspect .\projects\my-docs
```

`inspect --json` returns machine-readable project metadata, including public and private page information. The CLI reads `paglora.json` and `pages.json`, without rewriting project files. These commands are available in the published `0.0.1-alpha.3` release.

## Project initialization

`paglora init <new-folder> --name "My Docs"` writes a complete Paglora v1 project: `paglora.json`, `pages.json`, `docs/index.md`, and `theme/custom.css`. The folder name must be a lowercase slug such as `my-docs`, its parent must already exist, and the target must not exist. The CLI refuses to overwrite user content.

`inspect --json` and `validate --json` report page visibility, layout, and navigation groups.

**Desktop location:** Paglora Studio currently discovers projects only under its own application data `projects/` directory. A CLI project created elsewhere is valid, but cannot be opened through Studio until it is placed inside the directory shown by **Settings → Local project storage**. Project import is not implemented yet.

## Published alpha: `0.0.1-alpha.3`

This prerelease includes the existing `init`, `inspect`, and `validate` commands with improved strict argument handling, Unicode label validation, public Overview enforcement, and verified packaging tests on Windows and Linux. It uses the canonical `paglora.json` format and does not support the former Pageo manifest.

The package is published to npm under the `alpha` dist-tag, confirmed October 31, 2026. Verify the installed version or inspect the registry:

```powershell
bunx --bun paglora@alpha --version
npm.cmd view paglora@alpha version
npm.cmd dist-tag ls paglora
```

On Windows use `npm.cmd` instead of `npm` if PowerShell blocks the `npm.ps1` shim. The `latest` dist-tag is separate from `alpha`; it need not be moved for this prerelease.

**Do not republish `0.0.1-alpha.3`.** The next CLI release must use a new version, pass its tests and package checks, and be published by an authenticated npm maintainer. Never commit npm tokens or cookies.

