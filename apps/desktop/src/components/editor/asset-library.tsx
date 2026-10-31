import { useEffect, useRef, useState } from "react";
import { Check, Copy, ImagePlus, LoaderCircle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { defaultImageAlt, imageMarkdown } from "@/lib/image-markdown";
import { importSiteAsset, listSiteAssets, previewSiteAsset, type SiteAsset } from "@/lib/site";

export function AssetLibrary({ projectId, canInsert, onInsertImage }: {
  projectId: string;
  canInsert: boolean;
  onInsertImage: (src: string, alt: string) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<SiteAsset[]>([]);
  const [selected, setSelected] = useState("");
  const [alt, setAlt] = useState("");
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const generation = useRef(0);

  useEffect(() => {
    const version = ++generation.current;
    setAssets([]); setSelected(""); setAlt(""); setPreview(""); setError(""); setCopied(false);
    if (!open) return;
    setLoading(true);
    void listSiteAssets(projectId)
      .then(items => { if (generation.current === version) setAssets(items); })
      .catch(cause => { if (generation.current === version) setError(String(cause)); })
      .finally(() => { if (generation.current === version) setLoading(false); });
    return () => { generation.current++; };
  }, [open, projectId]);

  useEffect(() => {
    let alive = true;
    setPreview("");
    if (open && selected) {
      void previewSiteAsset(projectId, selected)
        .then(data => { if (alive) setPreview(data); })
        .catch(cause => { if (alive) setError(String(cause)); });
    }
    return () => { alive = false; };
  }, [open, projectId, selected]);

  function choose(url: string) {
    setSelected(url); setAlt(defaultImageAlt(url)); setCopied(false); setError("");
  }

  async function upload(file: File) {
    if (!file.size || file.size > 5 * 1024 * 1024) {
      setError("Images must be between 1 byte and 5 MiB."); return;
    }
    const version = generation.current;
    setUploading(true); setError("");
    try {
      const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
      if (generation.current !== version) return;
      const url = await importSiteAsset(projectId, file.name, bytes);
      if (generation.current !== version) return;
      const items = await listSiteAssets(projectId);
      if (generation.current !== version) return;
      setAssets(items); choose(url);
    } catch (cause) {
      if (generation.current === version) setError(String(cause));
    } finally {
      if (generation.current === version) setUploading(false);
    }
  }

  async function copy() {
    if (!selected || !alt.trim()) return;
    try {
      await navigator.clipboard.writeText(imageMarkdown(alt.trim(), selected));
      setCopied(true); setError("");
    } catch (cause) { setError("Unable to copy Markdown: " + String(cause)); }
  }

  return (
    <Dialog open={open} onOpenChange={value => { if (!uploading) setOpen(value); }}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" title="Browse local images"><ImagePlus /> Images</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Local images</DialogTitle>
          <DialogDescription>Images stay inside this project. Only images referenced by public pages or the site logo are exported.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="paglora-image-upload">Import PNG, JPEG, WebP or GIF (up to 5 MiB)</Label>
            <Input id="paglora-image-upload" type="file" accept="image/png,image/jpeg,image/webp,image/gif"
              disabled={uploading} onChange={event => {
                const file = event.currentTarget.files?.[0];
                if (file) void upload(file);
                event.currentTarget.value = "";
              }} />
          </div>
          {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          {(loading || uploading) && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />{uploading ? "Importing image…" : "Loading images…"}</p>}
          {!loading && assets.length === 0 && <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No local images yet. Import one to get started.</p>}
          {assets.length > 0 && <div role="group" aria-label="Project images" className="grid max-h-44 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
            {assets.map(asset => <button key={asset.url} type="button" aria-pressed={selected === asset.url}
              className="min-w-0 rounded-md border p-2 text-left text-xs hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary aria-pressed:border-primary aria-pressed:bg-primary/10"
              onClick={() => choose(asset.url)}>
              <span className="block truncate font-medium">{asset.url.slice(7)}</span>
              <span className="text-muted-foreground">{Math.ceil(asset.bytes / 1024)} KiB · {asset.mime.slice(6).toUpperCase()}</span>
            </button>)}
          </div>}
          {selected && <section aria-label="Selected image" className="space-y-3 border-t pt-4">
            <div className="flex min-h-32 items-center justify-center rounded-md bg-muted/50 p-3">
              {preview ? <img src={preview} alt={alt || "Selected image"} className="max-h-52 max-w-full object-contain" /> : <LoaderCircle className="size-4 animate-spin" aria-label="Loading image preview" />}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paglora-image-alt">Alternative text</Label>
              <Input id="paglora-image-alt" value={alt} maxLength={200} onChange={event => { setAlt(event.target.value); setCopied(false); }}
                placeholder="Describe the image for screen reader users" />
              <p className="text-xs text-muted-foreground">Describe the image's meaning, not just its filename.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={!canInsert || uploading || !alt.trim()} onClick={() => {
                if (onInsertImage(selected, alt.trim())) { setOpen(false); setError(""); }
                else setError("Could not insert image at the current cursor.");
              }}><Upload /> Insert image</Button>
              <Button type="button" variant="outline" disabled={!alt.trim()} onClick={() => void copy()}>{copied ? <Check /> : <Copy />}{copied ? "Copied Markdown" : "Copy Markdown"}</Button>
            </div>
            {!canInsert && <p className="text-xs text-muted-foreground">Switch to Edit or Split view to insert at the cursor. Copy Markdown is always available.</p>}
          </section>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
