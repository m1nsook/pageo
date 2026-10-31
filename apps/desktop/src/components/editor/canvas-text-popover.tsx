import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { canvasBlockName, type CanvasBlockSelection } from "@/lib/canvas-blocks";

export type CanvasTextAnchor = {
  selection: CanvasBlockSelection;
  text: string;
  left: number;
  top: number;
};

/** An editor control anchored to a verified source-mapped block in the
 * live site. Draft changes are only painted in the sandboxed preview; saving
 * still uses the source-owned Tiptap transaction and autosave queue.
 */
export function CanvasTextPopover({ target, onDraft, onCommit, onDismiss }: {
  target: CanvasTextAnchor;
  onDraft: (text: string) => void;
  onCommit: (selected: CanvasBlockSelection, text: string) => boolean;
  onDismiss: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(target.text);
  const [error, setError] = useState("");
  const composing = useRef(false);

  useEffect(() => { setDraft(target.text); setError(""); }, [target]);
  function cancel() {
    setOpen(false);
    onDismiss();
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (composing.current) return;
    if (!draft.trim() || draft.length > 3000 || /[\r\n]/.test(draft)) {
      setError("Enter 1–3000 characters on one line.");
      return;
    }
    if (!onCommit(target.selection, draft)) {
      setError("This block changed since selection. No source was overwritten. Re-select the text to try again.");
      onDraft(target.text);
      return;
    }
    setOpen(false);
  }

  return <Popover open={open} onOpenChange={value => { if (value) setOpen(true); else cancel(); }}>
    <PopoverTrigger asChild>
      <button type="button" data-canvas-edit-anchor
        style={{ left: target.left, top: target.top }}
        aria-label={`Edit ${canvasBlockName(target.selection.tagName)} on canvas`}
        className="absolute z-20 flex items-center gap-1 rounded-md border border-primary/40 bg-popover px-2 py-1 text-[11px] font-semibold text-popover-foreground shadow-lg ring-1 ring-background/50 focus-visible:outline-2 focus-visible:outline-ring">
        <Pencil className="size-3" aria-hidden="true"/> Edit text
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" side="bottom" sideOffset={8}
      className="w-[min(92vw,380px)] gap-3 p-3" data-canvas-text-popover>
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="canvas-anchored-text">Edit {canvasBlockName(target.selection.tagName)}</Label>
          <p className="text-[11px] text-muted-foreground">Changes preview immediately; Save updates the original Markdown.</p>
          <Input id="canvas-anchored-text" autoFocus maxLength={3000} value={draft}
            onCompositionStart={() => { composing.current = true; }}
            onCompositionEnd={() => { composing.current = false; }}
            onChange={event => { setDraft(event.target.value); onDraft(event.target.value); setError(""); }}/>
        </div>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="outline" onClick={cancel}><X className="size-3.5"/> Cancel</Button>
          <Button type="submit" size="sm" disabled={!draft.trim()}><Check className="size-3.5"/> Save</Button>
        </div>
      </form>
    </PopoverContent>
  </Popover>;
}
