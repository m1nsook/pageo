#!/usr/bin/env node
/**
 * Prepare sanitized public Markdown pages using the same DOM allowlist and
 * first-party component semantics as Studio's src/lib/site.ts.
 * The Rust paglora-build binary then generates the SAME site shell as Desktop.
 */
import { readFileSync, writeFileSync, lstatSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { marked } from "marked";
import { parseHTML } from "linkedom";

const [projectArg, outputArg] = process.argv.slice(2);
if (!projectArg || !outputArg) {
  console.error("Usage: node tools/headless/render.mjs <project-folder> <prepared-pages.json>");
  process.exit(2);
}
const project = resolve(projectArg);
const output = resolve(outputArg);
const MAX_MARKDOWN = 5_000_000;
const safeId = value => typeof value === "string" && /^[a-z0-9-]{1,80}$/.test(value);
const readRegular = file => {
  if (!lstatSync(file).isFile()) throw new Error("Expected a regular source file: " + file);
  return readFileSync(file, "utf8");
};
const escapeHtml = value => String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;")
  .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const safeLink = raw => {
  const link = raw.trim();
  if (/^(https?:\/\/|mailto:)/i.test(link) || /^#[\p{L}\p{N}_-]+$/u.test(link)) return link;
  const page = /^(\.\/)?([a-z\d-]+)(?:\.(?:md|html))?(#[\p{L}\p{N}_-]+)?$/u.exec(link);
  return page ? (page[1] ?? "") + page[2] + ".html" + (page[3] ?? "") : null;
};
const safeImage = raw => {
  const source = raw.trim();
  if (/^assets\/[a-z0-9-]{1,90}\.(?:png|jpg|webp|gif)$/.test(source)) return source;
  return /^https:\/\/[^\s]+$/i.test(source) ? source : null;
};
const allowed = new Set([
  "h1","h2","h3","h4","h5","h6","p","br","hr","strong","em","del","s",
  "code","pre","blockquote","ul","ol","li","a","img","table","thead",
  "tbody","tr","th","td","sup","sub","details","summary"
]);
const danger = new Set(["script","style","iframe","object","embed","form","svg","math","template"]);
function sanitize(html, document) {
  const parse = document.createElement("div");
  parse.innerHTML = html;
  const result = document.createElement("div");
  const clean = node => {
    if (node.nodeType === 3) return document.createTextNode(node.textContent || "");
    if (node.nodeType !== 1) return null;
    const tag = node.tagName.toLowerCase();
    if (danger.has(tag)) return null;
    if (tag === "input") {
      if (node.getAttribute("type")?.toLowerCase() !== "checkbox") return null;
      const checkbox = document.createElement("input");
      checkbox.className = "paglora-task-checkbox";
      checkbox.setAttribute("type", "checkbox");
      checkbox.setAttribute("disabled", "");
      if (node.hasAttribute("checked")) checkbox.setAttribute("checked", "");
      checkbox.setAttribute("aria-label", node.hasAttribute("checked") ? "Completed task" : "Incomplete task");
      return checkbox;
    }
    const next = document.createElement(allowed.has(tag) ? tag : "span");
    if (tag === "details") {
      next.className = "paglora-disclosure";
      if (node.hasAttribute("open")) next.setAttribute("open", "");
    }
    if (tag === "a") {
      const href = safeLink(node.getAttribute("href") || "");
      if (href) next.setAttribute("href", href);
      if (/^https?:\/\//i.test(href || "")) next.setAttribute("rel", "noopener noreferrer");
    }
    if (tag === "img") {
      const src = safeImage(node.getAttribute("src") || "");
      if (!src) return document.createTextNode(node.getAttribute("alt") || "");
      next.setAttribute("src", src);
      next.setAttribute("alt", (node.getAttribute("alt") || "").slice(0,300));
      next.setAttribute("loading", "lazy");
    }
    for (const child of [...node.childNodes]) {
      const item = clean(child);
      if (item) next.appendChild(item);
    }
    if (tag === "li" && next.querySelector("input.paglora-task-checkbox")) {
      next.classList.add("paglora-task-item");
    }
    return next;
  };
  for (const node of [...parse.childNodes]) {
    const value = clean(node);
    if (value) result.appendChild(value);
  }
  return result;
}
function localize(lang) {
  const base = file => JSON.parse(readRegular(file)).messages;
  const en = base(new URL("../../apps/desktop/src/i18n/locales/en.json", import.meta.url));
  let selected = {};
  if (/^[a-z]{2}(?:-[A-Z]{2})?$/.test(lang)) {
    try { selected = base(new URL("../../apps/desktop/src/i18n/locales/"+lang+".json", import.meta.url)); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  return key => selected[key] || en[key] || key;
}
function enhance(root, document, translate) {
  for (const quote of [...root.querySelectorAll("blockquote")]) {
    const first = quote.firstElementChild;
    if (!first || first.tagName.toLowerCase() !== "p") continue;
    const marker = first.firstChild;
    if (!marker || marker.nodeType !== 3) continue;
    const text = marker.textContent || "";
    const match = /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|CARD|STEPS)\](?:\s|$)/i.exec(text);
    if (!match) continue;
    const kind = match[1].toUpperCase();
    if (kind === "CARD") {
      const card = document.createElement("section");
      card.className = "paglora-card";
      const heading = document.createElement("div");
      heading.className = "paglora-card-title";
      heading.textContent = text.slice(match[0].length).trim() || "Card";
      card.appendChild(heading);
      marker.textContent = "";
      if(!first.textContent?.trim())first.remove();
      while (quote.firstChild) card.appendChild(quote.firstChild);
      quote.replaceWith(card); continue;
    }
    if (kind === "STEPS") {
      const list = [...quote.children].find(node=>node.tagName==="OL");
      if (!list || ![...list.children].some(node=>node.tagName==="LI")) continue;
      const title = text.slice(match[0].length).trim().slice(0,160);
      const step = document.createElement("section");
      step.className = "paglora-steps";
      step.setAttribute("aria-label",title||"Steps");
      if(title) {
        const heading=document.createElement("div");
        heading.className="paglora-steps-title";heading.textContent=title;
        step.appendChild(heading);
      }
      first.remove();list.classList.add("paglora-steps-list");
      while(quote.firstChild)step.appendChild(quote.firstChild);
      quote.replaceWith(step);continue;
    }
    const alert=document.createElement("aside");
    alert.className="paglora-callout paglora-callout-"+kind.toLowerCase();
    alert.setAttribute("role","note");
    const title=document.createElement("div");
    title.className="paglora-callout-title";
    title.textContent=translate("docs.callout."+kind.toLowerCase());
    alert.appendChild(title);
    marker.textContent=text.slice(match[0].length);
    while(quote.firstChild)alert.appendChild(quote.firstChild);
    if(!first.textContent?.trim())first.remove();
    quote.replaceWith(alert);
  }
  let current=root.firstElementChild;
  while(current) {
    if(!current.classList.contains("paglora-card")) {current=current.nextElementSibling;continue;}
    let next=current.nextElementSibling;
    if(!next?.classList.contains("paglora-card")) {current=next;continue;}
    const grid=document.createElement("div");
    grid.className="paglora-card-grid";
    current.before(grid);grid.appendChild(current);
    while(next?.classList.contains("paglora-card")) {
      const after=next.nextElementSibling;grid.appendChild(next);next=after;
    }
    current=next;
  }
}
function renderMarkdown(source, lang) {
  const { document } = parseHTML("<!doctype html><html><head></head><body></body></html>");
  const html = marked.parse(source, { gfm: true });
  const root = sanitize(html, document);
  enhance(root,document,localize(lang));
  const seen = new Set(), toc = [];
  for(const heading of [...root.querySelectorAll("h2,h3,h4")]) {
    const title=(heading.textContent||"").trim().replace(/\s+/g," ").slice(0,160);
    if(!title)continue;
    const slug=title.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu,"-").replace(/^-+|-+$/g,"")||"section";
    let id=slug;
    for(let n=2;seen.has(id);n++)id=slug+"-"+n;
    seen.add(id);heading.setAttribute("id",id);
    if(heading.tagName!=="H4")toc.push({id,title,level:heading.tagName==="H2"?2:3});
  }
  const searchText=Array.from(root.textContent||"").slice(0,15_000).join("").replace(/\s+/g," ").trim();
  return {html:root.innerHTML,toc:toc.slice(0,100),searchText};
}
export function prepare(projectDir) {
  const meta = JSON.parse(readRegular(join(projectDir,"paglora.json")));
  if (meta.formatVersion!==1 || !safeId(meta.id) || meta.id!==basename(projectDir)) {
    throw new Error("Invalid project manifest/folder");
  }
  const manifest=JSON.parse(readRegular(join(projectDir,"pages.json")));
  if (manifest.formatVersion!==1 || !Array.isArray(manifest.pages) || manifest.pages.length===0 ||
      manifest.pages[0].id!=="index" || manifest.pages[0].isPublic!==true ||
      manifest.pages.length>500)throw new Error("Invalid page manifest");
  const settings=JSON.parse(readRegular(join(projectDir,"site.json")));
  const lang=settings.language||"en";
  const unique=new Set();
  const rendered=[];
  for(const page of manifest.pages) {
    if(!safeId(page.id) || unique.has(page.id))throw new Error("Duplicate or invalid page id");
    unique.add(page.id);
    if(!page.isPublic)continue;
    const markdown=readRegular(join(projectDir,"docs",page.id+".md"));
    if(Buffer.byteLength(markdown,"utf8")>MAX_MARKDOWN)throw new Error("Page exceeds 5 MiB limit");
    rendered.push({id:page.id,...renderMarkdown(markdown,lang)});
  }
  return rendered;
}
try {
  const rendered=prepare(project);
  writeFileSync(output,JSON.stringify(rendered));
  console.log("Prepared "+rendered.length+" public documentation pages; no private Markdown exported.");
} catch(error) {
  console.error("Paglora headless Markdown preparation failed: "+error.message);
  process.exit(1);
}
