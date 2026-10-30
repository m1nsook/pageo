import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { ProjectDocument, ProjectSummary } from "@pageo/core";
import { validateProjectName } from "@pageo/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { ArrowLeft, BookOpen, Check, LoaderCircle, Plus, Upload, WandSparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { PageNavigation, type PageAction } from "@/components/editor/page-navigation";
import { FormatToolbar } from "@/components/editor/format-toolbar";
import { WorkspaceSidebar, type WorkspaceView } from "@/components/studio/workspace-sidebar";
import { Dashboard, Settings } from "@/components/studio/workspace-content";
import { createProject, isTauri, listProjects, loadProject, projectsDirectory } from "@/lib/projects";
import { listPages, loadPage, createPage, renamePage, duplicatePage, deletePage, reorderPages, savePage, type Page, type PageDocument } from "@/lib/pages";

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
    if (disabled) { setError("Run Pageo Desktop to create local projects."); return; }
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
          <div className="grid gap-2"><Label htmlFor="pageo-project-name">Project name</Label><Input id="pageo-project-name" autoFocus placeholder="My Project Docs" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required /></div>
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
  const [preview, setPreview] = useState(false);
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

  useEffect(() => { editor?.setEditable(!preview); }, [editor, preview]);
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  async function runAfterSave(action: () => Promise<void>) {
    if (leaving) return;
    setLeaving(true);
    try { await persist(); await action(); }
    catch (cause) { setSaveState("error"); setSaveError(friendlyError(cause)); }
    finally { setLeaving(false); }
  }
  async function back() { await runAfterSave(async () => onBack()); }
  const modify = (action: PageAction, id?: string, target?: string) => {
    void runAfterSave(() => onModify(action, id, target));
  };

  return (
    <main className="flex h-full min-w-0 flex-1 flex-col bg-background">
      <header className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-3 py-2 lg:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <SidebarTrigger aria-label="Toggle workspace sidebar"/>
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
          <Button variant="outline" size="sm" onClick={() => setPreview(!preview)}><WandSparkles />{preview ? "Edit" : "Preview"}</Button>
          <Button size="sm" disabled title="Static publishing is planned for a later release"><Upload /> Publish</Button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <PageNavigation pages={pages} currentId={current.page.id} busy={leaving}
          onNavigate={(id) => { if (id !== current.page.id) void runAfterSave(() => onChange(id)); }}
          onAction={modify}/>
        <section className="min-w-0 flex-1 overflow-y-auto" aria-label="Documentation editor">
          {!preview && <FormatToolbar editor={editor} />}
          <div className="mx-auto max-w-3xl animate-in fade-in-0 px-7 py-9 duration-200 lg:px-12 lg:py-12">
            {saveError && <p role="alert" className="mb-6 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">Couldn't save: {saveError}. Check disk permissions before leaving.</p>}
            <EditorContent editor={editor}/>
          </div>
        </section>
      </div>
    </main>
  );
}

function ProjectEditor(props: { document: ProjectDocument; onBack: () => void; onSaved: (project: ProjectSummary) => void }) {
  const { document } = props;
  const [pages, setPages] = useState<Page[]>([{id:"index",title:"Overview"}]);
  const [current, setCurrent] = useState<PageDocument>({page:{id:"index",title:"Overview"},markdown:document.markdown});
  const [failure, setFailure] = useState("");
  const id = document.project.id;
  useEffect(() => {
    let alive=true;
    void listPages(id).then(result => {if(alive) setPages(result);}).catch(e=>{if(alive)setFailure(friendlyError(e));});
    return ()=>{alive=false;};
  },[id]);
  const change = async (pageId: string) => { setCurrent(await loadPage(id,pageId)); };
  const modify = async (action: "create"|"rename"|"duplicate"|"delete"|"reorder", pageId?: string, target?: string) => {
    if(action==="create"){
      if(!target?.trim())return;
      setCurrent(await createPage(id,target.trim()));
    } else if(action==="rename" && pageId){
      if(!target?.trim())return;
      const updated=await renamePage(id,pageId,target.trim());
      if(current.page.id===pageId)setCurrent(p=>({...p,page:updated}));
    } else if(action==="duplicate" && pageId) setCurrent(await duplicatePage(id,pageId));
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
      <WorkspaceSidebar view={view} onNavigate={navigate} editing={active !== null}/>
      <SidebarInset className="h-full min-w-0 overflow-hidden">
        {active ? <ProjectEditor key={active.project.id} document={active} onBack={() => { setActive(null); void refresh(); }} onSaved={onSaved}/> : view === "settings" ? <Settings desktop={desktop} location={location}/> : <Dashboard projects={projects} view={view} loading={loading} error={error} desktop={desktop} search={search} setSearch={setSearch} openCreate={() => setCreating(true)} openProject={(id) => void open(id)}/>}
      </SidebarInset>
      <CreateProjectDialog open={creating} onOpenChange={setCreating} onCreate={create} disabled={!desktop}/>
    </SidebarProvider>
  );
}
