import { invoke, isTauri } from "@tauri-apps/api/core";

/** WebView2 target=_blank is not reliable; invoke a fixed OS browser action instead. */
export async function openDocumentation(): Promise<void> {
  if (isTauri()) return invoke("open_documentation");
  const opened = window.open("https://m1nsook.github.io/paglora-docs/", "_blank", "noopener,noreferrer");
  if (!opened) throw new Error("Your browser blocked the documentation tab.");
}
