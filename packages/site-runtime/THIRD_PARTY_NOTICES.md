# Third-party notices for Paglora site runtime

Paglora's browser runtime code in `packages/site-runtime/src/` is original code authored for Paglora and released under the repository's MIT license.

Some interaction patterns were informed by VitePress, but its Vue components and source code are **not** bundled or copied into Paglora's runtime.

## VitePress

- Project: https://github.com/vuejs/vitepress
- License: MIT
- Copyright: Copyright (c) 2019-present Yuxi (Evan) You

## MiniSearch (potential future dependency)

- Project: https://github.com/lucaong/minisearch
- License: MIT
- Status: **not bundled as of this change**. The current Paglora search implementation is original, using native text matching.

**Distribution rule:** when copying third-party MIT-licensed implementation code or bundling a third-party package, include its exact upstream license and copyright notice in the generated website package. Do not imply that a project is bundled just because its design informed a feature. Add a CI check for the actual bundled licenses as part of the dependency integration PR.
