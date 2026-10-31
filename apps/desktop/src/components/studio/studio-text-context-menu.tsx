import { useEffect, useRef, useState } from "react";
import { Clipboard, Copy, Scissors, TextSelect } from "lucide-react";
import { isTauri } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { canModify, isStudioTextTarget, replaceText, restoreTextSelection, selectedText, type EditableTarget, type TextSelection } from "@/lib/studio-text-edit";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type TextContext = { target: EditableTarget; selection: TextSelection };

/** Only replace the WebView's native menu where Paglora can supply equivalent,
 * functional clipboard controls. Monaco, TipTap, selects, dates, and password
 * inputs retain the platform's own editing/context behavior.
 */
export function StudioTextContextMenu() {
  const [open, setOpen] = useState(false);
  const [point, setPoint] = useState({ x: 0, y: 0 });
  const selected = useRef<TextContext | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [editable, setEditable] = useState(true);

  useEffect(() => {
    if (!isTauri()) return;
    const onContext = (event: MouseEvent) => {
      const target = event.target;
      if (!isStudioTextTarget(target) || target.disabled || target.closest(
        '[data-paglora-source-editor], [data-slot="context-menu-content"], [data-slot="dropdown-menu-content"], [data-slot="command"]'
      )) return;
      // This menu only supports selection-aware text input elements.
      // Numeric fields retain the WebView menu and arrow-key editing.
      if (target instanceof HTMLInputElement && target.type === "number") return;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      if (start === null || end === null) return;
      event.preventDefault();
      selected.current = { target, selection: { start, end } };
      setHasSelection(end > start);
      setEditable(canModify(target));
      setPoint({
        x: Math.min(event.clientX, Math.max(0, window.innerWidth - 204)),
        y: Math.min(event.clientY, Math.max(0, window.innerHeight - 204)),
      });
      setOpen(true);
    };
    document.addEventListener("contextmenu", onContext, { capture: true });
    return () => document.removeEventListener("contextmenu", onContext, { capture: true });
  }, []);

  async function action(kind: "copy" | "cut" | "paste" | "select") {
    const context = selected.current;
    if (!context || !context.target.isConnected) return;
    const { target, selection } = context;
    try {
      if (kind === "select") {
        target.focus({ preventScroll: true });
        target.select();
        return;
      }
      if (kind === "paste") {
        if (!canModify(target)) return;
        if (!navigator.clipboard?.readText) throw new Error("Clipboard reading is unavailable. Use Ctrl+V instead.");
        const content = await navigator.clipboard.readText();
        replaceText(target, selection, content);
        return;
      }
      const text = selectedText(target, selection);
      if (!text) return;
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard writing is unavailable. Use Ctrl+C instead.");
      await navigator.clipboard.writeText(text);
      if (kind === "cut" && canModify(target)) replaceText(target, selection, "");
      else restoreTextSelection(target, selection);
    } catch (cause) {
      toast.error("Clipboard action unavailable", {
        description: cause instanceof Error ? cause.message : String(cause),
      });
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button type="button" tabIndex={-1} aria-label="Text edit menu anchor"
          className="pointer-events-none fixed z-[-1] size-px opacity-0"
          style={{ left: point.x, top: point.y }} />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="start" sideOffset={0} className="min-w-44"
        onCloseAutoFocus={event => {
          event.preventDefault();
          // Do not overwrite the user's selection by refocusing the trigger.
        }}>
        <DropdownMenuLabel>Text editing</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!hasSelection || !editable} onSelect={() => void action("cut")}>
          <Scissors /> Cut
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!hasSelection} onSelect={() => void action("copy")}>
          <Copy /> Copy
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!editable} onSelect={() => void action("paste")}>
          <Clipboard /> Paste
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void action("select")}>
          <TextSelect /> Select all
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
