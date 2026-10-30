# Paglora CLI

<img src="https://raw.githubusercontent.com/m1nsook/paglora/main/apps/desktop/src-tauri/icons/icon.png" alt="Paglora official logo" width="88" />

The official npm package for [Paglora](https://github.com/m1nsook/paglora), an open-source local-first documentation studio.

The **early alpha** CLI inspects and validates project folders. Static site building and publishing still use Paglora Desktop.

```powershell
bun add --global paglora@alpha
paglora --help
paglora inspect "C:\path\to\projects\my-docs"
paglora validate "C:\path\to\projects\my-docs"
```

Or without installing:

```powershell
bunx --bun paglora@alpha inspect .\projects\my-docs
```

`inspect --json` returns machine-readable project metadata, including public and private page information. Existing `pageo.json` project files remain supported; the CLI does not rewrite user files.

## Release notes

The first npm publication was `paglora@0.0.1-alpha.0`. This repository's next CLI version is `0.0.1-alpha.1`, containing renamed repository links and messaging. **Merging a PR does not publish npm packages.**

When releasing a new version, the authenticated maintainer should run:

```powershell
cd packages/cli
bun run test
npm pack --dry-run
npm whoami
npm publish --access public --tag alpha
npm view paglora@alpha version
```

The npm login may require browser/2FA verification. Never commit npm tokens or login cookies. Do not try to republish an existing version number.
