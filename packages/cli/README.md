# Paglora CLI

**Paglora** is the new name for our local-first documentation studio. This early alpha CLI provides genuine project inspection and validation.

> **Compatibility:** Desktop application, GitHub repository and on-disk project files still use the original `Pageo` name in this initial package-name reservation release. Existing `pageo.json` projects remain supported without migration. The full application rename comes after npm successfully accepts `paglora`.

## Install (once published)

```powershell
bun add --global paglora@alpha
paglora --help
paglora inspect "C:\\path\\to\\projects\\my-docs"
paglora validate "C:\\path\\to\\projects\\my-docs"
```

Or use it without installing:

```powershell
bunx --bun paglora@alpha inspect .\projects\my-docs
```

`inspect --json` prints project information, including public and private pages.

This alpha does **not** build or publish websites through the CLI yet. That remains available in the desktop application.

## Publish the first alpha (maintainer only)

1. Switch GitHub Desktop to `main` and pull the updated source.
2. From the repository root: `cd packages/cli`.
3. Run `bun run test`, `npm pack --dry-run`, and `npm whoami`.
4. Check `npm view paglora version`. A 404 means no publicly indexed package, **not** a guarantee that npm will accept publication.
5. Run `npm publish --access public --tag alpha` while logged in to the intended npm owner account.
6. Confirm with `npm view paglora@alpha version`.

Only a successful publication secures an unscoped name. Never commit your npm token or authentication data. Verify ownership and availability before any GitHub repository rename.
