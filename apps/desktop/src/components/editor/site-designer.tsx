import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Eye, LayoutTemplate, LoaderCircle, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { importSiteAsset, loadSiteSettings, previewPublicPage, saveSiteSettings, type SiteLink, type SiteSettings } from "@/lib/site";

function LinkEditor({ label, links, onChange }: { label: string; links: SiteLink[]; onChange: (next: SiteLink[]) => void }) {
  function update(index: number, key: keyof SiteLink, value: string) {
    onChange(links.map((link, i) => i === index ? { ...link, [key]: value } : link));
  }
  return <div className="space-y-3">
    <div className="flex items-center justify-between"><Label>{label}</Label>
      <Button type="button" size="sm" variant="outline" disabled={links.length >= 8} onClick={() => onChange([...links, { label: "", url: "" }])}><Plus /> Add link</Button>
    </div>
    {links.length === 0 && <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">No links yet. You can add up to eight.</p>}
    {links.map((link, index) => <div key={index} className="flex min-w-0 items-start gap-2 rounded-md border border-border p-2">
      <div className="min-w-0 flex-1 space-y-2">
        <Input aria-label={`${label} link ${index + 1} label`} placeholder="Link label" maxLength={60} value={link.label} onChange={event => update(index, "label", event.target.value)}/>
        <Input aria-label={`${label} link ${index + 1} URL`} placeholder="https://example.com or page.html" value={link.url} onChange={event => update(index, "url", event.target.value)}/>
      </div>
      <Button type="button" size="icon-sm" variant="ghost" aria-label={`Remove ${label} link ${index + 1}`} onClick={() => onChange(links.filter((_, i) => index !== i))}><Trash2 /></Button>
    </div>)}
    <p className="text-xs text-muted-foreground">Use HTTPS URLs, mailto: links, or an existing public page filename such as getting-started.html.</p>
  </div>;
}

export function SiteDesigner({ projectId, onBeforePreview }: { projectId: string; onBeforePreview: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [width, setWidth] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const editVersion = useRef(0);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setLoading(true);
    setSettings(null);
    setPreview("");
    editVersion.current++;
    setError("");
    setSaved(false);
    void Promise.all([onBeforePreview(), loadSiteSettings(projectId)])
      .then(([, data]) => { if (mounted) setSettings(data); })
      .catch(cause => { if (mounted) setError(String(cause)); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [open, projectId, onBeforePreview]);

  useEffect(() => {
    if (!open || !settings) return;
    let mounted = true;
    // Debounce editing so the real Rust renderer doesn't rerun on every keystroke.
    const timer = window.setTimeout(() => {
      void previewPublicPage(projectId, "index", settings)
        .then(html => { if (mounted) setPreview(html); })
        .catch(cause => { if (mounted) setError(String(cause)); });
    }, 200);
    return () => { mounted = false; clearTimeout(timer); };
  }, [open, projectId, settings]);

  function patch<K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) {
    editVersion.current++;
    setSettings(current => current ? { ...current, [key]: value } : null);
    setSaved(false);
    setError("");
  }

  async function uploadLogo(file: File) {
    if (file.size > 5 * 1024 * 1024 || file.size === 0) {
      setError("Local images must be between 1 byte and 5 MiB.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
      const url = await importSiteAsset(projectId, file.name, bytes);
      patch("logoUrl", url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setUploading(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings || busy) return;
    setBusy(true);
    setError("");
    const savingVersion = editVersion.current;
    try {
      await saveSiteSettings(projectId, settings);
      // An edit made during the save still needs another save.
      setSaved(editVersion.current === savingVersion);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return <Dialog open={open} onOpenChange={value => { if (!busy && !uploading) setOpen(value); }}>
    <DialogTrigger asChild><Button variant="outline" size="sm"><LayoutTemplate /> Design site</Button></DialogTrigger>
    <DialogContent className="flex h-[92vh] max-h-[96vh] w-[min(97vw,1680px)] max-w-none flex-col gap-3 overflow-hidden p-4 sm:max-w-none">
      <DialogHeader className="shrink-0">
        <DialogTitle className="flex items-center gap-2"><LayoutTemplate className="size-4" /> Website layout designer</DialogTitle>
        <DialogDescription>Customize the real published header, navigation, and footer. Preview updates instantly; save to keep your changes.</DialogDescription>
      </DialogHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <div className="flex h-[48%] shrink-0 flex-col overflow-hidden rounded-lg border border-border lg:h-full lg:w-[365px]">
          {loading && <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin"/> Loading website settings...</p>}
          {!loading && !settings && error && <p role="alert" className="m-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          {settings && !loading && <form onSubmit={event => void save(event)} className="flex min-h-0 flex-1 flex-col">
            <Tabs defaultValue="header" className="min-h-0 flex-1 gap-0">
              <TabsList className="mx-3 mt-3 grid w-[calc(100%-24px)] grid-cols-4">
                <TabsTrigger value="theme">Theme</TabsTrigger>
                <TabsTrigger value="header">Header</TabsTrigger>
                <TabsTrigger value="navigation">Navigation</TabsTrigger>
                <TabsTrigger value="footer">Footer</TabsTrigger>
              </TabsList>
              <ScrollArea className="min-h-0 flex-1">
                <TabsContent value="theme" className="space-y-5 p-4">
                  <div className="space-y-2">
                    <Label>Published website color mode</Label>
                    <Select value={settings.themeMode} onValueChange={value => patch("themeMode", value as SiteSettings["themeMode"])}>
                      <SelectTrigger className="w-full" aria-label="Website color mode"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="system">System — visitor preference</SelectItem>
                        <SelectItem value="light">Light — always light</SelectItem>
                        <SelectItem value="dark">Dark — always dark</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Separate from the Paglora desktop appearance. Applies to real static exports.</p>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Document language</Label>
                    <Select value={settings.language} onValueChange={value => patch("language", value as SiteSettings["language"])}>
                      <SelectTrigger className="w-full" aria-label="Document language"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[
                          ["en", "English"], ["ko", "한국어"], ["pl", "Polski"], ["de", "Deutsch"],
                          ["fr", "Français"], ["es", "Español"], ["ja", "日本語"],
                          ["zh-CN", "简体中文"], ["zh-TW", "繁體中文"], ["pt-BR", "Português (Brasil)"],
                          ["ru", "Русский"], ["uk", "Українська"], ["ar", "العربية"],
                          ["tr", "Türkçe"], ["it", "Italiano"], ["cs", "Čeština"],
                          ["hu", "Magyar"], ["th", "ไทย"],
                        ].map(([code, label]) => <SelectItem key={code} value={code}>{label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Sets the exported HTML language for accessibility and search engines. Does not translate your content.</p>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label htmlFor="designer-google-font">Website font</Label>
                    <Input
                      id="designer-google-font"
                      placeholder="Geist (default) or Google Fonts family"
                      maxLength={80}
                      value={settings.googleFontFamily}
                      onChange={event => patch("googleFontFamily", event.target.value)}
                      list="paglora-google-font-families"
                    />
                    <datalist id="paglora-google-font-families">
                      <option value="Inter" />
                      <option value="Roboto" />
                      <option value="DM Sans" />
                      <option value="Outfit" />
                      <option value="Plus Jakarta Sans" />
                      <option value="Noto Sans" />
                      <option value="Noto Sans KR" />
                    </datalist>
                    <p className="text-xs text-muted-foreground">
                      Leave empty for Geist. Enter a Google Fonts family to load it from Google's servers
                      on the published website. Visitors need an internet connection to fetch it;
                      Geist remains the fallback. Your site's CSS can override the font.
                    </p>
                    {settings.googleFontFamily && <Button type="button" size="sm" variant="ghost"
                      onClick={() => patch("googleFontFamily", "")}>Use bundled Geist</Button>}
                  </div>
                  <Separator />
                  <div className="grid gap-3">
                    <Label htmlFor="designer-accent">Website accent color</Label>
                    <div className="flex items-center gap-3">
                      <Input id="designer-accent" type="color" className="h-10 w-16 cursor-pointer p-1" value={settings.accentColor} onChange={event => patch("accentColor", event.target.value)} />
                      <code className="text-sm text-muted-foreground">{settings.accentColor.toUpperCase()}</code>
                    </div>
                    <div className="flex flex-wrap gap-2" aria-label="Accent color presets">
                      {[
                        { name: "Paglora blue", value: "#2196f3" },
                        { name: "Violet", value: "#7c3aed" },
                        { name: "Teal", value: "#0d9488" },
                        { name: "Orange", value: "#ea580c" },
                        { name: "Rose", value: "#e11d48" },
                      ].map(color => <button
                        type="button" key={color.name} title={color.name} aria-label={color.name}
                        aria-pressed={settings.accentColor.toLowerCase() === color.value}
                        className="size-9 rounded-full border-2 border-background outline-offset-2 ring-1 ring-border focus-visible:outline-2 focus-visible:outline-ring data-[selected=true]:ring-2 data-[selected=true]:ring-foreground"
                        data-selected={settings.accentColor.toLowerCase() === color.value}
                        style={{ backgroundColor: color.value }}
                        onClick={() => patch("accentColor", color.value)}
                      />)}
                    </div>
                    <p className="text-xs text-muted-foreground">Buttons, links, active navigation, and selected states use your accent color. Custom project CSS can still override these values.</p>
                  </div>
                </TabsContent>
                <TabsContent value="header" className="space-y-5 p-4">
                  <div className="grid gap-2"><Label htmlFor="designer-site-name">Website title</Label><Input id="designer-site-name" required maxLength={100} value={settings.title} onChange={e => patch("title", e.target.value)}/></div>
                  <div className="grid gap-2">
                    <Label htmlFor="designer-site-url">Published site URL (optional)</Label>
                    <Input id="designer-site-url" type="url" maxLength={240}
                      placeholder="https://username.github.io/project/"
                      value={settings.siteUrl} onChange={e => patch("siteUrl", e.target.value)} />
                    <p className="text-xs text-muted-foreground">Full HTTPS root ending in /, including the GitHub Pages repository path. When set, export includes canonical URLs and a public-only sitemap.xml. Leave empty for offline or unknown hosting.</p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="designer-logo">Logo image URL</Label>
                    <Input id="designer-logo" placeholder="https://example.com/logo.png or assets/logo.png"
                      value={settings.logoUrl} onChange={e => patch("logoUrl", e.target.value)} />
                    <Label htmlFor="designer-logo-upload">Import a local logo image</Label>
                    <Input id="designer-logo-upload" type="file" accept="image/png,image/jpeg,image/webp,image/gif"
                      disabled={uploading || busy}
                      onChange={event => {
                        const file = event.target.files?.[0];
                        if (file) void uploadLogo(file);
                        event.target.value = "";
                      }} />
                    <p className="text-xs text-muted-foreground">
                      {uploading ? "Importing image…" : "PNG, JPEG, WebP or GIF up to 5 MiB. Local assets are bundled into public exports; you can also use their assets/ URL in Markdown images."}
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label>Header alignment</Label>
                    <Select value={settings.headerAlignment} onValueChange={value => patch("headerAlignment", value as SiteSettings["headerAlignment"])}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="left">Left</SelectItem><SelectItem value="center">Centered</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between gap-2"><Label htmlFor="designer-sticky">Sticky header</Label><Switch id="designer-sticky" checked={settings.stickyHeader} onCheckedChange={value => patch("stickyHeader", value)} /></div>
                  <Separator />
                  <LinkEditor label="Header links" links={settings.headerLinks} onChange={value => patch("headerLinks", value)}/>
                </TabsContent>
                <TabsContent value="navigation" className="space-y-5 p-4">
                  <div className="grid gap-2">
                    <Label>Navigation position</Label>
                    <Select value={settings.navigationPosition} onValueChange={value => patch("navigationPosition", value as SiteSettings["navigationPosition"])}>
                      <SelectTrigger className="w-full"><SelectValue/></SelectTrigger>
                      <SelectContent><SelectItem value="left">Left sidebar</SelectItem><SelectItem value="right">Right sidebar</SelectItem><SelectItem value="top">Top navigation</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between"><Label>Article width</Label><span className="text-xs text-muted-foreground">{settings.contentWidth}px</span></div>
                    <Slider aria-label="Article width" min={640} max={1100} step={10} value={[settings.contentWidth]} onValueChange={value => patch("contentWidth", value[0])} />
                    <p className="text-xs text-muted-foreground">Controls the maximum width of the documentation article.</p>
                  </div>
                </TabsContent>
                <TabsContent value="footer" className="space-y-5 p-4">
                  <div className="flex items-center justify-between gap-2"><Label htmlFor="designer-footer-toggle">Show footer</Label><Switch id="designer-footer-toggle" checked={settings.showFooter} onCheckedChange={value => patch("showFooter", value)}/></div>
                  <div className="grid gap-2"><Label htmlFor="designer-footer-text">Footer text</Label><Input id="designer-footer-text" maxLength={240} value={settings.footerText} onChange={event => patch("footerText", event.target.value)}/></div>
                  <Separator />
                  <LinkEditor label="Footer links" links={settings.footerLinks} onChange={value => patch("footerLinks", value)}/>
                </TabsContent>
              </ScrollArea>
            </Tabs>
            {error && <p role="alert" className="mx-3 mt-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">{error}</p>}
            <div className="flex shrink-0 items-center gap-3 border-t border-border p-3">
              <Button type="submit" disabled={busy || uploading || !settings.title.trim()} className="flex-1">{busy ? <LoaderCircle className="animate-spin"/> : <Save />} Save layout</Button>
              <span className="text-xs text-muted-foreground">{saved ? "Saved locally" : "Not saved yet"}</span>
            </div>
          </form>}
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-muted/60">
          <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Eye className="size-4" /> Live public website</div>
            <div className="flex gap-1">
              <Button type="button" aria-pressed={width === "desktop"} variant={width === "desktop" ? "secondary" : "ghost"} size="sm" onClick={() => setWidth("desktop")}>Desktop</Button>
              <Button type="button" aria-pressed={width === "tablet"} variant={width === "tablet" ? "secondary" : "ghost"} size="sm" onClick={() => setWidth("tablet")}>Tablet</Button>
              <Button type="button" aria-pressed={width === "mobile"} variant={width === "mobile" ? "secondary" : "ghost"} size="sm" onClick={() => setWidth("mobile")}>Mobile</Button>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 justify-center overflow-auto p-3">
            {preview ? <iframe title="Live website layout preview" sandbox="allow-same-origin" srcDoc={preview}
              style={{ width: width === "desktop" ? "100%" : width === "tablet" ? "min(100%,768px)" : "min(100%,390px)" }}
              className="h-full min-h-72 rounded-md border border-border bg-white shadow-md transition-[width] duration-200 motion-reduce:transition-none"/> :
              <p className="flex items-center gap-2 self-center text-xs text-muted-foreground"><LoaderCircle className="size-4 animate-spin"/> Rendering site...</p>}
          </div>
          <p className="flex shrink-0 items-center gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground"><ArrowRight className="size-3.5"/> The same renderer produces the website you export.</p>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}
