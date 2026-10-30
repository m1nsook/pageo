import { useCallback, useEffect, useState, type SyntheticEvent } from "react";
import { AlertCircle, Globe2, LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Page } from "@/lib/pages";
import { previewPublicPage } from "@/lib/site";

function describeError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/** Uses the SAME Rust renderer as static export; srcDoc is script-disabled.
 * Internal page links select a page in the studio rather than navigating the
 * iframe to Tauri's application origin. External links are inert in the editor.
 */
export function InlineSitePreview({
  projectId, page, pages, savedVersion, onNavigate, onBeforeRefresh,
}: {
  projectId: string;
  page: Page;
  pages: Page[];
  savedVersion: number;
  onNavigate: (pageId: string) => void;
  onBeforeRefresh: () => Promise<void>;
}) {
  const [html, setHtml] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const previewPageId = page.isPublic ? page.id : "index";

  useEffect(() => {
    let active = true;
    setBusy(true);
    setError("");
    void previewPublicPage(projectId, previewPageId)
      .then(result => { if (active) setHtml(result); })
      .catch(cause => { if (active) { setError(describeError(cause)); setHtml(""); } })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [projectId, previewPageId, savedVersion, reload]);

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

  const onFrameLoad = useCallback((event: SyntheticEvent<HTMLIFrameElement>) => {
    const frame = event.currentTarget;
    const doc = frame.contentDocument;
    if (!doc) return;
    doc.addEventListener("click", (click: MouseEvent) => {
      const target = click.target;
      const anchor = (target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      if (href.startsWith("#")) return; // Heading anchors still work inside the frame.
      click.preventDefault();
      const match = /^(?:\.\/)?([a-z0-9-]+)\.html(?:#[a-z0-9_-]+)?$/i.exec(href);
      if (match && pages.some(item => item.id === match[1] && item.isPublic)) {
        onNavigate(match[1]);
      }
    });
  }, [onNavigate, pages]);

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-muted/30" aria-label="Live public website preview">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Globe2 className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-xs font-medium">Published website</span>
          {busy && <LoaderCircle className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-label="Rendering preview" />}
        </div>
        <Button variant="ghost" size="icon-sm" onClick={() => void refresh()} disabled={busy}
          title="Save and refresh site" aria-label="Save and refresh site preview">
          <RefreshCw className="size-4" />
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
      <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
        {html ? <iframe
          title="Paglora published website"
          sandbox="allow-same-origin"
          srcDoc={html}
          onLoad={onFrameLoad}
          className="h-full min-h-80 w-full rounded-md border border-border bg-white shadow-sm"
        /> : !error && <div className="flex h-full min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" /> Rendering website…
        </div>}
      </div>
      <p className="shrink-0 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
        Same HTML and CSS as static export · autosaved edits refresh automatically
      </p>
    </section>
  );
}
