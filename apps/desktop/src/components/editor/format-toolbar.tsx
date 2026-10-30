import type { Editor } from "@tiptap/core";
import { Bold, Code2, Heading1, Heading2, Italic, List, ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function FormatButton({ name, active, onClick, children }: {
  name: string; active?: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return <Tooltip>
    <TooltipTrigger asChild>
      <Button type="button" variant="ghost" size="icon-sm" aria-label={name} aria-pressed={Boolean(active)}
        className={cn("shrink-0", active && "bg-accent text-accent-foreground")}
        onMouseDown={(event) => event.preventDefault()} onClick={onClick}>{children}</Button>
    </TooltipTrigger>
    <TooltipContent>{name}</TooltipContent>
  </Tooltip>;
}

export function FormatToolbar({ editor }: { editor: Editor | null }) {
  return (
    <div role="toolbar" aria-label="Text formatting" className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-background px-5">
      <FormatButton name="Heading 1" active={editor?.isActive("heading", { level: 1 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 /></FormatButton>
      <FormatButton name="Heading 2" active={editor?.isActive("heading", { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 /></FormatButton>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <FormatButton name="Bold" active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold /></FormatButton>
      <FormatButton name="Italic" active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic /></FormatButton>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <FormatButton name="Bulleted list" active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()}><List /></FormatButton>
      <FormatButton name="Numbered list" active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered /></FormatButton>
      <FormatButton name="Code block" active={editor?.isActive("codeBlock")} onClick={() => editor?.chain().focus().toggleCodeBlock().run()}><Code2 /></FormatButton>
      <span className="ml-auto hidden whitespace-nowrap text-xs text-muted-foreground lg:block">Visual editor · Markdown files</span>
    </div>
  );
}
