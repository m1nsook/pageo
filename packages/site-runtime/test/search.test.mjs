import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

// Run after the Bun build: tests exercise the exact browser bundle shipped by Rust.
const source = readFileSync(new URL("../dist/search.js", import.meta.url), "utf8");

function fixture(pages, { responseOk = true, waitForIndex = false, failFirstFetch = false } = {}) {
  let releaseFetch;
  const gate = new Promise(resolve => { releaseFetch = resolve; });
  const docListeners = {};
  let requested = "";
  let requestOptions;
  let navigated = "";
  let fetchCalls = 0;
  const document = {
    activeElement: null,
    body: node("body"),
    createElement(tag) { return node(tag); },
    createTextNode(value) { const text = node("#text"); text.textContent = value; return text; },
    querySelector(query) { return query === ".top-bar" ? header : null; },
    addEventListener(name, fn) { docListeners[name] = fn; },
  };
  function node(tag) {
    const attrs = new Map();
    return {
      tag, attrs, children: [], events: {}, style: {},
      hidden: false, value: "", _text: "", className: "",
      get textContent() { return this._text + this.children.map(child => child.textContent).join(""); },
      set textContent(value) { this._text = String(value); this.children = []; },
      classList: {
        toggle() {},
        add() {}, remove() {},
      },
      setAttribute(key, value) { attrs.set(key, value); },
      removeAttribute(key) { attrs.delete(key); },
      getAttribute(key) { return attrs.get(key); },
      addEventListener(name, fn) { this.events[name] = fn; },
      append(...items) { this.children.push(...items); },
      appendChild(item) { this.children.push(item); },
      replaceChildren(...items) { this._text = ""; this.children = [...items]; },
      querySelectorAll(query) {
        const selectors = query.split(",").map(part => part.trim());
        return this.children.filter(item => selectors.includes("." + item.className));
      },
      focus() { document.activeElement = this; },
      scrollIntoView() {},
    };
  }
  const header = node("header");
  const context = {
    document, window: {
      location: { assign(url) { navigated = url; } },
    },
    fetch: async (url, options) => {
      requested = url;
      requestOptions = options;
      fetchCalls++;
      if (waitForIndex) await gate;
      return { ok: responseOk && (!failFirstFetch || fetchCalls > 1), json: async () => ({ version: 1, pages }) };
    },
  };
  vm.runInNewContext(source, context);
  const button = header.children.find(child => child.className === "paglora-search-trigger");
  async function open() {
    button.events.click();
    // Dialog fetch and parsing use chained microtasks.
    await new Promise(resolve => setImmediate(resolve));
    const backdrop = document.body.children[0];
    const modal = backdrop.children[0];
    const bar = modal.children[0];
    return { backdrop, modal, input: bar.children[0], results: modal.children[1] };
  }
  return { button, open, document, docListeners, releaseFetch, get requested() { return requested; }, get requestOptions() { return requestOptions; }, get navigated() { return navigated; }, get fetchCalls() { return fetchCalls; } };
}

test("search keyboard selection exposes the active result and supports Home/End", async () => {
  const app = fixture([
    { title: "First", url: "first.html", text: "docs" },
    { title: "Second", url: "second.html", text: "docs" },
  ]);
  const { input, results } = await app.open();
  input.value = "docs";
  input.events.input();
  assert.equal(input.attrs.get("aria-controls"), "paglora-search-results");
  assert.equal(input.attrs.get("aria-activedescendant"), results.children[0].id);
  let prevented = 0;
  input.events.keydown({ key: "End", preventDefault() { prevented++; } });
  assert.equal(input.attrs.get("aria-activedescendant"), results.children[1].id);
  input.events.keydown({ key: "Home", preventDefault() { prevented++; } });
  assert.equal(input.attrs.get("aria-activedescendant"), results.children[0].id);
  assert.equal(prevented, 2);
  input.value = "no-match";
  input.events.input();
  assert.equal(input.attrs.has("aria-activedescendant"), false);
});

test("Ctrl+K search fetches only the local static index", async () => {
  const app = fixture([{ title: "Overview", url: "index.html", text: "Welcome to Paglora" }]);
  const { input, results } = await app.open();
  assert.equal(app.requested, "search-index.json");
  input.value = "Paglora";
  input.events.input();
  assert.equal(results.children.length, 1);
  assert.equal(results.children[0].href, "index.html");
  assert.equal(results.children[0].children[0].textContent, "Overview");
});

test("search renders excerpts as plain text and rejects non-local URLs", async () => {
  const app = fixture([
    { title: "<img onerror=alert(1)>", url: "safe.html", text: "<script>alert(1)</script> docs" },
    { title: "Unsafe", url: "javascript:alert(1)", text: "docs" },
  ]);
  const { input, results } = await app.open();
  input.value = "docs";
  input.events.input();
  assert.equal(results.children.length, 1);
  assert.equal(results.children[0].children[0].textContent, "<img onerror=alert(1)>");
  assert.match(results.children[0].children[1].textContent, /<script>/);
});

