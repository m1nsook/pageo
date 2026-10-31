import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const compiled = ts.transpileModule(read("src/lib/backup-task.ts"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { createBackupTaskCoordinator, backupTaskMessage } =
  await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test("backup import exposes real read, native import and refresh stages without fake percentages", async () => {
  const events = [];
  const coordinator = createBackupTaskCoordinator(task => events.push(task ? { ...task } : null));
  const native = deferred();
  const first = coordinator.run({ kind: "import", phase: "reading", label: "my docs.paglora" }, async report => {
    report("restoring");
    await native.promise;
    report("refreshing");
    return "project-42";
  });
  assert.equal(coordinator.active?.phase, "restoring");
  let duplicateRan = false;
  assert.deepEqual(await coordinator.run({ kind: "export", phase: "writing", label: "Other" }, async () => {
    duplicateRan = true;
  }), { started: false });
  assert.equal(duplicateRan, false);
  native.resolve();
  assert.deepEqual(await first, { started: true, value: "project-42" });
  assert.deepEqual(events.map(task => task?.phase ?? null), ["reading", "restoring", "refreshing", null]);
  assert.equal(coordinator.active, null);
  assert.match(backupTaskMessage(events[1]), /Validating and importing/);
  assert.match(backupTaskMessage(events[2]), /Refreshing/);
});

test("a rejected native operation releases the lock and allows a later retry", async () => {
  const events = [];
  const coordinator = createBackupTaskCoordinator(task => events.push(task));
  await assert.rejects(coordinator.run({ kind: "export", phase: "writing", label: "Docs" }, async () => {
    throw new Error("disk full");
  }), /disk full/);
  assert.equal(coordinator.active, null);
  assert.deepEqual(await coordinator.run({ kind: "export", phase: "writing", label: "Docs" }, async () => "/backup.paglora"),
    { started: true, value: "/backup.paglora" });
  assert.equal(events.filter(Boolean).length, 2);
  assert.match(backupTaskMessage({ kind: "export", phase: "writing", label: "Docs" }), /Saving portable backup/);
});

test("workspace connects backup stages to real file reads, Rust calls and strict refresh", () => {
  const app = read("src/App.tsx");
  const dashboard = read("src/components/studio/workspace-content.tsx");
  assert.match(app, /await file\.arrayBuffer\(\)/);
  assert.match(app, /setPhase\("restoring"\)/);
  assert.match(app, /await importProjectBackup\(archive\)/);
  assert.match(app, /setPhase\("refreshing"\)/);
  assert.match(app, /await refresh\(true\)/);
  assert.match(app, /if \(strict\) throw cause/);
  assert.match(app, /if \(importedId\)/);
  assert.match(app, /backupCoordinator\.current\?\.active/);
  assert.match(dashboard, /backupTaskMessage\(backupTask\)/);
  assert.match(dashboard, /role="status" aria-live="polite"/);
  assert.match(dashboard, /disabled=\{!desktop \|\| backupTask !== null\}/);
  assert.match(dashboard, /disabled=\{backupBusy\}/);
});
