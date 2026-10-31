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
import { cn } from "@/lib/utils";

type Device = "desktop" | "tablet" | "mobile";
const deviceWidth: Record<Device, number> = { desktop: 1280, tablet: 820, mobile: 390 };

export function SitePreview({ projectId, onBeforePreview }: {
  projectId: string;
  onBeforePreview: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pages, setPages] = useState<Page[]>([]);
  const [selected, setSelected] = useState("index");
  const [device, setDevice] = useState<Device>("desktop");
  const [srcDoc, setSrcDoc] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const frame = useRef<HTMLIFrameElement | null>(null);
  // Ignore responses from an older page selection or a closed preview.
  const requestId = useRef(0);
  // A cross-page Markdown link can include a heading fragment. Restore it
  // after the script-disabled srcDoc iframe finishes loading the target page.
  const pendingFragment = useRef("");
  const publicPages = pages.filter(page => page.isPublic);

  const refresh = useCallback(async (pageId?: string, fragment = "") => {
    const request = ++requestId.current;
    pendingFragment.current = fragment;
    setBusy(true);
    setError("");
    try {
      await onBeforePreview();
      if (request !== requestId.current) return;
      const available = (await listPages(projectId)).filter(page => page.isPublic);
      if (request !== requestId.current) return;
      const next = available.some(page => page.id === pageId) ? pageId! : "index";
      const html = await previewPublicPage(projectId, next);
      if (request !== requestId.current) return;
      setPages(available);
      setSelected(next);
      setSrcDoc(html);
    } catch (cause) {
      if (request === requestId.current) {
        pendingFragment.current = "";
        // Never leave an older page visible after the requested preview fails.
        setSrcDoc("");
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    } finally {
      if (request === requestId.current) setBusy(false);
    }
  }, [projectId, onBeforePreview]);

  useEffect(() => {
    // Clear the previous project's public content immediately when switching
    // workspaces, including while the preview dialog remains open.
    requestId.current++;
    pendingFragment.current = "";
    setPages([]);
    setSelected("index");
    setSrcDoc("");
    if (open) void refresh();
    else setBusy(false);
  }, [open, projectId]); // page navigation calls refresh itself

  function onFrameLoad() {
    const doc = frame.current?.contentDocument;
    if (!doc) return;
    const fragment = pendingFragment.current;
    pendingFragment.current = "";
    if (fragment) doc.getElementById(fragment)?.scrollIntoView({ block: "start" });
    // Scripts are disabled in the sandbox. Intercept navigation in the parent
    // so clicking an internal docs link switches the previewed Paglora page.
    doc.addEventListener("click", event => {
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";
      if (href.startsWith("#")) return;
      event.preventDefault(); // do not navigate to the host WebView or network
      const [path, ...hash] = href.split("#");
      const pathname = path.replace(/^\.\//, "");
      const target = pathname.replace(/\.html$/, "");
      if (!publicPages.some(page => page.id === target)) return;
      let fragment = "";
      try { fragment = decodeURIComponent(hash.join("#")); }
      catch { return; } // malformed fragments must not navigate or crash
      if (target === selected) {
        if (fragment) doc.getElementById(fragment)?.scrollIntoView({ block: "start" });
      } else void refresh(target, fragment);
    }, { once: false });
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
          {error && <div role="alert" className="absolute inset-x-3 top-3 z-10 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          {!srcDoc && !error && <div className="flex items-center gap-2 self-center text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Preparing preview...</div>}
          {srcDoc && <iframe
            key={selected}
            ref={frame}
            title={`Public website: ${selected}`}
            sandbox="allow-same-origin"
            srcDoc={srcDoc}
            onLoad={onFrameLoad}
            style={{ width: `min(100%, ${deviceWidth[device]}px)` }}
            className={cn("paglora-preview-frame h-full min-h-72 shrink-0 rounded-md border bg-white transition-[width] duration-200", busy && "opacity-75")}
          />}
        </div>
        <div className="shrink-0 text-xs text-muted-foreground"><Laptop className="mr-1 inline size-3.5"/> {deviceWidth[device]}px target width · Navigation works · Site colors preserved · No scripts run inside preview</div>
      </DialogContent>
    </Dialog>
  );
}
