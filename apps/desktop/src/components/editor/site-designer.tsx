import { useEffect, useRef, useState, type FormEvent } from "react";
import { DOCUMENT_LANGUAGES, useTranslation } from "@/i18n";
import { ArrowRight, Eye, LayoutTemplate, LoaderCircle, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StudioTooltip } from "@/components/studio/studio-tooltip";
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

const SITE_LAYOUTS: { id: SiteSettings["siteLayout"]; name: string; detail: string }[] = [
  { id: "classic", name: "studio.design.layoutClassic", detail: "studio.design.layoutClassicDetail" },
  { id: "inset", name: "studio.design.layoutInset", detail: "studio.design.layoutInsetDetail" },
  { id: "reading", name: "studio.design.layoutReading", detail: "studio.design.layoutReadingDetail" },
];

const CARD_LAYOUTS: { id: SiteSettings["cardLayout"]; name: string; detail: string }[] = [
  { id: "stacked", name: "studio.design.cardStacked", detail: "studio.design.cardStackedDetail" },
  { id: "grid", name: "studio.design.cardGrid", detail: "studio.design.cardGridDetail" },
];

const SITE_PALETTES: {
  id: SiteSettings["sitePalette"]; name: string; light: string; dark: string;
}[] = [
  { id: "original", name: "studio.design.paletteOriginal", light: "#ffffff", dark: "#11151d" },
  { id: "graphite", name: "studio.design.paletteGraphite", light: "#ffffff", dark: "#101114" },
  { id: "lavender", name: "studio.design.paletteLavender", light: "#fdfcff", dark: "#17121e" },
  { id: "linen", name: "studio.design.paletteLinen", light: "#fffdf9", dark: "#1c1915" },
];

