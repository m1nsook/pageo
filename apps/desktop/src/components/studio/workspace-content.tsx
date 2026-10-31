import { useMemo, useRef, useState } from "react";
import type { ProjectSummary, ProjectVisual } from "@paglora/core";
import { Archive, ChevronRight, Clock3, Copy, ExternalLink, FolderOpen, LoaderCircle, Plus, Search, Settings2, ShieldCheck, Trash2 } from "lucide-react";
import { BookOpenIcon, SparkleIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { ProjectTrashPanel } from "@/components/studio/project-trash-panel";
import { StudioTooltip } from "@/components/studio/studio-tooltip";
import { DEFAULT_PROJECT_VISUAL, PROJECT_ACCENTS, ProjectAppearanceDialog, ProjectIcon } from "@/components/studio/project-appearance";
import type { TrashedProject } from "@/lib/projects";
import { backupTaskMessage, type BackupTask } from "@/lib/backup-task";
import { pickStorageFolder } from "@/lib/projects";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { StudioShortcutSettings } from "@/components/studio/studio-shortcut-settings";
import type { ShortcutBindings, StudioCommand } from "@/lib/studio-shortcuts";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import type { WorkspaceView } from "@/components/studio/workspace-sidebar";
import { ThemeSwitcher } from "@/components/studio/theme-switcher";
import { LANGUAGES, useTranslation } from "@/i18n";
import { STUDIO_VERSION } from "@/lib/release-notes";
import { openDocumentation } from "@/lib/external-links";
import { toast } from "sonner";
import type { StudioUpdaterControls } from "@/components/studio/studio-updater";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const formatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
const displayDate = (seconds: number) => formatter.format(new Date(seconds * 1000));

function WorkspaceHeader({ section }: { section: string }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-5 lg:px-8">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger aria-label="Toggle workspace sidebar" />
        <Separator orientation="vertical" className="mx-1 h-5" />
        <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <span>Workspace</span><ChevronRight className="size-3.5" /><span className="truncate font-medium text-foreground">{section}</span>
        </div>
      </div>
      <Badge variant="secondary" className="gap-1.5 whitespace-nowrap"><span className="size-1.5 rounded-full bg-emerald-500" /> Local</Badge>
    </header>
  );
}

