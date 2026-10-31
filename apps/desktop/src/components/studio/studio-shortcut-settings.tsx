import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Keyboard, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import {
  DEFAULT_SHORTCUTS, STUDIO_COMMANDS, shortcutFromEvent, shortcutLabel,
  type ShortcutBindings, type StudioCommand,
} from "@/lib/studio-shortcuts";

export function StudioShortcutSettings({ bindings, onAssign, onReset }: {
  bindings: ShortcutBindings;
  onAssign: (command: StudioCommand, stroke: string) => string | null;
  onReset: () => void;
}) {
  const [recording, setRecording] = useState<StudioCommand | null>(null);
  const [error, setError] = useState("");
  const recorder = useRef<HTMLButtonElement>(null);
  const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);

  useEffect(() => {
    if (recording) recorder.current?.focus();
  }, [recording]);

  const close = () => { setRecording(null); setError(""); };
  const handleKey = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") { close(); return; }
    if (!recording) return;
    const stroke = shortcutFromEvent(event.nativeEvent);
    if (!stroke) {
      setError("Press Ctrl/Cmd together with a letter, number or comma. Esc cancels.");
      return;
    }
    const validation = onAssign(recording, stroke);
    if (validation) setError(validation);
    else close();
  };

  return (
    <>
      <div className="divide-y divide-border/70">
        {STUDIO_COMMANDS.map(command => (
          <div key={command.id} className="flex min-w-0 items-center gap-3 py-2.5">
            <Keyboard aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{command.label}</div>
              <div className="text-xs text-muted-foreground">{command.description}</div>
            </div>
            <Kbd className="shrink-0 px-2">{shortcutLabel(bindings[command.id], isMac)}</Kbd>
            <Button variant="outline" size="sm" aria-label={`Change shortcut for ${command.label}`}
              onClick={() => { setRecording(command.id); setError(""); }}>Change</Button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Shortcuts are stored on this computer, not in .paglora projects.</p>
        <Button type="button" variant="ghost" size="sm" onClick={onReset}
          disabled={STUDIO_COMMANDS.every(command => bindings[command.id] === DEFAULT_SHORTCUTS[command.id])}>
          <RotateCcw className="size-3.5" /> Reset all
        </Button>
      </div>
      <Dialog open={recording !== null} onOpenChange={value => { if (!value) close(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record keyboard shortcut</DialogTitle>
            <DialogDescription>
              {recording ? STUDIO_COMMANDS.find(command => command.id === recording)?.label : ""} — press your preferred shortcut.
            </DialogDescription>
          </DialogHeader>
          <button type="button" ref={recorder} data-studio-shortcut-recorder
            onKeyDown={handleKey} onContextMenu={e => e.preventDefault()}
            className="flex min-h-24 items-center justify-center rounded-md border border-dashed border-primary/60 bg-primary/10 p-4 text-center text-sm font-medium text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary">
            Press Ctrl/Cmd + key
          </button>
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">
            Common browser shortcuts and editor formatting commands are reserved. Duplicate shortcuts are not allowed.
          </p>
          <div className="flex justify-end"><Button type="button" variant="outline" onClick={close}>Cancel</Button></div>
        </DialogContent>
      </Dialog>
    </>
  );
}
