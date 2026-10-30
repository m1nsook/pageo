import { useCallback, useEffect, useState, type KeyboardEvent } from "react";
import { Check, Code2, LoaderCircle, RefreshCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { loadThemeCss, saveThemeCss } from "@/lib/source";
import { previewPublicPage } from "@/lib/site";

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/** Real editable project source, not a visual-settings mockup.
 * The CSS is read from theme/custom.css and included by the Rust static renderer
 * after the built-in stylesheet, both in preview and site exports.
 */
export function ThemeSourceEditor({
  projectId, currentPageId, onBeforePreview,
}: {
  projectId: string;
  currentPageId: string;
  onBeforePreview: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [savedValue, setSavedValue] = useState("");
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const dirty = value !== savedValue;

  const refresh = useCallback(async () => {
    await onBeforePreview();
    setHtml(await previewPublicPage(projectId, currentPageId));
  }, [onBeforePreview, projectId, currentPageId]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setHtml("");
    setError("");
    setMessage("");
    void Promise.all([loadThemeCss(projectId), onBeforePreview()])
      .then(async ([css]) => {
        if (!active) return;
        setValue(css);
        setSavedValue(css);
        const result = await previewPublicPage(projectId, currentPageId);
        if (active) setHtml(result);
      })
      .catch(cause => { if (active) setError(errorMessage(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, projectId, currentPageId, onBeforePreview]);

  const save = useCallback(async () => {
    if (saving || loading) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await saveThemeCss(projectId, value);
      setSavedValue(value);
      await refresh();
      setMessage("Saved to theme/custom.css · Preview updated");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }, [saving, loading, projectId, value, refresh]);

  function setDialogOpen(next: boolean) {
    if (!next && dirty && !window.confirm("Discard unsaved theme CSS changes?")) return;
    if (!saving) setOpen(next);
  }

  function onCodeKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      event.stopPropagation();
      void save();
    }
    // Insert spaces rather than moving focus while editing source code.
    if (event.key === "Tab" && !event.shiftKey) {
      event.preventDefault();
      const field = event.currentTarget;
      const start = field.selectionStart;
      const end = field.selectionEnd;
      const next = value.slice(0, start) + "  " + value.slice(end);
      setValue(next);
      requestAnimationFrame(() => {
        field.selectionStart = start + 2;
        field.selectionEnd = start + 2;
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Code2 /> Source</Button>
      </DialogTrigger>
      <DialogContent className="flex h-[92vh] max-h-[96vh] w-[min(97vw,1700px)] max-w-none flex-col gap-3 overflow-hidden p-4 sm:max-w-none">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2"><Code2 className="size-4" /> Project source</DialogTitle>
          <DialogDescription>
            Edit <code>theme/custom.css</code> directly. It overrides the default site CSS in both preview and exported HTML.
            The upcoming source-workspace milestones will add TSX themes, custom components, and a full Vite build.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-mono text-xs font-medium">theme/custom.css</p>
                <p className="text-xs text-muted-foreground">{dirty ? "Unsaved changes" : "Saved source file"}</p>
              </div>
              <Button size="sm" disabled={loading || saving || !dirty} onClick={() => void save()}>
                {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
                Save CSS
              </Button>
            </div>
            {loading
              ? <div className="flex items-center gap-2 p-5 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Loading source files...</div>
              : <Textarea
                  aria-label="Edit project custom CSS"
                  spellCheck={false}
                  value={value}
                  onChange={event => { setValue(event.target.value); setMessage(""); }}
                  onKeyDown={onCodeKeyDown}
                  className="min-h-0 flex-1 resize-none rounded-none border-0 bg-background p-4 font-mono text-xs leading-relaxed shadow-none focus-visible:ring-0"
                />
            }
            <div className="shrink-0 border-t border-border p-3 text-xs text-muted-foreground">
              Real local file · Ctrl+S to save · 256 KB maximum
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-muted/30">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
              <span className="text-xs font-medium">Published website preview</span>
              <Button variant="ghost" size="icon-sm" title="Refresh from saved files" aria-label="Refresh site preview" disabled={loading || saving} onClick={() => void refresh().catch(cause => setError(errorMessage(cause)))}>
                <RefreshCcw />
              </Button>
            </div>
            <div className="min-h-0 flex-1 p-2">
              {html && <iframe
                title="Project theme CSS site preview"
                sandbox="allow-same-origin"
                srcDoc={html}
                className="h-full min-h-56 w-full rounded-md border border-border bg-white"
              />}
              {!html && !error && <div className="p-4 text-sm text-muted-foreground">Preparing website preview...</div>}
            </div>
            <p className="shrink-0 border-t border-border p-3 text-xs text-muted-foreground">Scripts are disabled. Preview uses the static site's HTML renderer.</p>
          </div>
        </div>
        {(error || message) && <p role={error ? "alert" : "status"} className={error ? "shrink-0 text-xs text-destructive" : "flex shrink-0 items-center gap-2 text-xs text-muted-foreground"}>
          {!error && <Check className="size-3.5" />} {error || message}
        </p>}
      </DialogContent>
    </Dialog>
  );
}
