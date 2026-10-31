import { useEffect, useState, type FormEvent } from "react";
import type { ProjectSummary, ProjectVisual } from "@paglora/core";
import { BookOpen, Code2, FolderOpen, Globe2, Package, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const DEFAULT_PROJECT_VISUAL: ProjectVisual = { category: "", accent: "blue", icon: "book" };
export const PROJECT_ACCENTS = {
  blue: { name: "Blue", tone: "bg-sky-500/15 text-sky-500 ring-sky-500/40", dot: "bg-sky-500" },
  violet: { name: "Violet", tone: "bg-violet-500/15 text-violet-500 ring-violet-500/40", dot: "bg-violet-500" },
  cyan: { name: "Cyan", tone: "bg-cyan-500/15 text-cyan-500 ring-cyan-500/40", dot: "bg-cyan-500" },
  green: { name: "Green", tone: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/40", dot: "bg-emerald-500" },
  amber: { name: "Amber", tone: "bg-amber-500/15 text-amber-500 ring-amber-500/40", dot: "bg-amber-500" },
  rose: { name: "Rose", tone: "bg-rose-500/15 text-rose-500 ring-rose-500/40", dot: "bg-rose-500" },
} as const;

export const PROJECT_ICONS = {
  book: { name: "Book", Icon: BookOpen },
  code: { name: "Code", Icon: Code2 },
  package: { name: "Package", Icon: Package },
  rocket: { name: "Rocket", Icon: Rocket },
  globe: { name: "Globe", Icon: Globe2 },
  folder: { name: "Folder", Icon: FolderOpen },
} as const;

export function ProjectIcon({ visual, className }: { visual?: ProjectVisual; className?: string }) {
  const selected = visual ?? DEFAULT_PROJECT_VISUAL;
  const palette = PROJECT_ACCENTS[selected.accent] ?? PROJECT_ACCENTS.blue;
  const Icon = (PROJECT_ICONS[selected.icon] ?? PROJECT_ICONS.book).Icon;
  return (
    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-md ring-1", palette.tone, className)}>
      <Icon aria-hidden="true" className="size-5" />
    </span>
  );
}

export function ProjectAppearanceDialog({ project, open, onOpenChange, onSave }: {
  project: ProjectSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (visual: ProjectVisual) => Promise<void>;
}) {
  const [visual, setVisual] = useState<ProjectVisual>(project.visual ?? DEFAULT_PROJECT_VISUAL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) { setVisual(project.visual ?? DEFAULT_PROJECT_VISUAL); setError(""); }
  }, [open, project]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try { await onSave({ ...visual, category: visual.category.trim() }); onOpenChange(false); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={value => { if (!saving) onOpenChange(value); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Customize {project.name}</DialogTitle>
          <DialogDescription>Organize projects locally. Category, icon, and accent are included in portable backups.</DialogDescription>
        </DialogHeader>
        <form className="space-y-5" onSubmit={event => void submit(event)}>
          <div className="space-y-2">
            <Label htmlFor="paglora-project-category">Category</Label>
            <Input id="paglora-project-category" value={visual.category} maxLength={40}
              placeholder="e.g. Development, Games, Personal" onChange={e => setVisual(v => ({ ...v, category: e.target.value }))} />
            <p className="text-xs text-muted-foreground">Projects in the same category appear together in the workspace. Leave blank for Uncategorized.</p>
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Accent</legend>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(PROJECT_ACCENTS) as [ProjectVisual["accent"], (typeof PROJECT_ACCENTS)[keyof typeof PROJECT_ACCENTS]][]).map(([value, option]) => (
                <button type="button" key={value} aria-label={option.name} aria-pressed={visual.accent === value}
                  onClick={() => setVisual(v => ({ ...v, accent: value }))}
                  className={cn("flex h-9 items-center gap-2 rounded-md border px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring", visual.accent === value ? "border-foreground bg-muted" : "border-border")}>
                  <span aria-hidden="true" className={cn("size-3 rounded-full", option.dot)} /> {option.name}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Project icon</legend>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(PROJECT_ICONS) as [ProjectVisual["icon"], (typeof PROJECT_ICONS)[keyof typeof PROJECT_ICONS]][]).map(([value, option]) => (
                <button type="button" key={value} aria-pressed={visual.icon === value}
                  className={cn("flex flex-col items-center gap-1.5 rounded-md border p-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring", visual.icon === value ? "border-primary bg-primary/10" : "border-border hover:bg-muted")}
                  onClick={() => setVisual(v => ({ ...v, icon: value }))}>
                  <option.Icon className="size-5" aria-hidden="true" />{option.name}
                </button>
              ))}
            </div>
          </fieldset>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="mx-0 mb-0 flex-row border-0 bg-transparent px-0 pb-0 pt-3">
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save appearance"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
