# Canvas block selection

Click a top-level heading, paragraph, list, quote, code block, table or divider on the website canvas to select it. Its outline exists only in the Studio preview; it is never included in exported HTML.

The inspector identifies the selected block. Double-click or use Edit selected block to open the Tiptap editor. Source navigation verifies node type and complete text, prefers the expected block index, and allows a fallback only when the match is unique. If mapping is ambiguous, it opens the page editor without guessing a cursor location.

Page navigation links still work. Inside article content, a normal click selects the containing block; Ctrl-click follows a link. Private pages continue to display the public Overview in the canvas.

This is not direct contenteditable-on-canvas yet, and it does not compile TSX. Source ownership and existing file formats are preserved.

## Manual Windows test cases

1. Select and double-click a unique heading and paragraph; focus should reach the corresponding Tiptap block.
2. Select duplicate headings, nested lists, code and images; mismatches must not focus the wrong source block.
3. Click links in both article content and navigation; verify Ctrl-click behavior.
4. Switch page, canvas size, light/dark desktop appearance and inspector visibility.
5. Confirm selecting a block never changes saved Markdown or exported HTML.
6. Test actual Windows Tauri WebView2: CI compilation does not prove iframe click handling.
