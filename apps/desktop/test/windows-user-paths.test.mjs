import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import ts from "typescript";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const js=ts.transpileModule(read("src/lib/windows-path.ts"),{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}
}).outputText;
const {readableLocalPath:human}=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
test("Windows canonical drive prefixes disappear from labels and copy path",()=>{
 assert.equal(human("\\\\?\\C:\\Users\\bttq\\Documents\\PagloraDocs"),"C:\\Users\\bttq\\Documents\\PagloraDocs");
 assert.equal(human("\\\\?\\D:\\Paglora Projects"),"D:\\Paglora Projects");
 assert.equal(human("C:\\Users\\bttq\\Documents\\PagloraDocs"),"C:\\Users\\bttq\\Documents\\PagloraDocs");
});
test("extended UNC shares round-trip to normal UNC; device/non-drive paths stay intact",()=>{
 assert.equal(human("\\\\?\\UNC\\server\\share\\docs"),"\\\\server\\share\\docs");
 assert.equal(human("\\\\server\\share\\docs"),"\\\\server\\share\\docs");
 assert.equal(human("\\\\?\\Volume{abcd}\\docs"),"\\\\?\\Volume{abcd}\\docs");
 assert.equal(human("\\\\.\\PhysicalDrive0"),"\\\\.\\PhysicalDrive0");
 assert.equal(human("/home/user/projects"),"/home/user/projects");
 assert.equal(human(""),"");
});
test("all user-facing local path fields use formatting; native storage commands do not",()=>{
 const s=read("src/components/studio/workspace-content.tsx");
 assert.match(s,/const configuredDisplayPath = readableLocalPath\(storageStatus\?\.configuredPath \|\| location\)/);
 assert.match(s,/navigator\.clipboard\.writeText\(configuredDisplayPath\)/);
 assert.match(s,/const selected = readableLocalPath\(picked\)/);
 assert.match(s,/readableLocalPath\(storageStatus\.previousLocation\)/);
 const app=read("src/App.tsx");
 assert.match(app,/setBackupPath\(displayPath\)/);
 assert.match(read("src/components/editor/site-builder.tsx"),/setOutput\(readableLocalPath\(result\.path\)\)/);
 const native=read("src-tauri/src/storage.rs");
 assert.match(native,/fs::canonicalize\(path\)/);
 assert.doesNotMatch(native,/readableLocalPath/);
});
