import { useEffect, useRef, useState } from "react";
import { BookOpenText, House, Search, Settings2 } from "lucide-react";
import { isTauri } from "@tauri-apps/api/core";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Empty Studio surface menu. Existing Radix page/project context menus remain
 * authoritative, and editable fields retain browser editing actions for now.
 * The documentation preview runs in an isolated iframe and is never intercepted.
 */
export function StudioSurfaceMenu({ onFind, onHome, onSettings, editing }: {
  onFind: () => void;
  onHome: () => void;
  onSettings: () => void;
  editing: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [point, setPoint] = useState({ x: 0, y: 0 });
  const focusBefore = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    const onContext = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest([
        '[data-slot="context-menu-trigger"]',
        '[data-slot="context-menu-content"]',
        '[data-slot="dropdown-menu-content"]',
        '[data-slot="dialog-content"]',
        '[data-slot="alert-dialog-content"]',
        '[data-paglora-source-editor]',
        'input', 'textarea', 'select', 'iframe',
        '[contenteditable="true"]', '[contenteditable="plaintext-only"]',
      ].join(","))) return;
      event.preventDefault();
      focusBefore.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setPoint({
        x: Math.min(event.clientX, Math.max(0, window.innerWidth - 225)),
        y: Math.min(event.clientY, Math.max(0, window.innerHeight - 190)),
      });
      setOpen(true);
    };
    document.addEventListener("contextmenu", onContext, { capture: true });
    return () => document.removeEventListener("contextmenu", onContext, { capture: true });
  }, []);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button type="button" tabIndex={-1} aria-label="Studio context menu anchor"
          className="pointer-events-none fixed z-[-1] size-px opacity-0"
          style={{ left: point.x, top: point.y }} />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="start" sideOffset={0} className="w-52"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          focusBefore.current?.focus({ preventScroll: true });
        }}>
        <DropdownMenuLabel>Paglora Studio</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onFind}><Search /> Find projects or pages <DropdownMenuShortcut>Ctrl+F</DropdownMenuShortcut></DropdownMenuItem>
        <DropdownMenuItem onSelect={onHome} disabled={editing}><House /> Home</DropdownMenuItem>
        <DropdownMenuItem onSelect={onSettings} disabled={editing}><Settings2 /> Settings</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="https://m1nsook.github.io/paglora-docs/" target="_blank" rel="noopener noreferrer"><BookOpenText /> Documentation</a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
