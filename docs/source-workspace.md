# Project source editing — first milestone

Paglora projects are **source-owned**. The visual website designer does not own or replace your source code.

## Working today: custom CSS

Open a project and choose **Source** in the editor toolbar. Paglora opens a split view with **Monaco Editor** (the editor engine used by VS Code) on the left and the actual published-site preview on the right. Monaco provides CSS syntax highlighting, folding, completion and diagnostics; Ctrl+S saves the real project file. Its language workers are built by Vite as part of the app instead of relying on a CDN.

The file is stored in the project's local data directory:

```text
<project-directory>/
├── paglora.json           (Paglora project metadata)
├── docs/
│   └── index.md
├── pages.json
├── site.json
└── theme/
    └── custom.css         (your editable source stylesheet)
```

New projects contain `theme/custom.css` with commented examples. New Paglora projects contain a starter stylesheet. Missing CSS is treated as optional until you save from Source.

CSS is applied after the generated `styles.css`, so the user project overrides default selectors. Save CSS to refresh the preview.

The static export contains:

```text
site-exports/<project-id>/
├── index.html
├── <page-id>.html
├── styles.css
└── custom.css
```

Every exported HTML page links to `custom.css` when the project contains it. Do not edit `site-exports` as the source of truth: it is recreated at each build.

## Permissions and security

File operations use dedicated Rust Tauri commands restricted to the selected project and `theme/custom.css`. The frontend cannot provide arbitrary output paths. A project ID must match its existing local `paglora.json` file. Stylesheets are limited to 256 KB.

The live preview is a script-disabled iframe. Custom CSS may import external fonts or images just as normal CSS can. Keep a project's source code trusted, and do not execute user-authored JavaScript/TSX in Paglora's privileged desktop WebView.

## Planned next

This milestone **does not** compile React/TSX themes yet. The full source workspace will add a project file tree, Markdown/MDX/TSX file editing with this existing Monaco component, TSX component overrides, a safely isolated Vite build pipeline, and synchronized visual/source editing. We deliberately avoid shipping pretend TSX overrides that have no effect on output.

Monaco is an embedded source **editor**, not a full VS Code installation. This milestone edits `theme/custom.css`; installing Monaco does **not** automatically enable importing or compiling custom TSX site components. Built sites may continue loading Google Fonts, HTTPS images and other user-selected hosted resources.
