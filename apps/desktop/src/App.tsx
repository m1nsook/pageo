import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { ProjectDocument, ProjectSummary } from "@paglora/core";
import { validateProjectName } from "@paglora/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { ArrowLeft, BookOpen, Check, Columns2, LoaderCircle, Monitor, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, PencilLine, Plus, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { PageNavigation, type PageAction } from "@/components/editor/page-navigation";
import { FormatToolbar } from "@/components/editor/format-toolbar";
import { BlockPalette } from "@/components/editor/block-palette";
import { SiteBuilder } from "@/components/editor/site-builder";
import { SitePreview } from "@/components/editor/site-preview";
import { SiteDesigner } from "@/components/editor/site-designer";
import { ThemeSourceEditor } from "@/components/editor/theme-source-editor";
import { InlineSitePreview } from "@/components/editor/inline-site-preview";
import { PageInspector } from "@/components/editor/page-inspector";
import { WorkspaceSidebar, type WorkspaceView } from "@/components/studio/workspace-sidebar";
import { Dashboard, Settings } from "@/components/studio/workspace-content";
import { createProject, isTauri, listProjects, loadProject, projectsDirectory } from "@/lib/projects";
import { listPages, loadPage, createPage, renamePage, duplicatePage, deletePage, reorderPages, savePage, setPageVisibility, setPageLayout, type Page, type PageDocument } from "@/lib/pages";

function friendlyError(error: unknown) { return error instanceof Error ? error.message : String(error); }

