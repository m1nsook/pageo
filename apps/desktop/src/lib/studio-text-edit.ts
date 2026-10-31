/** Paglora-specific context menu for ordinary text fields. Contenteditable,
 * password/file/date inputs and code editors retain their specialized handlers.
 */
export type EditableTarget = HTMLInputElement | HTMLTextAreaElement;
export type TextSelection = { start: number; end: number };

const TEXT_TYPES = new Set(["text", "search", "url", "email", "tel", "number"]);

export function isStudioTextTarget(target: EventTarget | null): target is EditableTarget {
  if (target instanceof HTMLTextAreaElement) return true;
  if (!(target instanceof HTMLInputElement)) return false;
  return TEXT_TYPES.has(target.type) && target.type !== "password";
}

export function canModify(target: EditableTarget) {
  return !target.disabled && !target.readOnly;
}

export function selectedText(target: EditableTarget, selection: TextSelection): string {
  return target.value.slice(selection.start, selection.end);
}

export function restoreTextSelection(target: EditableTarget, selection: TextSelection): void {
  target.focus({ preventScroll: true });
  try {
    target.setSelectionRange(selection.start, selection.end);
  } catch {
    // Some input types do not support selection; caller must not mutate them.
  }
}

/** Prefer the WebView's editor-aware insertion so undo and React change
 * events behave like typing. A native setter fallback still fires input.
 */
export function replaceText(target: EditableTarget, selection: TextSelection, text: string): void {
  if (!canModify(target)) throw new Error("This text field cannot be edited.");
  if (target instanceof HTMLInputElement && target.type === "number") {
    throw new Error("Use the keyboard to edit numeric fields.");
  }
  restoreTextSelection(target, selection);
  if (document.execCommand("insertText", false, text)) return;
  const next = target.value.slice(0, selection.start) + text + target.value.slice(selection.end);
  const prototype = target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (!setter) throw new Error("Text editing is not available.");
  setter.call(target, next);
  target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
  const cursor = selection.start + text.length;
  target.setSelectionRange(cursor, cursor);
}
