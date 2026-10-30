# Canvas-first Studio

Paglora Studio combines a Figma-style workspace with documentation editing. It is a **local-first project editor**, not an offline-only product. Published websites can load Google Fonts, external stylesheets and images from the internet.

## Working in this milestone

When opening a project, the **Canvas** is the default view. It shows the **real Rust-rendered website**, using the same page markup as preview and static build rather than a separate design-only mockup.

- **Pages (left)**: the existing page tree, visibility, reordering and page actions, with a hide/show control in the top bar.
- **Canvas (center)**: desktop (1280 px), tablet (768 px), and phone (390 px) frame widths, zoom controls and Fit. These widths affect actual CSS media queries inside the generated website iframe.
- **Properties (right)**: page title, Docs/Wide/Landing layout, and public/private visibility. These controls write the existing manifest through the original scoped Rust commands. The properties panel can be hidden.
- **Edit**: the existing Tiptap WYSIWYG editor for Markdown, including the existing block toolbar and autosave.
- **Split**: rich-text editor and the real website preview side by side.
- **Source**: integrated Monaco for project CSS (from the separate Monaco source-editor milestone).
- **Design site** and **Build site**: the existing settings and actual static output remain intact.

The app's workspace sidebar is not shown while a documentation project is open. The pages panel takes its place to give the canvas more room. Back to projects is available in the editor header.

Opening a private page displays the **public Overview** in the canvas; private Markdown is not exposed in the generated website preview. The iframe is script-disabled and internal page links are routed through the project editor.

## Not yet implemented

This is a **canvas-first shell and working page-property editing**, not a full Figma canvas. In particular, clicking a heading or paragraph does not yet select a corresponding editable document block. The generated preview HTML is not an editable source of truth. Arbitrary absolute positioning would break responsive documentation layouts, so the eventual visual builder should use structured, responsive layout components.

The next milestone should introduce stable block identifiers in Paglora's content model and use them to synchronize:
1. Selection of a rendered block in the canvas
2. The corresponding editable Tiptap document block or source location
3. A contextual inspector with working, source-persisted settings

Do not write changes to the iframe DOM and claim they persist. Generated HTML is recreated during export; edits must update project source so preview and export remain identical.

## Regression checks

On a Windows Tauri WebView2 desktop build:

1. Open an existing project and confirm Canvas loads without deleting content.
2. Switch desktop/tablet/phone; confirm media queries respond and the CSS layout does not overflow the artboard.
3. Use Fit and manual zoom; verify controls work when the Pages/Properties panels are toggled.
4. Change title, page layout and visibility; reopen the project and confirm they persist.
5. Check private page fallback, internal page links and website preview refresh.
6. Switch between Edit, Split and Canvas; verify Markdown formatting and autosave are unchanged.
7. Save project CSS from Source and verify the generated static site honors it.
8. Check app light/dark theme, actual hosted Google Fonts, and build output.

CI TypeScript/Vite checks validate compilation; **they do not replace manual visual/interaction testing**.
