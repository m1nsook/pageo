import { useMemo, useRef, useState } from "react";
import type { ProjectSummary, ProjectVisual } from "@paglora/core";
import { Archive, ArrowUpRight, ChevronRight, Clock3, Copy, ExternalLink, FolderOpen, LoaderCircle, Plus, Search, Settings2, ShieldCheck, Trash2 } from "lucide-react";
import { BookOpenIcon, SparkleIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { ProjectTrashPanel } from "@/components/studio/project-trash-panel";
import { StudioTooltip } from "@/components/studio/studio-tooltip";
import { DEFAULT_PROJECT_VISUAL, PROJECT_ACCENTS, ProjectAppearanceDialog, ProjectIcon } from "@/components/studio/project-appearance";
import type { TrashedProject } from "@/lib/projects";
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

function ProjectCard({ project, onOpen, onExportBackup, onTrash, onVisualSave }: { project: ProjectSummary; onOpen: () => void; onExportBackup: () => void; onTrash: () => void; onVisualSave: (visual: ProjectVisual) => Promise<void> }) {
  const { t } = useTranslation();
  const [confirmTrash, setConfirmTrash] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  return (
    <>
    <ContextMenu>
      <ContextMenuTrigger asChild>
    <Card className="studio-library-card group relative gap-0 overflow-hidden border-border bg-card py-0 shadow-none transition-[border-color,background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-lg hover:shadow-black/10">
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-[3px] opacity-80 ${(PROJECT_ACCENTS[project.visual?.accent ?? "blue"] ?? PROJECT_ACCENTS.blue).dot}`} />
      <button className="flex h-full min-h-44 w-full flex-col rounded-md py-1 pl-2 pr-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={onOpen}>
        <CardHeader className="w-full pb-0 pt-5">
          <div className="flex items-center justify-between">
            <ProjectIcon visual={project.visual} className="size-11 ring-0" />
            <ArrowUpRight aria-hidden="true" className="mr-1 size-4 text-muted-foreground/40 transition-colors group-hover:text-primary" />
          </div>
        </CardHeader>
        <CardContent className="w-full flex-1 py-4">
          <StudioTooltip label={project.name}><span className="block min-w-0"><CardTitle className="truncate font-display text-[16px] font-extrabold tracking-tight">{project.name}</CardTitle></span></StudioTooltip>
          <CardDescription className="mt-1 truncate text-xs">{project.visual?.category || "Documentation project"}</CardDescription>
        </CardContent>
        <CardFooter className="w-full gap-2 border-t border-border/70 py-3 text-[11px] text-muted-foreground">
          <Clock3 className="size-3.5" /> {displayDate(project.updatedAt)}
          <span className="ml-auto inline-flex items-center font-bold text-foreground/65 transition-colors group-hover:text-primary">OPEN <ChevronRight className="ml-0.5 size-3.5" /></span>
        </CardFooter>
      </button>
      <Button type="button" variant="ghost" size="icon-sm" className="absolute right-11 top-5 z-10 opacity-65 transition-opacity hover:opacity-100 focus-visible:opacity-100" aria-label={`Customize ${project.name}`} onClick={() => setAppearanceOpen(true)}><Settings2 className="size-4" /></Button>
    </Card>
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-48">
        <ContextMenuItem onSelect={onOpen}><BookOpenIcon weight="bold" /> Open project</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onExportBackup}><Archive /> {t("studio.backup.export")}</ContextMenuItem>
        <ContextMenuItem onSelect={() => {
          if (navigator.clipboard?.writeText) {
            void navigator.clipboard.writeText(project.name).catch((error: unknown) => {
              console.warn("Could not copy project name", error);
            });
          }
        }}><Copy /> Copy project name</ContextMenuItem>
        <ContextMenuItem onSelect={() => setAppearanceOpen(true)}><Settings2 /> Customize project…</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onSelect={() => setConfirmTrash(true)}><Trash2 /> Remove project…</ContextMenuItem>
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
          <AlertDialogAction variant="destructive" onClick={onTrash}>Move to trash</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

export function Dashboard({ projects, trashItems, restoringTrashId, onRestoreProject, onUpdateVisual, openCreate, openProject, onExportBackup, onImportBackup, onTrashProject, backupNotice, backupPath, view, loading, search, setSearch, desktop, error }: {
  projects: ProjectSummary[]; trashItems: TrashedProject[]; restoringTrashId: string | null; onRestoreProject: (trashId: string) => void; onUpdateVisual: (id: string, visual: ProjectVisual) => Promise<void>; openCreate: () => void; openProject: (id: string) => void;
  onExportBackup: (id: string) => void; onImportBackup: (file: File) => void; onTrashProject: (id: string) => void; backupNotice: string; backupPath: string;
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
  const heading = view === "home" ? "Your library" : "All projects";
  const latestProject = useMemo(() => [...projects].sort((a, b) => b.updatedAt - a.updatedAt)[0], [projects]);
  return (
    <main className="flex h-full min-w-0 flex-col overflow-hidden">
      <WorkspaceHeader section={view === "home" ? "Home" : "Projects"} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl animate-in fade-in-0 px-5 py-8 duration-200 lg:px-10 lg:py-10">
          {view === "home" && (
            <div className="studio-home-overview mb-9 grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(260px,1fr)]">
              <section className="studio-home-feature relative flex min-h-64 flex-col overflow-hidden rounded-lg border border-border px-7 py-7 sm:px-9 sm:py-8" aria-label="Workspace overview">
                <span aria-hidden="true" className="pointer-events-none absolute -right-20 -top-32 size-80 rounded-full border border-primary/15" />
                <span aria-hidden="true" className="pointer-events-none absolute -right-12 -top-24 size-64 rounded-full border border-primary/15" />
                <div className="relative z-10">
                  <p className="mb-5 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.18em] text-primary"><span className="size-1.5 bg-primary" /> PAGLORA / WORKSPACE</p>
                  <h1 className="font-display max-w-xl text-3xl font-extrabold leading-[1.08] tracking-[-.055em] text-foreground sm:text-[38px]">Your documentation.<br /><span className="text-primary">Your workspace.</span></h1>
                  <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">Create, design, and publish from one local Studio. Pick up a project or start something new.</p>
                  <div className="mt-6 flex flex-wrap gap-2.5">
                    <Button onClick={openCreate} className="gap-2 px-4"><Plus className="size-4" /> New project</Button>
                    <Button variant="outline" disabled={!desktop} onClick={() => backupInput.current?.click()} className="gap-2 border-border bg-card/70"><Archive className="size-4" /> Import backup</Button>
                  </div>
                </div>
                <div className="relative z-10 mt-auto flex items-center gap-2 pt-7 text-[10px] font-bold uppercase tracking-[.13em] text-muted-foreground"><ShieldCheck className="size-3.5 text-emerald-500" /> LOCAL FIRST <span className="mx-1 text-border">/</span> PRIVATE BY DESIGN</div>
              </section>
              <section className="studio-home-recent flex min-h-64 flex-col rounded-lg border border-border bg-card p-6" aria-label="Continue working">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-muted-foreground">Continue working</p>
                  <Badge variant="outline" className="font-mono text-[10px] tabular-nums">{projects.length} PROJECTS</Badge>
                </div>
                {latestProject ? (
                  <>
                    <div className="mt-7 flex items-center gap-3">
                      <ProjectIcon visual={latestProject.visual} className="size-12" />
                      <div className="min-w-0"><p className="font-display truncate text-xl font-extrabold tracking-tight">{latestProject.name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{latestProject.visual?.category || "Documentation project"}</p></div>
                    </div>
                    <div className="mt-5 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground"><Clock3 className="size-3.5" /> Updated {displayDate(latestProject.updatedAt)}</div>
                    <Button variant="secondary" className="mt-auto w-full justify-between px-4 font-bold" onClick={() => openProject(latestProject.id)}>Open project <ArrowUpRight className="size-4" /></Button>
                  </>
                ) : (
                  <>
                    <div className="mt-8 flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary"><FolderOpen className="size-6" /></div>
                    <p className="mt-4 font-display text-lg font-extrabold">Ready when you are.</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Your next documentation project will appear here for quick access.</p>
                    <Button variant="secondary" className="mt-auto w-full justify-between" onClick={openCreate}>Create first project <ArrowUpRight className="size-4" /></Button>
                  </>
                )}
              </section>
            </div>
          )}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><div className="flex items-center gap-2"><h2 className="font-display text-xl font-extrabold tracking-tight">{heading}</h2><Badge variant="secondary" className="font-mono tabular-nums">{visible.length}</Badge></div><p className="mt-1 text-sm text-muted-foreground">Browse and organize documentation on this computer.</p></div>
            <div className="flex items-center gap-2">
              <input ref={backupInput} type="file" accept=".paglora" className="hidden" aria-label={t("studio.backup.import")}
                onChange={event => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  if (file) onImportBackup(file);
                }} />
              <Button variant="outline" onClick={() => backupInput.current?.click()} disabled={!desktop}>
                <Archive /> {t("studio.backup.import")}
              </Button>
              <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" />
                <Input aria-label="Search projects" className="w-52 pl-9" placeholder="Search projects" value={search} onChange={e => setSearch(e.target.value)} /></div>
              {view === "projects" && <Button onClick={openCreate}><Plus /> New project</Button>}
            </div>
          </div>
          {!desktop && <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Browser preview only. Run <code>bun run desktop</code> to access local projects.</div>}
          {error && <p role="alert" className="mt-6 rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          {backupNotice && <div role="status" className="mt-6 flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm">
            <span className="min-w-0 break-all">{backupNotice}</span>
            {backupPath && <Button variant="outline" size="sm" aria-label={t("studio.backup.copyPath")}
              onClick={() => { if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(backupPath); }}><Copy /></Button>}
          </div>}
          {loading ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 2xl:grid-cols-3" aria-label="Loading projects">
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
                    <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                      {items.map(p => <ProjectCard key={p.id} project={p} onOpen={() => openProject(p.id)}
                        onExportBackup={() => onExportBackup(p.id)} onTrash={() => onTrashProject(p.id)}
                        onVisualSave={visual => onUpdateVisual(p.id, visual)} />)}
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
              {!search && <EmptyContent><Button onClick={openCreate}><Plus /> Create project</Button></EmptyContent>}
            </Empty>
          )}
          {desktop && <ProjectTrashPanel items={trashItems} busy={restoringTrashId} onRestore={onRestoreProject} />}
          <p className="mt-6 text-xs text-muted-foreground">{t("studio.backup.description")}</p>
          <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4" /> Paglora works without a cloud account.</div>
        </div>
      </div>
    </main>
  );
}

export function Settings({ location, desktop, updater, onOpenReleaseNotes, shortcuts, onAssignShortcut, onResetShortcuts, onMigrateStorage, storageMigrating, storageError }: { location: string; desktop: boolean; updater: StudioUpdaterControls; onOpenReleaseNotes: () => void; shortcuts: ShortcutBindings; onAssignShortcut: (command: StudioCommand, stroke: string) => string | null; onResetShortcuts: () => void; onMigrateStorage: (destination: string) => Promise<void>; storageMigrating: boolean; storageError: string }) {
  const { locale, setLocale, t } = useTranslation();
  const [storageDestination, setStorageDestination] = useState("");
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
                  <code className="min-w-0 flex-1 break-all px-1 font-mono text-xs">{desktop ? location || t("studio.settings.storagePending") : t("studio.settings.desktopOnly")}</code>
                  <Button variant="outline" size="sm" disabled={!desktop || !location}
                    onClick={() => {
                      if (!navigator.clipboard?.writeText) return;
                      void navigator.clipboard.writeText(location).catch(error => console.warn("Could not copy local storage path", error));
                    }}><Copy className="size-3.5" /> Copy path</Button>
                </div>
                <form className="flex flex-wrap items-end gap-2 pt-1" onSubmit={event => {
                  event.preventDefault();
                  if (!storageDestination.trim() || storageMigrating) return;
                  void onMigrateStorage(storageDestination.trim()).then(() => setStorageDestination("")).catch(() => undefined);
                }}>
                  <div className="min-w-0 flex-1 space-y-1">
                    <Label htmlFor="storage-new-folder">Move projects to a new folder</Label>
                    <Input id="storage-new-folder" placeholder="D:\\Paglora Projects" value={storageDestination}
                      onChange={event => setStorageDestination(event.target.value)}
                      disabled={!desktop || storageMigrating} autoComplete="off" />
                  </div>
                  <Button variant="outline" type="submit" disabled={!desktop || storageMigrating || !storageDestination.trim()}>
                    {storageMigrating ? <LoaderCircle className="size-4 animate-spin" /> : <FolderOpen className="size-4" />}
                    {storageMigrating ? "Copying and verifying…" : "Move projects"}
                  </Button>
                </form>
                {storageError && <p role="alert" className="text-xs text-destructive">{storageError}</p>}
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Enter an absolute path for a <strong>new folder that does not exist yet</strong> (its parent must exist).
                  Paglora copies and verifies every file before changing its active location. Originals remain in the previous
                  folder as a recovery copy; backups remain in Paglora app data.
                </p>
              </CardContent>
            </Card>
            <Card className="gap-0 md:col-span-2">
              <Accordion type="single" collapsible defaultValue="shortcuts">
                <AccordionItem value="shortcuts" className="border-0">
                  <CardHeader>
                    <AccordionTrigger className="w-full py-0 hover:no-underline">
                      <span className="text-left"><CardTitle>Keyboard shortcuts</CardTitle>
                        <CardDescription className="mt-1">Customize Studio commands. Conflicts and reserved keys are checked automatically.</CardDescription></span>
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
                <Button variant="outline" size="sm" asChild>
                  <a href="https://m1nsook.github.io/paglora-docs/" target="_blank" rel="noopener noreferrer"><ExternalLink className="size-3.5" /> Documentation</a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
