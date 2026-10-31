import { FolderOpen, Home, LayoutTemplate, Settings2, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ThemeSwitcher } from "@/components/studio/theme-switcher";
import { useTranslation } from "@/i18n";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";

export type WorkspaceView = "home" | "projects" | "settings";

const destinations = [
  { id: "home", label: "studio.nav.home", icon: Home },
  { id: "projects", label: "studio.nav.projects", icon: FolderOpen },
  { id: "settings", label: "studio.nav.settings", icon: Settings2 },
] as const;

export function WorkspaceSidebar({ view, onNavigate, editing }: {
  view: WorkspaceView;
  onNavigate: (view: WorkspaceView) => void;
  editing: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="px-3 py-5">
        <div className="flex h-10 items-center gap-3 px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <span className="flex size-9 shrink-0 items-center justify-center">
            <img src="/paglora.svg" className="size-9 object-contain" alt="Paglora logo" />
          </span>
          <span className="truncate text-lg font-semibold tracking-tight group-data-[collapsible=icon]:hidden">paglora<span className="text-muted-foreground">.</span></span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("studio.nav.workspace")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {destinations.map(({ id, label, icon: Icon }) => (
                <SidebarMenuItem key={id}>
                  <SidebarMenuButton
                    isActive={!editing && view === id}
                    disabled={editing}
                    tooltip={editing ? "Save and leave the editor first" : t(label)}
                    onClick={() => onNavigate(id)}
                    className="transition-colors"
                  >
                    <Icon /> <span>{t(label)}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup>
          <SidebarGroupLabel>{t("studio.nav.resources")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton disabled tooltip="Templates are planned">
                  <LayoutTemplate /><span>{t("studio.nav.templates")}</span>
                  <Badge variant="secondary" className="ml-auto text-[10px] group-data-[collapsible=icon]:hidden">{t("studio.nav.soon")}</Badge>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-3 p-3">
        <div className="rounded-lg bg-muted/70 p-3 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center gap-2 text-xs font-medium"><ShieldCheck className="size-4" /> {t("studio.nav.privateByDesign")}</div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t("studio.nav.privateDescription")}</p>
        </div>
        <div className="flex items-center justify-between gap-2 px-2 text-[11px] text-muted-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <span className="group-data-[collapsible=icon]:hidden">{t("studio.nav.studioTitle")}</span>
          <ThemeSwitcher />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
