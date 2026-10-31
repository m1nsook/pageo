/** Paglora Studio keyboard shortcuts are local, versioned user preferences.
 * Never put them inside a documentation project or its .paglora backup.
 */
export const STUDIO_SHORTCUTS_KEY = "paglora-studio-shortcuts-v1";

export const STUDIO_COMMANDS = [
  { id: "find", label: "Find projects or pages", description: "Open the local quick finder" },
  { id: "new-project", label: "New project", description: "Open the creation dialog from the workspace" },
  { id: "projects", label: "All projects", description: "Go to the workspace project list" },
  { id: "settings", label: "Settings", description: "Open Studio preferences from the workspace" },
] as const;

export type StudioCommand = (typeof STUDIO_COMMANDS)[number]["id"];
export type ShortcutBindings = Record<StudioCommand, string>;
export type ShortcutEvent = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey" | "isComposing">;

export const DEFAULT_SHORTCUTS: ShortcutBindings = {
  find: "Mod+f",
  "new-project": "Mod+Shift+n",
  projects: "Mod+Shift+p",
  settings: "Mod+,",
};

const commands = STUDIO_COMMANDS.map(item => item.id);
const keyPattern = /^[a-z0-9,]$/;
const reserved = new Set([
  "Mod+a", "Mod+b", "Mod+c", "Mod+i", "Mod+l", "Mod+o", "Mod+p",
  "Mod+q", "Mod+r", "Mod+s", "Mod+t", "Mod+u", "Mod+v", "Mod+w",
  "Mod+x", "Mod+z", "Mod+Shift+z", "Mod+Shift+r",
]);

export function validShortcut(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parts = value.split("+");
  if (parts[0] !== "Mod") return false;
  const shift = parts.length === 3 && parts[1] === "Shift";
  if (parts.length !== 2 && !shift) return false;
  const key = parts[parts.length - 1];
  return keyPattern.test(key) && !reserved.has(value);
}

/** Normalize a keyboard event; ignore IME, AltGr, editor-only unmodified keys. */
export function shortcutFromEvent(event: ShortcutEvent): string | null {
  if (event.isComposing || event.altKey || (!event.ctrlKey && !event.metaKey)) return null;
  const key = event.key.toLowerCase();
  if (!keyPattern.test(key)) return null;
  return `Mod+${event.shiftKey ? "Shift+" : ""}${key}`;
}

export function commandForEvent(event: ShortcutEvent, bindings: ShortcutBindings): StudioCommand | null {
  const stroke = shortcutFromEvent(event);
  if (!stroke) return null;
  return commands.find(command => bindings[command] === stroke) ?? null;
}

export function shortcutLabel(value: string, isMac = false): string {
  const parts = value.split("+");
  const key = parts[parts.length - 1];
  return [isMac ? "⌘" : "Ctrl", ...(parts.includes("Shift") ? [isMac ? "⇧" : "Shift"] : []), key === "," ? "," : key.toUpperCase()].join(isMac ? " " : "+");
}

export function validateBinding(command: StudioCommand, stroke: string, current: ShortcutBindings): string | null {
  if (!validShortcut(stroke)) return "Use Ctrl/Cmd with a letter, number or comma. Common typing and system commands are reserved.";
  const conflict = commands.find(id => id !== command && current[id] === stroke);
  if (conflict) {
    return `Already assigned to ${STUDIO_COMMANDS.find(item => item.id === conflict)?.label ?? conflict}.`;
  }
  return null;
}

export function normalizeShortcutBindings(source: unknown): ShortcutBindings {
  const next = { ...DEFAULT_SHORTCUTS };
  if (!source || typeof source !== "object" || Array.isArray(source)) return next;
  const data = source as Record<string, unknown>;
  if (data.version !== 1 || !data.bindings || typeof data.bindings !== "object" || Array.isArray(data.bindings)) return next;
  const input = data.bindings as Record<string, unknown>;
  for (const command of commands) {
    const stroke = input[command];
    if (validShortcut(stroke) && !commands.some(other => other !== command && next[other] === stroke)) {
      next[command] = stroke;
    }
  }
  // A changed earlier command can collide with a later persisted value; do
  // a second pass so corrupt preferences can never result in duplicate hotkeys.
  const seen = new Set<string>();
  for (const command of commands) {
    if (seen.has(next[command])) next[command] = DEFAULT_SHORTCUTS[command];
    seen.add(next[command]);
  }
  return next;
}

export function readStudioShortcuts(): ShortcutBindings {
  try {
    return normalizeShortcutBindings(JSON.parse(localStorage.getItem(STUDIO_SHORTCUTS_KEY) || "null"));
  } catch {
    return { ...DEFAULT_SHORTCUTS };
  }
}
