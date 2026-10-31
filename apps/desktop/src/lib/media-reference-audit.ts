import type { SiteAsset } from "@/lib/site";

export type AssetReference = { url: string; locations: string[]; status: "referenced" | "not-found" };
/** Conservative audit of text references only. A "not-found" result never
 * authorizes deletion: plugins, embedded HTML and future CSS may use the asset.
 */
export function auditImageReferences(
  assets: readonly SiteAsset[],
  pageSources: ReadonlyArray<{ title: string; markdown: string }>,
  css: string,
  logo: string,
): AssetReference[] {
  return assets.map(asset => {
    const locations: string[] = [];
    for (const page of pageSources) {
      if (page.markdown.includes(asset.url)) locations.push(page.title);
    }
    if (css.includes(asset.url)) locations.push("Theme CSS");
    if (logo === asset.url || (logo.startsWith("/") && logo.slice(1) === asset.url)) locations.push("Site logo");
    return { url: asset.url, locations, status: locations.length ? "referenced" : "not-found" };
  });
}
