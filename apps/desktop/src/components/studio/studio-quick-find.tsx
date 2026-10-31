import { useEffect, useMemo, useState } from "react";
import { BookOpenText, FolderOpen, LoaderCircle, Search } from "lucide-react";
import { searchProjectPages, type PageSearchHit } from "@/lib/pages";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";

export type FindEntry = { id: string; title: string; description?: string; kind: "page" | "project" };

export function StudioQuickFind({ open, onOpenChange, entries, onSelect, shortcut, projectId }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: FindEntry[];
  shortcut: string;
  projectId?: string;
  onSelect: (id: string) => void;
}) {
  const title = entries.some(entry => entry.kind === "page") ? "Find documentation page" : "Find project";
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PageSearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open || !projectId || query.trim().length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    let active = true;
    setSearching(true);
    const timer = window.setTimeout(() => {
      void searchProjectPages(projectId, query.trim())
        .then(result => { if (active) setHits(result); })
        .catch(error => {
          if (active) { console.warn("Local page search unavailable", error); setHits([]); }
        })
        .finally(() => { if (active) setSearching(false); });
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [open, projectId, query]);

  const shown = useMemo(() => {
    if (!projectId || query.trim().length < 2) return entries;
    const found = new Map(hits.map(hit => [hit.id, hit]));
    return entries.map(item => {
      const match = found.get(item.id);
      return match ? { ...item, description: `${match.isPublic ? "" : "Private · "}${match.excerpt}` } : item;
    });
  }, [entries, hits, projectId, query]);
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title={title}
      description={projectId ? "Search page titles, navigation groups and saved Markdown locally. Private drafts stay in Studio." : "Search project names and categories on this computer."}
      className="w-[min(94vw,560px)] sm:max-w-xl">
      <Command className="rounded-md!">
        <CommandInput autoFocus value={query} onValueChange={setQuery} placeholder={projectId ? "Search pages and content…" : title + "…"} aria-label={title} />
        <CommandList className="max-h-[min(52vh,380px)]">
          <CommandEmpty className="py-7 text-muted-foreground">{searching ? "Searching saved pages…" : `No matching ${projectId ? "pages" : "projects"}.`}</CommandEmpty>
          <CommandGroup heading={title}>
            {shown.map(item => (
              <CommandItem key={item.id} value={`${item.title} ${item.description ?? ""} ${item.id}`}
                onSelect={() => { onOpenChange(false); onSelect(item.id); }} className="gap-3 py-2.5">
                {item.kind === "page" ? <BookOpenText className="size-4 text-primary" /> : <FolderOpen className="size-4 text-primary" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{item.title}</span>
                  {item.description && <span className="block truncate text-xs text-muted-foreground">{item.description}</span>}
                </span>
                <CommandShortcut><Kbd>↵</Kbd></CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
        <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">{searching ? <LoaderCircle className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}{projectId ? "Local saved-page search" : "Local project search"} <Kbd>{shortcut}</Kbd></span>
          <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> Navigate <Kbd>Esc</Kbd> Close</span>
        </div>
      </Command>
    </CommandDialog>
  );
}
