# Safe plain-text editing from the canvas

This milestone builds on canvas block selection (#35).

When a heading or paragraph contains only plain unformatted text and can be uniquely matched to a source node, the Properties inspector displays a Text field and **Apply text to page**. Applying text uses a ProseMirror transaction on the verified Tiptap node; it preserves the heading/paragraph type and triggers the existing Markdown autosave, then the real website preview is regenerated.

The inline inspector deliberately refuses to edit ambiguous duplicate content and blocks with inline links, emphasis, code, images, hard breaks or nested structures. In those cases use **Edit selected block** to open Tiptap instead.

No new Markdown format, migration, hosted backend, arbitrary filesystem access or iframe DOM serialization is introduced. Generated static output remains the same renderer and user-owned project files remain authoritative.

## Manual Windows regression checklist

- Edit an unformatted H1/H2/paragraph using Properties. Confirm the saved Markdown and published HTML match the edited text after restart and export.
- Verify duplicate paragraphs, links, styled text, lists, quotes, code and image paragraphs cannot be rewritten through the simplified Text field.
- Try empty text, newlines, long text and special Markdown characters. Ensure no malformed pages or unexpected formatting.
- Verify changing the selected block while unsaved inspector input exists does not write anything automatically.
- Check undo, autosave, preview refresh, site build and light/dark appearance in Windows Tauri WebView2.

Automated TypeScript/Vite and Rust checks do **not** replace the interactive desktop tests.