test("Arrow keys and Enter navigate to a matching local page", async () => {
  const app = fixture([
    { title: "Start", url: "index.html", text: "instructions" },
    { title: "Advanced", url: "advanced.html", text: "instructions" },
  ]);
  const { input } = await app.open();
  input.value = "instructions";
  input.events.input();
  input.events.keydown({ key: "ArrowDown", preventDefault() {} });
  input.events.keydown({ key: "Enter", preventDefault() {} });
  assert.equal(app.navigated, "index.html");
});

test("failed index load shows a non-crashing error message", async () => {
  const app = fixture([], { responseOk: false });
  const { results } = await app.open();
  assert.match(results.children[0].textContent, /could not be loaded/);
});

test("Tab reaches search results and wraps keyboard focus inside the dialog", async () => {
  const app = fixture([{ title: "Guide", url: "guide.html", text: "Keyboard accessible" }]);
  const { backdrop, input, results } = await app.open();
  input.value = "Keyboard";
  input.events.input();
  const link = results.children[0];
  const modal = backdrop.children[0];
  const closeButton = modal.children[0].children[1];
  let prevented = 0;
  input.focus();
  backdrop.events.keydown({ key: "Tab", shiftKey: true, preventDefault() { prevented++; } });
  assert.equal(app.document.activeElement, link);
  backdrop.events.keydown({ key: "Tab", shiftKey: false, preventDefault() { prevented++; } });
  assert.equal(app.document.activeElement, input);
  assert.equal(prevented, 2);
  // The close button remains part of the normal focus order.
  assert.ok(closeButton);
});

test("search preserves loading status while the index is in flight", async () => {
  const app = fixture([{ title: "Guide", url: "guide.html", text: "Paglora documentation" }], { waitForIndex: true });
  const { input, results } = await app.open();
  assert.equal(app.button.attrs.get("aria-expanded"), "true");
  input.value = "Paglora";
  input.events.input();
  assert.match(results.children[0].textContent, /Loading search index/);
  app.releaseFetch();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(results.children[0].href, "guide.html");
});

test("search dialog exposes its state and restores focus on close", async () => {
  const app = fixture([{ title: "Guide", url: "guide.html", text: "Search" }]);
  const { backdrop } = await app.open();
  assert.equal(app.button.attrs.get("aria-haspopup"), "dialog");
  assert.equal(app.button.attrs.get("aria-controls"), "paglora-search-dialog");
  assert.equal(app.button.attrs.get("aria-expanded"), "true");
  app.docListeners.keydown({ key: "Escape", preventDefault() {} });
  assert.equal(backdrop.hidden, true);
  assert.equal(app.button.attrs.get("aria-expanded"), "false");
});

test("IME candidate confirmation does not navigate or close search", async () => {
  const app = fixture([{ title: "Korean", url: "korean.html", text: "한국어 docs" }]);
  const { input, backdrop } = await app.open();
  input.value = "docs";
  input.events.input();
  let prevented = 0;
  input.events.keydown({ key: "Enter", isComposing: true, preventDefault() { prevented++; } });
  input.events.keydown({ key: "Enter", keyCode: 229, preventDefault() { prevented++; } });
  app.docListeners.keydown({ key: "Escape", isComposing: true, preventDefault() { prevented++; } });
  app.docListeners.keydown({ key: "k", ctrlKey: true, keyCode: 229, preventDefault() { prevented++; } });
  assert.equal(app.navigated, "");
  assert.equal(backdrop.hidden, false);
  assert.equal(prevented, 0);
  input.events.keydown({ key: "Enter", isComposing: false, preventDefault() { prevented++; } });
  assert.equal(app.navigated, "korean.html");
  assert.equal(prevented, 1);
});

test("search rejects malformed, oversized and duplicate index entries", async () => {
  const app = fixture([
    null,
    { title: "Guide", url: "guide.html", text: "docs" },
    { title: "Duplicate", url: "guide.html", text: "docs" },
    { title: "Huge", url: "huge.html", text: "docs".repeat(8000) },
    { title: "Long title".repeat(30), url: "long.html", text: "docs" },
    { title: "Unsafe", url: "../private.html", text: "docs" },
  ]);
  const { input, results } = await app.open();
  input.value = "docs";
  input.events.input();
  assert.equal(results.children.length, 1);
  assert.equal(results.children[0].href, "guide.html");
  assert.equal(app.requestOptions.cache, "no-cache");
});


