import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { ProjectDocument, ProjectSummary } from "@paglora/core";
import { validateProjectName } from "@paglora/core";
import { useTranslation } from "@/i18n";
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
import { editableCanvasText, findCanvasSourcePosition, replacePlainCanvasText, type CanvasBlockSelection } from "@/lib/canvas-blocks";
import { preservePagloraMarkers } from "@/lib/markdown-markers";
import { PageInspector } from "@/components/editor/page-inspector";
import { WorkspaceSidebar, type WorkspaceView } from "@/components/studio/workspace-sidebar";
import { StudioQuickFind } from "@/components/studio/studio-quick-find";
import { commandForEvent, DEFAULT_SHORTCUTS, readStudioShortcuts, shortcutLabel, STUDIO_SHORTCUTS_KEY, validateBinding, type ShortcutBindings, type StudioCommand } from "@/lib/studio-shortcuts";
import { StudioSurfaceMenu } from "@/components/studio/studio-surface-menu";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Dashboard, Settings } from "@/components/studio/workspace-content";
import { StudioUpdateDialog, useStudioUpdater } from "@/components/studio/studio-updater";
import { StudioReleaseDialog, LAST_STUDIO_VERSION_KEY } from "@/components/studio/studio-release-dialog";
import { STUDIO_VERSION } from "@/lib/release-notes";
import { createProject, exportProjectBackup, importProjectBackup, isTauri, listProjects, loadProject, migrateProjectStorage, projectsDirectory, trashProject } from "@/lib/projects";
import { listPages, loadPage, createPage, renamePage, duplicatePage, deletePage, reorderPages, savePage, setPageVisibility, setPageLayout, setPageNavigationGroup, type Page, type PageDocument } from "@/lib/pages";

function friendlyError(error: unknown) { return error instanceof Error ? error.message : String(error); }