function CreateProjectDialog({ open, onOpenChange, onCreate, disabled }: {
  open: boolean; onOpenChange: (value: boolean) => void;
  onCreate: (name: string) => Promise<void>; disabled: boolean;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!open) { setName(""); setError(""); setBusy(false); } }, [open]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateProjectName(name);
    if (validation) { setError(validation); return; }
    if (disabled) { setError("Run Paglora Desktop to create local projects."); return; }
    setBusy(true); setError("");
    try { await onCreate(name.trim()); onOpenChange(false); }
    catch (cause) { setError(friendlyError(cause)); }
    finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><BookOpen className="size-5"/></div>
          <DialogTitle>Create a documentation project</DialogTitle>
          <DialogDescription>Projects are saved locally and can be edited anytime.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-4">
          <div className="grid gap-2"><Label htmlFor="paglora-project-name">Project name</Label><Input id="paglora-project-name" autoFocus placeholder="My Project Docs" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required /></div>
          {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">{error}</p>}
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={busy || disabled}>{busy ? <LoaderCircle className="animate-spin"/> : <Plus/>} Create project</Button></DialogFooter>
          {disabled && <p className="text-xs text-amber-700">Browser preview only. Launch the Tauri desktop app to use local projects.</p>}
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SinglePageEditor({ document, current, pages, onBack, onSaved, onChange, onModify }: { document: ProjectDocument; current: PageDocument; pages: Page[]; onBack: () => void; onSaved: (project: ProjectSummary) => void; onChange: (id: string) => Promise<void>; onModify: (action: PageAction, id?: string, target?: string) => Promise<void> }) {
  const latest = useRef(current.markdown);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const revision = useRef(0);
  const [saveState, setSaveState] = useState<"saved" | "unsaved" | "saving" | "error">("saved");
  const [saveError, setSaveError] = useState("");
  const [viewMode, setViewMode] = useState<"edit" | "split" | "site">("site");
  const [switchingView, setSwitchingView] = useState(false);
  const [siteRevision, setSiteRevision] = useState(0);
  const [showBlockTools, setShowBlockTools] = useState(true);
  const [showPages, setShowPages] = useState(true);
  const [showInspector, setShowInspector] = useState(true);
  const [leaving, setLeaving] = useState(false);

  const persist = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const content = latest.current;
    const capturedRevision = revision.current;
    setSaveState("saving");
    const run = queue.current.catch(() => undefined).then(() => savePage(document.project.id, current.page.id, content));
    queue.current = run.then(() => undefined, () => undefined);
    try {
      const updated = await run;
      onSaved(updated);
      setSiteRevision(value => value + 1);
      if (capturedRevision === revision.current) { setSaveState("saved"); setSaveError(""); }
    } catch (error) {
      setSaveState("error"); setSaveError(friendlyError(error));
      throw error;
    }
  }, [document.project.id, current.page.id, onSaved]);

  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    content: current.markdown,
    contentType: "markdown",
    editorProps: { attributes: { class: "editor-content focus:outline-none" } },
    onUpdate: ({ editor: current }) => {
      latest.current = current.getMarkdown();
      revision.current += 1;
      setSaveState("unsaved");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => { void persist().catch(() => undefined); }, 850);
    },
  });

  // Desktop Ctrl+S saves the active Markdown file instead of opening WebView's
  // "Save page as..." dialog. The existing serialized autosave queue is reused.
  useEffect(() => {
    function saveShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        // Monaco owns the Source modal's Ctrl+S. Do not save Markdown from a
        // different editor, or race against the custom CSS save.
        if (event.target instanceof Element && event.target.closest("[data-paglora-source-editor]")) return;
        event.preventDefault();
        void persist().catch(() => undefined);
      }
    }
    window.addEventListener("keydown", saveShortcut);
    return () => window.removeEventListener("keydown", saveShortcut);
  }, [persist]);

  useEffect(() => { editor?.setEditable(viewMode !== "site"); }, [editor, viewMode]);
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  async function runAfterSave(action: () => Promise<void>) {
    if (leaving) return;
    setLeaving(true);
    try { await persist(); await action(); }
    catch (cause) { setSaveState("error"); setSaveError(friendlyError(cause)); }
    finally { setLeaving(false); }
  }
  async function selectView(next: "edit" | "split" | "site") {
    if (next === viewMode || leaving || switchingView) return;
    if (next === "edit") { setViewMode(next); return; }
    setSwitchingView(true);
    try {
      // Before revealing the public site, flush the Markdown save queue.
      // Later autosaves cause a fresh preview without replacing the editor.
      await persist();
      setViewMode(next);
    } catch (cause) {
      setSaveState("error");
      setSaveError(friendlyError(cause));
    } finally {
      setSwitchingView(false);
    }
  }
  async function back() { await runAfterSave(async () => onBack()); }
  const modify = (action: PageAction, id?: string, target?: string) => {
    void runAfterSave(() => onModify(action, id, target));
  };

  return (
    <main className="flex h-full min-w-0 flex-1 flex-col bg-background">
      <header className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-3 py-2 lg:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon-sm" aria-label={showPages ? "Hide pages panel" : "Show pages panel"} title={showPages ? "Hide pages panel" : "Show pages panel"} aria-pressed={showPages} onClick={() => setShowPages(value => !value)}>{showPages ? <PanelLeftClose /> : <PanelLeftOpen />}</Button>
          <Separator orientation="vertical" className="mx-1 h-5"/>
          <Button onClick={() => void back()} variant="ghost" size="icon-sm" disabled={leaving} aria-label="Back to projects"><ArrowLeft /></Button>
          <span className="hidden size-8 items-center justify-center rounded-lg bg-primary/10 text-primary sm:flex"><BookOpen className="size-4"/></span>
          <div className="min-w-0"><div className="max-w-44 truncate text-sm font-semibold lg:max-w-64">{document.project.name}</div><div className="max-w-44 truncate text-xs text-muted-foreground lg:max-w-64">{current.page.title}</div></div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={saveState === "error" ? "destructive" : "secondary"} className="gap-1.5 whitespace-nowrap">
            {saveState === "saving" ? <LoaderCircle className="size-3 animate-spin"/> : saveState === "saved" ? <Check className="size-3 text-emerald-600"/> : <span className="size-2 rounded-full bg-amber-400" />}
            {saveState === "saving" ? "Saving" : saveState === "saved" ? "Saved locally" : saveState === "error" ? "Save failed" : "Unsaved"}
          </Badge>
          <Separator orientation="vertical" className="mx-1 hidden h-5 sm:block"/>
          {viewMode === "edit" && <Button variant="ghost" size="icon-sm" aria-label={showBlockTools ? "Hide visual editor tools" : "Show visual editor tools"} title={showBlockTools ? "Hide visual editor tools" : "Show visual editor tools"} onClick={() => setShowBlockTools(value => !value)}>{showBlockTools ? <PanelRightClose /> : <PanelRightOpen />}</Button>}
          {viewMode === "site" && <Button variant="ghost" size="icon-sm" aria-label={showInspector ? "Hide page properties" : "Show page properties"} title={showInspector ? "Hide page properties" : "Show page properties"} aria-pressed={showInspector} onClick={() => setShowInspector(value => !value)}><SlidersHorizontal /></Button>}
          <div role="group" aria-label="Editor view" className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5">
            <Button type="button" size="sm" disabled={leaving || switchingView} variant={viewMode === "edit" ? "secondary" : "ghost"} aria-pressed={viewMode === "edit"} onClick={() => void selectView("edit")} className="gap-1.5 px-2.5"><PencilLine />Edit</Button>
            <Button type="button" size="sm" disabled={leaving || switchingView} variant={viewMode === "split" ? "secondary" : "ghost"} aria-pressed={viewMode === "split"} onClick={() => void selectView("split")} className="gap-1.5 px-2.5"><Columns2 />Split</Button>
            <Button type="button" size="sm" disabled={leaving || switchingView} variant={viewMode === "site" ? "secondary" : "ghost"} aria-pressed={viewMode === "site"} onClick={() => void selectView("site")} className="gap-1.5 px-2.5"><Monitor />Canvas</Button>
          </div>
          <ThemeSourceEditor projectId={document.project.id} currentPageId={current.page.isPublic ? current.page.id : "index"} onBeforePreview={persist} />
          <SiteDesigner projectId={document.project.id} onBeforePreview={persist} />
          <SitePreview projectId={document.project.id} onBeforePreview={persist} />
          <SiteBuilder projectId={document.project.id} onBeforeBuild={persist} />
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        {showPages && <PageNavigation pages={pages} currentId={current.page.id} busy={leaving}
          onNavigate={(id) => { if (id !== current.page.id) void runAfterSave(() => onChange(id)); }}
          onAction={modify}/>}
        <div className={viewMode === "site" ? "hidden" : viewMode === "split" ? "flex min-h-0 min-w-0 flex-1 flex-col border-r border-border xl:w-1/2" : "flex min-h-0 min-w-0 flex-1 flex-col"}>
        <section className="min-h-0 min-w-0 flex-1 overflow-y-auto" aria-label="Documentation editor">
          <FormatToolbar editor={editor} />
          <div data-editor-drop-zone className="mx-auto min-h-[calc(100%-3rem)] max-w-3xl animate-in fade-in-0 px-6 py-9 duration-200 lg:px-10 lg:py-12">
            {saveError && <p role="alert" className="mb-6 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">Couldn't save: {saveError}. Check disk permissions before leaving.</p>}
            <div onKeyDown={(event) => {
              // ProseMirror handles Ctrl/Cmd+B inside the editor. Keep it from
              // bubbling to shadcn Sidebar's global collapse shortcut.
              if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b" &&
                  event.target instanceof HTMLElement && event.target.isContentEditable) {
                event.stopPropagation();
              }
            }}>
              <EditorContent editor={editor}/>
            </div>
          </div>
        </section>
        </div>
        {viewMode !== "edit" && <InlineSitePreview
          projectId={document.project.id}
          page={current.page}
          pages={pages}
          savedVersion={siteRevision}
          onBeforeRefresh={persist}
          onNavigate={(pageId) => {
            if (pageId !== current.page.id) void runAfterSave(() => onChange(pageId));
          }}
        />}
        {viewMode === "site" && showInspector && <PageInspector page={current.page} busy={leaving || switchingView}
          onChange={(action, id, value) => modify(action, id, value)}
          onEditContent={() => void selectView("edit")} />}
        {showBlockTools && viewMode === "edit" && <BlockPalette editor={editor} disabled={leaving} />}
      </div>
    </main>
  );
}

