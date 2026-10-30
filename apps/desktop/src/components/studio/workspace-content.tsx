import { useMemo } from "react";
import type { ProjectSummary } from "@paglora/core";
import { ArrowRight, BookOpen, ChevronRight, Clock3, Copy, FolderOpen, Plus, Search, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import type { WorkspaceView } from "@/components/studio/workspace-sidebar";

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

function ProjectCard({ project, onOpen }: { project: ProjectSummary; onOpen: () => void }) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
    <Card className="group gap-0 py-0 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-lg">
      <button className="flex h-full min-h-48 flex-col rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={onOpen}>
        <CardHeader className="w-full pt-5">
          <div className="flex items-center justify-between">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><BookOpen className="size-5" /></span>
            <ArrowRight className="size-4 text-muted-foreground transition-transform duration-150 group-hover:translate-x-1" />
          </div>
        </CardHeader>
        <CardContent className="w-full flex-1 py-3">
          <CardTitle className="truncate" title={project.name}>{project.name}</CardTitle>
          <CardDescription className="mt-1">Documentation project</CardDescription>
        </CardContent>
        <CardFooter className="w-full gap-2 border-t border-border/70 py-3 text-xs text-muted-foreground">
          <Clock3 className="size-3.5" /> Updated {displayDate(project.updatedAt)}
        </CardFooter>
      </button>
    </Card>
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-48">
        <ContextMenuItem onSelect={onOpen}><BookOpen /> Open project</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => {
          if (navigator.clipboard?.writeText) {
            void navigator.clipboard.writeText(project.name).catch((error: unknown) => {
              console.warn("Could not copy project name", error);
            });
          }
        }}><Copy /> Copy project name</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function Dashboard({ projects, openCreate, openProject, view, loading, search, setSearch, desktop, error }: {
  projects: ProjectSummary[]; openCreate: () => void; openProject: (id: string) => void;
  view: WorkspaceView; loading: boolean; search: string; setSearch: (value: string) => void; desktop: boolean; error: string;
}) {
  const visible = useMemo(() => projects.filter(p => p.name.toLowerCase().includes(search.trim().toLowerCase())), [projects, search]);
  const heading = view === "home" ? "Your projects" : "All projects";
  return (
    <main className="flex h-full min-w-0 flex-col overflow-hidden">
      <WorkspaceHeader section={view === "home" ? "Home" : "Projects"} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl animate-in fade-in-0 px-5 py-8 duration-200 lg:px-10 lg:py-10">
          {view === "home" && (
            <Card className="relative mb-9 overflow-hidden border-0 bg-gradient-to-br from-muted via-card to-card py-0 ring-1 ring-border">
              <CardContent className="relative min-h-56 px-7 py-8 sm:px-9">
                <div className="relative z-10 max-w-xl">
                  <Badge variant="outline" className="mb-5 gap-1.5 bg-background/80"><Sparkles className="size-3.5" /> Your documentation studio</Badge>
                  <h1 className="max-w-lg text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">Create documentation you'll be proud to share.</h1>
                  <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">Write, organize, and design documentation locally. Your files always belong to you.</p>
                  <Button className="mt-6" onClick={openCreate}><Plus /> New project</Button>
                </div>
                <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-40 size-96 rounded-full border-[54px] border-primary/5" />
              </CardContent>
            </Card>
          )}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><h2 className="text-xl font-semibold tracking-tight">{heading}</h2><p className="mt-1 text-sm text-muted-foreground">Continue working or start something new.</p></div>
            <div className="flex items-center gap-2">
              <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" />
                <Input aria-label="Search projects" className="w-52 pl-9" placeholder="Search projects" value={search} onChange={e => setSearch(e.target.value)} /></div>
              {view === "projects" && <Button onClick={openCreate}><Plus /> New project</Button>}
            </div>
          </div>
          {!desktop && <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Browser preview only. Run <code>bun run desktop</code> to access local projects.</div>}
          {error && <p role="alert" className="mt-6 rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          {loading ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading projects">
              {[0, 1, 2].map(n => <Card key={n} className="min-h-48"><CardHeader><Skeleton className="size-10" /></CardHeader><CardContent className="space-y-2"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-3 w-1/2" /></CardContent></Card>)}
            </div>
          ) : visible.length > 0 ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{visible.map(p => <ProjectCard key={p.id} project={p} onOpen={() => openProject(p.id)} />)}</div>
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
          <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4" /> Paglora works without a cloud account.</div>
        </div>
      </div>
    </main>
  );
}

export function Settings({ location, desktop }: { location: string; desktop: boolean }) {
  return (
    <main className="flex h-full min-w-0 flex-col overflow-hidden">
      <WorkspaceHeader section="Settings" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl animate-in fade-in-0 space-y-5 px-5 py-10 duration-200 lg:px-10">
          <div className="mb-8"><h1 className="text-2xl font-semibold tracking-tight">Settings</h1><p className="mt-1 text-sm text-muted-foreground">Everything is stored locally. No login or cloud service required.</p></div>
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><FolderOpen className="size-4" /> Local project storage</CardTitle><CardDescription>Paglora saves documentation inside its application data folder.</CardDescription></CardHeader>
            <CardContent><div className="break-all rounded-md bg-muted p-3 font-mono text-xs text-foreground">{desktop ? location || "Loading location..." : "Available in the desktop app only"}</div><p className="mt-4 text-xs text-muted-foreground">Custom locations and .paglora backups are planned for later releases.</p></CardContent>
          </Card>
          <Card><CardHeader><CardTitle>About Paglora</CardTitle><CardDescription>Open-source local-first documentation studio · MIT License</CardDescription></CardHeader></Card>
        </div>
      </div>
    </main>
  );
}
