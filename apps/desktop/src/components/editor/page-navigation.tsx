import { Fragment, useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Copy, Eye, EyeOff, FilePlus2, FileText, GripVertical, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Page } from "@/lib/pages";
import { useTranslation } from "@/i18n";

export type PageAction = "create" | "rename" | "duplicate" | "delete" | "reorder" | "visibility" | "layout" | "group";

function PageTitleDialog({ open, setOpen, initial = "", mode, onSubmit }: {
  open: boolean; setOpen: (value: boolean) => void; initial?: string;
  mode: "create" | "rename"; onSubmit: (title: string) => void;
}) {
  const { t } = useTranslation();
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
          <DialogTitle>{mode === "create" ? t("studio.pages.createTitle") : t("studio.pages.renameTitle")}</DialogTitle>
          <DialogDescription>{mode === "create" ? t("studio.pages.createDescription") : t("studio.pages.renameDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-2">
            <Label htmlFor="paglora-page-title">{t("studio.pages.pageTitle")}</Label>
            <Input id="paglora-page-title" autoFocus required maxLength={100} placeholder={t("studio.pages.titlePlaceholder")} value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("studio.pages.cancel")}</Button>
            <Button type="submit" disabled={!value.trim()}>{mode === "create" ? t("studio.pages.createPage") : t("studio.pages.saveTitle")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PageRow({ page, selected, disabled, dragged, dropTarget, canMoveUp, canMoveDown, onNavigate, onAction, onStartDrag, onMove }: {
  page: Page; selected: boolean; disabled: boolean;
  onNavigate: () => void;
  onAction: (action: PageAction, id: string, title?: string) => void;
  dragged: boolean;
  dropTarget: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onStartDrag: (event: ReactPointerEvent<HTMLSpanElement>, id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
}) {
  const { t } = useTranslation();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
    <div
      data-page-id={page.id}
      className={cn(
        "group relative flex min-w-0 items-center gap-0.5 rounded-lg pr-1 transition-[background-color,opacity,box-shadow] duration-150",
        selected ? "bg-accent text-accent-foreground" : "hover:bg-muted/70",
        dragged && "opacity-50",
        dropTarget && "bg-primary/10 ring-2 ring-primary/60",
      )}
    >
      <span
        role="button" tabIndex={-1}
        aria-label={t("studio.pages.dragToReorder", { title: page.title })}
        onPointerDown={(event) => onStartDrag(event, page.id)}
        aria-description={page.id === "index" ? t("studio.pages.overviewFirst") : t("studio.pages.holdToDrag")}
        className={cn(
          "flex size-7 shrink-0 items-center justify-center text-muted-foreground/50 touch-none select-none",
          page.id !== "index" && !disabled ? "cursor-grab active:cursor-grabbing" : "cursor-default opacity-40",
        )}>
        <GripVertical className="size-3.5" />
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" disabled={disabled} aria-current={selected ? "page" : undefined} onClick={onNavigate}
            className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-left">{page.title}</span>
            {!page.isPublic && <EyeOff className="size-3 shrink-0 text-muted-foreground" aria-label={t("studio.pages.privatePage")} />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[360px] break-words">{page.title}</TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs" aria-label={t("studio.pages.actionsFor", { title: page.title })} disabled={disabled}
            className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="right" className="w-44">
          <DropdownMenuItem onSelect={() => setRenameOpen(true)}><Pencil /> {t("studio.pages.rename")}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onAction("duplicate", page.id)}><Copy /> {t("studio.pages.duplicate")}</DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>{t("studio.pages.pageLayout", { layout: t(page.layout === "landing" ? "studio.pages.layoutLanding" : page.layout === "wide" ? "studio.pages.layoutWide" : "studio.pages.layoutDocs") })}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onSelect={() => onAction("layout", page.id, "docs")}>{t("studio.pages.layoutDocsDetail")}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onAction("layout", page.id, "wide")}>{t("studio.pages.layoutWideDetail")}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onAction("layout", page.id, "landing")}>{t("studio.pages.layoutLandingDetail")}</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {page.id !== "index" && <DropdownMenuItem onSelect={() => onAction("visibility", page.id, String(!page.isPublic))}>
            {page.isPublic ? <EyeOff /> : <Eye />} {page.isPublic ? t("studio.pages.makePrivate") : t("studio.pages.makePublic")}
          </DropdownMenuItem>}
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!canMoveUp || disabled} onSelect={() => onMove(page.id, "up")}><ArrowUp /> {t("studio.pages.moveUp")}</DropdownMenuItem>
          <DropdownMenuItem disabled={!canMoveDown || disabled} onSelect={() => onMove(page.id, "down")}><ArrowDown /> {t("studio.pages.moveDown")}</DropdownMenuItem>
          {page.id !== "index" && <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}><Trash2 /> {t("studio.pages.delete")}</DropdownMenuItem>
          </>}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="min-w-44">
          <ContextMenuItem disabled={disabled} onSelect={onNavigate}><FileText /> {t("studio.pages.openPage")}</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem disabled={disabled} onSelect={() => setRenameOpen(true)}><Pencil /> {t("studio.pages.rename")}</ContextMenuItem>
          <ContextMenuItem disabled={disabled} onSelect={() => onAction("duplicate", page.id)}><Copy /> {t("studio.pages.duplicate")}</ContextMenuItem>
          {page.id !== "index" && <ContextMenuItem disabled={disabled} onSelect={() => onAction("visibility", page.id, String(!page.isPublic))}>
            {page.isPublic ? <EyeOff /> : <Eye />} {page.isPublic ? t("studio.pages.makePrivate") : t("studio.pages.makePublic")}
          </ContextMenuItem>}
          <ContextMenuSeparator />
          <ContextMenuItem disabled={!canMoveUp || disabled} onSelect={() => onMove(page.id, "up")}><ArrowUp /> {t("studio.pages.moveUp")}</ContextMenuItem>
          <ContextMenuItem disabled={!canMoveDown || disabled} onSelect={() => onMove(page.id, "down")}><ArrowDown /> {t("studio.pages.moveDown")}</ContextMenuItem>
          {page.id !== "index" && <>
            <ContextMenuSeparator />
            <ContextMenuItem disabled={disabled} variant="destructive" onSelect={() => setDeleteOpen(true)}><Trash2 /> {t("studio.pages.delete")}</ContextMenuItem>
          </>}
        </ContextMenuContent>
      </ContextMenu>
      <PageTitleDialog key={`${page.id}-${page.title}-${renameOpen}`} open={renameOpen} setOpen={setRenameOpen} initial={page.title} mode="rename" onSubmit={(title) => onAction("rename", page.id, title)} />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("studio.pages.deleteQuestion", { title: page.title })}</AlertDialogTitle>
            <AlertDialogDescription>{t("studio.pages.deleteDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("studio.pages.cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => onAction("delete", page.id)}>{t("studio.pages.deletePage")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
}

export function PageNavigation({ pages, currentId, busy, onNavigate, onAction }: {
  pages: Page[]; currentId: string; busy: boolean;
  onNavigate: (id: string) => void;
  onAction: (action: PageAction, id?: string, target?: string) => void;
}) {
  const { t } = useTranslation();
  const [createOpen, setCreateOpen] = useState(false);
  const [dragged, setDragged] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const activeGroup = pages.find(page => page.id === currentId)?.navGroup;
  // If navigation or a page's group assignment changes, make its new section
  // visible without expanding unrelated groups.
  useEffect(() => {
    if (!activeGroup) return;
    setCollapsedGroups(previous => {
      if (!previous.has(activeGroup)) return previous;
      const next = new Set(previous);
      next.delete(activeGroup);
      return next;
    });
  }, [currentId, activeGroup]);
  function toggleGroup(group: string) {
    resetDrag();
    setCollapsedGroups(previous => {
      const next = new Set(previous);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }
  // Pointer capture works in the Tauri WebView more reliably than the
  // native HTML5 draggable/drop events inside Radix ContextMenu + ScrollArea.
  const pointer = useRef<{ id: string; x: number; y: number; active: boolean } | null>(null);
  const target = useRef<string | null>(null);

  function resetDrag() {
    pointer.current = null;
    target.current = null;
    setDragged(null);
    setDropTarget(null);
  }
  function startDrag(event: ReactPointerEvent<HTMLSpanElement>, id: string) {
    if (busy || id === "index" || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    pointer.current = { id, x: event.clientX, y: event.clientY, active: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function movePointer(event: ReactPointerEvent<HTMLElement>) {
    const current = pointer.current;
    if (!current || busy) return;
    if (!current.active && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 6) return;
    if (!current.active) {
      current.active = true;
      setDragged(current.id);
    }
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    const id = hit instanceof Element ? hit.closest<HTMLElement>("[data-page-id]")?.dataset.pageId : undefined;
    const candidate = id && id !== "index" && id !== current.id ? id : null;
    if (target.current !== candidate) {
      target.current = candidate;
      setDropTarget(candidate);
    }
  }
  function finishDrag() {
    const current = pointer.current;
    const targetId = target.current;
    resetDrag();
    if (current?.active && targetId && current.id !== targetId) {
      onAction("reorder", current.id, targetId);
    }
  }
  function movePage(id: string, direction: "up" | "down") {
    const index = pages.findIndex((page) => page.id === id);
    const adjacent = direction === "up" ? index - 1 : index + 1;
    if (index <= 0 || adjacent <= 0 || adjacent >= pages.length || busy) return;
    onAction("reorder", id, pages[adjacent].id);
  }
  return (
    <aside aria-label={t("studio.pages.navigation")} className="flex h-full w-[246px] shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <div className="flex items-center gap-2 text-xs font-semibold">{t("studio.pages.pages")} <Badge variant="secondary">{t("studio.pages.publicCount", { publicCount: pages.filter(page => page.isPublic).length, totalCount: pages.length })}</Badge></div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" disabled={busy} aria-label={t("studio.pages.createPage")} onClick={() => setCreateOpen(true)}><FilePlus2 /></Button>
          </TooltipTrigger>
          <TooltipContent>{t("studio.pages.createPage")}</TooltipContent>
        </Tooltip>
      </div>
      <Separator />
      <ScrollArea className="min-h-0 flex-1">
        <nav
          className="space-y-1 px-2 py-3" aria-label={t("studio.pages.documentationPages")}
          onPointerMove={movePointer}
          onPointerUp={finishDrag}
          onPointerCancel={resetDrag}
        >
          {pages.map((page, index) => (
            <Fragment key={page.id}>
              {(index === 0 || pages[index - 1].navGroup !== page.navGroup) && (
                <button
                  type="button"
                  aria-expanded={!collapsedGroups.has(page.navGroup)}
                  onClick={() => toggleGroup(page.navGroup)}
                  className="flex w-full items-center gap-2 rounded-md px-2 pb-1 pt-4 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={collapsedGroups.has(page.navGroup) ? t("studio.pages.expandGroup", { group: page.navGroup }) : t("studio.pages.collapseGroup", { group: page.navGroup })}
                >
                  <ChevronDown aria-hidden className={`size-3 shrink-0 transition-transform ${collapsedGroups.has(page.navGroup) ? "-rotate-90" : ""}`} />
                  <span className="min-w-0 flex-1 truncate">{page.navGroup}</span>
                  <span className="text-[10px] font-normal tabular-nums">{pages.filter(item => item.navGroup === page.navGroup).length}</span>
                </button>
              )}
              {!collapsedGroups.has(page.navGroup) && (
                <div>
                  <PageRow page={page} selected={page.id === currentId} disabled={busy}
                    dragged={dragged === page.id} dropTarget={dropTarget === page.id}
                    canMoveUp={index > 1} canMoveDown={index > 0 && index < pages.length - 1}
                    onNavigate={() => onNavigate(page.id)} onAction={onAction}
                    onStartDrag={startDrag} onMove={movePage} />
                </div>
              )}
            </Fragment>
          ))}
        </nav>
      </ScrollArea>
      <div className="border-t border-border p-3 text-[11px] text-muted-foreground">{t("studio.pages.dragHint")}</div>
      <PageTitleDialog key={`create-${createOpen}`} open={createOpen} setOpen={setCreateOpen} mode="create" onSubmit={(title) => onAction("create", undefined, title)} />
    </aside>
  );
}
