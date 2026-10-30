import { BookOpen, FolderOpen, Home, LayoutTemplate, Settings2, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";

export type WorkspaceView = "home" | "projects" | "settings";

const destinations = [
  { id: "home", label: "Home", icon: Home },
  { id: "projects", label: "Projects", icon: FolderOpen },
  { id: "settings", label: "Settings", icon: Settings2 },
] as const;

export function WorkspaceSidebar({ view, onNavigate, editing }: {
  view: WorkspaceView;
  onNavigate: (view: WorkspaceView) => void;
  editing: boolean;
}) {
  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="px-3 py-5">
        <div className="flex h-10 items-center gap-3 px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <BookOpen className="size-5" />
          </span>
          <span className="truncate text-lg font-semibold tracking-tight group-data-[collapsible=icon]:hidden">pageo<span className="text-muted-foreground">.</span></span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {destinations.map(({ id, label, icon: Icon }) => (
                <SidebarMenuItem key={id}>
                  <SidebarMenuButton
                    isActive={!editing && view === id}
                    disabled={editing}
                    tooltip={editing ? "Save and leave the editor first" : label}
                    onClick={() => onNavigate(id)}
                    className="transition-colors"
                  >
                    <Icon /> <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup>
          <SidebarGroupLabel>Resources</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton disabled tooltip="Templates are planned">
                  <LayoutTemplate /><span>Templates</span>
                  <Badge variant="secondary" className="ml-auto text-[10px] group-data-[collapsible=icon]:hidden">Soon</Badge>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-3 p-3">
        <div className="rounded-lg bg-muted/70 p-3 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center gap-2 text-xs font-medium"><ShieldCheck className="size-4" /> Private by design</div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Stored on this computer. No account or cloud required.</p>
        </div>
        <div className="flex items-center justify-between px-2 text-[11px] text-muted-foreground group-data-[collapsible=icon]:hidden">
          <span>Pageo Studio</span><span>Local preview</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
