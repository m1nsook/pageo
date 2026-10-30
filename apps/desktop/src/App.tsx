import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { ProjectDocument, ProjectSummary } from "@pageo/core";
import { validateProjectName } from "@pageo/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import {
  ArrowLeft, ArrowRight, Bold, BookOpen, Check, ChevronRight, Clock3, Code2,
  FileText, FolderOpen, Heading1, Heading2, Home, Italic, LayoutTemplate,
  List, ListOrdered, LoaderCircle, Plus, Search, Settings2, ShieldCheck,
  Sparkles, Upload, WandSparkles, GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { NewPageDialog, PageActions } from "@/components/editor/page-dialogs";
import { createProject, isTauri, listProjects, loadProject, projectsDirectory } from "@/lib/projects";
import { listPages, loadPage, createPage, renamePage, duplicatePage, deletePage, reorderPages, savePage, type Page, type PageDocument } from "@/lib/pages";

type View = "home" | "projects" | "settings";

const formatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
function displayDate(epochSeconds: number) { return formatter.format(new Date(epochSeconds * 1000)); }
function friendlyError(error: unknown) { return error instanceof Error ? error.message : String(error); }

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-9 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold tracking-tighter text-white shadow-sm">p.</div>
      <span className="text-xl font-bold tracking-[-0.06em] text-zinc-900">pageo<span className="text-indigo-600">.</span></span>
    </div>
  );
}

function Navigation({ view, onView, inEditor }: { view: View; onView: (view: View) => void; inEditor: boolean }) {
  const links = [
    { id: "home" as View, icon: Home, label: "Home" },
    { id: "projects" as View, icon: FolderOpen, label: "Projects" },
    { id: "settings" as View, icon: Settings2, label: "Settings" },
  ];
  return (
    <aside className="flex w-[248px] shrink-0 flex-col border-r border-zinc-200/80 bg-white px-4 py-6">
      <div className="px-3"><Brand /></div>
      <div className="mt-11 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Workspace</div>
      <nav className="mt-3 space-y-1">
        {links.map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => onView(id)} disabled={inEditor} title={inEditor ? "Use the editor back arrow to save first" : undefined} className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors", !inEditor && view === id ? "bg-indigo-50 text-indigo-700" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900")}>
            <Icon size={18} strokeWidth={1.9} />{label}
          </button>
        ))}
      </nav>
      <div className="mt-8 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Resources</div>
      <div className="mt-3 space-y-1">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-400" title="Coming in a later release"><LayoutTemplate size={18}/> Templates <span className="ml-auto text-[10px]">Soon</span></div>
      </div>
      <div className="mt-auto rounded-xl border border-indigo-100 bg-indigo-50/70 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-indigo-800"><ShieldCheck size={15}/> Private by design</div>
        <p className="mt-2 text-xs leading-5 text-indigo-700/75">Your projects stay on this computer. No account or cloud required.</p>
      </div>
      <div className="mt-5 flex items-center justify-between px-3 text-xs text-zinc-400"><span>Pageo Studio</span><span>v0.1.0</span></div>
    </aside>
  );
}

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
        <div className="mb-5 flex size-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><BookOpen size={22}/></div>
        <DialogTitle>Create a documentation project</DialogTitle>
        <DialogDescription>Your new project is stored locally and can be edited anytime.</DialogDescription>
        <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-4">
          <label className="block space-y-2"><span className="text-sm font-medium text-zinc-700">Project name</span><Input autoFocus placeholder="e.g. My Project Docs" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} /></label>
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={busy || disabled}>{busy ? <LoaderCircle className="animate-spin"/> : <Plus/>} Create project</Button></div>
          {disabled && <p className="text-xs text-amber-700">Browser preview only. Launch the Tauri desktop app to use local projects.</p>}
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProjectCard({ project, onOpen }: { project: ProjectSummary; onOpen: () => void }) {
  return (
    <Card className="group overflow-hidden rounded-2xl transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-[0_12px_32px_rgba(60,56,130,0.1)]">
      <button onClick={onOpen} className="flex min-h-48 w-full flex-col p-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500">
      <div className="flex w-full items-start justify-between"><span className="flex size-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><BookOpen size={22}/></span><ArrowRight className="text-zinc-300 transition-all group-hover:translate-x-1 group-hover:text-indigo-500" size={19}/></div>
      <div className="mt-6 truncate text-base font-semibold tracking-tight text-zinc-900" title={project.name}>{project.name}</div>
      <div className="mt-1 text-xs text-zinc-500">Documentation project</div>
      <div className="mt-auto flex items-center gap-2 border-t border-zinc-100 pt-4 text-xs text-zinc-400"><Clock3 size={14}/> Updated {displayDate(project.updatedAt)}</div>
      </button>
    </Card>
  );
}

