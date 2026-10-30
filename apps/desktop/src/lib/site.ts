import { invoke } from "@tauri-apps/api/core";
import { marked } from "marked";
import { listPages, loadPage } from "@/lib/pages";

export type SiteSettings = {
  title: string;
  description: string;
  footerText: string;
};

export const loadSiteSettings = (projectId: string) =>
  invoke<SiteSettings>("load_site_settings", { projectId });

export const saveSiteSettings = (projectId: string, settings: SiteSettings) =>
  invoke<void>("save_site_settings", { projectId, settings });

const allowed = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "hr",
  "strong", "em", "del", "s", "code", "pre", "blockquote",
  "ul", "ol", "li", "a", "img", "table", "thead", "tbody",
  "tr", "th", "td", "sup", "sub",
]);

function safeLink(raw: string): string | null {
  const link = raw.trim();
  if (/^(https?:\/\/|mailto:)/i.test(link) || /^#[a-z\d_-]+$/i.test(link)) return link;
  // Link to a published Pageo page. Do not export filesystem paths or JS URLs.
  if (/^(?:\.\/)?[a-z\d-]+(?:\.md|\.html)?(?:#[a-z\d_-]+)?$/i.test(link)) {
    return link.replace(/\.md(?=#|$)/i, ".html");
  }
  return null;
}

function safeImage(raw: string): string | null {
  const link = raw.trim();
  // First static-site milestone supports externally hosted HTTPS media.
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
    const next = document.createElement(allowed.has(tag) ? tag : "span");
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
    return next;
  }

  for (const child of Array.from(doc.body.childNodes)) {
    const safe = clean(child);
    if (safe) sanitized.appendChild(safe);
  }
  return sanitized.innerHTML;
}

export async function buildPublicSite(projectId: string): Promise<string> {
  const pages = await listPages(projectId);
  const publicPages = pages.filter(page => page.isPublic);
  const rendered = await Promise.all(publicPages.map(async page => {
    const document = await loadPage(projectId, page.id);
    const html = await marked.parse(document.markdown);
    return { id: page.id, html: renderSafeMarkdown(html) };
  }));
  return invoke<string>("build_site", { projectId, rendered });
}
