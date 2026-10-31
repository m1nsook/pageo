import { useState, type FormEvent } from "react";
import type { Editor } from "@tiptap/core";
import { BookOpen, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatBibliography, type BibliographySource, type BibliographyStyle } from "@/lib/bibliography";

const empty = (): BibliographySource => ({ author: "", title: "", url: "", year: "", accessed: "" });

export function BibliographyPopover({ editor }: { editor: Editor | null }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<BibliographySource[]>([empty()]);
  const [style, setStyle] = useState<BibliographyStyle>("apa");
  const [error, setError] = useState("");
  const [inserting, setInserting] = useState(false);

  const edit = (index: number, field: keyof BibliographySource, value: string) => {
    setEntries(prev => prev.map((item, n) => n === index ? { ...item, [field]: value } : item));
    setError("");
  };
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || inserting) return;
    setInserting(true);
    try {
      const markdown = formatBibliography(entries, style);
      if (!editor.chain().focus().insertContent(markdown, { contentType: "markdown" }).run())
        throw new Error("Unable to insert references at the cursor.");
      setOpen(false);
      setEntries([empty()]);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setInserting(false);
    }
  }
  return <Popover open={open} onOpenChange={value => { if (!inserting) setOpen(value); }}>
    <PopoverTrigger asChild>
      <Button size="sm" variant="ghost" disabled={!editor} aria-label="Insert reference list">
        <BookOpen className="size-4" /> References
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" className="max-h-[min(76vh,680px)] w-[min(92vw,480px)] overflow-y-auto p-4">
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm font-semibold">Build a References section</p>
        <p className="text-xs text-muted-foreground">Basic APA, MLA or Chicago-style web references. Not a complete academic citation engine. The resulting Markdown remains portable and editable.</p>
        <div className="space-y-1"><Label htmlFor="references-style">Web reference style</Label>
          <Select value={style} onValueChange={value => setStyle(value as BibliographyStyle)}>
            <SelectTrigger id="references-style"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="apa">APA-style (alphabetical)</SelectItem>
              <SelectItem value="mla">MLA-style</SelectItem>
              <SelectItem value="chicago">Chicago-style</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {entries.map((entry, index) => <fieldset key={index} className="space-y-2 rounded-md border border-border p-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Source {index + 1}</span>
            <Button type="button" size="icon-xs" variant="ghost" disabled={entries.length === 1}
              aria-label={"Remove source " + (index + 1)}
              onClick={() => setEntries(current => current.filter((_, n) => n !== index))}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div><Label htmlFor={"bib-author-" + index}>Author / organization</Label>
              <Input id={"bib-author-" + index} required maxLength={120} value={entry.author}
                onChange={e => edit(index, "author", e.target.value)} /></div>
            <div><Label htmlFor={"bib-year-" + index}>Year (optional)</Label>
              <Input id={"bib-year-" + index} inputMode="numeric" maxLength={4} value={entry.year}
                onChange={e => edit(index, "year", e.target.value)} /></div>
          </div>
          <div><Label htmlFor={"bib-title-" + index}>Source title</Label>
            <Input id={"bib-title-" + index} required maxLength={140} value={entry.title}
              onChange={e => edit(index, "title", e.target.value)} /></div>
          <div><Label htmlFor={"bib-url-" + index}>HTTPS link</Label>
            <Input id={"bib-url-" + index} type="url" required maxLength={2048} placeholder="https://example.com/"
              value={entry.url} onChange={e => edit(index, "url", e.target.value)} /></div>
          <div><Label htmlFor={"bib-accessed-" + index}>Accessed (optional)</Label>
            <Input id={"bib-accessed-" + index} type="date" value={entry.accessed}
              onChange={e => edit(index, "accessed", e.target.value)} /></div>
        </fieldset>)}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" size="sm" variant="outline" disabled={entries.length >= 30}
            onClick={() => setEntries(current => [...current, empty()])}><Plus className="size-3.5" /> Add source</Button>
          <Button size="sm" type="submit" disabled={!editor || inserting || !entries.every(item => item.title.trim() && item.url.trim() && item.author.trim())}>
            <BookOpen className="size-3.5" /> Insert references
          </Button>
        </div>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      </form>
    </PopoverContent>
  </Popover>;
}