function CreateProjectDialog({ open, onOpenChange, onCreate, disabled }: {
  open: boolean; onOpenChange: (value: boolean) => void;
  onCreate: (name: string) => Promise<void>; disabled: boolean;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!open) { setName(""); setError(""); setBusy(false); } }, [open]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateProjectName(name);
    if (validation) { setError(validation); return; }
    if (disabled) { setError(t("studio.projects.desktopRequired")); return; }
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
          <DialogTitle>{t("studio.projects.createTitle")}</DialogTitle>
          <DialogDescription>{t("studio.projects.createDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-4">
          <div className="grid gap-2"><Label htmlFor="paglora-project-name">{t("studio.projects.projectName")}</Label><Input id="paglora-project-name" autoFocus placeholder={t("studio.projects.projectName")} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required /></div>
          {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">{error}</p>}
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("studio.projects.cancel")}</Button><Button type="submit" disabled={busy || disabled}>{busy ? <LoaderCircle className="animate-spin"/> : <Plus/>} {t("studio.projects.create")}</Button></DialogFooter>
          {disabled && <p className="text-xs text-amber-700">{t("studio.projects.browserOnly")}</p>}
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SinglePageEditor({ document, current, pages, onBack, onSaved, onChange, onModify, findOpen, onFindOpenChange, findShortcut }: { document: ProjectDocument; current: PageDocument; pages: Page[]; onBack: () => void; onSaved: (project: ProjectSummary) => void; onChange: (id: string) => Promise<void>; onModify: (action: PageAction, id?: string, target?: string) => Promise<void>; findOpen: boolean; onFindOpenChange: (open: boolean) => void; findShortcut: string }) {
  const { t } = useTranslation();
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
  const [selectedBlock, setSelectedBlock] = useState<CanvasBlockSelection | null>(null);
  const [pendingBlock, setPendingBlock] = useState<CanvasBlockSelection | null>(null);
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
      latest.current = preservePagloraMarkers(current.getMarkdown());
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
  useEffect(() => {
    if (viewMode !== "edit" || !pendingBlock || !editor) return;
    const position = pendingBlock.pageId === current.page.id
      ? findCanvasSourcePosition(editor, pendingBlock) : null;
    // Never edit an element based only on a potentially mismatched DOM index.
    // When a position is not confidently matched, safely open the page editor.
    if (position !== null) editor.commands.focus(position);
    else editor.commands.focus();
    setPendingBlock(null);
  }, [viewMode, pendingBlock, editor, current.page.id]);
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
  function editCanvasBlock(block: CanvasBlockSelection) {
    if (block.pageId !== current.page.id || leaving || switchingView) return;
    setSelectedBlock(block);
    setPendingBlock(block);
    setViewMode("edit");
  }

  async function back() { await runAfterSave(async () => onBack()); }
  const modify = (action: PageAction, id?: string, target?: string) => {
    void runAfterSave(() => onModify(action, id, target));
  };

  return (
    <main className="flex h-full min-w-0 flex-1 flex-col bg-background">
      <header className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-3 py-2 lg:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon-sm" aria-label={showPages ? t("studio.editor.hidePages") : t("studio.editor.showPages")} title={showPages ? t("studio.editor.hidePages") : t("studio.editor.showPages")} aria-pressed={showPages} onClick={() => setShowPages(value => !value)}>{showPages ? <PanelLeftClose /> : <PanelLeftOpen />}</Button>
          <Separator orientation="vertical" className="mx-1 h-5"/>
          <Button onClick={() => void back()} variant="ghost" size="icon-sm" disabled={leaving} aria-label={t("studio.editor.backToProjects")}><ArrowLeft /></Button>
          <span className="hidden size-8 items-center justify-center rounded-lg bg-primary/10 text-primary sm:flex"><BookOpen className="size-4"/></span>
          <div className="min-w-0"><div className="max-w-44 truncate text-sm font-semibold lg:max-w-64">{document.project.name}</div><div className="max-w-44 truncate text-xs text-muted-foreground lg:max-w-64">{current.page.title}</div></div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={saveState === "error" ? "destructive" : "secondary"} className="gap-1.5 whitespace-nowrap">
            {saveState === "saving" ? <LoaderCircle className="size-3 animate-spin"/> : saveState === "saved" ? <Check className="size-3 text-emerald-600"/> : <span className="size-2 rounded-full bg-amber-400" />}
            {saveState === "saving" ? t("studio.editor.saving") : saveState === "saved" ? t("studio.editor.savedLocally") : saveState === "error" ? t("studio.editor.saveFailed") : t("studio.editor.unsaved")}
          </Badge>
          <Separator orientation="vertical" className="mx-1 hidden h-5 sm:block"/>
          {viewMode === "edit" && <Button variant="ghost" size="icon-sm" aria-label={showBlockTools ? t("studio.editor.hideTools") : t("studio.editor.showTools")} title={showBlockTools ? t("studio.editor.hideTools") : t("studio.editor.showTools")} onClick={() => setShowBlockTools(value => !value)}>{showBlockTools ? <PanelRightClose /> : <PanelRightOpen />}</Button>}
          {viewMode === "site" && <Button variant="ghost" size="icon-sm" aria-label={showInspector ? t("studio.editor.hideProperties") : t("studio.editor.showProperties")} title={showInspector ? t("studio.editor.hideProperties") : t("studio.editor.showProperties")} aria-pressed={showInspector} onClick={() => setShowInspector(value => !value)}><SlidersHorizontal /></Button>}
          <div role="group" aria-label={t("studio.editor.editorView")} className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5">
            <Button type="button" size="sm" disabled={leaving || switchingView} variant={viewMode === "edit" ? "secondary" : "ghost"} aria-pressed={viewMode === "edit"} onClick={() => void selectView("edit")} className="gap-1.5 px-2.5"><PencilLine />{t("studio.editor.edit")}</Button>
            <Button type="button" size="sm" disabled={leaving || switchingView} variant={viewMode === "split" ? "secondary" : "ghost"} aria-pressed={viewMode === "split"} onClick={() => void selectView("split")} className="gap-1.5 px-2.5"><Columns2 />{t("studio.editor.split")}</Button>
            <Button type="button" size="sm" disabled={leaving || switchingView} variant={viewMode === "site" ? "secondary" : "ghost"} aria-pressed={viewMode === "site"} onClick={() => void selectView("site")} className="gap-1.5 px-2.5"><Monitor />{t("studio.editor.canvas")}</Button>
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
        <section className="min-h-0 min-w-0 flex-1 overflow-y-auto" aria-label={t("studio.editor.documentationEditor")}>
          <FormatToolbar editor={editor} />
          <div data-editor-drop-zone className="mx-auto min-h-[calc(100%-3rem)] max-w-3xl animate-in fade-in-0 px-6 py-9 duration-200 lg:px-10 lg:py-12">
            {saveError && <p role="alert" className="mb-6 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{t("studio.editor.saveError", { message: saveError })}</p>}
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
          selectedBlock={selectedBlock}
          onBlockSelect={(block) => { setSelectedBlock(block); if (block) setShowInspector(true); }}
          onBlockEdit={editCanvasBlock}
          canInlineTextEdit={(block) => Boolean(editor && block.pageId === current.page.id && editableCanvasText(editor, block))}
          onApplyInlineText={(block, text) => {
            if (!editor || block.pageId !== current.page.id || leaving || switchingView) return false;
            return replacePlainCanvasText(editor, block, text);
          }}
          onNavigate={(pageId) => {
            if (pageId !== current.page.id) void runAfterSave(() => onChange(pageId));
          }}
        />}
        {viewMode === "site" && showInspector && <PageInspector page={current.page} busy={leaving || switchingView}
          selectedBlock={selectedBlock}
          allowTextEdit={Boolean(editor && selectedBlock && selectedBlock.pageId === current.page.id && editableCanvasText(editor, selectedBlock))}
          onSaveText={(nextText) => {
            if (!selectedBlock || selectedBlock.pageId !== current.page.id || !editor || leaving || switchingView) return false;
            if (!replacePlainCanvasText(editor, selectedBlock, nextText)) return false;
            setSelectedBlock(null);
            return true;
          }}
          onEditBlock={() => { if (selectedBlock) editCanvasBlock(selectedBlock); }}
          onClearBlock={() => setSelectedBlock(null)}
          onChange={(action, id, value) => modify(action, id, value)}
          onEditContent={() => void selectView("edit")} />}
        {showBlockTools && viewMode === "edit" && <BlockPalette editor={editor} disabled={leaving} />}
      </div>
      <StudioQuickFind open={findOpen} onOpenChange={onFindOpenChange}
        shortcut={findShortcut} entries={pages.map(page => ({ id: page.id, title: page.title, description: page.navGroup, kind: "page" as const }))}
        onSelect={id => { if (id !== current.page.id) void runAfterSave(() => onChange(id)); }} />
    </main>
  );
}

function ProjectEditor(props: { document: ProjectDocument; onBack: () => void; onSaved: (project: ProjectSummary) => void; findOpen: boolean; onFindOpenChange: (open: boolean) => void; findShortcut: string }) {
  const { document } = props;
  const [pages, setPages] = useState<Page[]>([{id:"index",title:"Overview",isPublic:true,layout:"docs",navGroup:"Documentation"}]);
  const [current, setCurrent] = useState<PageDocument>({page:{id:"index",title:"Overview",isPublic:true,layout:"docs",navGroup:"Documentation"},markdown:document.markdown});
  const [failure, setFailure] = useState("");
  const id = document.project.id;
  useEffect(() => {
    let alive=true;
    void listPages(id).then(result => {
      if (!alive) return;
      setPages(result);
      // Hydrate the selected page's persisted title/layout/navigation metadata.
      // The initial Markdown comes from loadProject, but page metadata comes
      // from pages.json and must not remain a hard-coded placeholder.
      setCurrent(previous => {
        const loaded = result.find(page => page.id === previous.page.id);
        return loaded ? { ...previous, page: loaded } : previous;
      });
    }).catch(e => { if (alive) setFailure(friendlyError(e)); });
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
    else if(action==="group" && pageId && target){
      const updated = await setPageNavigationGroup(id,pageId,target);
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
      onBack={props.onBack} onSaved={props.onSaved} onChange={change} onModify={modify} findOpen={props.findOpen} onFindOpenChange={props.onFindOpenChange} findShortcut={props.findShortcut}/></>;
}

export default function App() {
  const desktop = isTauri();
  const updater = useStudioUpdater(desktop);
  const [releaseNotesOpen, setReleaseNotesOpen] = useState(false);
  const [view, setView] = useState<WorkspaceView>("home");
  const [search, setSearch] = useState("");
  const [findOpen, setFindOpen] = useState(false);
  const [shortcuts, setShortcuts] = useState<ShortcutBindings>(readStudioShortcuts);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [active, setActive] = useState<ProjectDocument | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(desktop);
  const [error, setError] = useState("");
  const [location, setLocation] = useState("");
  const [storageMigrating, setStorageMigrating] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [backupNotice, setBackupNotice] = useState("");
  const [backupPath, setBackupPath] = useState("");
  const { t } = useTranslation();

  // Only an actual installed version change opens the release dialog automatically.
  // Fresh installations record the first version without interrupting onboarding.
  useEffect(() => {
    if (!desktop || import.meta.env.DEV) return;
    try {
      const previous = localStorage.getItem(LAST_STUDIO_VERSION_KEY);
      if (previous && previous !== STUDIO_VERSION) setReleaseNotesOpen(true);
      else if (!previous) localStorage.setItem(LAST_STUDIO_VERSION_KEY, STUDIO_VERSION);
    } catch { /* Release notes remain manually accessible without localStorage. */ }
  }, [desktop]);

  const closeReleaseNotes = () => {
    try { localStorage.setItem(LAST_STUDIO_VERSION_KEY, STUDIO_VERSION); } catch {}
    setReleaseNotesOpen(false);
  };

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

  // Route customizable commands through one registry. Monaco keeps its
  // source find behavior; shortcut capture in Settings never triggers a command.
  useEffect(() => {
    function dispatchShortcut(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-studio-shortcut-recorder], [data-paglora-source-editor]')) return;
      const command = commandForEvent(event, shortcuts);
      if (!command) {
        if (desktop && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") event.preventDefault();
        return;
      }
      if (target instanceof Element && target.closest('[data-slot="dialog-content"], [data-slot="alert-dialog-content"]')) return;
      event.preventDefault();
      event.stopPropagation();
      switch (command) {
        case "find": setFindOpen(true); break;
        case "new-project": if (!active) setCreating(true); break;
        case "projects": if (!active) setView("projects"); break;
        case "settings": if (!active) setView("settings"); break;
      }
    }
    window.addEventListener("keydown", dispatchShortcut, { capture: true });
    return () => window.removeEventListener("keydown", dispatchShortcut, { capture: true });
  }, [shortcuts, active, desktop]);

  const persistShortcuts = (next: ShortcutBindings): boolean => {
    try {
      localStorage.setItem(STUDIO_SHORTCUTS_KEY, JSON.stringify({ version: 1, bindings: next }));
      setShortcuts(next);
      return true;
    } catch { return false; }
  };

  const assignShortcut = (command: StudioCommand, stroke: string): string | null => {
    const invalid = validateBinding(command, stroke, shortcuts);
    if (invalid) return invalid;
    if (!persistShortcuts({ ...shortcuts, [command]: stroke })) return "Could not save shortcut preferences on this computer.";
    toast.success("Shortcut updated", { description: "Changes take effect immediately." });
    return null;
  };

  const resetShortcuts = () => {
    if (persistShortcuts({ ...DEFAULT_SHORTCUTS })) toast.success("Shortcuts reset to defaults");
    else toast.error("Could not save shortcut preferences");
  };

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
    toast.success("Project created", { description: name.trim() });
  }
  async function open(id: string) {
    try { setError(""); setActive(await loadProject(id)); }
    catch (cause) { setError(friendlyError(cause)); }
  }
  async function exportBackup(id: string) {
    try {
      setError(""); setBackupNotice("");
      const path = await exportProjectBackup(id);
      setBackupPath(path);
      setBackupNotice(t("studio.backup.saved", { path }));
      toast.success("Project backup saved", { description: "A portable backup is ready in your local backups folder." });
    } catch (cause) { setError(friendlyError(cause)); }
  }
  async function importBackup(file: File) {
    if (!file.name.toLowerCase().endsWith(".paglora") || file.size > 96 * 1024 * 1024) {
      setError(t("studio.backup.invalid")); return;
    }
    try {
      setError(""); setBackupNotice(""); setBackupPath("");
      const archive = Array.from(new Uint8Array(await file.arrayBuffer()));
      const id = await importProjectBackup(archive);
      await refresh();
      setBackupNotice(t("studio.backup.imported", { id }));
      toast.success("Project imported", { description: "The project is now available in your workspace." });
    } catch (cause) { setError(friendlyError(cause)); }
  }
  async function removeProject(id: string) {
    try {
      setError("");
      const moved = await trashProject(id);
      setProjects(previous => previous.filter(project => project.id !== id));
      toast.success("Project moved to trash", {
        description: "Files are preserved in Paglora's local trash folder.",
        action: { label: "Copy path", onClick: () => {
          if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(moved);
        } },
      });
    } catch (cause) {
      const message = friendlyError(cause);
      setError(message);
      toast.error("Could not remove project", { description: message });
    }
  }
  async function moveStorage(destination: string) {
    if (storageMigrating || active) return;
    setStorageMigrating(true);
    setStorageError("");
    try {
      const next = await migrateProjectStorage(destination);
      setLocation(next);
      await refresh();
      toast.success("Projects copied to new location", {
        description: "Every source file was verified. Original files were preserved for recovery.",
      });
    } catch (cause) {
      const message = friendlyError(cause);
      setStorageError(message);
      toast.error("Project storage was not changed", { description: message });
      throw cause;
    } finally {
      setStorageMigrating(false);
    }
  }
  const onSaved = useCallback((updated: ProjectSummary) => {
    setProjects((previous) => previous.map((p) => p.id === updated.id ? updated : p));
  }, []);
  function navigate(next: WorkspaceView) { if (active || storageMigrating) return; setView(next); }

  return (
    <SidebarProvider className="h-svh min-h-0 overflow-hidden" defaultOpen>
      {!active && <WorkspaceSidebar view={view} onNavigate={navigate} editing={false}/>}
      <SidebarInset className="h-full min-w-0 overflow-hidden">
        {active ? <ProjectEditor key={active.project.id} document={active} onBack={() => { setActive(null); setFindOpen(false); void refresh(); }} onSaved={onSaved} findOpen={findOpen} onFindOpenChange={setFindOpen} findShortcut={shortcutLabel(shortcuts.find)}/> : view === "settings" ? <Settings desktop={desktop} location={location} updater={updater} onOpenReleaseNotes={() => setReleaseNotesOpen(true)} shortcuts={shortcuts} onAssignShortcut={assignShortcut} onResetShortcuts={resetShortcuts} onMigrateStorage={moveStorage} storageMigrating={storageMigrating} storageError={storageError}/> : <Dashboard projects={projects} view={view} loading={loading} error={error} desktop={desktop} search={search} setSearch={setSearch} openCreate={() => setCreating(true)} openProject={(id) => void open(id)} onExportBackup={(id) => void exportBackup(id)} onImportBackup={(file) => void importBackup(file)} onTrashProject={(id) => void removeProject(id)} backupNotice={backupNotice} backupPath={backupPath}/>}
      </SidebarInset>
      {!active && <StudioQuickFind open={findOpen} onOpenChange={setFindOpen} shortcut={shortcutLabel(shortcuts.find)}
        entries={projects.map(project => ({ id: project.id, title: project.name, description: "Local documentation project", kind: "project" as const }))}
        onSelect={id => { void open(id); }} />}
      <StudioSurfaceMenu editing={Boolean(active)} findShortcut={shortcutLabel(shortcuts.find)}
        onFind={() => setFindOpen(true)}
        onHome={() => navigate("home")}
        onSettings={() => navigate("settings")} />
      <Toaster position="top-center" richColors closeButton visibleToasts={3} duration={5000} />
      <CreateProjectDialog open={creating} onOpenChange={setCreating} onCreate={create} disabled={!desktop}/>
      <StudioUpdateDialog updater={updater}/>
      <StudioReleaseDialog open={releaseNotesOpen} onClose={closeReleaseNotes}/>
    </SidebarProvider>
  );
}
