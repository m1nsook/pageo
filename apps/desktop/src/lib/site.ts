import { invoke } from "@tauri-apps/api/core";
import { marked } from "marked";
import { listPages, loadPage } from "@/lib/pages";

export type SiteLink = { label: string; url: string };

export type SiteBuildResult = {
  /** Absolute directory path of the completed, staged-then-installed export. */
  path: string;
  publicPages: number;
  privatePages: number;
  localImages: number;
  /** Only links from published pages are examined; no private source is exported. */
  warnings: string[];
};

export type SiteSettings = {
  title: string;
  description: string;
  footerText: string;
  /** Optional HTTPS root for canonical URLs and public-page sitemap. */
  siteUrl: string;
  navigationPosition: "left" | "right" | "top";
  headerAlignment: "left" | "center";
  stickyHeader: boolean;
  showFooter: boolean;
  contentWidth: number;
  logoUrl: string;
  headerLinks: SiteLink[];
  footerLinks: SiteLink[];
  themeMode: "system" | "light" | "dark";
  language: "en" | "ko" | "pl" | "de" | "fr" | "es" | "ja" | "zh-CN" | "zh-TW" | "pt-BR" | "ru" | "uk" | "ar" | "tr" | "it" | "cs" | "hu" | "th";
  accentColor: string;
  /** The generated HTML layout; legacy projects default to classic. */
  siteLayout: "classic" | "inset" | "reading";
  /** Neutral page surfaces; the custom accent is independent of the palette. */
  sitePalette: "original" | "graphite" | "lavender" | "linen";
  /** Consecutive Markdown cards can form a responsive grid without custom CSS. */
  cardLayout: "stacked" | "grid";
  googleFontFamily: string;
};

export const loadSiteSettings = (projectId: string) =>
  invoke<SiteSettings>("load_site_settings", { projectId });

export const saveSiteSettings = (projectId: string, settings: SiteSettings) =>
  invoke<void>("save_site_settings", { projectId, settings });

/** Store a local image inside the project and receive a safe assets/ URL. */
export const importSiteAsset = (projectId: string, filename: string, bytes: number[]) =>
  invoke<string>("import_site_asset", { projectId, filename, bytes });

const allowed = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "hr",
  "strong", "em", "del", "s", "code", "pre", "blockquote",
  "ul", "ol", "li", "a", "img", "table", "thead", "tbody",
  "tr", "th", "td", "sup", "sub", "details", "summary",
]);

