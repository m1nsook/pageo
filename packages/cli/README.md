# Pageo CLI

Official command-line tools for [Pageo](https://github.com/m1nsook/pageo), a local-first documentation studio.

> **Early alpha.** This package currently provides useful project inspection and validation. Creating and exporting sites remains available in Pageo Desktop. The CLI does not yet build public websites.

Install with Bun:

```bash
bun add --global pageo
pageo --help
pageo inspect "C:\\path\\to\\app-data\\projects\\my-docs"
pageo validate "C:\\path\\to\\app-data\\projects\\my-docs"
```

Or run without installing:

```bash
bunx --bun pageo inspect ./projects/my-docs
```

`inspect --json` returns machine-readable information about a project, including which pages are public or private.

## Maintainer publication

This package is intended to be published from the `packages/cli` directory under the `pageo` name. **A GitHub repository or pull request does not reserve a name on npm.** Only a successful publication under the maintainer's authenticated npm account claims it.

Run `bun run test`, `npm pack --dry-run`, and publish from the directory using `npm publish --access public --tag alpha` after verifying the npm account and exact package name availability.

Do not commit npm tokens or publish an empty placeholder package.
