import { useEffect, useState, type FormEvent } from "react";
import { Copy, Ellipsis, FilePlus2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Page } from "@/lib/pages";

type Action = "create" | "rename" | "duplicate" | "delete";
type Modify = (action: Action, id?: string, title?: string) => void;

export function NewPageDialog({ disabled, onModify }: { disabled: boolean; onModify: Modify }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  useEffect(() => { if (!open) setName(""); }, [open]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || disabled) return;
    onModify("create", undefined, name.trim());
    setOpen(false);
  }
  return <>
    <Button variant="ghost" size="icon" aria-label="Create page" title="Create page" onClick={() => setOpen(true)} disabled={disabled} className="text-indigo-600"><FilePlus2 size={16}/></Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogTitle>Create a page</DialogTitle>
        <DialogDescription>Add a new Markdown page to your documentation.</DialogDescription>
        <form className="mt-5 space-y-4" onSubmit={submit}>
          <label className="block space-y-2"><span className="text-sm font-medium text-zinc-700">Page title</span>
            <Input autoFocus value={name} maxLength={100} onChange={e => setName(e.target.value)} placeholder="e.g. Getting started" required/>
          </label>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={!name.trim()}>Create page</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}

export function PageActions({ page, disabled, onModify }: { page: Page; disabled: boolean; onModify: Modify }) {
  const [menu, setMenu] = useState(false);
  const [rename, setRename] = useState(false);
  const [remove, setRemove] = useState(false);
  const [name, setName] = useState(page.title);
  useEffect(() => { if (rename) setName(page.title); }, [rename, page.title]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || disabled) return;
    onModify("rename", page.id, name.trim());
    setRename(false);
  }
  return <>
    <Button type="button" size="icon" variant="ghost" aria-label={`More actions for ${page.title}`} title="Page actions" disabled={disabled} onClick={() => setMenu(true)} className="size-7 text-zinc-400 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"><Ellipsis size={16}/></Button>
    <Dialog open={menu} onOpenChange={setMenu}>
      <DialogContent className="max-w-sm">
        <DialogTitle>{page.title}</DialogTitle>
        <DialogDescription>Choose what to do with this page.</DialogDescription>
        <div className="mt-5 grid gap-2">
          <Button variant="outline" className="justify-start" onClick={() => { setMenu(false); setRename(true); }}><Pencil/> Rename page</Button>
          <Button variant="outline" className="justify-start" onClick={() => { setMenu(false); onModify("duplicate", page.id); }}><Copy/> Duplicate page</Button>
          {page.id !== "index" && <Button variant="outline" className="justify-start text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => { setMenu(false); setRemove(true); }}><Trash2/> Delete page</Button>}
        </div>
      </DialogContent>
    </Dialog>
    <Dialog open={rename} onOpenChange={setRename}>
      <DialogContent>
        <DialogTitle>Rename page</DialogTitle>
        <DialogDescription>The page file keeps its current identifier so links remain stable.</DialogDescription>
        <form className="mt-5 space-y-4" onSubmit={submit}>
          <label className="block space-y-2"><span className="text-sm font-medium text-zinc-700">Page title</span>
            <Input autoFocus value={name} maxLength={100} onChange={e => setName(e.target.value)} required/>
          </label>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setRename(false)}>Cancel</Button><Button type="submit" disabled={!name.trim()}>Save changes</Button></div>
        </form>
      </DialogContent>
    </Dialog>
    <Dialog open={remove} onOpenChange={setRemove}>
      <DialogContent>
        <DialogTitle>Delete “{page.title}”?</DialogTitle>
        <DialogDescription>The page will be removed from navigation. Its Markdown file will be kept in the project's local .trash folder.</DialogDescription>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setRemove(false)}>Cancel</Button>
          <Button variant="destructive" onClick={() => { setRemove(false); onModify("delete", page.id); }}><Trash2/> Delete page</Button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
