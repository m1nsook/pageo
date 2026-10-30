# Inline site studio

The project editor now has three main views: **Edit**, **Split**, and **Site**.

- **Edit** keeps the Tiptap writing interface, page navigation and optional block tools.
- **Split** shows the rich-text editor and the actual public website side by side. Saving a page refreshes the published-site renderer; you can also use the refresh button.
- **Site** gives the website the available canvas space, with navigation on the left.

This is a preview of **the generated website**, not a separate approximate React mockup. All three views use the same local project source and the existing Rust preview renderer; static builds still use the same publishing backend. No Paglora account or special hosting environment is required.

Site links to existing public documentation pages navigate inside the editor. External links cannot navigate the studio iframe; heading anchors work inside the preview. The iframe does not run arbitrary scripts from document content.

The app still keeps the dedicated **Source** CSS editor, **Design site** and **Build site** controls. The next milestone is a deeper integration of file/code editing into this main workspace rather than adding another modal.

The public site can still use **internet-loaded resources** such as user-configured HTTPS logos and links. Static hosting is the intended final deployment model; local-first describes project ownership and editing, not an offline-only restriction.

## Windows acceptance checks

1. Edit an existing public page, enter Split, modify text and verify the published preview updates after saving.
2. Switch among Edit, Split, Site without losing document content or selection.
3. In Site view, click public page links; ensure they change the selected editor page.
4. Select a private page, enter Site, and confirm it displays the public Overview without exposing private content.
5. Open Design site/Source and build the static website; check that existing projects remain unchanged and the generated HTML matches the preview.