function ProjectEditor(props: { document: ProjectDocument; onBack: () => void; onSaved: (project: ProjectSummary) => void }) {
  const { document } = props;
  const [pages, setPages] = useState<Page[]>([{id:"index",title:"Overview",isPublic:true,layout:"docs"}]);
  const [current, setCurrent] = useState<PageDocument>({page:{id:"index",title:"Overview",isPublic:true,layout:"docs"},markdown:document.markdown});
  const [failure, setFailure] = useState("");
  const id = document.project.id;
  useEffect(() => {
    let alive=true;
    void listPages(id).then(result => {if(alive) setPages(result);}).catch(e=>{if(alive)setFailure(friendlyError(e));});
    return ()=>{alive=false;};
  },[id]);
  const change = async (pageId: string) => { setCurrent(await loadPage(id,pageId)); };
  const modify = async (action: PageAction, pageId?: string, target?: string) => {
    if(action==="create"){
      if(!target?.trim())return;
      setCurrent(await createPage(id,target.trim()));
    } else if(action==="rename" && pageId){
      if(!target?.trim())return;
      const updated=await renamePage(id,pageId,target.trim());
      if(current.page.id===pageId)setCurrent(p=>({...p,page:updated}));
    } else if(action==="duplicate" && pageId) setCurrent(await duplicatePage(id,pageId));
    else if(action==="visibility" && pageId && target){
      const updated = await setPageVisibility(id,pageId,target==="true");
      if(current.page.id===pageId)setCurrent(p=>({...p,page:updated}));
    }
    else if(action==="layout" && pageId && (target==="docs" || target==="wide" || target==="landing")){
      const updated = await setPageLayout(id,pageId,target);
      if(current.page.id===pageId)setCurrent(p=>({...p,page:updated}));
    }
    else if(action==="delete" && pageId){
      await deletePage(id,pageId);
      if(current.page.id===pageId)setCurrent(await loadPage(id,"index"));
    } else if(action==="reorder" && pageId && target){
      const ids=pages.map(p=>p.id); const from=ids.indexOf(pageId),to=ids.indexOf(target);
      if(from<=0 || to<=0 || from===to)return;
      ids.splice(from,1);ids.splice(to,0,pageId);
      setPages(await reorderPages(id,ids));return;
    }
    setPages(await listPages(id));
  };
  return <>{failure && <div role="alert" className="fixed bottom-4 right-4 z-50 rounded-lg bg-red-50 p-3 text-red-600">{failure}</div>}
    <SinglePageEditor key={current.page.id} document={document} current={current} pages={pages}
      onBack={props.onBack} onSaved={props.onSaved} onChange={change} onModify={modify}/></>;
}

