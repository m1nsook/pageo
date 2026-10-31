import { BookOpenText, FolderOpen, Search } from "lucide-react";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";

export type FindEntry = { id: string; title: string; description?: string; kind: "page" | "project" };

export function StudioQuickFind({ open, onOpenChange, entries, onSelect, shortcut }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: FindEntry[];
  shortcut: string;
  onSelect: (id: string) => void;
}) {
  const title = entries.some(entry => entry.kind === "page") ? "Find documentation page" : "Find project";
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title={title}
      description="Search titles and navigation groups. Use arrow keys to choose, Enter to open and Escape to dismiss."
      className="w-[min(94vw,560px)] sm:max-w-xl">
      <Command className="rounded-md!">
        <CommandInput autoFocus placeholder={title + "…"} aria-label={title} />
        <CommandList className="max-h-[min(52vh,380px)]">
          <CommandEmpty className="py-7 text-muted-foreground">No matching {title.includes("page") ? "pages" : "projects"}.</CommandEmpty>
          <CommandGroup heading={title}>
            {entries.map(item => (
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
          <span className="flex items-center gap-1"><Search className="size-3.5" /> Local title search <Kbd>{shortcut}</Kbd></span>
          <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> Navigate <Kbd>Esc</Kbd> Close</span>
        </div>
      </Command>
    </CommandDialog>
  );
}
