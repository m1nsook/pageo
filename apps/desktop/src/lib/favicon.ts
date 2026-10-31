/** Normalize user-provided icon images to a small, browser-supported PNG.
 * The original image stays local. No external favicon-generation service.
 */
export async function createFaviconPng(file: File): Promise<number[]> {
  if (!file.size || file.size > 5 * 1024 * 1024 ||
      !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
    throw new Error("Choose a PNG, JPEG, WebP or GIF under 5 MiB.");
  }
  const image = await createImageBitmap(file);
  try {
    if (!image.width || !image.height || image.width > 8192 || image.height > 8192) {
      throw new Error("Favicon image dimensions must be between 1 and 8192 pixels.");
    }
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas image conversion is unavailable.");
    ctx.clearRect(0, 0, 64, 64);
    const size = Math.min(64 / image.width, 64 / image.height);
    const w = image.width * size;
    const h = image.height * size;
    ctx.drawImage(image, (64 - w) / 2, (64 - h) / 2, w, h);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new Error("Cannot encode favicon PNG.")), "image/png");
    });
    if (blob.size > 100_000) throw new Error("Favicon output is unexpectedly large.");
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  } finally {
    image.close();
  }
}
