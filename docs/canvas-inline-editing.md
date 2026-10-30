# Direct inline text editing on the real website canvas

After selecting a page block in Canvas mode, **double-click an unformatted heading or paragraph** to edit its text in place. The site itself keeps the same real static preview renderer, CSS, font, responsive media queries and page navigation.

The Studio temporarily makes a verified text-only DOM element contenteditable. This is an input surface **only**: text is never serialized from a generated iframe into a new page format. On Enter or blur, the revised plain text is applied to the uniquely matched Tiptap source node using the existing ProseMirror transaction/autosave system. Esc cancels and restores the preview's original text. Paste is converted to single-line text.

Only direct plain text in a unique heading/paragraph is eligible. Links, bold/emphasis, inline code, nested blocks, lists, code fences, images, duplicate content and unmatched source nodes fall back to the existing Edit view. The same Properties text field introduced in #36 remains available.

The iframe still has **scripts disabled**: editing listeners are attached by the trusted parent Studio code through the Tauri same-origin preview, and not included in the published site. Selection outlines and contenteditable attributes never appear in static output.

## Windows WebView2 regression checklist

1. Double-click a unique H1/H2 or paragraph and type. Enter must commit to Tiptap and persist across closing/reopening Paglora; published HTML must match.
2. Double-click, modify, then press Esc: text must revert without modifying saved Markdown.
3. Click away: blur should commit once; Enter must not add a newline or double-save.
4. Paste multiline text; verify it becomes one line. Try 3001 characters and empty text: invalid changes must not overwrite the source.
5. Double-click a link-rich paragraph, duplicate heading, list, quote, code or image: safely open Edit, never silently flatten markup.
6. Verify source mapping errors do not overwrite other nodes. Check undo, autosave feedback, toggling artboard widths, selection inspector, responsive layout and Google Fonts.
7. Check dark and light Studio modes. Inspect exported files and confirm no Studio decoration classes, editable attributes or inline editing logic is present.

CI alone cannot validate Windows iframe caret or focus behavior; manual Windows WebView2 testing remains required.