test("exact titles and contiguous phrases outrank scattered body mentions", async () => {
  const app = fixture([
    { title: "Reference", url: "reference.html", text: "A guide with setup and several examples of install" },
    { title: "Setup install", url: "setup.html", text: "Install instructions for a new project" },
    { title: "Other", url: "other.html", text: "setup install details" },
  ]);
  const { input, results } = await app.open();
  input.value = "setup install";
  input.events.input();
  assert.equal(results.children[0].href, "setup.html");
  assert.equal(results.children[1].href, "other.html");
});

test("search snippets align with NFKC compatibility-expanded text", async () => {
  const app = fixture([{ title: "Ligatures", url: "ligatures.html", text: "ﬃ".repeat(100) + " needle appears here" }]);
  const { input, results } = await app.open();
  input.value = "needle";
  input.events.input();
  assert.equal(results.children[0].href, "ligatures.html");
  assert.match(results.children[0].children[1].textContent, /needle appears here/);
});

test("search accepts natural-language punctuation without treating it as part of a term", async () => {
  const app = fixture([
    { title: "Installation", url: "install.html", text: "Install Paglora. Then configure your project!" },
    { title: "Unrelated", url: "other.html", text: "This is about other tools." },
  ]);
  const { input, results } = await app.open();
  input.value = "install, configure?";
  input.events.input();
  assert.equal(results.children.length, 1);
  assert.equal(results.children[0].href, "install.html");
});

test("search preserves punctuation in programming-language terms", async () => {
  const app = fixture([
    { title: "C++", url: "cpp.html", text: "Compile C++ examples" },
    { title: "C#", url: "csharp.html", text: "Compile C# examples" },
  ]);
  const { input, results } = await app.open();
  input.value = "C++";
  input.events.input();
  assert.equal(results.children.length, 1);
  assert.equal(results.children[0].href, "cpp.html");
});

test("a failed search-index fetch can be retried without closing the dialog", async () => {
  const app = fixture([{ title: "Guide", url: "guide.html", text: "Paglora guide" }], { failFirstFetch: true });
  const { input, results } = await app.open();
  assert.match(results.children[0].textContent, /could not be loaded/);
  assert.equal(results.children[1].textContent, "Retry search");
  results.children[1].events.click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.fetchCalls, 2);
  input.value = "Paglora";
  input.events.input();
  assert.equal(results.children[0].href, "guide.html");
});


test("failed index retry stays inside the dialog keyboard focus trap", async () => {
  const app = fixture([], { responseOk: false });
  const { backdrop, input, results } = await app.open();
  const retry = results.children[1];
  assert.equal(retry.className, "paglora-search-retry");
  let prevented = 0;
  input.focus();
  backdrop.events.keydown({ key: "Tab", shiftKey: true, preventDefault() { prevented++; } });
  assert.equal(app.document.activeElement, retry);
  backdrop.events.keydown({ key: "Tab", shiftKey: false, preventDefault() { prevented++; } });
  assert.equal(app.document.activeElement, input);
  assert.equal(prevented, 2);
});

test("MiniSearch supports word prefixes and typo-tolerant fallback", async () => {
  const app = fixture([
    { title: "Installation", url: "install.html", text: "Configure Paglora projects" },
    { title: "Reference", url: "reference.html", text: "A separate guide" },
  ]);
  const { input, results } = await app.open();
  input.value = "instal";
  input.events.input();
  assert.equal(results.children[0].href, "install.html");
  input.value = "instalation";
  input.events.input();
  assert.equal(results.children[0].href, "install.html");
});

test("CJK substring search remains available without word boundaries", async () => {
  const app = fixture([
    { title: "한국어 사용 설명서", url: "korean.html", text: "문서 검색 안내" },
    { title: "Unrelated", url: "other.html", text: "English documentation" },
  ]);
  const { input, results } = await app.open();
  input.value = "사용";
  input.events.input();
  assert.equal(results.children[0].href, "korean.html");
});

test("invalid entries cannot displace the first 500 valid public pages", async () => {
  const invalid = Array.from({ length: 501 }, (_, i) => ({ title: "Unsafe", url: "../" + i, text: "docs" }));
  const app = fixture([...invalid, { title: "Valid", url: "valid.html", text: "docs" }]);
  const { input, results } = await app.open();
  input.value = "docs";
  input.events.input();
  assert.equal(results.children[0].href, "valid.html");
});

test("failed retry restores keyboard focus to the new retry control", async () => {
  const app = fixture([], { responseOk: false });
  const { results } = await app.open();
  const first = results.children[1];
  first.focus();
  first.events.click();
  assert.equal(first.disabled, true);
  assert.equal(first.attrs.get("aria-busy"), "true");
  await new Promise(resolve => setImmediate(resolve));
  assert.notEqual(results.children[1], first);
  assert.equal(app.document.activeElement, results.children[1]);
});

