# Contributing to Paglora

Thanks for helping make Paglora better.

## Before submitting work

- Search [Issues](https://github.com/m1nsook/paglora/issues) and [Discussions](https://github.com/m1nsook/paglora/discussions) first.
- For large changes or architectural decisions, open a discussion or feature request before implementation.
- Use a descriptive branch name, such as `feat/editor-toolbar` or `fix/export-paths`.
- Keep pull requests focused and describe how to reproduce or test your changes.
- Don't introduce mandatory cloud services, accounts, or telemetry without prior agreement.

## Development

The active stack is Bun, React 19, TypeScript, Vite, Tailwind 4, official shadcn/ui, Tiptap Markdown and Tauri 2/Rust. Run `bun install`, `bun run check` and `bun run build` at the root. For the desktop backend, Rust/Tauri checks run in CI on Windows. For the npm CLI, run `cd packages/cli && bun run test` and `npm pack --dry-run`.

Use the canonical Tauri identifier `com.m1nsook.paglora` and project manifest filename `paglora.json`. Changes to persistent project formats must update Rust, CLI validation, tests, and documentation together.

## Pull requests

Include a summary, any related issue, and test notes. Screenshots are helpful for user-interface changes, but not required.

## Reporting vulnerabilities

Please use the private reporting process described in [SECURITY.md](SECURITY.md), not a public issue.
