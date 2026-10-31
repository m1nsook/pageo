import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Keyboard, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { useTranslation } from "@/i18n";
import {
  DEFAULT_SHORTCUTS, STUDIO_COMMANDS, shortcutFromEvent, shortcutLabel,
  type ShortcutBindings, type StudioCommand,
} from "@/lib/studio-shortcuts";

export function StudioShortcutSettings({ bindings, onAssign, onReset }: {
  bindings: ShortcutBindings;
  onAssign: (command: StudioCommand, stroke: string) => string | null;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const localizedCommand = (id: StudioCommand) => t(`studio.shortcuts.${id === "new-project" ? "newProject" : id}`);
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
      setError(t("studio.shortcuts.badKey"));
      return;
    }
    const validation = onAssign(recording, stroke);
    if (!validation) { close(); return; }
    if (validation.startsWith("Already assigned to ")) {
      const english = validation.slice("Already assigned to ".length).replace(/\.$/, "");
      const match = STUDIO_COMMANDS.find(command => command.label === english);
      setError(t("studio.shortcuts.conflict", { name: match ? localizedCommand(match.id) : english }));
    } else setError(t(validation.startsWith("Use Ctrl/Cmd") ? "studio.shortcuts.invalid" : "studio.shortcuts.saveError"));
  };

  return (
    <>
      <div className="divide-y divide-border/70">
        {STUDIO_COMMANDS.map(command => (
          <div key={command.id} className="flex min-w-0 items-center gap-3 py-2.5">
            <Keyboard aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{localizedCommand(command.id)}</div>
              <div className="text-xs text-muted-foreground">{t(`studio.shortcuts.${command.id === "new-project" ? "newProject" : command.id}Desc`)}</div>
            </div>
            <Kbd className="shrink-0 px-2">{shortcutLabel(bindings[command.id], isMac)}</Kbd>
            <Button variant="outline" size="sm" aria-label={t("studio.shortcuts.changeAria", { name: localizedCommand(command.id) })}
              onClick={() => { setRecording(command.id); setError(""); }}>{t("studio.shortcuts.change")}</Button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{t("studio.shortcuts.local")}</p>
        <Button type="button" variant="ghost" size="sm" onClick={onReset}
          disabled={STUDIO_COMMANDS.every(command => bindings[command.id] === DEFAULT_SHORTCUTS[command.id])}>
          <RotateCcw className="size-3.5" /> {t("studio.shortcuts.reset")}
        </Button>
      </div>
      <Dialog open={recording !== null} onOpenChange={value => { if (!value) close(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("studio.shortcuts.record")}</DialogTitle>
            <DialogDescription>
              {recording ? t("studio.shortcuts.recordHelp", { name: localizedCommand(recording) }) : ""}
            </DialogDescription>
          </DialogHeader>
          <button type="button" ref={recorder} data-studio-shortcut-recorder
            onKeyDown={handleKey} onContextMenu={e => e.preventDefault()}
            className="flex min-h-24 items-center justify-center rounded-md border border-dashed border-primary/60 bg-primary/10 p-4 text-center text-sm font-medium text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary">
            {t("studio.shortcuts.press")}
          </button>
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">
            {t("studio.shortcuts.reserved")}
          </p>
          <div className="flex justify-end"><Button type="button" variant="outline" onClick={close}>{t("studio.shortcuts.cancel")}</Button></div>
        </DialogContent>
      </Dialog>
    </>
  );
}
