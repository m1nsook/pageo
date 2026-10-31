import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import test from "node:test";

const tool = fileURLToPath(new URL("../render.mjs", import.meta.url));
function makeProject(folder, language="en") {
  mkdirSync(join(folder,"docs"),{recursive:true});
  writeFileSync(join(folder,"paglora.json"),JSON.stringify({formatVersion:1,id:"sample",name:"Example Docs",createdAt:1,updatedAt:1}));
  writeFileSync(join(folder,"pages.json"),JSON.stringify({formatVersion:1,pages:[
    {id:"index",title:"Welcome",isPublic:true,layout:"docs",navGroup:"Guide"},
    {id:"draft",title:"Private",isPublic:false,layout:"docs",navGroup:"Guide"}
  ]}));
  writeFileSync(join(folder,"site.json"),JSON.stringify({title:"Docs",language}));
  writeFileSync(join(folder,"docs","index.md"),[
    "# Welcome","",
    "## Installation","",
    "> [!NOTE]","> Read the documentation.","",
    "> [!CARD] Getting started","> [Open guide](installation.md)","",
    "> [!CARD] Community translations","> [Translation hub](https://github.com/m1nsook/paglora-lang)","",
    "<script>alert('xss')</script>","",
    "[bad link](javascript:alert(1))","",
    "![logo](assets/logo.png)",""
  ].join("\n"));
  writeFileSync(join(folder,"docs","draft.md"),"# Private secret\n\nNever export this page");
}
test("headless prepares sanitized public Markdown and native components",()=>{
  const temp=mkdtempSync(join(tmpdir(),"paglora-headless-")),folder=join(temp,"sample"),out=join(temp,"rendered.json");
  try {
    makeProject(folder);
    execFileSync(process.execPath,[tool,folder,out],{encoding:"utf8"});
    const pages=JSON.parse(readFileSync(out,"utf8"));
    assert.equal(pages.length,1);
    const {html,toc,searchText}=pages[0];
    assert.match(html,/paglora-callout-note/);
    assert.match(html,/paglora-card-grid/);
    assert.match(html,/href="installation\.html"/);
    assert.match(html,/src="assets\/logo.png"/);
    assert.doesNotMatch(html,/<script|javascript:|onclick=/i);
    assert.doesNotMatch(searchText,/Never export/);
    assert.equal(toc[0].id,"installation");
  }finally{rmSync(temp,{recursive:true,force:true});}
});
test("rejects invalid public page manifest before writing output",()=>{
  const temp=mkdtempSync(join(tmpdir(),"paglora-headless-bad-")),folder=join(temp,"sample"),out=join(temp,"rendered.json");
  try {
    makeProject(folder,"ko");
    execFileSync(process.execPath,[tool,folder,out],{encoding:"utf8"});
    writeFileSync(join(folder,"pages.json"),JSON.stringify({formatVersion:1,pages:[]}));
    assert.throws(()=>execFileSync(process.execPath,[tool,folder,out],{stdio:"pipe"}));
  }finally{rmSync(temp,{recursive:true,force:true});}
});

test("headless exports first-party nested tabs and code groups instead of plain quotes",()=>{
 const temp=mkdtempSync(join(tmpdir(),"paglora-headless-tabs-")),folder=join(temp,"sample"),out=join(temp,"rendered.json");
 try {
   makeProject(folder);
   const fence=String.fromCharCode(96).repeat(3);
   const md=[
     "# Components","",
     "> [!TABS] Platforms",">",
     "> > [!TAB] Windows","> >","> > Download the Windows installer.",">",
     "> > [!TAB] Linux","> >","> > Linux instructions.","",
     "> [!CODEGROUP] API examples",">",
     "> "+fence+"js","> console.log('hello')","> "+fence,">",
     "> "+fence+"json",'> {"ready":true}',"> "+fence,
   ].join("\n");
   writeFileSync(join(folder,"docs","index.md"),md);
   execFileSync(process.execPath,[tool,folder,out],{encoding:"utf8"});
   const html=JSON.parse(readFileSync(out,"utf8"))[0].html;
   assert.match(html,/paglora-tabs-panels/);
   assert.match(html,/paglora-tabs-item/);
   assert.match(html,/paglora-code-group-panels/);
   assert.match(html,/paglora-code-group-item/);
   assert.match(html,/Windows installer/);
   assert.match(html,/console\.log/);
   assert.doesNotMatch(html,/<blockquote>\s*<p>\[!(?:TABS|CODEGROUP)/);
 }finally{rmSync(temp,{recursive:true,force:true});}
});
