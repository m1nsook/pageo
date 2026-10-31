import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/i18n";
import { RELEASE_NOTES, RELEASE_URL, STUDIO_VERSION } from "@/lib/release-notes";

export const LAST_STUDIO_VERSION_KEY = "paglora.studio.last-launched-version";

export function StudioReleaseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[85svh] overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("studio.release.title", { version: STUDIO_VERSION })}</DialogTitle>
          <DialogDescription>{t("studio.release.description")}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 max-h-[55svh] space-y-5 overflow-y-auto pr-2">
          {RELEASE_NOTES.length ? RELEASE_NOTES.map(section => (
            <section key={section.name} className="space-y-2">
              <h3 className="text-sm font-semibold">{section.name}</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {section.items.map((entry, index) => <li key={index}>{entry}</li>)}
              </ul>
            </section>
          )) : <p>{t("studio.release.empty")}</p>}
        </div>
        <DialogFooter className="flex items-center justify-between gap-3 sm:justify-between">
          <a className="text-xs text-primary underline underline-offset-4" href={RELEASE_URL}
            target="_blank" rel="noopener noreferrer">{t("studio.release.viewAll")}</a>
          <Button onClick={onClose}>{t("studio.release.close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