test("successful retry returns keyboard focus to search input", async () => {
  const app = fixture([{ title: "Guide", url: "guide.html", text: "Paglora" }], { failFirstFetch: true });
  const { input, results } = await app.open();
  const retry = results.children[1];
  retry.focus();
  retry.events.click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.document.activeElement, input);
  input.value = "Paglora";
  input.events.input();
  assert.equal(results.children[0].href, "guide.html");
});

test("CJK substring results are included even when MiniSearch finds token matches", async () => {
  const app = fixture([
    { title: "사용 안내", url: "exact.html", text: "사용" },
    { title: "한국어사용법", url: "compound.html", text: "초보자 가이드" },
    { title: "Unrelated", url: "other.html", text: "English documentation" },
  ]);
  const { input, results } = await app.open();
  input.value = "사용";
  input.events.input();
  const urls = results.children.map(item => item.href);
  assert.equal(urls.length, 2);
  assert.ok(urls.includes("exact.html"));
  assert.ok(urls.includes("compound.html"));
  assert.equal(new Set(urls).size, 2, "each page should appear only once");
});


test("search rejects unbounded malformed indexes before indexing", async () => {
  const pages = Array.from({ length: 2001 }, (_, index) => ({
    title: `Page ${index}`, url: `page-${index}.html`, text: "public documentation",
  }));
  const app = fixture(pages);
  const { results } = await app.open();
  assert.match(results.children[0].textContent, /Search index could not be loaded/);
  assert.equal(results.children[1].className, "paglora-search-retry");
});

test("search excerpts preserve matching text after locale case-fold expansion", async () => {
  const app = fixture([
    { title: "Turkish case folding", url: "turkish.html", text: "İ".repeat(120) + " NEEDLE appears here" },
  ]);
  const { input, results } = await app.open();
  input.value = "needle";
  input.events.input();
  assert.equal(results.children[0].href, "turkish.html");
  assert.match(results.children[0].children[1].textContent, /NEEDLE appears here/);
});

test("search highlights exact title and excerpt terms with semantic marks", async () => {
  const app = fixture([{ title: "Install Paglora", url: "install.html", text: "First install Paglora, then configure it." }]);
  const { input, results } = await app.open();
  input.value = "install paglora";
  input.events.input();
  const [title, summary] = results.children[0].children;
  assert.equal(title.textContent, "Install Paglora");
  assert.equal(title.children.filter(child => child.tag === "mark").length, 2);
  assert.equal(summary.children.filter(child => child.tag === "mark").length, 2);
  assert.equal(results.attrs.get("aria-label"), "1 matching documentation page");
});

test("search highlights punctuation-sensitive C++", async () => {
  const app = fixture([
    { title: "C++ Guide", url: "cpp.html", text: "Compile C++ locally" },
    { title: "C# Guide", url: "csharp.html", text: "Compile C# locally" },
  ]);
  const { input, results } = await app.open();
  input.value = "C++";
  input.events.input();
  assert.equal(results.children.length, 1);
  assert.equal(results.children[0].children[0].children.find(child => child.tag === "mark").textContent, "C++");
});

test("search highlights Unicode ligatures and dotted I without losing display text", async () => {
  const app = fixture([{ title: "ﬃ Guide", url: "ligature.html", text: "İstanbul documentation about a needle" }]);
  const { input, results } = await app.open();
  input.value = "ffi";
  input.events.input();
  const title = results.children[0].children[0];
  assert.equal(title.textContent, "ﬃ Guide");
  assert.equal(title.children[0].tag, "mark");
  assert.equal(title.children[0].textContent, "ﬃ");
  input.value = "İstanbul";
  input.events.input();
  const summary = results.children[0].children[1];
  assert.equal(summary.children.find(child => child.tag === "mark")?.textContent, "İstanbul");
});

test("untrusted search text remains text instead of executable HTML", async () => {
  const app = fixture([{ title: "<img onerror=alert(1)> docs", url: "safe.html", text: "<script>alert(1)</script> docs" }]);
  const { input, results } = await app.open();
  input.value = "docs";
  input.events.input();
  const [title, summary] = results.children[0].children;
  assert.ok(title.textContent.includes("<img onerror=alert(1)>"));
  assert.ok(summary.textContent.includes("<script>"));
  assert.ok(title.children.every(child => ["#text", "mark"].includes(child.tag)));
  assert.ok(summary.children.every(child => ["#text", "mark"].includes(child.tag)));
});

test("fuzzy results remain readable when no exact term can be marked", async () => {
  const app = fixture([{ title: "Installation", url: "install.html", text: "Configure the project" }]);
  const { input, results } = await app.open();
  input.value = "instalation";
  input.events.input();
  assert.equal(results.children[0].href, "install.html");
  assert.equal(results.children[0].children[0].textContent, "Installation");
  assert.equal(results.children[0].children[0].children.length, 0);
});
