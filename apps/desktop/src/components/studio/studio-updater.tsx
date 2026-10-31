import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { checkStudioUpdate, installStudioUpdate, type StudioUpdate } from "@/lib/updates";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/** Only production installations automatically check the stable release feed. */
export function useStudioUpdater(desktop: boolean) {
  const [available, setAvailable] = useState<StudioUpdate | null>(null);
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [message, setMessage] = useState("");

  const check = useCallback(async (manual: boolean) => {
    if (!desktop || import.meta.env.DEV) {
      if (manual) setMessage("Update checks are available in installed Studio builds.");
      return;
    }
    setChecking(true);
    if (manual) setMessage("");
    try {
      const found = await checkStudioUpdate();
      setAvailable(found);
      if (found) setOpen(true);
      else if (manual) setMessage("You're using the latest stable Studio release.");
    } catch (error) {
      // First launch may precede any published stable release. Don't spam dialogs.
      if (manual) setMessage("Couldn't check for updates: " + errorMessage(error));
    } finally {
      setChecking(false);
    }
  }, [desktop]);

  useEffect(() => { void check(false); }, [check]);

  async function install() {
    if (!available || installing) return;
    setInstalling(true);
    setMessage("");
    try {
      // Tauri validates the signature; on Windows the installer closes the app.
      await installStudioUpdate(available.version);
    } catch (error) {
      setMessage("Update installation failed: " + errorMessage(error));
      setInstalling(false);
    }
  }

  return { available, open, checking, installing, message, check, install, dismiss: () => {
    if (!installing) setOpen(false);
  }};
}

export type StudioUpdaterControls = ReturnType<typeof useStudioUpdater>;

export function StudioUpdateDialog({ updater }: { updater: StudioUpdaterControls }) {
  return <Dialog open={updater.open} onOpenChange={open => { if (!open) updater.dismiss(); }}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Paglora Studio v{updater.available?.version} is available</DialogTitle>
        <DialogDescription>A newer stable release is available. Review the notes before installing.</DialogDescription>
      </DialogHeader>
      <div className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-sm text-foreground">
        {updater.available?.notes || "Read the release changelog on GitHub for details."}
      </div>
      {updater.message && <p role="alert" className="text-sm text-destructive">{updater.message}</p>}
      <DialogFooter>
        <Button variant="outline" disabled={updater.installing} onClick={updater.dismiss}>Later</Button>
        <Button disabled={updater.installing || !updater.available} onClick={() => void updater.install()}>
          {updater.installing ? "Verifying and installing…" : "Install signed update"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
