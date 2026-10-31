import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, Code2, FileCode2, FileJson2, FileText, Folder, LoaderCircle, Plus, RefreshCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StudioTooltip } from "@/components/studio/studio-tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MonacoCodeEditor } from "@/components/editor/monaco-code-editor";
import { loadThemeCss, saveThemeCss, listThemeStyles, loadThemeStyle, saveThemeStyle, createThemeStyle, reorderThemeStyles } from "@/lib/source";
import { Input } from "@/components/ui/input";
import { loadPage, savePage, type Page } from "@/lib/pages";
import { loadSiteSettings, previewPublicPage } from "@/lib/site";

type SourceFile = `theme/${string}.css` | "pages.json" | "site.json" | `docs/${string}.md`;
const safeFile = (id: string): SourceFile => `docs/${id}.md`;

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/** A deliberately scoped source workspace: only manifest-listed pages and the
 * existing CSS can be edited, and project metadata is inspected read-only.
 * This is NOT an arbitrary filesystem explorer or an executable code editor.
 */
export function ThemeSourceEditor({
  projectId, currentPageId, pages, onBeforePreview, onPageSourceSaved,
}: {
  projectId: string;
  currentPageId: string;
  pages: Page[];
  onBeforePreview: () => Promise<void>;
  onPageSourceSaved: (pageId: string, content: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<SourceFile>("theme/custom.css");
  const [value, setValue] = useState("");
  const [savedValue, setSavedValue] = useState("");
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [treeOpen, setTreeOpen] = useState({ docs: true, theme: true, metadata: true });
  const [styleFiles, setStyleFiles] = useState<string[]>(["custom.css"]);
  const [newStyle, setNewStyle] = useState("");
  const [stylesBusy, setStylesBusy] = useState(false);
  const operation = useRef(0);
  const beforePreviewRef = useRef(onBeforePreview);
  beforePreviewRef.current = onBeforePreview;
  const pageSavedRef = useRef(onPageSourceSaved);
  pageSavedRef.current = onPageSourceSaved;
  const dirty = value !== savedValue;
  const readOnly = file === "pages.json" || file === "site.json";
  const pageId = file.startsWith("docs/") ? file.slice(5, -3) : "";
  const language = file.endsWith(".json") ? "json" : file.endsWith(".md") ? "markdown" : "css";

  const refresh = useCallback(async () => {
    // Preserve live editor autosave ordering before refreshing the actual site.
    await beforePreviewRef.current();
    setHtml(await previewPublicPage(projectId, currentPageId));
  }, [projectId, currentPageId]);

  const loadSelected = useCallback(async (next: SourceFile, version: number) => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      let content: string;
      if (next === "theme/custom.css") content = await loadThemeCss(projectId);
      else if (next.startsWith("theme/") && next.endsWith(".css")) content = await loadThemeStyle(projectId,next.slice(6));
      else if (next === "pages.json") content = JSON.stringify({ formatVersion: 1, pages }, null, 2) + "\n";
      else if (next === "site.json") content = JSON.stringify(await loadSiteSettings(projectId), null, 2) + "\n";
      else {
        const id = next.slice(5, -3);
        if (!pages.some(page => page.id === id)) throw new Error("Page is no longer listed in this project.");
        content = (await loadPage(projectId, id)).markdown;
      }
      if (operation.current !== version) return;
      setValue(content);
      setSavedValue(content);
    } catch (cause) {
      if (operation.current === version) setError(errorMessage(cause));
    } finally {
      if (operation.current === version) setLoading(false);
    }
  }, [projectId, pages]);

  useEffect(() => {
    if (!open) return;
    const version = ++operation.current;
    setFile("theme/custom.css");
    setValue("");
    setSavedValue("");
    setHtml("");
    setLoading(true);
    void beforePreviewRef.current()
      .then(async () => {
        if (version !== operation.current) return;
        const order=await listThemeStyles(projectId);
        if (version !== operation.current) return;
        setStyleFiles(order);
        await loadSelected("theme/custom.css", version);
        const rendered = await previewPublicPage(projectId, currentPageId);
        if (version === operation.current) setHtml(rendered);
      })
      .catch(cause => { if (version === operation.current) setError(errorMessage(cause)); })
      .finally(() => { if (version === operation.current) setLoading(false); });
    return () => { operation.current++; };
    // Opening establishes a consistent saved-source snapshot. Switching pages
    // never recreates it; the dialog is modal while sources are edited.
  }, [open, projectId, currentPageId, loadSelected]);

  const selectFile = (next: SourceFile) => {
    if (saving || loading || next === file) return;
    if (dirty && !window.confirm("Discard unsaved changes in " + file + "?")) return;
    const version = ++operation.current;
    setFile(next);
    void loadSelected(next, version);
  };

  const save = useCallback(async () => {
    if (saving || loading || readOnly || !dirty) return;
    if (file.startsWith("docs/") && !pages.some(page => page.id === pageId)) {
      setError("The selected page is no longer in the project."); return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (file === "theme/custom.css") {
        await saveThemeCss(projectId, value);
      } else if (file.startsWith("theme/") && file.endsWith(".css")) {
        await saveThemeStyle(projectId,file.slice(6),value);
      } else if (pageId) {
        if (new TextEncoder().encode(value).length > 5_000_000) throw new Error("Markdown exceeds the 5 MB page limit.");
        await savePage(projectId, pageId, value);
        pageSavedRef.current(pageId, value);
      }
      setSavedValue(value);
      await refresh();
      setMessage(`Saved ${file} · Site preview updated`);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setSaving(false); }
  }, [saving, loading, readOnly, dirty, file, pages, pageId, projectId, value, refresh]);


  async function addStyle() {
    const input=newStyle.trim();
    const name=input.endsWith(".css") ? input : input+".css";
    if (!/^[a-z0-9][a-z0-9-]{0,31}\.css$/.test(name) || name==="custom.css" || name.endsWith("-.css")) {
      setError("Use a unique lowercase filename (letters, digits and hyphens).");
      return;
    }
    if (dirty && !window.confirm("Discard unsaved changes in " + file + "?")) return;
    setStylesBusy(true);setError("");
    try {
      const order=await createThemeStyle(projectId,name);
      setStyleFiles(order);setNewStyle("");
      const version=++operation.current;
      const selectedStyle = `theme/${name}` as SourceFile;
      setFile(selectedStyle);
      await loadSelected(selectedStyle,version);
      await refresh();
      setMessage("Stylesheet added to site preview and export cascade.");
    } catch(cause){setError(errorMessage(cause));}
    finally{setStylesBusy(false);}
  }
  async function moveStyle(index:number,delta:number) {
    if (index<1 || index+delta<1 || index+delta>=styleFiles.length || stylesBusy || saving || loading) return;
    if (dirty && !window.confirm("Discard unsaved changes in " + file + "?")) return;
    const order=[...styleFiles];
    [order[index],order[index+delta]]=[order[index+delta],order[index]];
    setStylesBusy(true);setError("");
    try{
      setStyleFiles(await reorderThemeStyles(projectId,order));
      await refresh();
      setMessage("Stylesheet priority saved · Last file wins.");
    }catch(cause){setError(errorMessage(cause));}
    finally{setStylesBusy(false);}
  }
  function setDialogOpen(next: boolean) {
    if (!next && dirty && !window.confirm(`Discard unsaved changes in ${file}?`)) return;
    if (!saving) setOpen(next);
  }

  const toggle = (section: "docs" | "theme" | "metadata") =>
    setTreeOpen(current => ({ ...current, [section]: !current[section] }));

  const section = (name: "docs" | "theme" | "metadata", title: string, entries: { path: SourceFile; label: string }[]) => (
    <div className="mb-2" key={name}>
      <button type="button" aria-expanded={treeOpen[name]} onClick={() => toggle(name)}
        className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted">
        <ChevronDown className={`size-3.5 transition-transform ${treeOpen[name] ? "" : "-rotate-90"}`} />
        <Folder className="size-4" /> {title}
      </button>
      {treeOpen[name] && <div className="space-y-0.5 pl-2">
        {entries.map(entry => {
          const Icon = entry.path.endsWith(".css") ? FileCode2 : entry.path.endsWith(".json") ? FileJson2 : FileText;
          return <button key={entry.path} type="button" aria-current={entry.path === file ? "page" : undefined}
            onClick={() => selectFile(entry.path)}
            className={`flex w-full min-w-0 items-center gap-2 rounded px-2 py-1.5 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring ${entry.path === file ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
            <Icon className="size-4 shrink-0" /> <span className="truncate">{entry.label}</span>
          </button>;
        })}
      </div>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Code2 /> Source</Button>
      </DialogTrigger>
      <DialogContent className="flex h-[92dvh] max-h-[96dvh] w-[min(97vw,1700px)] max-w-none flex-col gap-3 overflow-hidden p-4 sm:max-w-none">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2"><Code2 className="size-4" /> Project source workspace</DialogTitle>
          <DialogDescription>
            Explore real project Markdown and theme CSS in Monaco. Metadata is read-only and protected by Paglora's schema. Changes to pages update the visual editor.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-2 lg:flex-row">
          <nav aria-label="Project source files" className="max-h-36 shrink-0 overflow-y-auto rounded-lg border border-border bg-muted/20 p-2 lg:max-h-none lg:w-56">
            {section("docs", "Documentation", pages.map(page => ({ path: safeFile(page.id), label: `${page.id}.md` })))}
            {section("theme", "Theme", styleFiles.map((name,index)=>({path:`theme/${name}` as SourceFile,label:`${index+1}. ${name}` })))}
            {treeOpen.theme && <div aria-label="Stylesheet cascade order" className="mb-3 space-y-2 rounded-md border border-border bg-card p-2">
              <p className="text-[11px] leading-relaxed text-muted-foreground">Site default CSS → custom.css → additional styles in order. Last declaration wins in Preview and published Build.</p>
              {styleFiles.map((name,index) => <div key={name} className="flex min-w-0 items-center gap-1 text-[11px]">
                <span className="min-w-0 flex-1 truncate font-mono" title={name}>{index+1}. {name}</span>
                {index>0 && <>
                  <Button type="button" size="icon-xs" variant="ghost" disabled={stylesBusy || saving || loading || index===1}
                    aria-label={`Move ${name} up`} onClick={() => void moveStyle(index,-1)}><ArrowUp className="size-3.5" /></Button>
                  <Button type="button" size="icon-xs" variant="ghost" disabled={stylesBusy || saving || loading || index===styleFiles.length-1}
                    aria-label={`Move ${name} down`} onClick={() => void moveStyle(index,1)}><ArrowDown className="size-3.5" /></Button>
                </>}
              </div>)}
              <div className="flex flex-wrap gap-1">
                <Input aria-label="New stylesheet name" className="h-8 min-w-28 flex-1 text-xs" placeholder="components.css"
                  value={newStyle} onChange={event => setNewStyle(event.target.value)} disabled={stylesBusy || styleFiles.length>=13} />
                <Button type="button" size="sm" variant="outline" disabled={stylesBusy || loading || saving || !newStyle.trim() || styleFiles.length>=13}
                  onClick={() => void addStyle()}><Plus className="size-3.5" /> Add CSS</Button>
              </div>
            </div>}
            {section("metadata", "Metadata (read-only)", [{ path: "pages.json", label: "pages.json" }, { path: "site.json", label: "site.json" }])}
          </nav>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-mono text-xs font-medium">{file}{dirty ? " •" : ""}</p>
                <p className="text-xs text-muted-foreground">{readOnly ? "Schema protected · Read-only" : dirty ? "Unsaved changes" : "Saved source file"}</p>
              </div>
              {!readOnly && <Button size="sm" disabled={loading || saving || !dirty} onClick={() => void save()}>
                {saving ? <LoaderCircle className="animate-spin" /> : <Save />} Save
              </Button>}
            </div>
            {loading
              ? <div className="flex items-center gap-2 p-5 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Loading source files...</div>
              : <div className="flex min-h-0 flex-1" data-paglora-source-editor>
                  <MonacoCodeEditor key={file} label={`${readOnly ? "Inspect" : "Edit"} ${file}`}
                    language={language} readOnly={readOnly} value={value}
                    onChange={next => { if (!readOnly) { setValue(next); setMessage(""); } }}
                    onSave={() => void save()} />
                </div>
            }
            <div className="shrink-0 border-t border-border p-3 text-xs text-muted-foreground">
              {readOnly ? "Generated metadata view · Use Paglora settings to change structured fields" : "Local project source · Ctrl+S to save · No external filesystem access"}
            </div>
          </div>
          <div className="flex min-h-40 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-muted/30">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
              <span className="text-xs font-medium">Published website preview</span>
              <StudioTooltip label="Refresh from saved files"><Button variant="ghost" size="icon-sm" aria-label="Refresh site preview" disabled={loading || saving} onClick={() => void refresh().catch(cause => setError(errorMessage(cause)))}>
                <RefreshCcw />
              </Button></StudioTooltip>
            </div>
            <div className="min-h-0 flex-1 p-2">
              {html && <iframe title="Project source website preview" sandbox="allow-same-origin" srcDoc={html}
                className="h-full min-h-36 w-full rounded-md border border-border bg-white" />}
              {!html && !error && <div className="p-4 text-sm text-muted-foreground">Preparing website preview...</div>}
            </div>
            <p className="shrink-0 border-t border-border p-3 text-xs text-muted-foreground">Scripts are disabled. Only public content appears in this preview.</p>
          </div>
        </div>
        {(error || message) && <p role={error ? "alert" : "status"}
          className={error ? "shrink-0 text-xs text-destructive" : "flex shrink-0 items-center gap-2 text-xs text-muted-foreground"}>
          {!error && <Check className="size-3.5" />} {error || message}
        </p>}
      </DialogContent>
    </Dialog>
  );
}
