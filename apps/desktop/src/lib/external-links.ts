import { invoke, isTauri } from "@tauri-apps/api/core";

/** WebView2 target=_blank is not reliable; invoke a fixed OS browser action instead. */
export async function openDocumentation(): Promise<void> {
  if (isTauri()) return invoke("open_documentation");
  const opened = window.open("https://github.com/m1nsook/paglora#readme", "_blank", "noopener,noreferrer");
  if (!opened) throw new Error("Your browser blocked the documentation tab.");
}
