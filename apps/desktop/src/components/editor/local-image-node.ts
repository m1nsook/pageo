import { Node } from "@tiptap/core";
import { imageMarkdown, isSafeImageSource } from "@/lib/image-markdown";

/** Source-owned Markdown images. The editor shows a labeled placeholder because
 * assets/ belongs to the static site, not the Vite app. Canvas renders the image.
 */
export const LocalImageNode = Node.create({
  name: "pagloraImage",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { src: { default: "" }, alt: { default: "" }, title: { default: null } };
  },
  parseHTML() { return [{ tag: "img[src]" }]; },
  renderHTML({ node }) {
    const src = String(node.attrs.src ?? "");
    const alt = String(node.attrs.alt ?? "");
    const label = alt || "Image";
    return ["span", { class: "paglora-editor-image", role: "img",
      "aria-label": label, title: isSafeImageSource(src) ? src : "Image" },
      `Image: ${label}`];
  },
  markdownTokenName: "image",
  parseMarkdown(token, helpers) {
    const src = String(token.href ?? "");
    const alt = String(token.text ?? "");
    if (!isSafeImageSource(src)) return helpers.createTextNode(alt || "Image");
    return { type: "pagloraImage", attrs: { src, alt, title: token.title ?? null } };
  },
  renderMarkdown(node) {
    const src = String(node.attrs?.src ?? "");
    const alt = String(node.attrs?.alt ?? "");
    return isSafeImageSource(src) ? imageMarkdown(alt, src) : alt;
  },
});
