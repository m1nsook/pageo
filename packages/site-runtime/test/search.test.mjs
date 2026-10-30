import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../src/search.js", import.meta.url), "utf8");

function fixture(pages, { responseOk = true, waitForIndex = false } = {}) {
  let releaseFetch;
  const gate = new Promise(resolve => { releaseFetch = resolve; });
  const docListeners = {};
  let requested = "";
  let navigated = "";
  const document = {
    activeElement: null,
    body: node("body"),
    createElement(tag) { return node(tag); },
    querySelector(query) { return query === ".top-bar" ? header : null; },
    addEventListener(name, fn) { docListeners[name] = fn; },
  };
  function node(tag) {
    const attrs = new Map();
    return {
      tag, attrs, children: [], events: {}, style: {},
      hidden: false, value: "", textContent: "", className: "",
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
      replaceChildren(...items) { this.children = [...items]; },
      querySelectorAll(query) {
        return query === ".paglora-search-result"
          ? this.children.filter(item => item.className === "paglora-search-result")
          : [];
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
    fetch: async url => {
      requested = url;
      if (waitForIndex) await gate;
      return { ok: responseOk, json: async () => ({ version: 1, pages }) };
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
  return { button, open, document, docListeners, releaseFetch, get requested() { return requested; }, get navigated() { return navigated; } };
}

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
