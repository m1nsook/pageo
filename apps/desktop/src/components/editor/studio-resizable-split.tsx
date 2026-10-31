import { useMemo, type ReactNode } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { readStudioSplitLayout, STUDIO_SPLIT_LAYOUT_KEY } from "@/lib/studio-panel-layout";

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
