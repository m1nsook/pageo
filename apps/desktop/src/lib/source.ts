import { invoke } from "@tauri-apps/api/core";

/** Per-project source stylesheet. The Rust backend restricts these commands to
 * theme/custom.css inside the current local project; no arbitrary filesystem
 * paths are accepted from the frontend.
 */
export const loadThemeCss = (projectId: string) =>
  invoke<string>("load_theme_css", { projectId });

export const saveThemeCss = (projectId: string, content: string) =>
  invoke<void>("save_theme_css", { projectId, content });
