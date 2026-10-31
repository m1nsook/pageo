import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const src = new URL("../src/", import.meta.url);
const read = (path) => readFileSync(new URL(path, src), "utf8");

test("Paglora Studio defaults to dark without overwriting saved appearance", () => {
  const app = read("main.tsx");
  assert.match(app, /defaultTheme="dark"/);
  assert.match(app, /storageKey="paglora-color-theme"/);
});

test("the four-tier Studio palette is local to the desktop UI", () => {
  const css = read("index.css");
  for (const color of ["#101014", "#141418", "#1d1d22", "#292930", "#2196f3"]) {
    assert.ok(css.includes(color), `Missing Studio color ${color}`);
  }
  assert.match(css, /--radius: 0\.3rem/);
  assert.doesNotMatch(css, /@import url\(["']?https?:/);
});

test("Studio font and icon roles remain explicit", () => {
  const css = read("index.css");
  for (const font of ["inter", "manrope", "jetbrains-mono"]) {
    assert.ok(css.includes(`@fontsource-variable/${font}`));
  }
  assert.match(read("components/studio/workspace-sidebar.tsx"), /@phosphor-icons\/react/);
  assert.match(read("components/studio/brand-icon.tsx"), /from "simple-icons"/);
  assert.match(read("components/editor/monaco-code-editor.tsx"), /JetBrains Mono Variable/);
});

test("native titlebar follows Studio appearance without disabling decorations", () => {
  const config = JSON.parse(readFileSync(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8"));
  const capabilities = JSON.parse(readFileSync(new URL("../src-tauri/capabilities/default.json", import.meta.url), "utf8"));
  const windowConfig = config.app.windows.find((item) => item.label === "main");
  assert.equal(windowConfig.theme, "Dark");
  assert.notEqual(windowConfig.decorations, false);
  assert.ok(capabilities.permissions.includes("core:window:allow-set-theme"));
  assert.match(read("main.tsx"), /getCurrentWindow\(\)/);
  assert.match(read("main.tsx"), /setTheme\(resolvedTheme === "dark" \? "dark" : "light"\)/);
});
