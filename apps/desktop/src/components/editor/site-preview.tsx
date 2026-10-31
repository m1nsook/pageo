import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, Laptop, LoaderCircle, Monitor, RefreshCcw, Smartphone, Tablet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StudioTooltip } from "@/components/studio/studio-tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { previewPublicPage } from "@/lib/site";
import { listPages, type Page } from "@/lib/pages";
import { resolveCanvasLink } from "@/lib/site-preview-links";

type Device = "desktop" | "tablet" | "mobile";
type Frame = { html: string; pageId: string; revision: number; fragment: string };
const blankFrame = (): Frame => ({ html: "", pageId: "", revision: 0, fragment: "" });
const deviceWidth: Record<Device, number> = { desktop: 1280, tablet: 820, mobile: 390 };

export function SitePreview({ projectId, onBeforePreview }: {
  projectId: string;
  onBeforePreview: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pages, setPages] = useState<Page[]>([]);
  const [selected, setSelected] = useState("index");
  const [device, setDevice] = useState<Device>("desktop");
  // Keep the visible website mounted while a replacement preview is rendered.
  const [frames, setFrames] = useState<[Frame, Frame]>([blankFrame(), blankFrame()]);
  const [visibleSlot, setVisibleSlot] = useState<0 | 1>(0);
  const visibleRef = useRef<0 | 1>(0);
  const pending = useRef<{ slot: 0 | 1; request: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Ignore responses from an older page selection or a closed preview.
  const requestId = useRef(0);
  const publicPages = pages.filter(page => page.isPublic);

  const refresh = useCallback(async (pageId?: string, fragment = "") => {
    const request = ++requestId.current;
    pending.current = null;
    setBusy(true);
    setError("");
    try {
      await onBeforePreview();
      if (request !== requestId.current) return;
      const available = (await listPages(projectId)).filter(item => item.isPublic);
      if (request !== requestId.current) return;
      const next = available.some(item => item.id === pageId) ? pageId! : "index";
      const html = await previewPublicPage(projectId, next);
      if (request !== requestId.current) return;
      const slot: 0 | 1 = visibleRef.current === 0 ? 1 : 0;
      pending.current = { slot, request };
      setPages(available);
      setFrames(previous => {
        const updated: [Frame, Frame] = [...previous];
        updated[slot] = { html, pageId: next, revision: request, fragment };
        return updated;
      });
      // Busy remains until the hidden document's onLoad confirms readiness.
    } catch (cause) {
      if (request === requestId.current) {
        pending.current = null;
        setError(cause instanceof Error ? cause.message : String(cause));
        // Do not destroy the already-rendered page on a failed refresh.
        setBusy(false);
      }
    }
  }, [projectId, onBeforePreview]);

  useEffect(() => {
    // A project change clears BOTH frames: never display another project's
    // private workspace data, even for one frame of a pending transition.
    requestId.current++;
    pending.current = null;
    visibleRef.current = 0;
    setVisibleSlot(0);
    setFrames([blankFrame(), blankFrame()]);
    setPages([]);
    setSelected("index");
    if (open) void refresh();
    else setBusy(false);
  }, [open, projectId]); // page navigation calls refresh itself

  function onFrameLoad(event: React.SyntheticEvent<HTMLIFrameElement>, snapshot: Frame, slot: 0 | 1) {
    if (!pending.current || pending.current.request !== snapshot.revision || pending.current.slot !== slot) return;
    const doc = event.currentTarget.contentDocument;
    if (!doc) {
      pending.current = null;
      setError("The public preview document could not be opened.");
      setBusy(false);
      return;
    }
    const publicIds = pages.filter(item => item.isPublic).map(item => item.id);
    // No iframe scripts are allowed. Links are resolved in parent React, with
    // private pages, external origins and invalid paths explicitly rejected.
    doc.addEventListener("click", click => {
      const anchor = (click.target as Element | null)?.closest?.("a[href]");
      if (!anchor) return;
      click.preventDefault();
      const destination = resolveCanvasLink(anchor.getAttribute("href") ?? "", publicIds);
      if (!destination) return;
      if (destination.kind === "fragment") {
        if (destination.fragment) doc.getElementById(destination.fragment)?.scrollIntoView({ block: "start" });
      } else if (destination.pageId === snapshot.pageId) {
        if (destination.fragment) doc.getElementById(destination.fragment)?.scrollIntoView({ block: "start" });
      } else void refresh(destination.pageId, destination.fragment);
    });
    if (snapshot.fragment) doc.getElementById(snapshot.fragment)?.scrollIntoView({ block: "start" });
    pending.current = null;
    visibleRef.current = slot;
    setVisibleSlot(slot);
    setSelected(snapshot.pageId);
    setBusy(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip><TooltipTrigger asChild>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" aria-label="Preview public website"><Eye /> Preview site</Button>
        </DialogTrigger>
      </TooltipTrigger><TooltipContent>See the actual generated website before publishing</TooltipContent></Tooltip>
      <DialogContent className="flex h-[92vh] max-h-[96vh] w-[min(96vw,1600px)] max-w-none flex-col gap-3 overflow-hidden p-4 sm:max-w-none">
        <DialogHeader className="shrink-0 pr-10">
          <DialogTitle className="flex items-center gap-2"><Monitor className="size-4" /> Public website preview</DialogTitle>
          <DialogDescription>This is the same HTML and CSS generated by Paglora's website builder. Only public pages appear.</DialogDescription>
        </DialogHeader>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Select value={selected} onValueChange={value => void refresh(value)} disabled={busy || publicPages.length === 0}>
            <SelectTrigger aria-label="Preview page" className="min-w-40 max-w-64"><SelectValue placeholder="Choose page"/></SelectTrigger>
            <SelectContent>{publicPages.map(page => <SelectItem key={page.id} value={page.id}>{page.title}</SelectItem>)}</SelectContent>
          </Select>
          <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block"/>
          {([
            ["desktop", Monitor, "Desktop"],
            ["tablet", Tablet, "Tablet"],
            ["mobile", Smartphone, "Mobile"],
          ] as const).map(([name, Icon, label]) =>
            <Button key={name} variant={device === name ? "secondary" : "ghost"} size="sm"
              aria-label={`${label} preview`} aria-pressed={device === name} onClick={() => setDevice(name)}>
              <Icon /> <span className="hidden sm:inline">{label}</span>
            </Button>
          )}
          <StudioTooltip label="Refresh preview"><Button className="ml-auto" variant="outline" size="icon-sm" disabled={busy} aria-label="Refresh preview" onClick={() => void refresh(selected)}>
            {busy ? <LoaderCircle className="animate-spin"/> : <RefreshCcw/>}
          </Button></StudioTooltip>
        </div>
        <div className="paglora-preview-stage relative flex min-h-0 flex-1 justify-center overflow-auto rounded-lg border border-border p-3 sm:p-6">
          {error && <div role="alert" className="absolute inset-x-3 top-3 z-20 rounded-lg border border-destructive/30 bg-card p-3 text-sm text-destructive">Could not load requested page: {error}. The previous preview remains available.</div>}
          {!frames.some(frame => frame.html) && !error && <div className="flex items-center gap-2 self-center text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Preparing preview...</div>}
          {frames.some(frame => frame.html) && (
            <div className="relative h-full min-h-72 shrink-0 transition-[width] duration-200 motion-reduce:transition-none"
              style={{ width: `min(100%, ${deviceWidth[device]}px)` }}>
              {frames.map((snapshot, slot) => snapshot.html ? (
                <iframe key={`${slot}-${snapshot.revision}`}
                  title={`Public website: ${snapshot.pageId}`}
                  sandbox="allow-same-origin"
                  srcDoc={snapshot.html}
                  aria-hidden={visibleSlot !== slot}
                  tabIndex={visibleSlot === slot ? 0 : -1}
                  onLoad={event => onFrameLoad(event, snapshot, slot as 0 | 1)}
                  style={{ zIndex: visibleSlot === slot ? 2 : 1, opacity: visibleSlot === slot ? 1 : 0,
                    pointerEvents: visibleSlot === slot && !busy ? "auto" : "none" }}
                  className="paglora-preview-frame absolute inset-0 h-full w-full rounded-md border bg-white"
                />
              ) : null)}
              {busy && <div className="pointer-events-none absolute right-3 top-3 z-10 flex items-center gap-2 rounded-md border border-border bg-card/95 px-3 py-1.5 text-xs text-muted-foreground shadow-md">
                <LoaderCircle className="size-3.5 animate-spin" /> Updating preview…
              </div>}
            </div>
          )}
        </div>
        <div className="shrink-0 text-xs text-muted-foreground"><Laptop className="mr-1 inline size-3.5"/> {deviceWidth[device]}px target width · Navigation works · Site colors preserved · No scripts run inside preview</div>
      </DialogContent>
    </Dialog>
  );
}
