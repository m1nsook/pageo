import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from "react";
import {
  AlertCircle, Globe2, LoaderCircle, Maximize2, Minus, Monitor,
  Plus, RefreshCw, Smartphone, Tablet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StudioTooltip } from "@/components/studio/studio-tooltip";
import type { Page } from "@/lib/pages";
import { normalizeCanvasText, type CanvasBlockSelection } from "@/lib/canvas-blocks";
import { loadSiteSettings, previewPublicPage, type SiteSettings } from "@/lib/site";
import { resolveCanvasLink } from "@/lib/site-preview-links";
import { CanvasTextPopover, type CanvasTextAnchor } from "@/components/editor/canvas-text-popover";

type Device = "desktop" | "tablet" | "phone";
const deviceWidths: Record<Device, number> = { desktop: 1280, tablet: 768, phone: 390 };
const deviceHeights: Record<Device, number> = { desktop: 900, tablet: 1024, phone: 844 };
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
/** Capture only direct, simple blocks. Complex or transformed structures
 * never use ordinal targeting and retain the existing conservative fallback.
 */
function plainRenderedOrder(article: Element): CanvasBlockSelection["renderedOrder"] {
  const children = Array.from(article.children);
  if (!children.length || children.length > 500 ||
      !children.every(block => /^(h[1-6]|p|hr)$/.test(block.tagName.toLowerCase()))) return undefined;
  return children.map(block => ({
    tagName: block.tagName.toLowerCase(),
    text: normalizeCanvasText(block.textContent ?? ""),
  }));
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
  // Two persistent frames: render the next srcDoc behind the visible frame and
  // swap only after its load event. Editing must never blank the current canvas.
  type FrameSnapshot = { revision: number; html: string };
  const [frames, setFrames] = useState<[FrameSnapshot, FrameSnapshot]>([{ revision: 0, html: "" }, { revision: 0, html: "" }]);
  const [visibleSlot, setVisibleSlot] = useState<0 | 1>(0);
  const visibleSlotRef = useRef<0 | 1>(0);
  const pendingFrame = useRef<{ revision: number; slot: 0 | 1 } | null>(null);
  const previewRequest = useRef(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [siteThemeMode, setSiteThemeMode] = useState<SiteSettings["themeMode"] | null>(null);
  const [reload, setReload] = useState(0);
  const [device, setDevice] = useState<Device>("desktop");
  const [fit, setFit] = useState(true);
  const [zoom, setZoom] = useState(100);
  const viewportRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wheelZoomRef = useRef<(delta: number) => void>(() => {});
  const keyboardZoomRef = useRef<(key: string) => void>(() => {});
  const zoomValueRef = useRef(100);
  const [textAnchor, setTextAnchor] = useState<CanvasTextAnchor | null>(null);
  const livePreviewNode = useRef<{ node: HTMLElement; source: string } | null>(null);
  const previewPageId = page.isPublic ? page.id : "index";
  const previewIdentity = JSON.stringify([projectId, previewPageId]);
  const selectedRef = useRef(selectedBlock);
  selectedRef.current = selectedBlock;
  const clearTextAnchor = useCallback((restore = true) => {
    const preview = livePreviewNode.current;
    if (restore && preview && preview.node.isConnected &&
        preview.node.ownerDocument === iframeRef.current?.contentDocument) {
      preview.node.textContent = preview.source;
      paintSelection(preview.node.ownerDocument, selectedRef.current);
    }
    livePreviewNode.current = null;
    setTextAnchor(null);
  }, []);
  const previewText = useCallback((next: string) => {
    const entry = livePreviewNode.current;
    // Draft rendering only changes temporary sandbox DOM. The Tiptap document
    // and autosave queue are untouched until the user explicitly saves.
    if (entry && entry.node.isConnected && entry.node.ownerDocument === iframeRef.current?.contentDocument) {
      entry.node.textContent = next;
    }
  }, []);
  const commitText = useCallback((selection: CanvasBlockSelection, next: string): boolean => {
    const applied = applyInlineRef.current(selection, next);
    if (applied) {
      clearTextAnchor(false);
      onBlockSelect(null);
    }
    return applied;
  }, [clearTextAnchor, onBlockSelect]);
  useEffect(() => { clearTextAnchor(); }, [previewIdentity, clearTextAnchor]);
  useEffect(() => {
    if (textAnchor && (!selectedBlock || selectedBlock.pageId !== textAnchor.selection.pageId ||
        selectedBlock.index !== textAnchor.selection.index || selectedBlock.text !== textAnchor.selection.text)) {
      clearTextAnchor();
    }
  }, [selectedBlock, textAnchor, clearTextAnchor]);
  useEffect(() => { clearTextAnchor(); }, [device, fit, zoom, visibleSlot, clearTextAnchor]);
  // DOM listeners attached to an existing iframe must always call current
  // source-editor callbacks, even if Tiptap initialized after iframe load.
  const canInlineRef = useRef(canInlineTextEdit);
  canInlineRef.current = canInlineTextEdit;
  const applyInlineRef = useRef(onApplyInlineText);
  applyInlineRef.current = onApplyInlineText;
  const [space, setSpace] = useState({ width: 1000, height: 700 });


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
    const viewport = viewportRef.current;
    if (!viewport) return;
    const wheel = (event: WheelEvent) => {
      // The real site must retain normal vertical scrolling. Wheel over blank
      // canvas zooms; Ctrl/Cmd+wheel also zooms when panning the canvas.
      if (!(event.ctrlKey || event.metaKey) &&
          event.target instanceof Element && event.target.closest("[data-canvas-artboard]")) return;
      event.preventDefault();
      wheelZoomRef.current(event.deltaY);
    };
    const onKey = (event: KeyboardEvent) => {
      // Zoom shortcuts apply only when the canvas viewport has focus.
      // Never steal normal typing, IME composition, or browser shortcuts elsewhere.
      if ((!event.ctrlKey && !event.metaKey) || event.altKey || event.isComposing) return;
      if (!["+", "=", "-", "_", "0"].includes(event.key)) return;
      event.preventDefault();
      keyboardZoomRef.current(event.key);
    };
    viewport.addEventListener("wheel", wheel, { passive: false });
    viewport.addEventListener("keydown", onKey);
    return () => {
      viewport.removeEventListener("wheel", wheel);
      viewport.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const revision = ++previewRequest.current;
    pendingFrame.current = null;
    setBusy(true);
    setError("");
    setSiteThemeMode(null);
    void loadSiteSettings(projectId).then(settings => {
      if (active && revision === previewRequest.current) setSiteThemeMode(settings.themeMode);
    }).catch(() => undefined);
    void previewPublicPage(projectId, previewPageId)
      .then(result => {
        if (!active || revision !== previewRequest.current) return;
        const slot: 0 | 1 = visibleSlotRef.current === 0 ? 1 : 0;
        pendingFrame.current = { revision, slot };
        setFrames(previous => {
          const updated: [FrameSnapshot, FrameSnapshot] = [...previous];
          updated[slot] = { revision, html: result };
          return updated;
        });
      })
      .catch(cause => {
        if (active && revision === previewRequest.current) {
          setError(describeError(cause));
          setBusy(false);
        }
      });
    return () => { active = false; };
  }, [projectId, previewPageId, previewIdentity, savedVersion, reload, page.layout, page.title, page.isPublic, page.navGroup, pages]);

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
  }, [selectedBlock, visibleSlot]);

  const onFrameLoad = useCallback((event: SyntheticEvent<HTMLIFrameElement>) => {
    const loadedFrame = event.currentTarget;
    const doc = loadedFrame.contentDocument;
    if (!doc) return;
    const canvasDoc: Document = doc;
    const article = canvasDoc.querySelector("article.docs");
    if (article && page.isPublic) {
      const decorations = doc.createElement("style");
      decorations.textContent = '.docs > :is(h1,h2,h3,h4,h5,h6,p,ul,ol,blockquote,pre,table,hr){cursor:pointer}.docs > :is(h1,h2,h3,h4,h5,h6,p,ul,ol,blockquote,pre,table,hr):hover{outline:1px dashed #4299ff;outline-offset:4px}.docs > .paglora-studio-selected,.docs > .paglora-studio-selected:hover{outline:2px solid #2684ff!important;outline-offset:5px!important}';
      doc.head.appendChild(decorations);
    }
    paintSelection(doc, selectedRef.current);
    // Wheel events inside an iframe do not bubble to the parent app. Let
    // ordinary wheel scroll the site, and only intercept Ctrl/Cmd+wheel.
    doc.addEventListener("wheel", event => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      wheelZoomRef.current(event.deltaY);
    }, { passive: false });
    doc.addEventListener("keydown", event => {
      if ((!event.ctrlKey && !event.metaKey) || event.altKey || event.isComposing) return;
      if (!["+", "=", "-", "_", "0"].includes(event.key)) return;
      event.preventDefault();
      keyboardZoomRef.current(event.key);
    });

    let editing: HTMLElement | null = null;
    const beginInlineText = (block: HTMLElement, selected: CanvasBlockSelection) => {
      if (editing || !canInlineRef.current(selected)) return false;
      // Only direct text nodes may be made contenteditable. Links, code and
      // nested markup must never be flattened by the temporary DOM editor.
      if (block.childNodes.length !== 1 || block.firstChild?.nodeType !== 3 ||
          !(/^(h[1-6]|p)$/.test(selected.tagName))) return false;
      clearTextAnchor();
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
        // Enter/Escape may confirm or dismiss an IME candidate. Never save or
        // cancel the inline edit while Korean/Japanese/Chinese composition is active.
        if (e.isComposing || e.keyCode === 229) return;
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
      const anchor = (click.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (anchor) {
        // Links inside paragraphs must navigate, not select their parent paragraph.
        // All navigation stays inside the parent Studio; scripts remain disabled.
        click.preventDefault();
        const destination = resolveCanvasLink(anchor.getAttribute("href") ?? "", pages.map(item => item.isPublic ? item.id : ""));
        if (destination?.kind === "fragment") {
          doc.getElementById(destination.fragment)?.scrollIntoView({ block: "start" });
        } else if (destination?.kind === "page") {
          if (destination.pageId === page.id) {
            if (destination.fragment) doc.getElementById(destination.fragment)?.scrollIntoView({ block: "start" });
          } else {
            onNavigate(destination.pageId);
          }
        }
        return;
      }
      const source = page.isPublic ? selectedSourceBlock(article, click.target) : null;
      if (source && !click.ctrlKey && !click.metaKey) {
        click.preventDefault();
        const selected: CanvasBlockSelection = {
          pageId: page.id, index: source.index,
          tagName: source.block.tagName.toLowerCase(),
          text: normalizeCanvasText(source.block.textContent ?? ""),
          renderedOrder: article ? plainRenderedOrder(article) : undefined,
        };
        onBlockSelect(selected);
        paintSelection(doc, selected);
        // A visible, accessible edit control is anchored to the clicked block.
        // Do not offer it for ambiguous, formatted, linked or private Markdown.
        clearTextAnchor();
        const element = source.block as HTMLElement;
        if (canInlineRef.current(selected) && /^(h[1-6]|p)$/.test(selected.tagName) &&
            element.childNodes.length === 1 && element.firstChild?.nodeType === Node.TEXT_NODE) {
          const blockRect = element.getBoundingClientRect();
          // React SyntheticEvent.currentTarget is cleared after onLoad returns;
          // retain the iframe element itself for future document click events.
          const frame = loadedFrame;
          const frameRect = frame.getBoundingClientRect();
          const scale = frameRect.width / Math.max(1, frame.offsetWidth);
          livePreviewNode.current = { node: element, source: element.textContent ?? "" };
          setTextAnchor({
            selection: selected, text: element.textContent ?? "",
            left: Math.min(Math.max(4, frameRect.width - 88), Math.max(4, blockRect.left * scale + 8)),
            top: Math.max(4, blockRect.top * scale - 15),
          });
        }
        return;
      }
      clearTextAnchor();
      onBlockSelect(null);
      paintSelection(doc, null);
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
        renderedOrder: article ? plainRenderedOrder(article) : undefined,
      };
      if (!beginInlineText(source.block as HTMLElement, selected)) onBlockEdit(selected);
    });
  }, [onNavigate, pages, page.id, page.isPublic, onBlockSelect, onBlockEdit, canInlineTextEdit, onApplyInlineText, clearTextAnchor]);

  const frameReady = (event: SyntheticEvent<HTMLIFrameElement>, slot: 0 | 1, revision: number) => {
    if (pendingFrame.current?.revision !== revision || pendingFrame.current.slot !== slot) return;
    iframeRef.current = event.currentTarget;
    // Attach selection and edit listeners only to a fully loaded document.
    onFrameLoad(event);
    pendingFrame.current = null;
    visibleSlotRef.current = slot;
    setVisibleSlot(slot);
    setBusy(false);
  };

  const frameWidth = deviceWidths[device];
  const frameHeight = deviceHeights[device];
  // Fit considers both dimensions: the site itself scrolls inside its iframe,
  // while the outer Studio stays at the size of its allocated canvas.
  const fitScale = Math.max(0.1, Math.min(1, (space.width - 48) / frameWidth, (space.height - 48) / frameHeight));
  const scale = fit ? fitScale : zoom / 100;
  const percentage = Math.round(scale * 100);
  zoomValueRef.current = percentage;
  function changeZoom(delta: number) {
    const next = Math.min(200, Math.max(25, zoomValueRef.current + delta));
    zoomValueRef.current = next;
    setZoom(next);
    setFit(false);
  }
  wheelZoomRef.current = delta => { if (delta !== 0) changeZoom(delta > 0 ? -10 : 10); };
  keyboardZoomRef.current = key => {
    if (key === "0") setFit(true);
    else changeZoom(key === "+" || key === "=" ? 10 : -10);
  };

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-muted/30" aria-label="Website design canvas">
      <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2">
        <div className="mr-auto flex min-w-0 items-center gap-2">
          <Globe2 className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-xs font-semibold">Website canvas</span>
          <span className="hidden text-[11px] text-muted-foreground sm:inline" data-canvas-site-theme>
            · Site {siteThemeMode ?? "loading"} · Studio appearance is separate
          </span>
          {busy && <LoaderCircle className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-label="Rendering preview" />}
        </div>
        <div role="group" aria-label="Canvas device width" className="flex items-center gap-0.5 rounded-md border border-border bg-muted/30 p-0.5">
          {(["desktop", "tablet", "phone"] as const).map(option => {
            const Icon = option === "desktop" ? Monitor : option === "tablet" ? Tablet : Smartphone;
            return (
              <StudioTooltip key={option} label={`${deviceNames[option]} · ${deviceWidths[option]} px`}>
                <Button variant={device === option ? "secondary" : "ghost"} size="icon-xs"
                  aria-label={`${deviceNames[option]} canvas · ${deviceWidths[option]} pixels`}
                  aria-pressed={device === option}
                  onClick={() => { setDevice(option); setFit(true); }}>
                  <Icon className="size-3.5" />
                </Button>
              </StudioTooltip>
            );
          })}
        </div>
        <div role="group" aria-label="Canvas zoom" className="flex items-center gap-0.5 rounded-md border border-border bg-muted/30 p-0.5">
          <StudioTooltip label="Zoom out">
            <Button variant="ghost" size="icon-xs" aria-label="Zoom out"
              disabled={percentage <= 25} onClick={() => changeZoom(-10)}><Minus className="size-3.5" /></Button>
          </StudioTooltip>
          <span aria-live="polite" className="min-w-10 text-center font-mono text-[11px] tabular-nums">{percentage}%</span>
          <StudioTooltip label="Zoom in">
            <Button variant="ghost" size="icon-xs" aria-label="Zoom in"
              disabled={percentage >= 200} onClick={() => changeZoom(10)}><Plus className="size-3.5" /></Button>
          </StudioTooltip>
          <StudioTooltip label="Fit canvas to window">
            <Button variant={fit ? "secondary" : "ghost"} size="icon-xs"
              aria-label="Fit canvas to window" aria-pressed={fit}
              onClick={() => setFit(true)}><Maximize2 className="size-3.5" /></Button>
          </StudioTooltip>
        </div>
        <StudioTooltip label="Save and refresh site">
          <Button variant="ghost" size="icon-xs" onClick={() => void refresh()} disabled={busy}
            aria-label="Save and refresh site preview">
            <RefreshCw className="size-3.5" />
          </Button>
        </StudioTooltip>
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
        tabIndex={0}
        aria-label="Website design canvas viewport"
        className="paglora-preview-stage min-h-0 flex-1 overflow-auto p-6 focus-visible:outline-2 focus-visible:outline-ring"
      >
        {frames.some(frame => frame.html) ? (
          <div data-canvas-artboard className="paglora-preview-artboard relative mx-auto shrink-0" style={{ width: frameWidth * scale, height: frameHeight * scale }}>
            {frames.map((frame, index) => frame.html ? (
              <iframe
                key={`${index}-${frame.revision}`}
                title={`Paglora ${deviceNames[device].toLowerCase()} website preview`}
                sandbox="allow-same-origin"
                srcDoc={frame.html}
                onLoad={event => frameReady(event, index as 0 | 1, frame.revision)}
                aria-hidden={visibleSlot !== index}
                tabIndex={visibleSlot === index ? 0 : -1}
                style={{
                  width: frameWidth, height: frameHeight,
                  transform: `scale(${scale})`, transformOrigin: "top left",
                  zIndex: visibleSlot === index ? 2 : 1,
                  opacity: visibleSlot === index ? 1 : 0,
                  pointerEvents: visibleSlot === index && !busy ? "auto" : "none",
                }}
                className="paglora-preview-frame absolute left-0 top-0 block rounded-md border bg-white"
              />
            ) : null)}
            {textAnchor && !busy && <CanvasTextPopover key={`${textAnchor.selection.pageId}-${textAnchor.selection.index}-${textAnchor.selection.text}`}
              target={textAnchor} onDraft={previewText} onCommit={commitText} onDismiss={() => clearTextAnchor()}/>}
            {busy && !frames[visibleSlot].html && <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" /> Rendering website…
            </div>}
          </div>
        ) : !error && <div className="flex h-full min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" /> Rendering website…
        </div>}
      </div>
      <p className="shrink-0 border-t border-border bg-card px-4 py-2 text-[11px] text-muted-foreground">
        {deviceNames[device]} · {frameWidth} px · Published site colors are not modified · Wheel or Ctrl+wheel to zoom · Ctrl+0 to fit · Double-click plain text to edit · Esc to cancel
      </p>
    </section>
  );
}
