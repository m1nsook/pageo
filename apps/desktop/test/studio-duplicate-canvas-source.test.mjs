import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const code=ts.transpileModule(read("src/lib/canvas-blocks.ts"),{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}
}).outputText;
const {findCanvasSourcePosition,editableCanvasText,replacePlainCanvasText}=await import(
 "data:text/javascript;base64,"+Buffer.from(code).toString("base64")
);
const p=text=>({type:{name:"paragraph"},attrs:{},textContent:text,nodeSize:text.length+2,
  content:{childCount:1},firstChild:{isText:true,marks:[]}});
const h=(text,level=1)=>({...p(text),type:{name:"heading"},attrs:{level}});
function editor(nodes) {
 let changed=null;
 const doc={
  childCount:nodes.length,
  forEach(fn){let offset=0;nodes.forEach((node,index)=>{fn(node,offset,index);offset+=node.nodeSize;});},
  nodeAt(pos){let offset=0;for(const node of nodes){if(offset===pos)return node;offset+=node.nodeSize;}return null;}
 };
 return {state:{doc,tr:{insertText(text,start,end){changed={text,start,end};return changed;}}},
   view:{dispatch(){}},get change(){return changed}};
}
const source=nodes=>nodes.map(node=>({
 tagName:node.type.name==="paragraph"?"p":node.type.name==="heading"?"h"+node.attrs.level:"hr",
 text:node.textContent.replace(/\s+/g," ").trim()
}));
test("duplicate heading/paragraph source targets only align with the complete current page",()=>{
 const nodes=[h("Intro"),p("Same"),p("Same"),p("Last")];
 const e=editor(nodes),renderedOrder=source(nodes);
 const second={pageId:"index",index:2,tagName:"p",text:"Same",renderedOrder};
 assert.equal(findCanvasSourcePosition(e,{...second,renderedOrder:undefined}),null);
 assert.equal(findCanvasSourcePosition(e,second),nodes[0].nodeSize+nodes[1].nodeSize+1);
 assert.equal(editableCanvasText(e,second),true);
 assert.equal(replacePlainCanvasText(e,second,"Changed"),true);
 assert.deepEqual(e.change,{text:"Changed",start:nodes[0].nodeSize+nodes[1].nodeSize+1,
   end:nodes[0].nodeSize+nodes[1].nodeSize+1+nodes[2].nodeSize-2});
});
test("unknown or stale whole-page mapping does not guess the target",()=>{
 const nodes=[h("Intro"),p("Same"),p("Same"),p("End")],e=editor(nodes);
 const order=source(nodes);
 const base={pageId:"index",index:1,tagName:"p",text:"Same",renderedOrder:order};
 assert.equal(findCanvasSourcePosition(e,{...base,renderedOrder:order.slice(0,3)}),null);
 assert.equal(findCanvasSourcePosition(e,{...base,renderedOrder:[...order.slice(0,3),{tagName:"p",text:"Changed"}]}),null);
 assert.equal(findCanvasSourcePosition(e,{...base,index:3}),null);
 assert.equal(findCanvasSourcePosition(e,{...base,renderedOrder:[...order.slice(0,2),{tagName:"h2",text:"Same"},order[3]]}),null);
 assert.equal(replacePlainCanvasText(e,{...base,renderedOrder:[]}, "Oops"),false);
});
test("rich/nested or transformed blocks never use ordinal mapping",()=>{
 const nodes=[h("Heading"),p("Same"),{...p("x"),type:{name:"blockquote"}},p("Same")];
 const e=editor(nodes),order=source(nodes).map((part,index)=>index===2?{tagName:"p",text:"x"}:part);
 const target={pageId:"index",index:3,tagName:"p",text:"Same",renderedOrder:order};
 assert.equal(findCanvasSourcePosition(e,target),null);
 assert.equal(editableCanvasText(e,target),false);
});
test("canvas source signature derives from actual direct article children only",()=>{
 const canvas=read("src/components/editor/inline-site-preview.tsx");
 assert.match(canvas,/function plainRenderedOrder\(article: Element\)/);
 assert.match(canvas,/children\.every\(block =>/);
 assert.match(canvas,/renderedOrder: article \? plainRenderedOrder\(article\) : undefined/);
 assert.match(canvas,/sandbox="allow-same-origin"/);
});
