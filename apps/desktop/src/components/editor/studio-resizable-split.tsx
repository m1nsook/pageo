import { useMemo, type ReactNode } from "react";
import type { Layout } from "react-resizable-panels";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

/** Pure Studio preference: never stored in a documentation project or published site. */
export const STUDIO_SPLIT_LAYOUT_KEY = "paglora-studio-split-layout-v1";
export const DEFAULT_SPLIT_LAYOUT: Layout = { source: "45%", preview: "55%" };

export function readStudioSplitLayout(): Layout {
  try {
    const saved = JSON.parse(localStorage.getItem(STUDIO_SPLIT_LAYOUT_KEY) ?? "null");
    if (saved && typeof saved === "object" && !Array.isArray(saved)) {
      const source = saved.source;
      const preview = saved.preview;
      // Ignore corrupt or dangerously narrow persisted widths.
      const toPercent = (value: unknown): number =>
        typeof value === "number" ? value : typeof value === "string" && /^\d+(?:\.\d+)?%$/.test(value) ? parseFloat(value) : NaN;
      const a = toPercent(source);
      const b = toPercent(preview);
      if (Number.isFinite(a) && Number.isFinite(b) && a >= 25 && b >= 25 && a <= 75 && b <= 75 && Math.abs(a + b - 100) < 2) {
        return { source: `${a}%`, preview: `${b}%` };
      }
    }
  } catch { /* localStorage may be disabled or invalid */ }
  return DEFAULT_SPLIT_LAYOUT;
}

export function StudioResizableSplit({ source, preview, resetToken }: {
  source: ReactNode;
  preview: ReactNode;
  resetToken: number;
}) {
  const savedLayout = useMemo(readStudioSplitLayout, [resetToken]);
  return (
    <ResizablePanelGroup key={resetToken} id="paglora-editor-preview" orientation="horizontal"
      defaultLayout={savedLayout} className="min-h-0 min-w-0 flex-1"
      onLayoutChanged={layout => {
        try { localStorage.setItem(STUDIO_SPLIT_LAYOUT_KEY, JSON.stringify(layout)); }
        catch { /* Workspace remains fully usable without persisted layout. */ }
      }}>
      <ResizablePanel id="source" minSize="25%" className="flex min-h-0 min-w-0 flex-col">
        {source}
      </ResizablePanel>
      <ResizableHandle withHandle className="bg-border/80 hover:bg-primary/50 focus-visible:bg-primary/70" />
      <ResizablePanel id="preview" minSize="25%" className="flex min-h-0 min-w-0 flex-col">
        {preview}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