function LinkEditor({ label, links, onChange }: { label: string; links: SiteLink[]; onChange: (next: SiteLink[]) => void }) {
  const { t } = useTranslation();
  function update(index: number, key: keyof SiteLink, value: string) {
    onChange(links.map((link, i) => i === index ? { ...link, [key]: value } : link));
  }
  return <div className="space-y-3">
    <div className="flex items-center justify-between"><Label>{label}</Label>
      <Button type="button" size="sm" variant="outline" disabled={links.length >= 8} onClick={() => onChange([...links, { label: "", url: "" }])}><Plus /> {t("studio.design.addLink")}</Button>
    </div>
    {links.length === 0 && <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">{t("studio.design.noLinks")}</p>}
    {links.map((link, index) => <div key={index} className="flex min-w-0 items-start gap-2 rounded-md border border-border p-2">
      <div className="min-w-0 flex-1 space-y-2">
        <Input aria-label={t("studio.design.linkAria", { section: label, index: index + 1 })} placeholder={t("studio.design.linkLabel")} maxLength={60} value={link.label} onChange={event => update(index, "label", event.target.value)}/>
        <Input aria-label={t("studio.design.linkUrlAria", { section: label, index: index + 1 })} placeholder={t("studio.design.linkPlaceholder")} value={link.url} onChange={event => update(index, "url", event.target.value)}/>
      </div>
      <Button type="button" size="icon-sm" variant="ghost" aria-label={t("studio.design.linkRemoveAria", { section: label, index: index + 1 })} onClick={() => onChange(links.filter((_, i) => index !== i))}><Trash2 /></Button>
    </div>)}
    <p className="text-xs text-muted-foreground">{t("studio.design.linkHelp")}</p>
  </div>;
}

export function SiteDesigner({ projectId, onBeforePreview }: { projectId: string; onBeforePreview: () => Promise<void> }) {
  const { t } = useTranslation();
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
  // Invalidate in-flight uploads and saves when the dialog or project changes.
  const generation = useRef(0);

  useEffect(() => {
    generation.current++;
    if (!open) return;
    let mounted = true;
    setBusy(false);
    setUploading(false);
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
        .catch(cause => { if (mounted) { setPreview(""); setError(String(cause)); } });
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
      setError(t("studio.design.imageLimit"));
      return;
    }
    const startedGeneration = generation.current;
    const isCurrent = () => generation.current === startedGeneration;
    setUploading(true);
    setError("");
    try {
      const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
      if (!isCurrent()) return;
      const url = await importSiteAsset(projectId, file.name, bytes);
      if (isCurrent()) patch("logoUrl", url);
    } catch (cause) {
      if (isCurrent()) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (isCurrent()) setUploading(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings || busy) return;
    setBusy(true);
    setError("");
    const savingVersion = editVersion.current;
    const startedGeneration = generation.current;
    try {
      await saveSiteSettings(projectId, settings);
      // An edit made during the save still needs another save. A completed
      // save for a previous project must never mark the current one saved.
      if (generation.current === startedGeneration) setSaved(editVersion.current === savingVersion);
    } catch (cause) {
      if (generation.current === startedGeneration) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (generation.current === startedGeneration) setBusy(false);
    }
  }

  return <Dialog open={open} onOpenChange={value => { if (!busy && !uploading) setOpen(value); }}>
    <DialogTrigger asChild><Button variant="outline" size="sm"><LayoutTemplate /> {t("studio.design.trigger")}</Button></DialogTrigger>
    <DialogContent className="flex h-[92vh] max-h-[96vh] w-[min(97vw,1680px)] max-w-none flex-col gap-3 overflow-hidden p-4 sm:max-w-none">
      <DialogHeader className="shrink-0">
        <DialogTitle className="flex items-center gap-2"><LayoutTemplate className="size-4" /> {t("studio.design.dialogTitle")}</DialogTitle>
        <DialogDescription>{t("studio.design.dialogDescription")}</DialogDescription>
      </DialogHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <div className="flex h-[48%] shrink-0 flex-col overflow-hidden rounded-lg border border-border lg:h-full lg:w-[365px]">
          {loading && <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin"/> {t("studio.design.loading")}</p>}
          {!loading && !settings && error && <p role="alert" className="m-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          {settings && !loading && <form onSubmit={event => void save(event)} className="flex min-h-0 flex-1 flex-col">
            <Tabs defaultValue="theme" className="min-h-0 flex-1 gap-0">
              <TabsList className="mx-3 mt-3 grid w-[calc(100%-24px)] grid-cols-4">
                <TabsTrigger value="theme">{t("studio.design.tabTheme")}</TabsTrigger>
                <TabsTrigger value="header">{t("studio.design.tabHeader")}</TabsTrigger>
                <TabsTrigger value="navigation">{t("studio.design.tabNavigation")}</TabsTrigger>
                <TabsTrigger value="footer">{t("studio.design.tabFooter")}</TabsTrigger>
              </TabsList>
              <ScrollArea className="min-h-0 flex-1">
                <TabsContent value="theme" className="space-y-5 p-4">
                  <div className="space-y-2">
                    <Label>{t("studio.design.colorMode")}</Label>
                    <Select value={settings.themeMode} onValueChange={value => patch("themeMode", value as SiteSettings["themeMode"])}>
                      <SelectTrigger className="w-full" aria-label={t("studio.design.colorModeAria")}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="system">{t("studio.design.modeSystem")}</SelectItem>
                        <SelectItem value="light">{t("studio.design.modeLight")}</SelectItem>
                        <SelectItem value="dark">{t("studio.design.modeDark")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{t("studio.design.colorModeHelp")}</p>
                  </div>
                  <div className="space-y-3">
                    <Label>{t("studio.design.websiteLayout")}</Label>
                    <div className="grid gap-2" role="group" aria-label={t("studio.design.layoutPresets")}>
                      {SITE_LAYOUTS.map(layout => (
                        <button
                          key={layout.id}
                          type="button"
                          aria-label={t("studio.design.layoutAria", { layout: t(layout.name) })}
                          aria-pressed={settings.siteLayout === layout.id}
                          onClick={() => patch("siteLayout", layout.id)}
                          className="flex items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:border-foreground/35 focus-visible:outline-2 focus-visible:outline-ring aria-pressed:border-primary aria-pressed:bg-primary/5"
                        >
                          <span aria-hidden="true" className="flex h-12 w-16 shrink-0 flex-col overflow-hidden rounded-md border border-border bg-card p-1">
                            <span className="mb-1 h-1.5 rounded-sm bg-muted-foreground/40" />
                            <span className="flex min-h-0 flex-1 gap-1">
                              <span className={`w-3 rounded-sm bg-muted-foreground/20 ${layout.id === "inset" ? "m-0.5" : ""}`} />
                              <span className={`flex-1 rounded-sm bg-primary/15 ${layout.id === "reading" ? "mx-1" : ""}`} />
                              {layout.id !== "reading" && <span className="w-2 rounded-sm bg-muted-foreground/15" />}
                            </span>
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold">{t(layout.name)}</span>
                            <span className="block text-xs leading-5 text-muted-foreground">{t(layout.detail)}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label>{t("studio.design.palette")}</Label>
                    <div className="grid grid-cols-2 gap-2" role="group" aria-label={t("studio.design.palettePresets")}>
                      {SITE_PALETTES.map(palette => (
                        <button
                          key={palette.id}
                          type="button"
                          aria-label={t("studio.design.paletteAria", { palette: t(palette.name) })}
                          aria-pressed={settings.sitePalette === palette.id}
                          onClick={() => patch("sitePalette", palette.id)}
                          className="rounded-xl border border-border p-3 text-left transition-colors hover:border-foreground/35 focus-visible:outline-2 focus-visible:outline-ring aria-pressed:border-primary aria-pressed:bg-primary/5"
                        >
                          <span className="mb-2 flex h-7 overflow-hidden rounded-md border border-border/70">
                            <span className="w-1/2" style={{ backgroundColor: palette.light }} />
                            <span className="w-1/2" style={{ backgroundColor: palette.dark }} />
                          </span>
                          <span className="text-xs font-semibold">{t(palette.name)}</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">{t("studio.design.paletteHelp")}</p>
                  </div>
                  <div className="space-y-3">
                    <Label>{t("studio.design.cardLayout")}</Label>
                    <div className="grid grid-cols-2 gap-2" role="group" aria-label={t("studio.design.cardLayout")}>
                      {CARD_LAYOUTS.map(layout => (
                        <button
                          key={layout.id}
                          type="button"
                          aria-label={t(layout.name)}
                          aria-pressed={settings.cardLayout === layout.id}
                          onClick={() => patch("cardLayout", layout.id)}
                          className="rounded-xl border border-border p-3 text-left transition-colors hover:border-foreground/35 focus-visible:outline-2 focus-visible:outline-ring aria-pressed:border-primary aria-pressed:bg-primary/5"
                        >
                          <span aria-hidden="true" className={`mb-2 flex h-9 gap-1.5 rounded-md border border-border/70 p-1.5 ${layout.id === "stacked" ? "flex-col" : "flex-row"}`}>
                            <span className="min-h-0 min-w-0 flex-1 rounded bg-primary/20" />
                            <span className="min-h-0 min-w-0 flex-1 rounded bg-primary/20" />
                          </span>
                          <span className="block text-xs font-semibold">{t(layout.name)}</span>
                          <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">{t(layout.detail)}</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">{t("studio.design.cardHelp")}</p>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label>{t("studio.design.documentLanguage")}</Label>
                    <Select value={settings.language} onValueChange={value => patch("language", value as SiteSettings["language"])}>
                      <SelectTrigger className="w-full" aria-label={t("studio.design.documentLanguage")}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DOCUMENT_LANGUAGES.map(({ code, label }) => <SelectItem key={code} value={code}>{label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{t("studio.design.documentLanguageHelp")}</p>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label htmlFor="designer-google-font">{t("studio.design.websiteFont")}</Label>
                    <Input
                      id="designer-google-font"
                      placeholder={t("studio.design.fontPlaceholder")}
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
                      {t("studio.design.fontHelp")}
                    </p>
                    {settings.googleFontFamily && <Button type="button" size="sm" variant="ghost"
                      onClick={() => patch("googleFontFamily", "")}>{t("studio.design.fontReset")}</Button>}
                  </div>
                  <Separator />
                  <div className="grid gap-3">
                    <Label htmlFor="designer-accent">{t("studio.design.accent")}</Label>
                    <div className="flex items-center gap-3">
                      <Input id="designer-accent" type="color" className="h-10 w-16 cursor-pointer p-1" value={settings.accentColor} onChange={event => patch("accentColor", event.target.value)} />
                      <code className="text-sm text-muted-foreground">{settings.accentColor.toUpperCase()}</code>
                    </div>
                    <div className="flex flex-wrap gap-2" aria-label={t("studio.design.accentPresets")}>
                      {[
                        { name: "studio.design.accentBlue", value: "#2196f3" },
                        { name: "studio.design.accentViolet", value: "#7c3aed" },
                        { name: "studio.design.accentTeal", value: "#0d9488" },
                        { name: "studio.design.accentOrange", value: "#ea580c" },
                        { name: "studio.design.accentRose", value: "#e11d48" },
                      ].map(color => (
                        <StudioTooltip key={color.name} label={t(color.name)}>
                          <button type="button" aria-label={t(color.name)}
                            aria-pressed={settings.accentColor.toLowerCase() === color.value}
                            className="size-9 rounded-full border-2 border-background outline-offset-2 ring-1 ring-border focus-visible:outline-2 focus-visible:outline-ring data-[selected=true]:ring-2 data-[selected=true]:ring-foreground"
                            data-selected={settings.accentColor.toLowerCase() === color.value}
                            style={{ backgroundColor: color.value }}
                            onClick={() => patch("accentColor", color.value)} />
                        </StudioTooltip>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">{t("studio.design.accentHelp")}</p>
                  </div>
                </TabsContent>
                <TabsContent value="header" className="space-y-5 p-4">
                  <div className="grid gap-2"><Label htmlFor="designer-site-name">{t("studio.design.siteTitle")}</Label><Input id="designer-site-name" required maxLength={100} value={settings.title} onChange={e => patch("title", e.target.value)}/></div>
                  <div className="grid gap-2">
                    <Label htmlFor="designer-site-url">{t("studio.design.siteUrl")}</Label>
                    <Input id="designer-site-url" type="url" maxLength={240}
                      placeholder="https://username.github.io/project/"
                      value={settings.siteUrl} onChange={e => patch("siteUrl", e.target.value)} />
                    <p className="text-xs text-muted-foreground">{t("studio.design.siteUrlHelp")}</p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="designer-logo">{t("studio.design.logoUrl")}</Label>
                    <Input id="designer-logo" placeholder="https://example.com/logo.png or assets/logo.png"
                      value={settings.logoUrl} onChange={e => patch("logoUrl", e.target.value)} />
                    <Label htmlFor="designer-logo-upload">{t("studio.design.logoImport")}</Label>
                    <Input id="designer-logo-upload" type="file" accept="image/png,image/jpeg,image/webp,image/gif"
                      disabled={uploading || busy}
                      onChange={event => {
                        const file = event.target.files?.[0];
                        if (file) void uploadLogo(file);
                        event.target.value = "";
                      }} />
                    <p className="text-xs text-muted-foreground">
                      {uploading ? t("studio.design.logoImporting") : t("studio.design.logoHelp")}
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("studio.design.headerAlignment")}</Label>
                    <Select value={settings.headerAlignment} onValueChange={value => patch("headerAlignment", value as SiteSettings["headerAlignment"])}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="left">{t("studio.design.left")}</SelectItem><SelectItem value="center">{t("studio.design.centered")}</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between gap-2"><Label htmlFor="designer-sticky">{t("studio.design.stickyHeader")}</Label><Switch id="designer-sticky" checked={settings.stickyHeader} onCheckedChange={value => patch("stickyHeader", value)} /></div>
                  <Separator />
                  <LinkEditor label={t("studio.design.headerLinks")} links={settings.headerLinks} onChange={value => patch("headerLinks", value)}/>
                </TabsContent>
                <TabsContent value="navigation" className="space-y-5 p-4">
                  <div className="grid gap-2">
                    <Label>{t("studio.design.navigationPosition")}</Label>
                    <Select value={settings.navigationPosition} onValueChange={value => patch("navigationPosition", value as SiteSettings["navigationPosition"])}>
                      <SelectTrigger className="w-full"><SelectValue/></SelectTrigger>
                      <SelectContent><SelectItem value="left">{t("studio.design.navLeft")}</SelectItem><SelectItem value="right">{t("studio.design.navRight")}</SelectItem><SelectItem value="top">{t("studio.design.navTop")}</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between"><Label>{t("studio.design.articleWidth")}</Label><span className="text-xs text-muted-foreground">{settings.contentWidth}px</span></div>
                    <Slider aria-label={t("studio.design.articleWidth")} min={640} max={1100} step={10} value={[settings.contentWidth]} onValueChange={value => patch("contentWidth", value[0])} />
                    <p className="text-xs text-muted-foreground">{t("studio.design.articleWidthHelp")}</p>
                  </div>
                </TabsContent>
                <TabsContent value="footer" className="space-y-5 p-4">
                  <div className="flex items-center justify-between gap-2"><Label htmlFor="designer-footer-toggle">{t("studio.design.showFooter")}</Label><Switch id="designer-footer-toggle" checked={settings.showFooter} onCheckedChange={value => patch("showFooter", value)}/></div>
                  <div className="grid gap-2"><Label htmlFor="designer-footer-text">{t("studio.design.footerText")}</Label><Input id="designer-footer-text" maxLength={240} value={settings.footerText} onChange={event => patch("footerText", event.target.value)}/></div>
                  <Separator />
                  <LinkEditor label={t("studio.design.footerLinks")} links={settings.footerLinks} onChange={value => patch("footerLinks", value)}/>
                </TabsContent>
              </ScrollArea>
            </Tabs>
            {error && <p role="alert" className="mx-3 mt-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">{error}</p>}
            <div className="flex shrink-0 items-center gap-3 border-t border-border p-3">
              <Button type="submit" disabled={busy || uploading || !settings.title.trim()} className="flex-1">{busy ? <LoaderCircle className="animate-spin"/> : <Save />} {t("studio.design.saveLayout")}</Button>
              <span className="text-xs text-muted-foreground">{saved ? t("studio.design.saved") : t("studio.design.unsaved")}</span>
            </div>
          </form>}
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-3 py-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground"><Eye className="size-4" /> {t("studio.design.liveWebsite")}
              <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px]">Site: {settings?.themeMode ?? "loading"}</span></div>
            <div className="flex gap-1">
              <Button type="button" aria-pressed={width === "desktop"} variant={width === "desktop" ? "secondary" : "ghost"} size="sm" onClick={() => setWidth("desktop")}>{t("studio.design.desktop")}</Button>
              <Button type="button" aria-pressed={width === "tablet"} variant={width === "tablet" ? "secondary" : "ghost"} size="sm" onClick={() => setWidth("tablet")}>{t("studio.design.tablet")}</Button>
              <Button type="button" aria-pressed={width === "mobile"} variant={width === "mobile" ? "secondary" : "ghost"} size="sm" onClick={() => setWidth("mobile")}>{t("studio.design.mobile")}</Button>
            </div>
          </div>
          <div className="paglora-preview-stage flex min-h-0 flex-1 justify-center overflow-auto p-3 sm:p-6">
            {preview ? <iframe title={t("studio.design.previewTitle")} sandbox="allow-same-origin" srcDoc={preview}
              style={{ width: width === "desktop" ? "100%" : width === "tablet" ? "min(100%,768px)" : "min(100%,390px)" }}
              className="paglora-preview-frame h-full min-h-72 rounded-md border bg-white transition-[width] duration-200 motion-reduce:transition-none"/> :
              <p className="flex items-center gap-2 self-center text-xs text-muted-foreground"><LoaderCircle className="size-4 animate-spin"/> {t("studio.design.rendering")}</p>}
          </div>
          <p className="flex shrink-0 items-center gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground"><ArrowRight className="size-3.5"/> {t("studio.design.rendererHelp")}</p>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}
