/** Bounded image gallery for the local-first Studio. Large images are only
 * previewed on selection, rather than eagerly decoding every project asset. */
export const IMAGE_GALLERY_PAGE_SIZE = 24;
export const INLINE_THUMBNAIL_LIMIT = 256 * 1024;

export function filterSiteAssets<T extends { url: string }>(assets: readonly T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...assets];
  return assets.filter(asset => asset.url.slice("assets/".length).toLowerCase().includes(needle));
}
