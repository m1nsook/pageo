import { useState, type FormEvent } from "react";
import type { Editor } from "@tiptap/core";
import { formatInlineCitation } from "@/lib/inline-citation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bold, Code2, Heading1, Heading2, Italic, Link2, List, ListOrdered } from "lucide-react";
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

function CitationPopover({ editor }: { editor: Editor | null }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [accessed, setAccessed] = useState("");
  const [error, setError] = useState("");

  function insert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    try {
      const markdown = formatInlineCitation(label, url, accessed);
      // Tiptap Markdown already parses standard Markdown on insertion. This
      // stays a normal editable link in the visual editor and the saved file.
      const applied = editor.chain().focus().insertContent(markdown, { contentType: "markdown" }).run();
      if (!applied) throw new Error("Unable to insert this citation into the current text block.");
      setOpen(false);
      setLabel(""); setUrl(""); setAccessed(""); setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" disabled={!editor} className="gap-1.5" aria-label="Insert source citation">
          <Link2 className="size-4" /> Citation
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" className="w-[min(92vw,370px)] p-4">
        <form onSubmit={insert} className="space-y-3">
          <p className="text-sm font-semibold">Insert inline citation</p>
          <p className="text-xs text-muted-foreground">Creates a portable Markdown source link. No proprietary citation format is required.</p>
          <div className="space-y-1"><Label htmlFor="citation-label">Source label</Label>
            <Input id="citation-label" maxLength={140} required value={label} placeholder="Official documentation" onChange={e => setLabel(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="citation-url">HTTPS source</Label>
            <Input id="citation-url" type="url" required value={url} placeholder="https://example.com/docs" onChange={e => setUrl(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="citation-date">Accessed (optional)</Label>
            <Input id="citation-date" type="date" value={accessed} onChange={e => setAccessed(e.target.value)} /></div>
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          <Button type="submit" size="sm" disabled={!editor || !label.trim() || !url.trim()} className="w-full">Insert citation</Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

export function FormatToolbar({ editor }: { editor: Editor | null }) {
  return (
    <div role="toolbar" aria-label="Text formatting" className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-background px-5">
      <FormatButton name="Heading 1" active={editor?.isActive("heading", { level: 1 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 /></FormatButton>
      <FormatButton name="Heading 2" active={editor?.isActive("heading", { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 /></FormatButton>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <FormatButton name="Bold" active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold /></FormatButton>
      <FormatButton name="Italic" active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic /></FormatButton>
      <CitationPopover editor={editor} />
      <Separator orientation="vertical" className="mx-1 h-5" />
      <FormatButton name="Bulleted list" active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()}><List /></FormatButton>
      <FormatButton name="Numbered list" active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered /></FormatButton>
      <FormatButton name="Code block" active={editor?.isActive("codeBlock")} onClick={() => editor?.chain().focus().toggleCodeBlock().run()}><Code2 /></FormatButton>
      <span className="ml-auto hidden whitespace-nowrap text-xs text-muted-foreground lg:block">Visual editor · Markdown files</span>
    </div>
  );
}
