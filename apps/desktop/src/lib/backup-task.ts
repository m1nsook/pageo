/** Honest, indeterminate status for offline backup operations.
 * The coordinator locks synchronously, before React's next render.
 * No simulated percentages or cancellation of in-flight native writes.
 */
export type BackupTask =
  | { kind: "import"; phase: "reading" | "restoring" | "refreshing"; label: string }
  | { kind: "export"; phase: "writing"; label: string };

export function backupTaskMessage(task: BackupTask): string {
  if (task.kind === "export") return `Saving portable backup for “${task.label}”…`;
  if (task.phase === "reading") return `Reading “${task.label}” from this computer…`;
  if (task.phase === "restoring") return `Validating and importing “${task.label}” locally…`;
  return "Refreshing the local project list…";
}

export function createBackupTaskCoordinator(onChange: (task: BackupTask | null) => void) {
  let active: BackupTask | null = null;
  return {
    get active(): BackupTask | null { return active; },
    async run<T>(
      initial: BackupTask,
      work: (setPhase: (phase: BackupTask["phase"]) => void) => Promise<T>,
    ): Promise<{ started: true; value: T } | { started: false }> {
      if (active) return { started: false };
      active = initial;
      onChange(active);
      const setPhase = (phase: BackupTask["phase"]) => {
        if (!active) return;
        // Only report actual supported phases for the current operation.
        if (active.kind === "export" && phase !== "writing") return;
        if (active.kind === "import" && !["reading", "restoring", "refreshing"].includes(phase)) return;
        active = { ...active, phase } as BackupTask;
        onChange(active);
      };
      try {
        return { started: true, value: await work(setPhase) };
      } finally {
        active = null;
        onChange(null);
      }
    },
  };
}
