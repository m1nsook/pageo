import { BookOpenTextIcon, FolderOpenIcon, HouseIcon, GearSixIcon, ShieldCheckIcon } from "@phosphor-icons/react";
import { ThemeSwitcher } from "@/components/studio/theme-switcher";
import { useTranslation } from "@/i18n";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";

export type WorkspaceView = "home" | "projects" | "settings";

const destinations = [
  { id: "home", label: "studio.nav.home", icon: HouseIcon },
  { id: "projects", label: "studio.nav.projects", icon: FolderOpenIcon },
  { id: "settings", label: "studio.nav.settings", icon: GearSixIcon },
] as const;

export function WorkspaceSidebar({ view, onNavigate, editing, projectCount = 0 }: {
  view: WorkspaceView;
  onNavigate: (view: WorkspaceView) => void;
  editing: boolean;
  projectCount?: number;
}) {
  const { t } = useTranslation();
  return (
    <Sidebar collapsible="icon" className="studio-workspace-sidebar overflow-x-hidden border-r border-sidebar-border">
      <SidebarHeader className="gap-0 px-3 pb-5 pt-5">
        <div className="flex min-h-14 items-center gap-3 rounded-lg px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 shadow-[inset_0_1px_0_rgba(255,255,255,.08)]">
            <img src="/paglora.svg" className="size-8 object-contain" alt="Paglora logo" />
          </span>
          <span className="min-w-0 group-data-[collapsible=icon]:hidden">
            <span className="font-display block truncate text-xl font-extrabold leading-tight tracking-[-.06em]">paglora<span className="text-primary">.</span></span>
            <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-[.19em] text-muted-foreground">Studio workspace</span>
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent className="overflow-x-hidden overflow-y-auto px-2">
        <SidebarGroup className="gap-2 px-1 py-2">
          <SidebarGroupLabel className="px-3 text-[10px] font-extrabold tracking-[.14em]">{t("studio.nav.workspace")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {destinations.map(({ id, label, icon: Icon }) => (
                <SidebarMenuItem key={id}>
                  <SidebarMenuButton
                    isActive={!editing && view === id}
                    disabled={editing}
                    tooltip={editing ? "Save and leave the editor first" : t(label)}
                    onClick={() => onNavigate(id)}
                    className="studio-shell-nav-item h-11 rounded-md px-3 text-[13px] font-semibold transition-[background-color,color] duration-150 data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
                  >
                    <Icon weight={view === id && !editing ? "fill" : "bold"} className="size-5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{t(label)}</span>
                    {id === "projects" && <span className="ml-auto rounded bg-background/60 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground group-data-[collapsible=icon]:hidden">{projectCount}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator className="my-3" />
        <SidebarGroup className="gap-2 px-1">
          <SidebarGroupLabel className="px-3 text-[10px] font-extrabold tracking-[.14em]">{t("studio.nav.resources")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip={t("studio.nav.documentation")}
                  className="studio-shell-nav-item h-11 rounded-md px-3 text-[13px] font-semibold">
                  <a href="https://m1nsook.github.io/paglora-docs/" target="_blank" rel="noopener noreferrer">
                    <BookOpenTextIcon weight="bold" className="size-5 shrink-0" /><span>{t("studio.nav.documentation")}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-3 border-t border-sidebar-border px-3 py-4">
        <div className="rounded-lg border border-sidebar-border bg-card/50 px-3 py-3 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.07em]"><ShieldCheckIcon weight="bold" className="size-4 text-emerald-500" /> {t("studio.nav.privateByDesign")}</div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{t("studio.nav.privateDescription")}</p>
        </div>
        <div className="flex min-h-9 items-center justify-between gap-2 px-2 text-[11px] text-muted-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <span className="font-semibold uppercase tracking-[.1em] group-data-[collapsible=icon]:hidden">Appearance</span>
          <ThemeSwitcher />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
