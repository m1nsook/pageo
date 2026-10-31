import { useEffect, useState, type FormEvent } from "react";
import { Check, LoaderCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Edit page titles where they are shown. The parent flushes the Markdown
 * autosave queue before invoking the existing validated rename command.
 */
export function InlinePageTitle({ title, pageId, disabled, onRename }: {
  title: string;
  pageId: string;
  disabled: boolean;
  onRename: (title: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(title);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) { setDraft(title); setError(""); }
  }, [title, pageId, open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = draft.trim();
    if (!next || [...next].length > 100 || /[\x00-\x1f\x7f]/.test(next)) {
      setError("Page titles must contain 1–100 characters without control characters.");
      return;
    }
    if (next === title) { setOpen(false); return; }
    if (saving || disabled) return;
    setSaving(true);
    setError("");
    try {
      await onRename(next);
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally { setSaving(false); }
  }

  return (
    <Popover open={open} onOpenChange={value => { if (!saving) setOpen(value); }}>
      <PopoverTrigger asChild>
        <button type="button" disabled={disabled} aria-label={`Rename page ${title}`}
          className="group flex max-w-44 items-center gap-1 rounded text-left text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:max-w-64">
          <span className="min-w-0 truncate">{title}</span>
          <Pencil className="size-3 shrink-0 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" className="w-[min(92vw,320px)] gap-3 p-3">
        <form onSubmit={event => void submit(event)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="studio-quick-page-title">Page title</Label>
            <Input id="studio-quick-page-title" autoFocus maxLength={100} value={draft}
              disabled={saving} onChange={event => setDraft(event.target.value)} />
            <p className="text-xs text-muted-foreground">Updates the page navigation label without changing its URL.</p>
          </div>
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={saving || disabled || !draft.trim()}>
              {saving ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              Save title
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
