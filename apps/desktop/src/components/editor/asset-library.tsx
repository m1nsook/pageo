import { useEffect, useRef, useState } from "react";
import { Check, Copy, Image as ImageIcon, ImagePlus, LoaderCircle, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { defaultImageAlt, imageMarkdown } from "@/lib/image-markdown";
import { filterSiteAssets, IMAGE_GALLERY_PAGE_SIZE, INLINE_THUMBNAIL_LIMIT } from "@/lib/asset-gallery";
import { importSiteAsset, listSiteAssets, previewSiteAsset, type SiteAsset } from "@/lib/site";

/** Only small images get inline gallery thumbnails; large images are loaded only
 * when selected, avoiding a multi-hundred-megabyte WebView gallery. */
function AssetTile({ asset, projectId, selected, onChoose }: {
  asset: SiteAsset; projectId: string; selected: boolean; onChoose: () => void;
}) {
  const [thumbnail, setThumbnail] = useState("");
  useEffect(() => {
    let active = true;
    setThumbnail("");
    if (asset.bytes <= INLINE_THUMBNAIL_LIMIT) {
      void previewSiteAsset(projectId, asset.url)
        .then(data => { if (active) setThumbnail(data); })
        .catch(() => { /* The selected-image preview reports errors separately. */ });
    }
    return () => { active = false; };
  }, [asset.bytes, asset.url, projectId]);

  return <button type="button" aria-pressed={selected} onClick={onChoose}
    className="min-w-0 rounded-md border p-2 text-left text-xs hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary aria-pressed:border-primary aria-pressed:bg-primary/10">
    <span className="mb-2 flex h-20 items-center justify-center overflow-hidden rounded bg-muted/50">
      {thumbnail ? <img src={thumbnail} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
        : <ImageIcon className="size-6 text-muted-foreground" aria-hidden="true" />}
    </span>
    <span className="block truncate font-medium">{asset.url.slice(7)}</span>
    <span className="text-muted-foreground">{Math.ceil(asset.bytes / 1024)} KiB · {asset.mime.slice(6).toUpperCase()}</span>
  </button>;
}

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
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(IMAGE_GALLERY_PAGE_SIZE);
  const generation = useRef(0);

  useEffect(() => {
    const version = ++generation.current;
    setAssets([]); setSelected(""); setAlt(""); setPreview(""); setError(""); setCopied(false);
    setQuery(""); setVisibleLimit(IMAGE_GALLERY_PAGE_SIZE);
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
    setPreviewLoading(Boolean(open && selected));
    if (open && selected) {
      void previewSiteAsset(projectId, selected)
        .then(data => { if (alive) setPreview(data); })
        .catch(cause => { if (alive) setError(String(cause)); })
        .finally(() => { if (alive) setPreviewLoading(false); });
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
      setAssets(items); setQuery(""); setVisibleLimit(IMAGE_GALLERY_PAGE_SIZE); choose(url);
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

  const matchingAssets = filterSiteAssets(assets, query);
  const visibleAssets = matchingAssets.slice(0, visibleLimit);

  return (
    <Drawer direction="right" open={open} onOpenChange={value => { if (!uploading) setOpen(value); }}>
      <DrawerTrigger asChild>
        <Button type="button" variant="outline" size="sm" aria-label="Browse project media"><ImagePlus /> Images</Button>
      </DrawerTrigger>
      <DrawerContent className="h-dvh w-[min(96vw,900px)] max-w-[96vw] overflow-hidden sm:max-w-[min(95vw,900px)]">
        <DrawerHeader className="shrink-0 border-b border-border px-5 py-4 pr-14">
          <div className="flex items-center gap-2">
            <DrawerTitle>Project media</DrawerTitle>
            <Badge variant="secondary">{assets.length} images</Badge>
          </div>
          <DrawerDescription>Browse and reuse images stored locally with this project. Only images referenced by public content or the logo are exported.</DrawerDescription>
        </DrawerHeader>
        <DrawerClose asChild>
          <Button variant="ghost" size="icon-sm" className="absolute right-4 top-4 z-10" aria-label="Close media manager"><X className="size-4" /></Button>
        </DrawerClose>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
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
          {assets.length > 0 && <div className="space-y-2">
            <Label htmlFor="paglora-image-search">Find an image</Label>
            <Input id="paglora-image-search" type="search" value={query} placeholder="Filter by filename"
              onChange={event => { setQuery(event.target.value); setVisibleLimit(IMAGE_GALLERY_PAGE_SIZE); }} />
            <p role="status" className="text-xs text-muted-foreground">
              Showing {visibleAssets.length} of {matchingAssets.length} matching images
            </p>
            {matchingAssets.length === 0 && <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">No images match this filename.</p>}
            <div role="group" aria-label="Project images" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {visibleAssets.map(asset => <AssetTile key={asset.url} asset={asset} projectId={projectId}
                selected={selected === asset.url} onChoose={() => choose(asset.url)} />)}
            </div>
            {matchingAssets.length > visibleLimit && <Button type="button" variant="outline" size="sm"
              onClick={() => setVisibleLimit(value => value + IMAGE_GALLERY_PAGE_SIZE)}>
              Show more images ({matchingAssets.length - visibleLimit} remaining)
            </Button>}
          </div>}
          {selected && <section aria-label="Selected image" className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex min-h-32 items-center justify-center rounded-md bg-muted/50 p-3">
              {preview ? <img src={preview} alt={alt || "Selected image"} className="max-h-72 max-w-full object-contain" /> : previewLoading ? <LoaderCircle className="size-4 animate-spin" aria-label="Loading image preview" /> : <p className="text-sm text-muted-foreground">Preview unavailable.</p>}
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
      </DrawerContent>
    </Drawer>
  );
}
