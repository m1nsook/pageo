import { useState } from "react";
import { ArchiveRestore, ChevronDown, ChevronUp, FolderClock, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { TrashedProject } from "@/lib/projects";

export function ProjectTrashPanel({ items, busy, onRestore }: {
  items: TrashedProject[];
  busy: string | null;
  onRestore: (trashId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section aria-label="Recently removed projects" className="mt-8 rounded-lg border border-border bg-card/50">
      <Button variant="ghost" className="flex h-auto w-full justify-between rounded-lg px-4 py-3 text-left"
        aria-expanded={expanded} aria-controls="paglora-project-trash" onClick={() => setExpanded(value => !value)}>
        <span className="flex min-w-0 items-center gap-2 font-medium">
          <FolderClock aria-hidden="true" className="size-4 text-muted-foreground" />
          Recently removed
          <Badge variant="secondary">{items.length}</Badge>
        </span>
        {expanded ? <ChevronUp aria-hidden="true" className="size-4" /> : <ChevronDown aria-hidden="true" className="size-4" />}
      </Button>
      {expanded && (
        <div id="paglora-project-trash" className="border-t border-border px-4 py-3">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recoverable projects. Removed projects remain on this computer.</p>
          ) : (
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {items.map(item => (
                <div key={item.trashId} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/40">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={item.project.name}>{item.project.name}</p>
                    <p className="text-xs text-muted-foreground">Removed {new Date(item.removedAt * 1000).toLocaleString()}</p>
                  </div>
                  <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => onRestore(item.trashId)}
                    aria-label={`Restore ${item.project.name}`}>
                    {busy === item.trashId ? <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" /> : <ArchiveRestore aria-hidden="true" className="size-3.5" />}
                    Restore
                  </Button>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Restore returns the original project, including its documents and assets. Existing projects are never overwritten.
            Previous storage locations may need to be reconnected before restoring older entries.
          </p>
        </div>
      )}
    </section>
  );
}
