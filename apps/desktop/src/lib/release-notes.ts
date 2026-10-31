import packageInfo from "../../package.json";

export const STUDIO_VERSION = packageInfo.version;
export const RELEASE_URL = "https://github.com/m1nsook/paglora/releases";

export interface ReleaseSection { name: string; items: string[]; }

/** Vite bundles curated notes for each version. Never show old notes as a newer release. */
const releaseFiles = import.meta.glob("../../../../.github/releases/v*.md", {
  query: "?raw", import: "default", eager: true,
}) as Record<string, string>;
const releaseSource = Object.entries(releaseFiles)
  .find(([path]) => path.endsWith("/v" + STUDIO_VERSION + ".md"))?.[1] || "";

export function parseReleaseNotes(notes: string): ReleaseSection[] {
  const sections: ReleaseSection[] = [];
  let active: ReleaseSection | undefined;
  for (const line of notes.split(/\r?\n/)) {
    if (line.startsWith("## ")) {
      active = {name:line.slice(3).trim(),items:[]};
      sections.push(active);
    } else if (active && line.startsWith("- ")) {
      active.items.push(line.slice(2).trim());
    }
  }
  return sections;
}
export const RELEASE_NOTES = parseReleaseNotes(releaseSource);
