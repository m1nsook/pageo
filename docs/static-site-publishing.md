# Static website publishing (early preview)

Pageo can generate a standalone website from a local documentation project. Nothing is uploaded automatically.

## Build a public site

1. Open a project in Pageo Desktop.
2. Use each page's **⋯** or right-click menu to choose **Make public** or **Make private**. The Overview page is always the public home page.
3. Click **Website** in the editor toolbar.
4. Set the **header title**, **description** and **footer text**.
5. Click **Build static site**.

Pageo writes a new local directory under its application data:

```text
site-exports/
  <project-id>/
    index.html
    getting-started.html
    other-public-page.html
    styles.css
```

Use the exact export directory displayed by Pageo. Open `index.html` to inspect the exported site, then upload the **contents of that directory** to any static host.

The site uses standard static HTML and CSS. It does not require Pageo, a JavaScript runtime, a login, or a database to serve.

## What becomes public

Only pages marked **Public** are exported; pages marked **Private** remain in the local project and do not appear in the navigation or output folder.

**Important:** This is not access control on a web server. If you upload private source files yourself, Pageo cannot prevent exposure. Only upload Pageo's generated `site-exports/<project-id>/` contents.

Existing projects remain compatible. Pages written before the visibility feature are treated as public by default; mark sensitive pages private before publishing.

## Header, navigation and footer

The header displays the configured website title. The left navigation lists public pages in your chosen order and highlights the current page. The footer displays the configured footer text. Layout responds to narrow screens.

This milestone provides a fixed documentation layout with configurable text, **not** a free-form header/footer layout editor yet.

## Current limitations

- Generated sites do not include search, custom domain management, sitemap, automatic hosting/deploy, or theme editing.
- The Markdown renderer supports normal documentation content. Scripts, raw HTML widgets and unsafe links are intentionally excluded from exported content.
- External **HTTPS** images are supported. Local images are not packaged into the export yet.
- Links to another Pageo page should use that page's Markdown filename (for example `getting-started.md`); the renderer turns it into `getting-started.html`.
- Rich interactive shadcn components in public output require a dedicated persistence and JavaScript bundling system and are **not yet exported**.

## Troubleshooting

If a page does not appear on the website, check that it is marked Public, then build again. The generated folder is replaced on every successful build, so files from pages that were later made private are removed from the current export.
