import { useMemo, type ReactNode } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { readStudioSplitLayout, STUDIO_SPLIT_LAYOUT_KEY } from "@/lib/studio-panel-layout";

export function StudioResizableSplit({ source, preview, resetToken, mode }: {
  source: ReactNode;
  preview: ReactNode;
  resetToken: number;
  mode: "edit" | "split" | "site";
}) {
  const savedLayout = useMemo(readStudioSplitLayout, [resetToken]);
  return (
    <ResizablePanelGroup key={resetToken} id="paglora-editor-preview" orientation="horizontal"
      defaultLayout={savedLayout} className="relative min-h-0 min-w-0 flex-1"
      onLayoutChanged={layout => {
        try { localStorage.setItem(STUDIO_SPLIT_LAYOUT_KEY, JSON.stringify(layout)); }
        catch { /* Workspace remains fully usable without persisted layout. */ }
      }}>
      <ResizablePanel id="source" minSize="25%" aria-hidden={mode === "site"}
        className={mode === "split" ? "flex min-h-0 min-w-0 flex-col" :
          mode === "edit" ? "absolute inset-0 z-10 flex !h-full !w-full min-h-0 min-w-0 flex-col" :
          "absolute inset-0 invisible flex !h-full !w-full min-h-0 min-w-0 flex-col pointer-events-none"}>
        {source}
      </ResizablePanel>
      <ResizableHandle withHandle className={mode === "split" ?
        "bg-border/80 hover:bg-primary/50 focus-visible:bg-primary/70" : "hidden"} />
      <ResizablePanel id="preview" minSize="25%" aria-hidden={mode === "edit"}
        className={mode === "split" ? "flex min-h-0 min-w-0 flex-col" :
          mode === "site" ? "absolute inset-0 z-10 flex !h-full !w-full min-h-0 min-w-0 flex-col" :
          "absolute inset-0 invisible flex !h-full !w-full min-h-0 min-w-0 flex-col pointer-events-none"}>
        {preview}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
