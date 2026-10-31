import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { deleteBlock, duplicateBlock, moveBlock } from "@/lib/block-operations";
import { ArrowDown, ArrowUp, Copy, GripVertical, ListTree, Redo2, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type BlockRow = { index: number; offset: number; size: number; label: string; type: string };
type Drag = { index: number; x: number; y: number; active: boolean };

function labelBlock(node: ProseMirrorNode): string {
  const name = node.type.name === "heading"
    ? `H${node.attrs.level ?? 1}`
    : node.type.name === "horizontalRule"
    ? "Divider"
    : node.type.name === "codeBlock"
    ? "Code"
    : node.type.name === "blockquote"
    ? "Quote"
    : node.type.name === "bulletList"
    ? "Bullets"
    : node.type.name === "orderedList"
    ? "Numbered"
    : "Text";
  const text = node.textContent.trim().replace(/\s+/g, " ").slice(0, 56);
  return text ? `${name} · ${text}` : name;
}

export function BlockOutline({ editor, disabled }: { editor: Editor | null; disabled: boolean }) {
  const [revision, setRevision] = useState(0);
  const [dragged, setDragged] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const pointer = useRef<Drag | null>(null);
  const target = useRef<number | null>(null);

  useEffect(() => {
    if (!editor) return;
    const refresh = () => setRevision(value => value + 1);
    editor.on("update", refresh);
    editor.on("selectionUpdate", refresh);
    return () => {
      editor.off("update", refresh);
      editor.off("selectionUpdate", refresh);
    };
  }, [editor]);

  const rows = useMemo<BlockRow[]>(() => {
    const blocks: BlockRow[] = [];
    editor?.state.doc.forEach((node, offset, index) => {
      blocks.push({ index, offset, size: node.nodeSize, label: labelBlock(node), type: node.type.name });
    });
    return blocks;
    // revision is an intentional subscription token for Tiptap state updates.
  }, [editor, revision]);

  const selection = editor?.state.selection.from ?? -1;
  const activeIndex = rows.find(row => selection >= row.offset && selection < row.offset + row.size)?.index;

  function clearDrag() {
    pointer.current = null;
    target.current = null;
    setDragged(null);
    setHovered(null);
  }
  function start(event: ReactPointerEvent<HTMLSpanElement>, index: number) {
    if (disabled || !editor || event.button !== 0 || rows.length < 2) return;
    event.preventDefault();
    pointer.current = { index, x: event.clientX, y: event.clientY, active: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: ReactPointerEvent<HTMLElement>) {
    const state = pointer.current;
    if (!state) return;
    if (!state.active && Math.hypot(event.clientX - state.x, event.clientY - state.y) < 6) return;
    if (!state.active) {
      state.active = true;
      setDragged(state.index);
    }
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    const raw = hit instanceof Element ? hit.closest<HTMLElement>("[data-outline-index]")?.dataset.outlineIndex : undefined;
    const value = raw !== undefined ? Number(raw) : null;
    const next = value !== null && Number.isInteger(value) && value !== state.index ? value : null;
    if (target.current !== next) {
      target.current = next;
      setHovered(next);
    }
  }
  function end() {
    const active = pointer.current;
    const destination = target.current;
    clearDrag();
    if (!disabled && editor && active?.active && destination !== null) moveBlock(editor, active.index, destination);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">Select, reorder, duplicate or delete Markdown blocks. Drag the grip, use the buttons or press Alt+↑/↓ on a row. Undo restores changes; edits autosave.</p>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-1 px-2 pb-4" onPointerMove={move} onPointerUp={end} onPointerCancel={clearDrag}>
          {!editor && <p className="p-3 text-xs text-muted-foreground">Loading editor...</p>}
          {rows.map(row => (
            <div
              key={row.index}
              data-outline-index={row.index}
              onKeyDown={(event) => {
                if (disabled || !editor || !event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing) return;
                if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                event.preventDefault();
                event.stopPropagation();
                moveBlock(editor, row.index, row.index + (event.key === "ArrowUp" ? -1 : 1));
              }}
              className={cn(
                "group flex min-w-0 items-center gap-1 rounded-lg p-1 transition-colors duration-150",
                activeIndex === row.index ? "bg-accent" : "hover:bg-muted",
                dragged === row.index && "opacity-50",
                hovered === row.index && "bg-primary/10 ring-2 ring-primary/60",
              )}
            >
              <span
                onPointerDown={(event) => start(event, row.index)}
                aria-label={`Drag block ${row.index + 1}`}
                title="Hold and drag to move block"
                className="flex size-6 shrink-0 cursor-grab touch-none select-none items-center justify-center text-muted-foreground/50 active:cursor-grabbing"
              ><GripVertical className="size-3.5" /></span>
              <button type="button" disabled={disabled}
                className="min-w-0 flex-1 truncate rounded-md py-1 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title={row.label}
                aria-current={activeIndex === row.index ? "true" : undefined}
                onClick={() => editor?.chain().focus().setTextSelection(Math.min(row.offset + 1, editor.state.doc.content.size)).run()}>
                {row.label}
              </button>
              <Button type="button" variant="ghost" size="icon-xs" aria-label={`Move block ${row.index + 1} up`}
                disabled={disabled || !editor || row.index === 0} onClick={() => editor && moveBlock(editor, row.index, row.index - 1)}>
                <ArrowUp />
              </Button>
              <Button type="button" variant="ghost" size="icon-xs" aria-label={`Move block ${row.index + 1} down`}
                disabled={disabled || !editor || row.index === rows.length - 1} onClick={() => editor && moveBlock(editor, row.index, row.index + 1)}>
                <ArrowDown />
              </Button>
              <Button type="button" variant="ghost" size="icon-xs" aria-label={`Duplicate block ${row.index + 1}`}
                title="Duplicate block" disabled={disabled || !editor}
                onClick={() => editor && duplicateBlock(editor, row.index)}>
                <Copy />
              </Button>
              <Button type="button" variant="ghost" size="icon-xs" aria-label={`Delete block ${row.index + 1}`}
                title="Delete block (Undo to restore)" disabled={disabled || !editor}
                onClick={() => editor && deleteBlock(editor, row.index)}>
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="flex items-center gap-1 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        <ListTree className="size-3.5 shrink-0" />
        <span className="mr-auto">{rows.length} blocks</span>
        <Button type="button" variant="ghost" size="icon-xs" aria-label="Undo editor change"
          title="Undo" disabled={disabled || !editor?.can().undo()}
          onClick={() => editor?.chain().undo().run()}><Undo2 /></Button>
        <Button type="button" variant="ghost" size="icon-xs" aria-label="Redo editor change"
          title="Redo" disabled={disabled || !editor?.can().redo()}
          onClick={() => editor?.chain().redo().run()}><Redo2 /></Button>
      </div>
    </div>
  );
}
