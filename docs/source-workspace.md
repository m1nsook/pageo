# Project source editing — first milestone

Paglora projects are **source-owned**. The visual website designer does not own or replace your source code.

## Working today: custom CSS

Open a project and choose **Source** in the editor toolbar. Paglora opens a split view with a real editable source file on the left and its generated HTML preview on the right.

The file is stored in the project's local data directory:

```text
<project-directory>/
├── pageo.json             (legacy v1 metadata; do not rename)
├── docs/
│   └── index.md
├── pages.json
├── site.json
└── theme/
    └── custom.css         (your editable source stylesheet)
```

New projects contain `theme/custom.css` with commented examples. Existing Pageo/Paglora projects are compatible: missing CSS is treated as optional until you save it from Source.

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

File operations use dedicated Rust Tauri commands restricted to the selected project and `theme/custom.css`. The frontend cannot provide arbitrary output paths. A project ID must match its existing local `pageo.json` file. Stylesheets are limited to 256 KB.

The live preview is a script-disabled iframe. Custom CSS may import external fonts or images just as normal CSS can. Keep a project's source code trusted, and do not execute user-authored JavaScript/TSX in Paglora's privileged desktop WebView.

## Planned next

This milestone **does not** compile React/TSX themes yet. The full source workspace will add a project file tree, a dedicated code editor (CodeMirror or Monaco), TSX component overrides, a sandboxed Vite build pipeline, and synchronized visual/source editing. We deliberately avoid shipping pretend TSX overrides that have no effect on output.
