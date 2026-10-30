import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const bundle = filename => readFileSync(new URL("../dist/" + filename, import.meta.url), "utf8");
test("bundler produces standalone, compact browser scripts", () => {
  for (const file of ["index.js", "search.js"]) {
    const source = bundle(file);
    assert.ok(source.length > 50);
    assert.ok(Buffer.byteLength(source) <= 65_536, file + " exceeds size budget");
    assert.doesNotThrow(() => new vm.Script(source, { filename: file }));
    assert.doesNotMatch(source, /(?:import\s+.*from\s+|require\s*\()/);
  }
});
test("bundled site runtime activates without external libraries", () => {
  const appended = [];
  const context = {
    document: {
      documentElement: {dataset:{colorMode:"system"}},
      querySelector(selector) {return selector === ".top-bar" ? {appendChild(n){appended.push(n)}} : null;},
      createElement() {return {setAttribute(){},addEventListener(){},textContent:""};},
    },
    URL, location:{href:"https://docs.example.test/index.html"},
    localStorage:{getItem(){return null},setItem(){}},
  };
  vm.runInNewContext(bundle("index.js"),context);
  assert.equal(appended.length,1);
  assert.match(appended[0].textContent,/System/);
});
