import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { checkStudioUpdate, installStudioUpdate, type StudioUpdate } from "@/lib/updates";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/** Only production installations automatically check the stable release feed. */
export function useStudioUpdater(desktop: boolean) {
  const { t } = useTranslation();
  const startupChecked = useRef(false);
  const [available, setAvailable] = useState<StudioUpdate | null>(null);
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [message, setMessage] = useState("");

  const check = useCallback(async (manual: boolean) => {
    if (!desktop || import.meta.env.DEV) {
      if (manual) setMessage(t("studio.updater.onlyInstalled"));
      return;
    }
    setChecking(true);
    if (manual) setMessage("");
    try {
      const found = await checkStudioUpdate();
      setAvailable(found);
      if (found) setOpen(true);
      else if (manual) setMessage(t("studio.updater.upToDate"));
    } catch (error) {
      // First launch may precede any published stable release. Don't spam dialogs.
      if (manual) setMessage(t("studio.updater.checkError", {error: errorMessage(error)}));
    } finally {
      setChecking(false);
    }
  }, [desktop, t]);

  useEffect(() => {
    if (!startupChecked.current) { startupChecked.current = true; void check(false); }
  }, [check]);

  async function install() {
    if (!available || installing) return;
    setInstalling(true);
    setMessage("");
    try {
      // Tauri validates the signature; on Windows the installer closes the app.
      await installStudioUpdate(available.version);
    } catch (error) {
      setMessage(t("studio.updater.installError", {error: errorMessage(error)}));
      setInstalling(false);
    }
  }

  return { available, open, checking, installing, message, check, install, dismiss: () => {
    if (!installing) setOpen(false);
  }};
}

export type StudioUpdaterControls = ReturnType<typeof useStudioUpdater>;

export function StudioUpdateDialog({ updater }: { updater: StudioUpdaterControls }) {
  const { t } = useTranslation();
  return <Dialog open={updater.open} onOpenChange={open => { if (!open) updater.dismiss(); }}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t("studio.updater.available", {version: updater.available?.version || ""})}</DialogTitle>
        <DialogDescription>{t("studio.updater.description")}</DialogDescription>
      </DialogHeader>
      <div className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-sm text-foreground">
        {updater.available?.notes || t("studio.updater.noNotes")}
      </div>
      {updater.message && <p role="alert" className="text-sm text-destructive">{updater.message}</p>}
      <DialogFooter>
        <Button variant="outline" disabled={updater.installing} onClick={updater.dismiss}>{t("studio.updater.later")}</Button>
        <Button disabled={updater.installing || !updater.available} onClick={() => void updater.install()}>
          {updater.installing ? t("studio.updater.installing") : t("studio.updater.install")}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
