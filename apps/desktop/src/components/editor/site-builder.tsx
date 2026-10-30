import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, Copy, Globe2, LoaderCircle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { buildPublicSite, loadSiteSettings, saveSiteSettings, type SiteSettings } from "@/lib/site";

export function SiteBuilder({ projectId, onBeforeBuild }: {
  projectId: string;
  onBeforeBuild: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [output, setOutput] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const generation = useRef(0);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    generation.current++;
    setSettings(null);
    setOutput("");
    setCopyStatus("");
    setBusy(false);
    setLoading(true);
    setError("");
    void loadSiteSettings(projectId)
      .then(data => { if (alive) setSettings(data); })
      .catch(cause => { if (alive) setError(String(cause)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [open, projectId]);

  function field(key: keyof SiteSettings, value: string) {
    setSettings(current => current ? { ...current, [key]: value } : null);
    setOutput("");
    setCopyStatus("");
  }

  async function saveAndBuild(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings || busy) return;
    const started = generation.current;
    setBusy(true);
    setError("");
    setOutput("");
    setCopyStatus("");
    try {
      // Save active editor content before reading the files for the site.
      await onBeforeBuild();
      await saveSiteSettings(projectId, settings);
      const path = await buildPublicSite(projectId);
      if (generation.current === started) setOutput(path);
    } catch (cause) {
      if (generation.current === started) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (generation.current === started) setBusy(false);
    }
  }

  async function copyOutput() {
    if (!output) return;
    const started = generation.current;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(output);
      if (generation.current === started) setCopyStatus("Path copied");
    } catch {
      if (generation.current === started) setCopyStatus("Clipboard unavailable. Select the path to copy it.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
      <DialogTrigger asChild>
        <Button size="sm" aria-label="Build public website"><Globe2 /> Website</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Globe2 className="size-4" /> Public website</DialogTitle>
          <DialogDescription>Create a static documentation website with real HTML pages, navigation, a header, and a footer. The generated folder can be uploaded to any static host.</DialogDescription>
        </DialogHeader>
        {loading && <div className="flex items-center gap-2 py-7 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Loading website settings...</div>}
        {settings && !loading && (
          <form className="space-y-4" onSubmit={event => void saveAndBuild(event)}>
            <div className="grid gap-2">
              <Label htmlFor="site-title">Header / website title</Label>
              <Input id="site-title" required maxLength={100} value={settings.title} onChange={event => field("title", event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="site-description">Website description</Label>
              <Textarea id="site-description" maxLength={240} rows={2} value={settings.description} onChange={event => field("description", event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="site-footer">Footer text</Label>
              <Input id="site-footer" maxLength={240} value={settings.footerText} onChange={event => field("footerText", event.target.value)} />
            </div>
            <div className="rounded-lg bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
              Only pages marked <strong>Public</strong> in the Pages sidebar will be included. Overview is always the public home page. Private pages are not copied to the export.
            </div>
            <Separator />
            {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            {output && <div className="space-y-2 rounded-lg border border-emerald-300/60 bg-emerald-50 p-3 text-sm text-emerald-900">
              <div className="flex items-center gap-2 font-medium"><CheckCircle2 className="size-4" /> Static website generated</div>
              <p className="text-xs">Open the following folder on your computer. Upload its entire contents to your static host:</p>
              <div className="flex min-w-0 items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-md bg-white/70 p-2 text-xs">{output}</code>
                <Button type="button" variant="outline" size="icon-sm" title="Copy export directory" aria-label="Copy export directory" onClick={() => void copyOutput()}><Copy /></Button>
              </div>
              {copyStatus && <p role="status" className="text-xs">{copyStatus}</p>}
              <p className="text-xs">Open <code>index.html</code> in the exported folder for a local preview.</p>
            </div>}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Close</Button>
              <Button type="submit" disabled={busy || !settings.title.trim()}>
                {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Upload />}
                {busy ? "Building..." : "Build static site"}
              </Button>
            </DialogFooter>
          </form>
        )}
        {error && !settings && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