function Dashboard({ projects, openCreate, openProject, view, loading, search, setSearch, desktop, error }: {
  projects: ProjectSummary[]; openCreate: () => void; openProject: (id: string) => void;
  view: View; loading: boolean; search: string; setSearch: (value: string) => void; desktop: boolean; error: string;
}) {
  const visible = useMemo(() => projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase())), [projects, search]);
  return (
    <main className="min-w-0 flex-1 overflow-y-auto">
      <header className="flex h-20 items-center justify-between border-b border-zinc-200/70 bg-white/70 px-10"><div className="flex items-center gap-2 text-sm text-zinc-500">Workspace <ChevronRight size={14}/> <span className="font-medium text-zinc-800">{view === "home" ? "Home" : "Projects"}</span></div><Badge variant="outline" className="gap-2 py-1.5"><span className="size-1.5 rounded-full bg-emerald-500"/> Local workspace</Badge></header>
      <div className="mx-auto max-w-[1120px] px-10 py-12">
        {view === "home" && (
          <div className="relative mb-12 overflow-hidden rounded-[24px] border border-indigo-100 bg-gradient-to-br from-[#f0efff] via-[#f8f7ff] to-white px-9 py-10">
            <div className="relative z-10 max-w-xl"><div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-indigo-200/70 bg-white/70 px-3 py-1 text-[11px] font-semibold text-indigo-600"><Sparkles size={13}/> YOUR DOCUMENTATION STUDIO</div><h1 className="text-[34px] font-bold leading-tight tracking-[-0.045em] text-zinc-900">Documentation that feels<br/> effortless to create.</h1><p className="mt-4 max-w-md text-sm leading-6 text-zinc-600">Write beautifully, organize simply, and make something worth sharing. Everything starts right here on your computer.</p><Button className="mt-7" onClick={openCreate}><Plus/> New project</Button></div>
            <div aria-hidden className="pointer-events-none absolute -right-8 -top-10 size-72 rounded-full border-[45px] border-indigo-100/60"/>
            <div aria-hidden className="pointer-events-none absolute -bottom-20 right-32 size-48 rounded-full bg-violet-200/30 blur-3xl"/>
          </div>
        )}
        <div className="flex flex-wrap items-end justify-between gap-5"><div><h2 className="text-2xl font-bold tracking-[-0.035em] text-zinc-900">{view === "home" ? "Your projects" : "All projects"}</h2><p className="mt-1.5 text-sm text-zinc-500">Pick up where you left off, or start something new.</p></div><div className="flex gap-2"><div className="relative"><Search className="absolute left-3 top-3 size-4 text-zinc-400"/><Input className="w-56 pl-9" placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)}/></div>{view === "projects" && <Button onClick={openCreate}><Plus/> New project</Button>}</div></div>
        {!desktop && <div className="mt-7 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Browser preview mode: the interface is visible, but creating and editing local files requires <code className="font-mono">bun run desktop</code>.</div>}
        {error && <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {loading ? <div className="flex items-center justify-center gap-2 py-28 text-sm text-zinc-500"><LoaderCircle className="animate-spin" size={18}/> Loading projects...</div> : visible.length > 0 ? (
          <div className="mt-7 grid grid-cols-1 gap-4 xl:grid-cols-3 lg:grid-cols-2">{visible.map((project) => <ProjectCard key={project.id} project={project} onOpen={() => openProject(project.id)}/>)}</div>
        ) : search ? (
          <div className="mt-7 rounded-2xl border border-dashed border-zinc-200 bg-white py-20 text-center text-sm text-zinc-500">No projects match “{search}”.</div>
        ) : (
          <div className="mt-7 flex flex-col items-center rounded-2xl border border-dashed border-zinc-300 bg-white px-5 py-16 text-center"><div className="flex size-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500"><FolderOpen size={29}/></div><h3 className="mt-6 text-lg font-semibold text-zinc-900">A clean slate, full of possibilities</h3><p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">Create your first documentation project and start writing. Your work will be saved automatically on this computer.</p><Button onClick={openCreate} className="mt-6"><Plus/> Create your first project</Button></div>
        )}
        <div className="mt-10 flex items-center gap-2 text-xs text-zinc-400"><ShieldCheck size={15}/> Your files belong to you. Pageo works without a cloud account.</div>
      </div>
    </main>
  );
}