function ProjectCard({ project, onOpen, onExportBackup, onTrash, onVisualSave, backupBusy, exporting }: { project: ProjectSummary; onOpen: () => void; onExportBackup: () => void; onTrash: () => void; onVisualSave: (visual: ProjectVisual) => Promise<void>; backupBusy: boolean; exporting: boolean }) {
  const { t } = useTranslation();
  const [confirmTrash, setConfirmTrash] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  return (
    <>
    <ContextMenu>
      <ContextMenuTrigger asChild>
    <Card className="group relative gap-0 py-0 transition-[background-color,border-color,box-shadow] duration-150 hover:bg-muted/50 hover:ring-primary/45">
      <button disabled={backupBusy} className="flex h-full min-h-48 flex-col rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait" onClick={onOpen}>
        <CardHeader className="w-full pt-5">
          <div className="flex items-center justify-between">
            <ProjectIcon visual={project.visual} />
            <span aria-hidden="true" className="size-5" />
          </div>
        </CardHeader>
        <CardContent className="w-full flex-1 py-3">
          <StudioTooltip label={project.name}><span className="block min-w-0"><CardTitle className="truncate">{project.name}</CardTitle></span></StudioTooltip>
          <CardDescription className="mt-1 truncate">{project.visual?.category || "Documentation project"}</CardDescription>
        </CardContent>
        <CardFooter className="w-full gap-2 border-t border-border/70 py-3 text-xs text-muted-foreground">
          <Clock3 className="size-3.5" /> Updated {displayDate(project.updatedAt)}
        </CardFooter>
      </button>
      <Button type="button" variant="ghost" size="icon-sm" className="absolute right-3 top-4 z-10" aria-label={`Customize ${project.name}`} disabled={backupBusy} onClick={() => setAppearanceOpen(true)}><Settings2 className="size-4" /></Button>
    </Card>
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-48">
        <ContextMenuItem disabled={backupBusy} onSelect={onOpen}><BookOpenIcon weight="bold" /> Open project</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem disabled={backupBusy} onSelect={onExportBackup}>{exporting ? <LoaderCircle className="size-4 animate-spin" /> : <Archive />} {exporting ? "Saving backup…" : t("studio.backup.export")}</ContextMenuItem>
        <ContextMenuItem onSelect={() => {
          if (navigator.clipboard?.writeText) {
            void navigator.clipboard.writeText(project.name).catch((error: unknown) => {
              console.warn("Could not copy project name", error);
            });
          }
        }}><Copy /> Copy project name</ContextMenuItem>
        <ContextMenuItem disabled={backupBusy} onSelect={() => setAppearanceOpen(true)}><Settings2 /> Customize project…</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" disabled={backupBusy} onSelect={() => setConfirmTrash(true)}><Trash2 /> Remove project…</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
    <ProjectAppearanceDialog project={project} open={appearanceOpen} onOpenChange={setAppearanceOpen} onSave={onVisualSave} />
    <AlertDialog open={confirmTrash} onOpenChange={setConfirmTrash}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove “{project.name}” from Paglora?</AlertDialogTitle>
          <AlertDialogDescription>
            The project and its pages will disappear from your workspace. All files are moved
            into Paglora’s local trash folder for manual recovery, not permanently deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep project</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={backupBusy} onClick={onTrash}>Move to trash</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

export function Dashboard({ projects, trashItems, restoringTrashId, onRestoreProject, onDeleteTrashedProject, onUpdateVisual, openCreate, openProject, onExportBackup, onImportBackup, onTrashProject, backupNotice, backupPath, backupTask, view, loading, search, setSearch, desktop, error }: {
  projects: ProjectSummary[]; trashItems: TrashedProject[]; restoringTrashId: string | null; onRestoreProject: (trashId: string) => void; onDeleteTrashedProject: (trashId: string, confirmation: string) => void; onUpdateVisual: (id: string, visual: ProjectVisual) => Promise<void>; openCreate: () => void; openProject: (id: string) => void;
  onExportBackup: (id: string) => void; onImportBackup: (file: File) => void; onTrashProject: (id: string) => void; backupNotice: string; backupPath: string; backupTask: BackupTask | null;
  view: WorkspaceView; loading: boolean; search: string; setSearch: (value: string) => void; desktop: boolean; error: string;
}) {
  const { t } = useTranslation();
  const backupInput = useRef<HTMLInputElement>(null);
  const visible = useMemo(() => projects.filter(p =>
    (p.name + " " + (p.visual?.category || "")).toLowerCase().includes(search.trim().toLowerCase())), [projects, search]);
  const groups = useMemo(() => {
    const byName = new Map<string, ProjectSummary[]>();
    for (const project of visible) {
      const category = project.visual?.category?.trim() || "Uncategorized";
      const key = [...byName.keys()].find(value => value.toLocaleLowerCase() === category.toLocaleLowerCase()) ?? category;
      const group = byName.get(key) ?? [];
      group.push(project);
      byName.set(key, group);
    }
    return [...byName.entries()].sort(([a], [b]) => {
      if (a === "Uncategorized") return 1;
      if (b === "Uncategorized") return -1;
      return a.localeCompare(b);
    });
  }, [visible]);
  const heading = view === "home" ? "Your projects" : "All projects";
  return (
    <main className="flex h-full min-w-0 flex-col overflow-hidden">
      <WorkspaceHeader section={view === "home" ? "Home" : "Projects"} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl animate-in fade-in-0 px-5 py-8 duration-200 lg:px-10 lg:py-10">
          {view === "home" && (
            <Card className="relative mb-9 overflow-hidden border-0 bg-gradient-to-br from-card via-card to-muted/50 py-0 ring-1 ring-border">
              <CardContent className="relative min-h-56 px-7 py-8 sm:px-9">
                <div className="relative z-10 max-w-xl">
                  <Badge variant="outline" className="mb-5 gap-1.5 bg-background/80"><SparkleIcon weight="fill" className="size-3.5" /> Your documentation studio</Badge>
                  <h1 className="font-display max-w-lg text-3xl font-extrabold leading-tight tracking-tight text-foreground sm:text-4xl">Create documentation you'll be proud to share.</h1>
                  <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">Write, organize, and design documentation locally. Your files always belong to you.</p>
                  <Button className="mt-6" onClick={openCreate} disabled={backupTask !== null}><Plus /> New project</Button>
                </div>
                <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-primary/7 via-transparent to-transparent" />
              </CardContent>
            </Card>
          )}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><h2 className="font-display text-xl font-extrabold tracking-tight">{heading}</h2><p className="mt-1 text-sm text-muted-foreground">Continue working or start something new.</p></div>
            <div className="flex items-center gap-2">
              <input ref={backupInput} type="file" accept=".paglora" className="hidden" aria-label={t("studio.backup.import")}
                onChange={event => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  if (file && !backupTask) onImportBackup(file);
                }} />
              <Button variant="outline" onClick={() => backupInput.current?.click()} disabled={!desktop || backupTask !== null}>
                {backupTask?.kind === "import" ? <LoaderCircle className="size-4 animate-spin" /> : <Archive />} {t("studio.backup.import")}
              </Button>
              <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" />
                <Input aria-label="Search projects" className="w-52 pl-9" placeholder="Search projects" value={search} onChange={e => setSearch(e.target.value)} /></div>
              {view === "projects" && <Button onClick={openCreate} disabled={backupTask !== null}><Plus /> New project</Button>}
            </div>
          </div>
          {!desktop && <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Browser preview only. Run <code>bun run desktop</code> to access local projects.</div>}
          {error && <p role="alert" className="mt-6 rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          {backupTask && <div role="status" aria-live="polite" className="mt-6 flex items-center gap-3 rounded-lg border border-primary/25 bg-primary/5 p-3 text-sm text-foreground">
            <LoaderCircle aria-hidden="true" className="size-4 shrink-0 animate-spin text-primary" />
            <span>{backupTaskMessage(backupTask)}</span>
          </div>}
          {backupNotice && <div role="status" className="mt-6 flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm">
            <span className="min-w-0 break-all">{backupNotice}</span>
            {backupPath && <Button variant="outline" size="sm" aria-label={t("studio.backup.copyPath")}
              onClick={() => { if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(backupPath); }}><Copy /></Button>}
          </div>}
          {loading ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading projects">
              {[0, 1, 2].map(n => <Card key={n} className="min-h-48"><CardHeader><Skeleton className="size-10" /></CardHeader><CardContent className="space-y-2"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-3 w-1/2" /></CardContent></Card>)}
            </div>
          ) : visible.length > 0 ? (
            <div className="mt-6 space-y-7">
              {groups.map(([groupName, items]) => {
                const accent = PROJECT_ACCENTS[items[0]?.visual?.accent ?? DEFAULT_PROJECT_VISUAL.accent] ?? PROJECT_ACCENTS.blue;
                return (
                  <section key={groupName} aria-label={groupName}>
                    <div className="mb-3 flex items-center gap-2">
                      <span aria-hidden="true" className={`size-2.5 rounded-full ${accent.dot}`} />
                      <h3 className="text-sm font-semibold">{groupName}</h3>
                      <Badge variant="secondary">{items.length}</Badge>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {items.map(p => <ProjectCard key={p.id} project={p} onOpen={() => openProject(p.id)}
                        onExportBackup={() => onExportBackup(p.id)} onTrash={() => onTrashProject(p.id)}
                        onVisualSave={visual => onUpdateVisual(p.id, visual)} backupBusy={backupTask !== null}
                        exporting={backupTask?.kind === "export" && backupTask.label === p.name} />)}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <Empty className="mt-6 min-h-64 border border-dashed border-border bg-card">
              <EmptyHeader>
                <EmptyMedia variant="icon"><FolderOpen /></EmptyMedia>
                <EmptyTitle>{search ? "No matching projects" : "Your workspace is ready"}</EmptyTitle>
                <EmptyDescription>{search ? `Nothing matches “${search}”. Try another search.` : "Create your first project to start writing and organizing documentation."}</EmptyDescription>
              </EmptyHeader>
              {!search && <EmptyContent><Button onClick={openCreate} disabled={backupTask !== null}><Plus /> Create project</Button></EmptyContent>}
            </Empty>
          )}
          {desktop && <ProjectTrashPanel items={trashItems} busy={restoringTrashId} onRestore={onRestoreProject} onDelete={onDeleteTrashedProject} />}
          <p className="mt-6 text-xs text-muted-foreground">{t("studio.backup.description")}</p>
          <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4" /> Paglora works without a cloud account.</div>
        </div>
      </div>
    </main>
  );
}

export function Settings({ location, desktop, storageStatus, onCheckStorage, onReconnectStorage, onReturnStorage, updater, onOpenReleaseNotes, shortcuts, onAssignShortcut, onResetShortcuts, onMigrateStorage, storageMigrating, storageError }: { location: string; desktop: boolean; storageStatus: import("@/lib/projects").ProjectStorageStatus | null; onCheckStorage: () => void; onReconnectStorage: (destination: string, confirmation: string) => Promise<void>; onReturnStorage: (confirmation: string) => Promise<void>; updater: StudioUpdaterControls; onOpenReleaseNotes: () => void; shortcuts: ShortcutBindings; onAssignShortcut: (command: StudioCommand, stroke: string) => string | null; onResetShortcuts: () => void; onMigrateStorage: (destination: string) => Promise<void>; storageMigrating: boolean; storageError: string }) {
  const { locale, setLocale, t } = useTranslation();
  const [storageDestination, setStorageDestination] = useState("");
  const [recoverPath, setRecoverPath] = useState("");
  const [recoverConfirmation, setRecoverConfirmation] = useState("");
  const [folderPicking, setFolderPicking] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnConfirmation, setReturnConfirmation] = useState("");
  async function browseFolder(mode: "new" | "existing") {
    if (!desktop || storageMigrating || folderPicking) return;
    setFolderPicking(true);
    try {
      const selected = await pickStorageFolder();
      if (selected === null) return;
      if (mode === "new") {
        const parent = selected.replace(/[\\/]+$/, "");
        setStorageDestination(`${parent}${selected.includes("\\") ? "\\" : "/"}Paglora Projects`);
      } else setRecoverPath(selected);
    } catch (error) {
      toast.error(t("studio.storage.pickerError"), { description: String(error) });
    } finally { setFolderPicking(false); }
  }
  return (
    <main className="flex h-full min-w-0 flex-col overflow-hidden">
      <WorkspaceHeader section={t("studio.nav.settings")} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl animate-in fade-in-0 space-y-4 px-5 py-6 duration-200 lg:px-10">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><h1 className="font-display text-2xl font-extrabold tracking-tight">{t("studio.settings.title")}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{t("studio.settings.description")}</p></div>
            <Badge variant="outline" className="shrink-0 font-mono">v{STUDIO_VERSION}</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="gap-3">
              <CardHeader><CardTitle>{t("studio.settings.appearance")}</CardTitle><CardDescription>{t("studio.settings.appearanceDescription")}</CardDescription></CardHeader>
              <CardContent><ThemeSwitcher showLabel /></CardContent>
            </Card>
            <Card className="gap-3">
              <CardHeader><CardTitle>{t("studio.settings.language")}</CardTitle><CardDescription>{t("studio.settings.languageDescription")}</CardDescription></CardHeader>
              <CardContent className="space-y-2">
                <Select value={locale} onValueChange={setLocale}>
                  <SelectTrigger className="w-full max-w-xs" aria-label={t("studio.settings.language")}><SelectValue /></SelectTrigger>
                  <SelectContent>{LANGUAGES.map(item => (
                    <SelectItem key={item.locale} value={item.locale}>{item.nativeName} ({item.englishName})</SelectItem>
                  ))}</SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t("studio.settings.languagePartial")}</p>
              </CardContent>
            </Card>
            <Card className="gap-3 md:col-span-2">
              <CardHeader><CardTitle className="flex items-center gap-2"><FolderOpen className="size-4" /> {t("studio.settings.localStorage")}</CardTitle>
                <CardDescription>{t("studio.settings.storageDescription")}</CardDescription></CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-2">
                  <code className="min-w-0 flex-1 break-all px-1 font-mono text-xs">{desktop ? storageStatus?.configuredPath || location || t("studio.settings.storagePending") : t("studio.settings.desktopOnly")}</code>
                  <Button variant="outline" size="sm" disabled={!desktop || !location}
                    onClick={() => {
                      if (!navigator.clipboard?.writeText) return;
                      void navigator.clipboard.writeText(location).catch(error => console.warn("Could not copy local storage path", error));
                    }}><Copy className="size-3.5" /> {t("studio.storage.copyPath")}</Button>
                </div>
                {desktop && storageStatus?.isCustom && !storageStatus.available && (
                  <div role="alert" className="space-y-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-sm font-semibold text-destructive">{t("studio.storage.offline")}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {storageStatus.error || t("studio.storage.offlineReason")} {t("studio.storage.offlineHelp")}
                    </p>
                    <Button type="button" size="sm" variant="outline" disabled={storageMigrating} onClick={onCheckStorage}>{t("studio.storage.retry")}</Button>
                    <form className="grid gap-2" onSubmit={event => {
                      event.preventDefault();
                      if (recoverConfirmation !== "RECONNECT" || !recoverPath.trim() || storageMigrating) return;
                      void onReconnectStorage(recoverPath.trim(), recoverConfirmation).then(() => {setRecoverPath("");setRecoverConfirmation("");}).catch(() => undefined);
                    }}>
                      <Label htmlFor="storage-reconnect-folder">{t("studio.storage.existing")}</Label>
                      <div className="flex flex-wrap gap-2"><Input id="storage-reconnect-folder" className="min-w-44 flex-1" value={recoverPath} onChange={e => setRecoverPath(e.target.value)}
                        placeholder="E:\\Paglora Projects" autoComplete="off" disabled={storageMigrating || folderPicking} />
                        <Button type="button" size="sm" variant="outline" disabled={storageMigrating || folderPicking} onClick={() => void browseFolder("existing")}>{t("studio.storage.browse")}</Button></div>
                      <Label htmlFor="storage-reconnect-confirm">{t("studio.storage.confirm")}</Label>
                      <Input id="storage-reconnect-confirm" value={recoverConfirmation} onChange={e => setRecoverConfirmation(e.target.value)}
                        autoComplete="off" disabled={storageMigrating} />
                      <Button type="submit" size="sm" disabled={storageMigrating || !recoverPath.trim() || recoverConfirmation !== "RECONNECT"}>
                        {storageMigrating ? <LoaderCircle className="size-4 animate-spin" /> : <FolderOpen className="size-4" />} {t("studio.storage.reconnect")}
                      </Button>
                    </form>
                    <p className="text-xs text-muted-foreground">{t("studio.storage.recoveryHelp")}</p>
                  </div>
                )}
                {(!storageStatus?.isCustom || storageStatus.available) && <form className="flex flex-wrap items-end gap-2 pt-1" onSubmit={event => {
                  event.preventDefault();
                  if (!storageDestination.trim() || storageMigrating) return;
                  void onMigrateStorage(storageDestination.trim()).then(() => setStorageDestination("")).catch(() => undefined);
                }}>
                  <div className="min-w-0 flex-1 space-y-1">
                    <Label htmlFor="storage-new-folder">{t("studio.storage.new")}</Label>
                    <div className="flex flex-wrap gap-2"><Input id="storage-new-folder" className="min-w-44 flex-1" placeholder="D:\\Paglora Projects" value={storageDestination}
                      onChange={event => setStorageDestination(event.target.value)}
                      disabled={!desktop || storageMigrating || folderPicking} autoComplete="off" />
                      <Button type="button" size="sm" variant="outline" disabled={!desktop || storageMigrating || folderPicking} onClick={() => void browseFolder("new")}>{t("studio.storage.browseParent")}</Button></div>
                  </div>
                  <Button variant="outline" type="submit" disabled={!desktop || storageMigrating || !storageDestination.trim()}>
                    {storageMigrating ? <LoaderCircle className="size-4 animate-spin" /> : <FolderOpen className="size-4" />}
                    {storageMigrating ? t("studio.storage.copying") : t("studio.storage.move")}
                  </Button>
                </form>}
                {desktop && storageStatus?.available && storageStatus.previousLocation && (
                  <>
                    <Button type="button" variant="ghost" size="sm" className="w-fit" disabled={storageMigrating}
                      onClick={() => { setReturnConfirmation(""); setReturnOpen(true); }}>
                      {t("studio.storage.returnButton")}
                    </Button>
                    <AlertDialog open={returnOpen} onOpenChange={open => { setReturnOpen(open); if (!open) setReturnConfirmation(""); }}>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("studio.storage.returnTitle")}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("studio.storage.returnDescription", { path: storageStatus.previousLocation })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <Label htmlFor="storage-return-confirm">{t("studio.storage.returnConfirm")}</Label>
                        <Input id="storage-return-confirm" value={returnConfirmation} autoComplete="off" spellCheck={false}
                          onChange={event => setReturnConfirmation(event.target.value)} />
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("studio.shortcuts.cancel")}</AlertDialogCancel>
                          <AlertDialogAction disabled={storageMigrating || returnConfirmation !== "RETURN"}
                            onClick={() => { void onReturnStorage(returnConfirmation).catch(() => undefined); }}>
                            {t("studio.storage.returnButton")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
                {storageError && <p role="alert" className="text-xs text-destructive">{storageError}</p>}
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("studio.storage.migrationHelp")}
                </p>
              </CardContent>
            </Card>
            <Card className="gap-0 md:col-span-2">
              <Accordion type="single" collapsible defaultValue="shortcuts">
                <AccordionItem value="shortcuts" className="border-0">
                  <CardHeader>
                    <AccordionTrigger className="w-full py-0 hover:no-underline">
                      <span className="text-left"><CardTitle>{t("studio.shortcuts.title")}</CardTitle>
                        <CardDescription className="mt-1">{t("studio.shortcuts.description")}</CardDescription></span>
                    </AccordionTrigger>
                  </CardHeader>
                  <AccordionContent className="px-4 pb-3">
                    <StudioShortcutSettings bindings={shortcuts} onAssign={onAssignShortcut} onReset={onResetShortcuts} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>
            <Card className="gap-3">
              <CardHeader><CardTitle>{t("studio.updater.stableTitle")}</CardTitle><CardDescription>{t("studio.updater.stableDescription")}</CardDescription></CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" disabled={!desktop || updater.checking || updater.installing} onClick={() => void updater.check(true)}>
                  {updater.checking ? t("studio.updater.checking") : t("studio.updater.check")}
                </Button>
                {updater.message && <p role="status" className="text-xs text-muted-foreground">{updater.message}</p>}
              </CardContent>
            </Card>
            <Card className="gap-3">
              <CardHeader><CardTitle>{t("studio.settings.about")}</CardTitle>
                <CardDescription>Paglora Studio v{STUDIO_VERSION} · local-first documentation builder</CardDescription></CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={onOpenReleaseNotes}>{t("studio.release.open")}</Button>
                <Button variant="outline" size="sm" onClick={() => void openDocumentation().catch(error => toast.error("Could not open documentation", { description: String(error) }))}>
                    <ExternalLink className="size-3.5" /> Documentation
                  </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
