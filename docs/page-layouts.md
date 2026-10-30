# Page layouts: Docs, Wide, and Landing

Paglora pages can choose a layout from the **Pages** sidebar.

Open a project's **Pages** sidebar, choose **⋯** beside a page, and select **Page layout**. Choose one of:

- **Docs** — polished documentation shell, left or right navigation, article column, and an automatic “On this page” table of contents for H2/H3 headings.
- **Wide** — keeps normal page navigation but removes the TOC and gives the article more room. Useful for tutorials with images, comparison tables, and examples.
- **Landing** — removes the document sidebar and TOC, expands the content area, and styles the first heading and paragraph as a hero. Good for a documentation homepage or product landing page.

Page layouts are applied by the same Rust HTML renderer in both preview and static export. No account or external service is required.

## Storage

Each page's layout is saved in the existing `pages.json` manifest:

```json
{
  "id": "index",
  "title": "Overview",
  "isPublic": true,
  "layout": "landing"
}
```

The default for all older files (which lack `layout`) is **Docs**. No migration is required. Duplicated pages inherit the source page layout; newly created pages start as Docs. Setting a layout does not rewrite Markdown content.

For a Landing page, put a single `# Headline` followed by a paragraph to get the hero treatment. Later milestones will add visual hero sections, feature grids, CTA components, and proper MDX/TSX component overrides. Currently it is a layout mode and typography treatment, **not yet a full drag-and-drop landing-page builder**.

Your project-local `theme/custom.css` can override any generated layout styles. The final static output is regular HTML/CSS, with no client-side React runtime required.
