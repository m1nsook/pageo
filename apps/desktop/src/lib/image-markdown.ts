/** Only passive local assets or HTTPS images may enter the visual editor. */
export function isSafeImageSource(value: string): boolean {
  return /^assets\/[a-z0-9-]{1,90}\.(?:png|jpg|webp|gif)$/.test(value) ||
    (value.length <= 2048 && /^https:\/\/[^\s<>"'()\\]+$/i.test(value));
}

export function imageMarkdown(alt: string, src: string): string {
  if (!isSafeImageSource(src)) throw new Error("Unsafe image URL");
  const label = alt.slice(0, 300).replace(/\r?\n/g, " ")
    .replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
  return `![${label}](${src})`;
}

export function defaultImageAlt(url: string): string {
  return (url.split("/").pop() ?? "Image").replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim() || "Image";
}