function safeLink(raw: string): string | null {
  const link = raw.trim();
  if (/^(https?:\/\/|mailto:)/i.test(link) || /^#[\p{L}\p{N}_-]+$/u.test(link)) return link;
  // Link to a published Paglora page. Do not export filesystem paths or JS URLs.
  const page = /^(\.\/)?([a-z\d-]+)(?:\.(?:md|html))?(#[\p{L}\p{N}_-]+)?$/u.exec(link);
  if (page) {
    // Extensionless Markdown links must resolve to generated .html files too.
    return `${page[1] ?? ""}${page[2]}.html${page[3] ?? ""}`;
  }
  return null;
}

function safeImage(raw: string): string | null {
  const link = raw.trim();
  // Flat project-owned PNG/JPEG/WebP/GIF images are bundled only when
  // referenced by public pages. Never allow traversal, SVG or data URLs.
  if (/^assets\/[a-z0-9-]{1,90}\.(?:png|jpg|webp|gif)$/.test(link)) return link;
  return /^https:\/\/[^\s]+$/i.test(link) ? link : null;
}

/** Marked supports raw HTML, so never publish its output unfiltered. This
 * intentionally allows only simple documentation markup and safe link attributes.
 * Scripts, event handlers, inline styles, iframes, and arbitrary HTML are removed.
 */
export function renderSafeMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const sanitized = document.createElement("div");

  function clean(node: Node): Node | null {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent || "");
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    const element = node as Element;
    const tag = element.tagName.toLowerCase();
    if (["script", "style", "iframe", "object", "embed", "form", "svg", "math", "template"].includes(tag)) return null;
    // GFM task lists use <input type="checkbox">. Preserve only a disabled,
    // read-only checkbox: never pass through name, value, event handlers or
    // any other attributes from raw Markdown HTML.
    if (tag === "input") {
      if (element.getAttribute("type")?.toLowerCase() !== "checkbox") return null;
      const checkbox = document.createElement("input");
      checkbox.className = "paglora-task-checkbox";
      checkbox.setAttribute("type", "checkbox");
      checkbox.setAttribute("disabled", "");
      if (element.hasAttribute("checked")) checkbox.setAttribute("checked", "");
      checkbox.setAttribute("aria-label", element.hasAttribute("checked") ? "Completed task" : "Incomplete task");
      return checkbox;
    }
    const next = document.createElement(allowed.has(tag) ? tag : "span");
    // Native disclosure components work without JavaScript in both exported
    // HTML and the script-disabled Studio preview. Never copy event handlers.
    if (tag === "details") {
      next.className = "paglora-disclosure";
      if (element.hasAttribute("open")) next.setAttribute("open", "");
    }
    if (tag === "a") {
      const href = safeLink(element.getAttribute("href") || "");
      if (href) next.setAttribute("href", href);
      if (/^https?:\/\//i.test(href || "")) {
        next.setAttribute("rel", "noopener noreferrer");
      }
    }
    if (tag === "img") {
      const src = safeImage(element.getAttribute("src") || "");
      if (!src) return document.createTextNode(element.getAttribute("alt") || "");
      next.setAttribute("src", src);
      next.setAttribute("alt", (element.getAttribute("alt") || "").slice(0, 300));
      next.setAttribute("loading", "lazy");
    }
    for (const child of Array.from(element.childNodes)) {
      const item = clean(child);
      if (item) next.appendChild(item);
    }
    if (tag === "li" && next.querySelector("input.paglora-task-checkbox")) {
      next.classList.add("paglora-task-item");
    }
    return next;
  }

  for (const child of Array.from(doc.body.childNodes)) {
    const safe = clean(child);
    if (safe) sanitized.appendChild(safe);
  }
  return sanitized.innerHTML;
}

/** Convert GitHub-style Markdown admonitions and cards into first-party site components
 * after sanitizing all user HTML. The same transformation runs in preview and
 * static export, so the project's Markdown stays the source of truth.
 */
function enhanceCallouts(container: HTMLElement) {
  const labels: Record<string, string> = {
    NOTE: "Note", TIP: "Tip", IMPORTANT: "Important",
    WARNING: "Warning", CAUTION: "Caution",
  };
  for (const quote of Array.from(container.querySelectorAll("blockquote"))) {
    const first = quote.firstElementChild;
    if (!first || first.tagName.toLowerCase() !== "p") continue;
    const marker = first.firstChild;
    if (!marker || marker.nodeType !== Node.TEXT_NODE) continue;
    const text = marker.textContent ?? "";
    const match = /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|CARD|STEPS)\](?:\s|$)/i.exec(text);
    if (!match) continue;
    const type = match[1].toUpperCase();
    if (type === "CARD") {
      // A Markdown blockquote is the source of truth. Build only DOM nodes
      // from sanitized content, never from untrusted HTML or attributes.
      const card = document.createElement("section");
      card.className = "paglora-card";
      const heading = document.createElement("div");
      heading.className = "paglora-card-title";
      heading.textContent = text.slice(match[0].length).trim() || "Card";
      card.appendChild(heading);
      first.remove();
      while (quote.firstChild) card.appendChild(quote.firstChild);
      quote.replaceWith(card);
      continue;
    }
    if (type === "STEPS") {
      // Keep the ordered list as semantic HTML, so the timeline is readable
      // with JavaScript disabled and in assistive technologies.
      const list = Array.from(quote.children).find((child) => child.tagName === "OL");
      if (!list || !Array.from(list.children).some((child) => child.tagName === "LI")) continue;
      const titleText = text.slice(match[0].length).trim().slice(0, 160);
      const steps = document.createElement("section");
      steps.className = "paglora-steps";
      steps.setAttribute("aria-label", titleText || "Steps");
      if (titleText) {
        const heading = document.createElement("div");
        heading.className = "paglora-steps-title";
        heading.textContent = titleText;
        steps.appendChild(heading);
      }
      first.remove();
      list.classList.add("paglora-steps-list");
      while (quote.firstChild) steps.appendChild(quote.firstChild);
      quote.replaceWith(steps);
      continue;
    }
    const callout = document.createElement("aside");
    callout.className = `paglora-callout paglora-callout-${type.toLowerCase()}`;
    callout.setAttribute("role", "note");
    const title = document.createElement("div");
    title.className = "paglora-callout-title";
    title.textContent = labels[type];
    callout.appendChild(title);
    marker.textContent = text.slice(match[0].length);
    while (quote.firstChild) callout.appendChild(quote.firstChild);
    // The marker can occupy its own line and leave an empty paragraph.
    if (!first.textContent?.trim()) first.remove();
    quote.replaceWith(callout);
  }
}

