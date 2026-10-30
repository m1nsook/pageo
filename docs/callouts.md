# Documentation callouts

Paglora supports modern documentation callouts directly in ordinary Markdown. They are rendered by the **same sanitized page pipeline** in both the Studio site preview and exported HTML.

Write a blockquote beginning with an admonition marker:

```md
> [!NOTE]
> This is useful background information.

> [!TIP]
> Keep examples focused and practical.

> [!IMPORTANT]
> Read this before proceeding.

> [!WARNING]
> This step changes project settings.

> [!CAUTION]
> Double-check destructive actions.
```

The supported markers are **NOTE**, **TIP**, **IMPORTANT**, **WARNING**, and **CAUTION**, case-insensitively. Other blockquotes remain ordinary quotations.

Callouts use first-party CSS and do not require external JavaScript, online services, accounts, or framework bundles. They adapt to the site's existing light/dark theme and are responsive.

## Source ownership and security

The original blockquote Markdown remains editable in Tiptap and is saved without conversion to proprietary markup. Callout enhancement runs **after** the existing sanitizer, and only recognizes a marker at the start of a paragraph in a blockquote. Published websites never receive Studio-only canvas selection/editing controls.

## Validation checklist

1. Preview and export all five variants. Compare typography, border, color and spacing on light and dark modes.
2. Verify normal blockquotes, nested links, bold text and fenced code are unchanged, including safe links and escaped raw HTML.
3. Verify a single-line marker with text and multiline blockquotes work.
4. Test narrow mobile viewports and a heading following the callout.
5. Edit a callout in Tiptap, save, reopen, and rebuild: marker and content must persist.
6. Verify the generated website works without scripts. Test the static export separately from the desktop preview.

CLI and desktop compilation checks do not replace visual and interactive Windows WebView2 testing.
