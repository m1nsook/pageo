import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const read = path => readFileSync(new URL(path, root), "utf8");
const tsSource = read("src/lib/studio-shortcuts.ts");
const javascript = ts.transpileModule(tsSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const shortcuts = await import("data:text/javascript;base64," + Buffer.from(javascript).toString("base64"));

function key(key, opts = {}) {
  return { key, ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, isComposing: false, ...opts };
}

test("default Paglora shortcut registry has no conflicts or reserved bindings", () => {
  const values = Object.values(shortcuts.DEFAULT_SHORTCUTS);
  assert.equal(new Set(values).size, shortcuts.STUDIO_COMMANDS.length);
  for (const [command, stroke] of Object.entries(shortcuts.DEFAULT_SHORTCUTS)) {
    assert.equal(shortcuts.validShortcut(stroke), true, command);
  }
});

test("actual keyboard dispatch respects Windows and macOS modifiers", () => {
  const current = shortcuts.DEFAULT_SHORTCUTS;
  assert.equal(shortcuts.commandForEvent(key("F"), current), "find");
  assert.equal(shortcuts.commandForEvent(key("F", { ctrlKey: false, metaKey: true }), current), "find");
  assert.equal(shortcuts.commandForEvent(key("N", { shiftKey: true }), current), "new-project");
  assert.equal(shortcuts.commandForEvent(key(",", {}), current), "settings");
  assert.equal(shortcuts.commandForEvent(key("f", { isComposing: true }), current), null);
  assert.equal(shortcuts.commandForEvent(key("f", { altKey: true }), current), null);
  assert.equal(shortcuts.commandForEvent(key("f", { ctrlKey: false }), current), null);
});

test("cannot assign editing/browser reserved shortcuts or duplicates", () => {
  assert.equal(shortcuts.validShortcut("Mod+s"), false);
  assert.equal(shortcuts.validShortcut("Mod+p"), false);
  assert.equal(shortcuts.validShortcut("Mod+Shift+z"), false);
  assert.equal(shortcuts.validShortcut("Mod+Alt+f"), false);
  assert.equal(shortcuts.validateBinding("settings", "Mod+f", shortcuts.DEFAULT_SHORTCUTS)?.includes("Find"), true);
  assert.equal(shortcuts.validateBinding("settings", "Mod+Shift+x", shortcuts.DEFAULT_SHORTCUTS), null);
});

test("invalid, obsolete, and duplicated saved preferences fall back safely", () => {
  assert.deepEqual(shortcuts.normalizeShortcutBindings(null), shortcuts.DEFAULT_SHORTCUTS);
  assert.deepEqual(shortcuts.normalizeShortcutBindings({ version: 2, bindings: { find: "Mod+y" } }), shortcuts.DEFAULT_SHORTCUTS);
  const cleaned = shortcuts.normalizeShortcutBindings({ version: 1, bindings: { find: "Mod+Shift+x", settings: "Mod+Shift+x", projects: "Mod+s" } });
  assert.equal(cleaned.find, "Mod+Shift+x");
  assert.equal(cleaned.settings, shortcuts.DEFAULT_SHORTCUTS.settings);
  assert.equal(cleaned.projects, shortcuts.DEFAULT_SHORTCUTS.projects);
  assert.equal(new Set(Object.values(cleaned)).size, shortcuts.STUDIO_COMMANDS.length);
});

test("shortcut recorder and keybinding UI remain connected to Studio", () => {
  const app = read("src/App.tsx");
  assert.match(app, /commandForEvent\(event, shortcuts\)/);
  assert.match(app, /\[data-studio-shortcut-recorder\]/);
  assert.match(app, /STUDIO_SHORTCUTS_KEY/);
  const settings = read("src/components/studio/workspace-content.tsx");
  assert.match(settings, /<StudioShortcutSettings bindings=\{shortcuts\}/);
  assert.match(read("src/components/studio/studio-quick-find.tsx"), /\{shortcut\}/);
});