function Settings({ location, desktop }: { location: string; desktop: boolean }) {
  return (
    <main className="min-w-0 flex-1 overflow-y-auto"><header className="flex h-20 items-center border-b border-zinc-200/70 bg-white/70 px-10 text-sm font-medium text-zinc-700">Workspace <ChevronRight className="mx-2" size={14}/> Settings</header>
      <div className="mx-auto max-w-[890px] px-10 py-12"><h1 className="text-3xl font-bold tracking-tight">Settings</h1><p className="mt-2 text-sm text-zinc-500">Pageo is local-first. No login, account, or online services.</p>
        <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6"><div className="flex items-center gap-3"><div className="rounded-xl bg-indigo-50 p-3 text-indigo-600"><FolderOpen size={20}/></div><div><h2 className="font-semibold">Local project storage</h2><p className="mt-1 text-sm text-zinc-500">Pageo saves your projects in its application data folder.</p></div></div><p className="mt-6 break-all rounded-lg bg-zinc-50 p-3 font-mono text-xs text-zinc-600">{desktop ? (location || "Loading location...") : "Available in the desktop app only"}</p><p className="mt-4 text-xs leading-5 text-zinc-500">Pageo v0.1 uses a managed local directory. Custom locations and .pageo archives are planned for later milestones.</p></div>
        <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-6"><h2 className="font-semibold">About Pageo</h2><p className="mt-2 text-sm text-zinc-500">Open-source desktop documentation studio · Version 0.1.0 · MIT License</p></div>
      </div>
    </main>
  );
}

