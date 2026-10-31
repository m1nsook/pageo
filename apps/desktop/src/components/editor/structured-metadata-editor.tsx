import { useEffect, useState, type FormEvent } from "react";
import { LoaderCircle, Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { loadSiteSettings, saveSiteSettings, type SiteSettings } from "@/lib/site";
import { updatePageMetadata, type Page } from "@/lib/pages";

const validTitle=(value:string)=>Boolean(value.trim() && [...value.trim()].length<=100 &&
  !/[\x00-\x1f\x7f]/.test(value));
const validGroup=(value:string)=>value.length>0 && value===value.trim() &&
  [...value].length<=60 && !/[\x00-\x1f\x7f]/.test(value);

type Props = {
  file: "site.json" | "pages.json";
  projectId: string;
  pages: Page[];
  onBeforeSave: () => Promise<void>;
  onPageSaved: (page: Page) => Promise<void>;
  onSiteSaved: () => Promise<void>;
};

/** JSON remains an inspect-only representation. Only existing typed Tauri
 * commands can change the manifest, avoiding arbitrary schema/path writes.
 */
export function StructuredMetadataEditor({file,projectId,pages,onBeforeSave,onPageSaved,onSiteSaved}: Props) {
  const [selectedId,setSelectedId]=useState(pages[0]?.id??"index");
  const page=pages.find(p=>p.id===selectedId)??pages[0];
  const [draftPage,setDraftPage]=useState<Page|null>(page??null);
  const [site,setSite]=useState<SiteSettings|null>(null);
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");

  useEffect(()=>{
    setDraftPage(page?{...page}:null);
  },[page?.id,page?.title,page?.layout,page?.navGroup,page?.isPublic]);
  useEffect(()=>{
    if(file!=="site.json")return;
    let alive=true;
    setLoading(true);
    void loadSiteSettings(projectId).then(result=>{if(alive)setSite(result);})
      .catch(cause=>{if(alive)setError(String(cause));})
      .finally(()=>{if(alive)setLoading(false);});
    return ()=>{alive=false;};
  },[file,projectId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(saving||loading)return;
    setError("");setSuccess("");
    if(file==="pages.json") {
      if(!draftPage||!page || !validTitle(draftPage.title) || !validGroup(draftPage.navGroup) ||
         (draftPage.id==="index" && !draftPage.isPublic)){
        setError("Page title, navigation group, or public home page is invalid.");return;
      }
    } else if(!site || !validTitle(site.title) ||
      [...site.description].length>240 || [...site.footerText].length>240) {
      setError("Site title or description is invalid.");return;
    }
    setSaving(true);
    try{
      await onBeforeSave();
      if(file==="pages.json" && draftPage){
        const updated=await updatePageMetadata(projectId,draftPage);
        await onPageSaved(updated);
        setDraftPage(updated);
      } else if(file==="site.json" && site){
        // Refresh the full settings object to preserve future schema fields
        // that this small structured form does not expose.
        const saved=await loadSiteSettings(projectId);
        await saveSiteSettings(projectId,{
          ...saved,
          title:site.title.trim(),description:site.description,
          footerText:site.footerText,siteUrl:site.siteUrl,
        });
        await onSiteSaved();
      }
      setSuccess("Saved and validated. The JSON view and website preview were updated.");
    }catch(cause){setError(cause instanceof Error?cause.message:String(cause));}
    finally{setSaving(false);}
  }
  return <form onSubmit={event=>void submit(event)} data-structured-metadata
    className="max-h-64 shrink-0 space-y-2 overflow-y-auto border-t border-border bg-card/60 px-3 py-2">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold"><ShieldCheck className="size-3.5 text-primary" />
        Structured {file==="pages.json"?"page":"site"} metadata
      </p>
      <Button type="submit" size="sm" disabled={saving||loading||!((file==="pages.json"&&draftPage)||(file==="site.json"&&site))}>
        {saving?<LoaderCircle className="size-3.5 animate-spin"/>:<Save className="size-3.5"/>} Apply metadata
      </Button>
    </div>
    <p className="text-[11px] text-muted-foreground">Edit supported fields only. Source JSON stays read-only; validation and writes happen in Rust.</p>
    {file==="pages.json" && draftPage && <>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="source-metadata-page">Page</Label>
          <Select value={selectedId} onValueChange={value=>{setSelectedId(value);setError("");setSuccess("");}}>
            <SelectTrigger id="source-metadata-page" size="sm"><SelectValue /></SelectTrigger>
            <SelectContent>{pages.map(item=><SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="source-metadata-title">Page title</Label>
          <Input id="source-metadata-title" className="h-8" maxLength={100} value={draftPage.title}
            onChange={e=>setDraftPage(old=>old?{...old,title:e.target.value}:old)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="source-metadata-group">Navigation group</Label>
          <Input id="source-metadata-group" className="h-8" maxLength={60} value={draftPage.navGroup}
            onChange={e=>setDraftPage(old=>old?{...old,navGroup:e.target.value}:old)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="source-metadata-layout">Page layout</Label>
          <Select value={draftPage.layout} onValueChange={value=>setDraftPage(old=>old?{...old,layout:value as Page["layout"]}:old)}>
            <SelectTrigger id="source-metadata-layout" size="sm"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="docs">Documentation</SelectItem><SelectItem value="wide">Wide</SelectItem><SelectItem value="landing">Landing</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
      <Label className="flex cursor-pointer items-center gap-2 text-xs">
        <Checkbox checked={draftPage.isPublic} disabled={draftPage.id==="index"}
          onCheckedChange={value=>setDraftPage(old=>old?{...old,isPublic:value===true}:old)}/>
        Published page {draftPage.id==="index"?"(Overview must stay public)":""}
      </Label>
    </>}
    {file==="site.json" && (loading?<p className="text-xs text-muted-foreground">Loading site settings…</p>:site&&
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1"><Label htmlFor="source-site-title">Site title</Label>
          <Input id="source-site-title" className="h-8" maxLength={100} value={site.title}
            onChange={e=>setSite(old=>old?{...old,title:e.target.value}:old)}/></div>
        <div className="space-y-1"><Label htmlFor="source-site-description">SEO description</Label>
          <Input id="source-site-description" className="h-8" maxLength={240} value={site.description}
            onChange={e=>setSite(old=>old?{...old,description:e.target.value}:old)}/></div>
        <div className="space-y-1"><Label htmlFor="source-site-url">Canonical HTTPS root</Label>
          <Input id="source-site-url" className="h-8" maxLength={240} placeholder="https://docs.example.com/"
            value={site.siteUrl} onChange={e=>setSite(old=>old?{...old,siteUrl:e.target.value}:old)}/></div>
        <div className="space-y-1"><Label htmlFor="source-site-footer">Footer text</Label>
          <Input id="source-site-footer" className="h-8" maxLength={240} value={site.footerText}
            onChange={e=>setSite(old=>old?{...old,footerText:e.target.value}:old)}/></div>
      </div>)}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    {success && <p role="status" className="text-xs text-muted-foreground">{success}</p>}
  </form>;
}
