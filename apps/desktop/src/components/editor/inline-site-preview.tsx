import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from "react";
import {
  AlertCircle, Globe2, LoaderCircle, Maximize2, Minus, Monitor,
  Plus, RefreshCw, Smartphone, Tablet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Page } from "@/lib/pages";
import { normalizeCanvasText, type CanvasBlockSelection } from "@/lib/canvas-blocks";
import { previewPublicPage } from "@/lib/site";

type Device = "desktop" | "tablet" | "phone";
const deviceWidths: Record<Device, number> = { desktop: 1280, tablet: 768, phone: 390 };
const deviceNames: Record<Device, string> = { desktop: "Desktop", tablet: "Tablet", phone: "Phone" };

const selectable = new Set(["h1","h2","h3","h4","h5","h6","p","ul","ol","blockquote","pre","table","hr"]);
function selectedSourceBlock(article: Element | null, target: EventTarget | null): { index: number; block: Element } | null {
  // iframe elements belong to its own realm, so parent-window instanceof Element fails.
  if (!article || !target || (target as Node).nodeType !== 1) return null;
  let node: Element | null = target as Element;
  while (node && node.parentElement !== article) node = node.parentElement;
  if (!node || node.parentElement !== article || !selectable.has(node.tagName.toLowerCase())) return null;
  const index = Array.from(article.children).indexOf(node);
  return index >= 0 ? { index, block: node } : null;
}
function paintSelection(doc: Document, selected: CanvasBlockSelection | null): void {
  const article = doc.querySelector("article.docs");
  article?.querySelector(".paglora-studio-selected")?.classList.remove("paglora-studio-selected");
  if (!article || !selected) return;
  const node = article.children.item(selected.index);
  if (node?.tagName.toLowerCase() === selected.tagName &&
      normalizeCanvasText(node.textContent ?? "") === selected.text) {
    node.classList.add("paglora-studio-selected");
  }
}
function describeError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/** The actual static-site renderer in a sized, zoomable design canvas.
 * Only the studio chrome changes: scripts are still disabled inside the frame.
 * Page content is never rewritten by manipulating this generated DOM.
 */