function ToolbarButton({ title, active, onClick, children }: { title: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" title={title} aria-label={title} aria-pressed={Boolean(active)} className={cn("flex size-9 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900", active && "bg-indigo-50 text-indigo-700")} onMouseDown={(event) => event.preventDefault()} onClick={onClick}>{children}</button>;
}

function SinglePageEditor({ document, current, pages, onBack, onSaved, onChange, onModify }: { document: ProjectDocument; current: PageDocument; pages: Page[]; onBack: () => void; onSaved: (project: ProjectSummary) => void; onChange: (id: string) => Promise<void>; onModify: (action: "create"|"rename"|"duplicate"|"delete"|"reorder", id?: string, target?: string) => Promise<void> }) {
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
  const [dragged, setDragged] = useState<string | null>(null);
  const modify = (action: "create"|"rename"|"duplicate"|"delete"|"reorder", id?: string, target?: string) => {
    void runAfterSave(() => onModify(action, id, target));
  };

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-[#fbfbfc]">
      <div className="flex h-[74px] shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6">
        <div className="flex min-w-0 items-center gap-3"><Button onClick={() => void back()} variant="ghost" size="icon" disabled={leaving} aria-label="Back to projects"><ArrowLeft size={19}/></Button><span className="h-6 w-px bg-zinc-200"/><span className="flex size-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><BookOpen size={19}/></span><div className="min-w-0"><div className="truncate text-sm font-semibold text-zinc-900">{document.project.name}</div><div className="text-xs text-zinc-400">{current.page.title}</div></div></div>
        <div className="flex items-center gap-3"><span className={cn("flex items-center gap-1.5 text-xs", saveState === "error" ? "text-red-600" : "text-zinc-500")}>{saveState === "saving" ? <LoaderCircle className="size-3.5 animate-spin"/> : saveState === "saved" ? <Check className="size-3.5 text-emerald-600"/> : <span className="size-2 rounded-full bg-amber-400"/>}{saveState === "saving" ? "Saving" : saveState === "saved" ? "Saved locally" : saveState === "error" ? "Save failed" : "Unsaved changes"}</span>
          <span className="mx-1 h-6 w-px bg-zinc-200"/>
          <Button variant="outline" size="sm" onClick={() => setPreview(!preview)}>{preview ? <WandSparkles/> : <BookOpen/>}{preview ? "Edit" : "Preview"}</Button>
          <Button size="sm" disabled title="Static publishing is coming in a later milestone"><Upload/> Publish <span className="ml-1 text-[10px] opacity-65">Soon</span></Button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <aside className="w-[248px] shrink-0 overflow-y-auto border-r border-zinc-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between px-2 py-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">Pages</span>
            <NewPageDialog disabled={leaving} onModify={modify}/>
          </div>
          <Separator className="mb-2 bg-zinc-100"/>
          <nav aria-label="Documentation pages" className="space-y-1">
            {pages.map(page => <div key={page.id} onDragOver={event => { if(dragged && page.id!=="index") event.preventDefault(); }} onDrop={event => { event.preventDefault(); if(dragged && dragged!==page.id) modify("reorder",dragged,page.id); setDragged(null); }} className={cn("group flex items-center gap-1 rounded-lg pr-1 transition-colors duration-150",current.page.id===page.id ? "bg-indigo-50 text-indigo-700" : "hover:bg-zinc-50 text-zinc-600")}>
              <span draggable={page.id!=="index"} onDragStart={()=>setDragged(page.id)} onDragEnd={()=>setDragged(null)} title={page.id!=="index" ? "Drag to reorder" : "Overview stays first"} className={cn("flex h-9 w-4 items-center justify-center text-zinc-300",page.id!=="index" ? "cursor-grab active:cursor-grabbing" : "cursor-default opacity-40")}><GripVertical size={14}/></span>
              <button disabled={leaving} aria-current={current.page.id===page.id ? "page" : undefined} onClick={() => page.id!==current.page.id && void runAfterSave(() => onChange(page.id))} className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left text-sm outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-indigo-500"><FileText size={15} className="shrink-0 opacity-75"/><span className="truncate">{page.title}</span></button>
              <PageActions page={page} disabled={leaving} onModify={modify}/>
            </div>)}
          </nav>
          <p className="mt-5 px-2 text-[11px] leading-relaxed text-zinc-400">Drag a page to reorder it. Changes are saved locally.</p>
        </aside>
        <div className="min-w-0 flex-1 overflow-y-auto">
          {!preview && <div className="sticky top-0 z-10 flex h-14 items-center gap-0.5 border-b border-zinc-200 bg-white px-8"><ToolbarButton title="Heading 1" active={editor?.isActive("heading", { level: 1 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 size={18}/></ToolbarButton><ToolbarButton title="Heading 2" active={editor?.isActive("heading", { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={18}/></ToolbarButton><div className="mx-2 h-5 w-px bg-zinc-200"/><ToolbarButton title="Bold" active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold size={17}/></ToolbarButton><ToolbarButton title="Italic" active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic size={17}/></ToolbarButton><div className="mx-2 h-5 w-px bg-zinc-200"/><ToolbarButton title="Bulleted list" active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()}><List size={18}/></ToolbarButton><ToolbarButton title="Numbered list" active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered size={18}/></ToolbarButton><ToolbarButton title="Code block" active={editor?.isActive("codeBlock")} onClick={() => editor?.chain().focus().toggleCodeBlock().run()}><Code2 size={17}/></ToolbarButton><span className="ml-auto text-xs text-zinc-400">Visual editor · Markdown source</span></div>}
          <div className="mx-auto max-w-3xl px-12 py-12">{saveError && <p role="alert" className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">Couldn't save: {saveError}. Check disk permissions before leaving.</p>}<EditorContent editor={editor}/></div>
        </div>
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
  const [view, setView] = useState<View>("home");
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
  function navigate(next: View) { setActive(null); setView(next); }

  return (
    <div className="flex h-screen min-h-[620px] bg-[#f8f9fb]">
      <Navigation view={view} onView={navigate} inEditor={active !== null}/>
      {active ? <ProjectEditor key={active.project.id} document={active} onBack={() => { setActive(null); void refresh(); }} onSaved={onSaved}/> : view === "settings" ? <Settings desktop={desktop} location={location}/> : <Dashboard projects={projects} view={view} loading={loading} error={error} desktop={desktop} search={search} setSearch={setSearch} openCreate={() => setCreating(true)} openProject={(id) => void open(id)}/>}
      <CreateProjectDialog open={creating} onOpenChange={setCreating} onCreate={create} disabled={!desktop}/>
    </div>
  );
}
