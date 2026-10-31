import { useMemo, type ReactNode } from "react";
import type { Layout } from "react-resizable-panels";
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from "@/components/ui/resizable";

const STORE = "paglora-studio-navigation-layout-v1";

export function readNavigationLayout(key: string, hasLeft: boolean, hasRight: boolean): Layout {
  const defaults: Layout = hasLeft && hasRight ? { navigation: 19, content: 61, details: 20 }
    : hasLeft ? { navigation: 22, content: 78 }
    : hasRight ? { content: 76, details: 24 } : { content: 100 };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE + ":" + key) ?? "null") as Record<string, unknown>;
    const keys = Object.keys(defaults);
    if (!saved || keys.length !== Object.keys(saved).length) return defaults;
    if (keys.every(k => typeof saved[k] === "number" && Number.isFinite(saved[k]) && (saved[k] as number) >= (k === "content" ? 35 : 14) && (saved[k] as number) <= (k === "content" ? 100 : 34))
      && Math.abs(keys.reduce((sum, k) => sum + (saved[k] as number), 0) - 100) < 1) return saved as Layout;
  } catch { /* local preferences are optional */ }
  return defaults;
}

/** Independent from the existing source/canvas split, so the saved widths
 * never leak into documentation projects or exported websites.
 */
export function StudioNavigationLayout({ left, center, right, mode }: {
  left?: ReactNode;
  center: ReactNode;
  right?: ReactNode;
  mode: string;
}) {
  // Keep the ProseMirror view mounted when switching Canvas and Edit.
  // The prior mode-specific key forced an editor subtree unmount on each switch.
  const key = `${Boolean(left)}-${Boolean(right)}`;
  const persistenceKey = `${mode}-${key}`;
  const initial = useMemo(() => readNavigationLayout(persistenceKey, Boolean(left), Boolean(right)), [persistenceKey, left, right]);
  return (
    <ResizablePanelGroup key={key} orientation="horizontal" id={`studio-outer-${key}`} defaultLayout={initial}
      className="min-h-0 min-w-0 flex-1"
      onLayoutChanged={layout => {
        try { localStorage.setItem(STORE + ":" + persistenceKey, JSON.stringify(layout)); } catch { /* optional */ }
      }}>
      {left && <>
        <ResizablePanel id="navigation" minSize="14%" maxSize="34%" className="min-h-0 min-w-0 overflow-hidden">{left}</ResizablePanel>
        <ResizableHandle withHandle aria-label="Resize page navigation" />
      </>}
      <ResizablePanel id="content" minSize="35%" className="flex min-h-0 min-w-0 flex-col overflow-hidden">{center}</ResizablePanel>
      {right && <>
        <ResizableHandle withHandle aria-label="Resize page properties or tools" />
        <ResizablePanel id="details" minSize="14%" maxSize="34%" className="min-h-0 min-w-0 overflow-hidden">{right}</ResizablePanel>
      </>}
    </ResizablePanelGroup>
  );
}
