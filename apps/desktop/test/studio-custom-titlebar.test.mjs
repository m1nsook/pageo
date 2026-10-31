import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const read = path => readFileSync(new URL(path, root), "utf8");
const config = JSON.parse(read("src-tauri/tauri.conf.json"));
const caps = JSON.parse(read("src-tauri/capabilities/default.json"));

test("the main Tauri window is actually frameless and remains resizable", () => {
  const main = config.app.windows.find(item => item.label === "main");
  assert.equal(main.decorations, false);
  assert.equal(main.resizable ?? true, true);
  assert.ok(main.minWidth >= 560 && main.minHeight >= 400);
  assert.equal(config.app.windows.length, 1);
});

test("minimal window permissions cover only necessary native control actions", () => {
  for (const permission of ["core:window:allow-minimize","core:window:allow-toggle-maximize",
    "core:window:allow-close","core:window:allow-is-maximized","core:window:allow-start-dragging"]) {
    assert.ok(caps.permissions.includes(permission), permission);
  }
  assert.ok(!caps.permissions.includes("core:window:allow-set-decorations"));
  assert.ok(!caps.permissions.includes("core:window:allow-set-resizable"));
});

test("the titlebar is always mounted above the workspace and adjusts fixed sidebar geometry", () => {
  const app = read("src/App.tsx");
  const css = read("src/index.css");
  assert.match(app, /<StudioTitlebar activeProject=\{active\?\.project\.name\}/);
  assert.ok(app.indexOf("<StudioTitlebar") < app.indexOf("<SidebarProvider"));
  assert.match(app, /className="min-h-0 min-w-0 flex-1 overflow-hidden" defaultOpen/);
  assert.match(css, /\[data-paglora-desktop-shell\] \[data-slot="sidebar-container"\]/);
  assert.match(css, /height: calc\(100svh - 42px\)/);
});

test("drag regions exclude native window controls and keyboard labels remain accessible", () => {
  const title = read("src/components/studio/studio-titlebar.tsx");
  assert.match(title, /data-tauri-drag-region/);
  assert.match(title, /onDoubleClick=\{doubleClickDragRegion\}/);
  assert.match(title, /appWindow\.onResized/);
  assert.match(title, /appWindow\.isMaximized/);
  for (const method of ["minimize", "toggleMaximize", "close"]) assert.ok(title.includes("appWindow."+method+"()"));
  for (const label of ["Minimize window", "Maximize window", "Restore window", "Close Paglora"]) {
    assert.ok(title.includes(label));
  }
  assert.match(read("src/index.css"), /app-region: no-drag/);
});

test("titlebar theme is Studio-owned and exports never receive desktop chrome", () => {
  const title = read("src/components/studio/studio-titlebar.tsx");
  assert.match(title, /bg-\[var\(--studio-surface-0\)\]/);
  assert.match(read("src/main.tsx"), /setTheme\(resolvedTheme === "dark" \? "dark" : "light"\)/);
  assert.doesNotMatch(read("../../tools/headless/render.mjs"), /paglora-titlebar/);
});