export function InlineSitePreview({
  projectId, page, pages, savedVersion, onNavigate, onBeforeRefresh,
  selectedBlock, onBlockSelect, onBlockEdit, canInlineTextEdit, onApplyInlineText,
}: {
  projectId: string;
  page: Page;
  pages: Page[];
  savedVersion: number;
  onNavigate: (pageId: string) => void;
  onBeforeRefresh: () => Promise<void>;
  selectedBlock: CanvasBlockSelection | null;
  onBlockSelect: (selected: CanvasBlockSelection | null) => void;
  onBlockEdit: (selected: CanvasBlockSelection) => void;
  canInlineTextEdit: (selected: CanvasBlockSelection) => boolean;
  onApplyInlineText: (selected: CanvasBlockSelection, text: string) => boolean;
}) {
  const [html, setHtml] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [device, setDevice] = useState<Device>("desktop");
  const [fit, setFit] = useState(true);
  const [zoom, setZoom] = useState(100);
  const viewportRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const selectedRef = useRef(selectedBlock);
  selectedRef.current = selectedBlock;
  // DOM listeners attached to an existing iframe must always call current
  // source-editor callbacks, even if Tiptap initialized after iframe load.
  const canInlineRef = useRef(canInlineTextEdit);
  canInlineRef.current = canInlineTextEdit;
  const applyInlineRef = useRef(onApplyInlineText);
  applyInlineRef.current = onApplyInlineText;
  const [space, setSpace] = useState({ width: 1000, height: 700 });
  const previewPageId = page.isPublic ? page.id : "index";

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const measure = () => setSpace({ width: viewport.clientWidth, height: viewport.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    setBusy(true);
    setError("");
    void previewPublicPage(projectId, previewPageId)
      .then(result => { if (active) setHtml(result); })
      .catch(cause => { if (active) { setError(describeError(cause)); setHtml(""); } })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [projectId, previewPageId, savedVersion, reload, page.layout, page.title, page.isPublic]);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      await onBeforeRefresh();
      setReload(value => value + 1);
    } catch (cause) {
      setError(describeError(cause));
      setBusy(false);
    }
  }, [onBeforeRefresh]);

  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    if (doc) paintSelection(doc, selectedBlock);
  }, [selectedBlock, html]);

  const onFrameLoad = useCallback((event: SyntheticEvent<HTMLIFrameElement>) => {
    const doc = event.currentTarget.contentDocument;
    if (!doc) return;
    const canvasDoc: Document = doc;
    const article = canvasDoc.querySelector("article.docs");
    if (article && page.isPublic) {
      const decorations = doc.createElement("style");
      decorations.textContent = '.docs > :is(h1,h2,h3,h4,h5,h6,p,ul,ol,blockquote,pre,table,hr){cursor:pointer}.docs > :is(h1,h2,h3,h4,h5,h6,p,ul,ol,blockquote,pre,table,hr):hover{outline:1px dashed #4299ff;outline-offset:4px}.docs > .paglora-studio-selected,.docs > .paglora-studio-selected:hover{outline:2px solid #2684ff!important;outline-offset:5px!important}';
      doc.head.appendChild(decorations);
    }
    paintSelection(doc, selectedRef.current);

    let editing: HTMLElement | null = null;
    const beginInlineText = (block: HTMLElement, selected: CanvasBlockSelection) => {
      if (editing || !canInlineRef.current(selected)) return false;
      // Only direct text nodes may be made contenteditable. Links, code and
      // nested markup must never be flattened by the temporary DOM editor.
      if (block.childNodes.length !== 1 || block.firstChild?.nodeType !== 3 ||
          !(/^(h[1-6]|p)$/.test(selected.tagName))) return false;
      editing = block;
      const previous = block.textContent ?? "";
      const originalTabIndex = block.getAttribute("tabindex");
      let finished = false;
      block.setAttribute("contenteditable", "plaintext-only");
      block.setAttribute("spellcheck", "true");
      block.setAttribute("tabindex", "-1");
      block.style.cursor = "text";

      function finish(save: boolean) {
        if (finished) return;
        finished = true;
        block.removeEventListener("blur", onBlur);
        block.removeEventListener("keydown", onKey);
        block.removeEventListener("paste", onPaste);
        const next = block.textContent ?? "";
        editing = null;
        block.removeAttribute("contenteditable");
        block.removeAttribute("spellcheck");
        block.style.removeProperty("cursor");
        if (originalTabIndex === null) block.removeAttribute("tabindex");
        else block.setAttribute("tabindex", originalTabIndex);
        if (!save) {
          block.textContent = previous;
        } else if (next !== previous) {
          if (applyInlineRef.current(selected, next)) {
            onBlockSelect(null);
            paintSelection(canvasDoc, null);
          } else {
            // A changed or ambiguous source node is never overwritten.
            block.textContent = previous;
            onBlockEdit(selected);
          }
        }
      }
      function onBlur() { finish(true); }
      function onKey(e: KeyboardEvent) {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish(false); block.blur(); }
        if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); finish(true); block.blur(); }
      }
      function onPaste(e: ClipboardEvent) {
        e.preventDefault();
        const raw = e.clipboardData?.getData("text/plain") ?? "";
        const text = raw.replace(/[\r\n]+/g, " ");
        const selection = canvasDoc.getSelection();
        if (!selection?.rangeCount) return;
        const range = selection.getRangeAt(0);
        if (!block.contains(range.commonAncestorContainer)) return;
        range.deleteContents();
        range.insertNode(canvasDoc.createTextNode(text));
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      block.addEventListener("blur", onBlur);
      block.addEventListener("keydown", onKey);
      block.addEventListener("paste", onPaste);
      block.focus();
      const range = doc.createRange();
      range.selectNodeContents(block);
      range.collapse(false);
      const selection = doc.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return true;
    };

    doc.addEventListener("click", (click: MouseEvent) => {
      if (editing) return;
      const source = page.isPublic ? selectedSourceBlock(article, click.target) : null;
      if (source && !click.ctrlKey && !click.metaKey) {
        click.preventDefault();
        const selected: CanvasBlockSelection = {
          pageId: page.id, index: source.index,
          tagName: source.block.tagName.toLowerCase(),
          text: normalizeCanvasText(source.block.textContent ?? ""),
        };
        onBlockSelect(selected);
        paintSelection(doc, selected);
        return;
      }
      const anchor = (click.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) { onBlockSelect(null); paintSelection(doc, null); return; }
      const href = anchor.getAttribute("href") ?? "";
      if (href.startsWith("#")) return;
      click.preventDefault();
      const match = /^(?:\.\/)?([a-z0-9-]+)\.html(?:#[a-z0-9_-]+)?$/i.exec(href);
      if (match && pages.some(item => item.id === match[1] && item.isPublic)) {
        onNavigate(match[1]);
      }
    });
    doc.addEventListener("dblclick", (click: MouseEvent) => {
      if (!page.isPublic) return;
      const source = selectedSourceBlock(article, click.target);
      if (!source) return;
      click.preventDefault();
      const selected: CanvasBlockSelection = {
        pageId: page.id, index: source.index,
        tagName: source.block.tagName.toLowerCase(),
        text: normalizeCanvasText(source.block.textContent ?? ""),
      };
      if (!beginInlineText(source.block as HTMLElement, selected)) onBlockEdit(selected);
    });
  }, [onNavigate, pages, page.id, page.isPublic, onBlockSelect, onBlockEdit, canInlineTextEdit, onApplyInlineText]);

  const frameWidth = deviceWidths[device];
  const fitScale = Math.min(1, Math.max(0.25, (space.width - 48) / frameWidth));
  const scale = fit ? fitScale : zoom / 100;
  const percentage = Math.round(scale * 100);
  const frameHeight = Math.max(650, Math.round(Math.max(450, space.height - 48) / scale));

  function changeZoom(delta: number) {
    setZoom(Math.min(200, Math.max(25, percentage + delta)));
    setFit(false);
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-muted/30" aria-label="Website design canvas">
      <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2">
        <div className="mr-auto flex min-w-0 items-center gap-2">
          <Globe2 className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-xs font-semibold">Website canvas</span>
          {busy && <LoaderCircle className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-label="Rendering preview" />}
        </div>
        <div role="group" aria-label="Canvas device width" className="flex items-center gap-0.5 rounded-md border border-border bg-muted/30 p-0.5">
          {(["desktop", "tablet", "phone"] as const).map(option => {
            const Icon = option === "desktop" ? Monitor : option === "tablet" ? Tablet : Smartphone;
            return (
              <Button key={option} variant={device === option ? "secondary" : "ghost"} size="icon-xs"
                title={`${deviceNames[option]} · ${deviceWidths[option]} px`}
                aria-label={`${deviceNames[option]} canvas · ${deviceWidths[option]} pixels`}
                aria-pressed={device === option}
                onClick={() => { setDevice(option); setFit(true); }}>
                <Icon className="size-3.5" />
              </Button>
            );
          })}
        </div>
        <div role="group" aria-label="Canvas zoom" className="flex items-center gap-0.5 rounded-md border border-border bg-muted/30 p-0.5">
          <Button variant="ghost" size="icon-xs" title="Zoom out" aria-label="Zoom out"
            disabled={percentage <= 25} onClick={() => changeZoom(-10)}><Minus className="size-3.5" /></Button>
          <span aria-live="polite" className="min-w-10 text-center font-mono text-[11px] tabular-nums">{percentage}%</span>
          <Button variant="ghost" size="icon-xs" title="Zoom in" aria-label="Zoom in"
            disabled={percentage >= 200} onClick={() => changeZoom(10)}><Plus className="size-3.5" /></Button>
          <Button variant={fit ? "secondary" : "ghost"} size="icon-xs"
            title="Fit canvas to window" aria-label="Fit canvas to window" aria-pressed={fit}
            onClick={() => setFit(true)}><Maximize2 className="size-3.5" /></Button>
        </div>
        <Button variant="ghost" size="icon-xs" onClick={() => void refresh()} disabled={busy}
          title="Save and refresh site" aria-label="Save and refresh site preview">
          <RefreshCw className="size-3.5" />
        </Button>
      </div>
      {!page.isPublic && (
        <p className="shrink-0 border-b border-border bg-amber-500/10 px-4 py-2 text-xs text-muted-foreground">
          This page is private. Showing the public Overview instead.
        </p>
      )}
      {error && <p role="alert" className="m-3 flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-xs text-destructive">
        <AlertCircle className="size-4 shrink-0" /> {error}
      </p>}
      <div
        ref={viewportRef}
        className="min-h-0 flex-1 overflow-auto bg-muted/40 p-6"
        style={{ backgroundImage: "radial-gradient(circle, var(--border) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
      >
        {html ? (
          <div className="mx-auto shrink-0" style={{ width: frameWidth * scale, height: frameHeight * scale }}>
            <iframe
              ref={iframeRef}
              title={`Paglora ${deviceNames[device].toLowerCase()} website preview`}
              sandbox="allow-same-origin"
              srcDoc={html}
              onLoad={onFrameLoad}
              style={{ width: frameWidth, height: frameHeight, transform: `scale(${scale})`, transformOrigin: "top left" }}
              className="block rounded-md border border-border bg-white shadow-xl"
            />
          </div>
        ) : !error && <div className="flex h-full min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" /> Rendering website…
        </div>}
      </div>
      <p className="shrink-0 border-t border-border bg-card px-4 py-2 text-[11px] text-muted-foreground">
        {deviceNames[device]} · {frameWidth} px · Click to select · Double-click plain text to edit in place · Enter to apply · Esc to cancel
      </p>
    </section>
  );
}
