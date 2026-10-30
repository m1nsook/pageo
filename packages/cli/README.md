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

`inspect --json` returns machine-readable project metadata, including public and private page information. The CLI reads `paglora.json` and `pages.json`, without rewriting project files. A new npm release is required before these changes reach the published alpha.

## Project initialization

`paglora init <new-folder> --name "My Docs"` writes a complete Paglora v1 project: `paglora.json`, `pages.json`, `docs/index.md`, and `theme/custom.css`. The folder name must be a lowercase slug such as `my-docs`, its parent must already exist, and the target must not exist. The CLI refuses to overwrite user content.

`inspect --json` and `validate --json` report page visibility, layout, and navigation groups.

**Desktop location:** Paglora Studio currently discovers projects only under its own application data `projects/` directory. A CLI project created elsewhere is valid, but cannot be opened through Studio until it is placed inside the directory shown by **Settings → Local project storage**. Project import is not implemented yet.

## Release: `0.0.1-alpha.2`

This prerelease adds the working `init` command, richer inspection, and the canonical `paglora.json` format with navigation groups. It intentionally drops the abandoned Pageo format.

Merging the code **does not publish** npm. From the repository root, after merging and confirming this version is not already published:

```powershell
bun install
bun run check
bun run build
cd packages/cli
bun run test
npm pack --dry-run
npm whoami
npm view paglora versions --json
npm publish --access public --tag alpha
npm view paglora@alpha version
```

Publishing requires your authenticated npm account and may require browser/2FA approval. Never commit npm tokens or cookies. Do not republish the same version.