/** Wrap only adjacent top-level cards; separate sections and single cards are
 * never forced into a grid. No raw HTML is copied or interpolated here.
 * Styling remains controlled by the validated site's cardLayout attribute.
 */
function groupAdjacentCards(container: HTMLElement) {
  let current = container.firstElementChild;
  while (current) {
    if (!current.classList.contains("paglora-card")) {
      current = current.nextElementSibling;
      continue;
    }
    let next = current.nextElementSibling;
    if (!next?.classList.contains("paglora-card")) {
      current = next;
      continue;
    }
    const grid = document.createElement("div");
    grid.className = "paglora-card-grid";
    current.before(grid);
    grid.appendChild(current);
    while (next?.classList.contains("paglora-card")) {
      const after: Element | null = next.nextElementSibling;
      grid.appendChild(next);
      next = after;
    }
    current = next;
  }
}

export type TocHeading = { id: string; title: string; level: 2 | 3 };

/** Use the final sanitized DOM as the source of heading anchors and the TOC.
 * Explicit IDs are generated after sanitization so neither raw HTML nor an
 * unsanitized Markdown heading can inject attributes into the exported site.
 */
function renderPageContent(markdownHtml: string): { html: string; toc: TocHeading[]; searchText: string } {
  const container = document.createElement("div");
  container.innerHTML = renderSafeMarkdown(markdownHtml);
  enhanceCallouts(container);
  groupAdjacentCards(container);
  const seen = new Set<string>();
  const toc: TocHeading[] = [];
  for (const heading of Array.from(container.querySelectorAll("h2, h3, h4"))) {
    const title = (heading.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 160);
    if (!title) continue;
    const slug = title.toLowerCase().normalize("NFKC")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || "section";
    let id = slug;
    for (let n = 2; seen.has(id); n += 1) id = `${slug}-${n}`;
    seen.add(id);
    heading.setAttribute("id", id);
    // h4 gets a permalink without crowding the two-level table of contents.
    if (heading.tagName !== "H4") toc.push({ id, title, level: heading.tagName === "H2" ? 2 : 3 });
  }
  // The index contains plain text extracted AFTER HTML sanitization.
  // Private documents are never passed to build_site by buildPublicSite.
  const searchText = Array.from(container.textContent ?? "").slice(0, 15_000).join("").replace(/\s+/g, " ").trim();
  return { html: container.innerHTML, toc: toc.slice(0, 100), searchText };
}

export async function buildPublicSite(projectId: string): Promise<SiteBuildResult> {
  const pages = await listPages(projectId);
  const publicPages = pages.filter(page => page.isPublic);
  const rendered = await Promise.all(publicPages.map(async page => {
    const document = await loadPage(projectId, page.id);
    const html = await marked.parse(document.markdown);
    return { id: page.id, ...renderPageContent(html) };
  }));
  return invoke<SiteBuildResult>("build_site", { projectId, rendered });
}

/** Render a public page with the same sanitized markup as static export.
 * Unlike buildPublicSite, this writes no files to disk.
 */
export async function previewPublicPage(projectId: string, pageId: string, settingsOverride?: SiteSettings): Promise<string> {
  const document = await loadPage(projectId, pageId);
  const html = await marked.parse(document.markdown);
  return invoke<string>("preview_site_page", {
    projectId,
    rendered: { id: pageId, ...renderPageContent(html) },
    settingsOverride,
  });
}
