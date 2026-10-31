import { useEffect, useState, type MouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Maximize2, Minus, Square, X } from "lucide-react";
import { toast } from "sonner";
import { StudioTooltip } from "@/components/studio/studio-tooltip";

/**
 * Window chrome is intentionally outside SidebarProvider so the drag strip
 * remains available on Home, Settings, and while editing a project.
 * Tauri's own window manages edge resizing, OS shortcuts and monitor DPI.
 */
export function StudioTitlebar({ activeProject }: { activeProject?: string }) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    let mounted = true;
    let stopListening: (() => void) | undefined;
    const refresh = async () => {
      try {
        const next = await appWindow.isMaximized();
        if (mounted) setMaximized(next);
      } catch (error) {
        console.warn("Cannot read Paglora window state", error);
      }
    };

    void refresh();
    void appWindow.onResized(() => void refresh())
      .then(stop => {
        if (mounted) stopListening = stop;
        else stop();
      })
      .catch(error => console.warn("Cannot observe Paglora window resizing", error));

    return () => {
      mounted = false;
      stopListening?.();
    };
  }, []);

  async function action(command: "minimize" | "toggle" | "close") {
    const appWindow = getCurrentWindow();
    try {
      if (command === "minimize") await appWindow.minimize();
      else if (command === "toggle") {
        await appWindow.toggleMaximize();
        setMaximized(await appWindow.isMaximized());
      } else await appWindow.close();
    } catch (error) {
      toast.error("Window action failed", { description: error instanceof Error ? error.message : String(error) });
    }
  }

  function doubleClickDragRegion(event: MouseEvent<HTMLDivElement>) {
    if (event.button === 0) void action("toggle");
  }

  return (
    <header data-paglora-titlebar aria-label="Paglora window title bar"
      className="paglora-titlebar relative z-20 flex h-[42px] w-full shrink-0 select-none items-center border-b border-border/70 bg-[var(--studio-surface-0)] text-foreground">
      <div data-tauri-drag-region onDoubleClick={doubleClickDragRegion}
        className="paglora-titlebar-drag flex h-full min-w-0 flex-1 items-center gap-2.5 px-3">
        <img src="/paglora.svg" draggable={false} alt="" aria-hidden="true"
          className="pointer-events-none size-[19px] shrink-0 object-contain" />
        <span data-tauri-drag-region className="pointer-events-none font-display text-[13px] font-extrabold tracking-tight">
          paglora<span className="text-primary">.</span>
        </span>
        <span data-tauri-drag-region aria-hidden="true" className="pointer-events-none mx-1 h-3.5 w-px bg-border" />
        <span data-tauri-drag-region className="pointer-events-none min-w-0 truncate text-[11px] font-medium text-muted-foreground">
          {activeProject ? activeProject : "Documentation Studio"}
        </span>
      </div>
      <div role="group" aria-label="Window controls" className="paglora-titlebar-controls flex h-full shrink-0 items-stretch">
        <StudioTooltip label="Minimize window">
          <button type="button" className="paglora-caption-button" aria-label="Minimize window"
            onClick={() => void action("minimize")}><Minus aria-hidden="true" className="size-4" /></button>
        </StudioTooltip>
        <StudioTooltip label={maximized ? "Restore window" : "Maximize window"}>
          <button type="button" className="paglora-caption-button" aria-label={maximized ? "Restore window" : "Maximize window"}
            onClick={() => void action("toggle")}>
            {maximized ? <Square aria-hidden="true" className="size-3.5" /> : <Maximize2 aria-hidden="true" className="size-3.5" />}
          </button>
        </StudioTooltip>
        <StudioTooltip label="Close Paglora">
          <button type="button" className="paglora-caption-button paglora-caption-close" aria-label="Close Paglora"
            onClick={() => void action("close")}><X aria-hidden="true" className="size-4" /></button>
        </StudioTooltip>
      </div>
    </header>
  );
}
