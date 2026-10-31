import { formatInlineCitation } from "./inline-citation";

export type BibliographyStyle = "apa" | "mla" | "chicago";
export type BibliographySource = {
  author: string;
  title: string;
  url: string;
  year: string;
  accessed: string;
};
function plain(value: string, name: string, max: number): string {
  const text = value.trim();
  if (!text || [...text].length > max || /[\r\n\[\]<>\\\x00-\x1f\x7f]/.test(text))
    throw new Error(name + " must be 1–" + max + " plain-text characters.");
  return text;
}
/** Portable Markdown references for basic web pages only. This does not claim
 * full journal, book, DOI, multi-author, or official academic-style compliance.
 */
export function formatBibliography(entries: BibliographySource[], style: BibliographyStyle): string {
  if (!["apa", "mla", "chicago"].includes(style)) throw new Error("Unsupported reference style.");
  if (entries.length < 1 || entries.length > 30) throw new Error("Select 1–30 references.");
  const list = entries.map(entry => {
    const author = plain(entry.author, "Author or organization", 120);
    const name = plain(entry.title, "Source title", 140);
    const year = entry.year.trim();
    if (year && (!/^\d{4}$/.test(year) || +year < 1500 || +year > 2100))
      throw new Error("Use a four-digit year between 1500 and 2100.");
    const link = formatInlineCitation(name, entry.url, entry.accessed);
    if (style === "apa") return author + ". (" + (year || "n.d.") + "). " + link + ".";
    if (style === "mla") return author + '. "' + link + '." ' + (year || "n.d.") + ".";
    return author + '. "' + link + '." Last modified ' + (year || "n.d.") + ".";
  });
  if (style === "apa") list.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return "## References\n\n" + list.map(line => "- " + line).join("\n") + "\n";
}