export default function App() {
  const desktop = isTauri();
  const [view, setView] = useState<WorkspaceView>("home");
  const [search, setSearch] = useState("");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [active, setActive] = useState<ProjectDocument | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(desktop);
  const [error, setError] = useState("");
  const [location, setLocation] = useState("");

  // Paglora is a desktop editor, not a web page. Prevent browser-only
  // print/save/reload/open shortcuts (and F5) in the Tauri WebView.
  // Do not block copy/paste/undo, or text formatting inside Tiptap.
  useEffect(() => {
    if (!desktop) return;
    function preventBrowserCommands(event: KeyboardEvent) {
      const command = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if ((command && ["p", "s", "r", "o"].includes(key)) || event.key === "F5") {
        event.preventDefault();
      }
    }
    window.addEventListener("keydown", preventBrowserCommands, { capture: true });
    return () => window.removeEventListener("keydown", preventBrowserCommands, { capture: true });
  }, [desktop]);

  const refresh = useCallback(async () => {
    if (!desktop) return;
    setLoading(true);
    try { setProjects(await listProjects()); setError(""); }
    catch (cause) { setError(friendlyError(cause)); }
    finally { setLoading(false); }
  }, [desktop]);

  useEffect(() => { void refresh(); if (desktop) void projectsDirectory().then(setLocation).catch(() => undefined); }, [refresh, desktop]);

  async function create(name: string) {
    const doc = await createProject(name);
    setProjects((prev) => [doc.project, ...prev]);
    setActive(doc);
  }
  async function open(id: string) {
    try { setError(""); setActive(await loadProject(id)); }
    catch (cause) { setError(friendlyError(cause)); }
  }
  const onSaved = useCallback((updated: ProjectSummary) => {
    setProjects((previous) => previous.map((p) => p.id === updated.id ? updated : p));
  }, []);
  function navigate(next: WorkspaceView) { if (active) return; setView(next); }

  return (
    <SidebarProvider className="h-svh min-h-0 overflow-hidden" defaultOpen>
      {!active && <WorkspaceSidebar view={view} onNavigate={navigate} editing={false}/>}
      <SidebarInset className="h-full min-w-0 overflow-hidden">
        {active ? <ProjectEditor key={active.project.id} document={active} onBack={() => { setActive(null); void refresh(); }} onSaved={onSaved}/> : view === "settings" ? <Settings desktop={desktop} location={location}/> : <Dashboard projects={projects} view={view} loading={loading} error={error} desktop={desktop} search={search} setSearch={setSearch} openCreate={() => setCreating(true)} openProject={(id) => void open(id)}/>}
      </SidebarInset>
      <CreateProjectDialog open={creating} onOpenChange={setCreating} onCreate={create} disabled={!desktop}/>
    </SidebarProvider>
  );
}
