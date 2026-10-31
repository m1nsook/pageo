import packageInfo from "../../package.json";
import rawNotes from "../../../../.github/releases/v0.2.0.md?raw";
export const STUDIO_VERSION = packageInfo.version;
export const RELEASE_URL = "https://github.com/m1nsook/paglora/releases";
export interface ReleaseSection { name: string; items: string[]; }
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
export const RELEASE_NOTES = parseReleaseNotes(rawNotes);
