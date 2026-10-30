import { useState, type FormEvent } from "react";
import { Copy, FilePlus2, FileText, GripVertical, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Page } from "@/lib/pages";

export type PageAction = "create" | "rename" | "duplicate" | "delete" | "reorder";

function PageTitleDialog({ open, setOpen, initial = "", mode, onSubmit }: {
  open: boolean; setOpen: (value: boolean) => void; initial?: string;
  mode: "create" | "rename"; onSubmit: (title: string) => void;
}) {
  const [value, setValue] = useState(initial);
  // Keying by the opening state/page in the parent ensures each dialog starts with current title.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = value.trim();
    if (!name) return;
    onSubmit(name);
    setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create a page" : "Rename page"}</DialogTitle>
          <DialogDescription>{mode === "create" ? "Add a Markdown page to your documentation." : "The page identifier stays the same, so its links remain stable."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-2">
            <Label htmlFor="pageo-page-title">Page title</Label>
            <Input id="pageo-page-title" autoFocus required maxLength={100} placeholder="Getting started" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={!value.trim()}>{mode === "create" ? "Create page" : "Save title"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PageRow({ page, selected, disabled, onNavigate, onAction, onDrag, onDrop }: {
  page: Page; selected: boolean; disabled: boolean;
  onNavigate: () => void;
  onAction: (action: PageAction, id: string, title?: string) => void;
  onDrag: (id: string | null) => void;
  onDrop: (id: string) => void;
}) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <div className={cn("group flex min-w-0 items-center gap-0.5 rounded-lg pr-1 transition-colors duration-150", selected ? "bg-accent text-accent-foreground" : "hover:bg-muted/70")}
      onDragOver={(event) => { if (page.id !== "index") event.preventDefault(); }}
      onDrop={(event) => { event.preventDefault(); onDrop(page.id); }}
    >
      <span draggable={!disabled && page.id !== "index"} onDragStart={() => onDrag(page.id)} onDragEnd={() => onDrag(null)}
        title={page.id === "index" ? "Overview stays first" : "Drag to reorder"}
        className={cn("flex size-7 shrink-0 items-center justify-center text-muted-foreground/50", page.id !== "index" && !disabled ? "cursor-grab active:cursor-grabbing" : "cursor-default opacity-40")}>
        <GripVertical className="size-3.5" />
      </span>
      <button type="button" disabled={disabled} aria-current={selected ? "page" : undefined} onClick={onNavigate}
        className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{page.title}</span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs" aria-label={`Actions for ${page.title}`} disabled={disabled}
            className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="right" className="w-44">
          <DropdownMenuItem onSelect={() => setRenameOpen(true)}><Pencil /> Rename</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onAction("duplicate", page.id)}><Copy /> Duplicate</DropdownMenuItem>
          {page.id !== "index" && <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}><Trash2 /> Delete</DropdownMenuItem>
          </>}
        </DropdownMenuContent>
      </DropdownMenu>
      <PageTitleDialog key={`${page.id}-${page.title}-${renameOpen}`} open={renameOpen} setOpen={setRenameOpen} initial={page.title} mode="rename" onSubmit={(title) => onAction("rename", page.id, title)} />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{page.title}”?</AlertDialogTitle>
            <AlertDialogDescription>The page will be removed from navigation. Its Markdown file will remain in the project's local .trash folder.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => onAction("delete", page.id)}>Delete page</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function PageNavigation({ pages, currentId, busy, onNavigate, onAction }: {
  pages: Page[]; currentId: string; busy: boolean;
  onNavigate: (id: string) => void;
  onAction: (action: PageAction, id?: string, target?: string) => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const drop = (target: string) => {
    if (dragging && dragging !== target && target !== "index") onAction("reorder", dragging, target);
    setDragging(null);
  };
  return (
    <aside aria-label="Page navigation" className="flex h-full w-[246px] shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <div className="flex items-center gap-2 text-xs font-semibold">Pages <Badge variant="secondary">{pages.length}</Badge></div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" disabled={busy} aria-label="Create page" onClick={() => setCreateOpen(true)}><FilePlus2 /></Button>
          </TooltipTrigger>
          <TooltipContent>Create page</TooltipContent>
        </Tooltip>
      </div>
      <Separator />
      <ScrollArea className="min-h-0 flex-1">
        <nav className="space-y-1 px-2 py-3" aria-label="Documentation pages">
          {pages.map((page) => <PageRow key={page.id} page={page} selected={page.id === currentId} disabled={busy}
            onNavigate={() => onNavigate(page.id)} onAction={onAction}
            onDrag={setDragging} onDrop={drop} />)}
        </nav>
      </ScrollArea>
      <div className="border-t border-border p-3 text-[11px] text-muted-foreground">Drag pages to reorder.</div>
      <PageTitleDialog key={`create-${createOpen}`} open={createOpen} setOpen={setCreateOpen} mode="create" onSubmit={(title) => onAction("create", undefined, title)} />
    </aside>
  );
}
