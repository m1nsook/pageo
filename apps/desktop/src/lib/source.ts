import { invoke } from "@tauri-apps/api/core";

/** Per-project source stylesheet. The Rust backend restricts these commands to
 * theme/custom.css inside the current local project; no arbitrary filesystem
 * paths are accepted from the frontend.
 */
export const loadThemeCss = (projectId: string) =>
  invoke<string>("load_theme_css", { projectId });

export const saveThemeCss = (projectId: string, content: string) =>
  invoke<void>("save_theme_css", { projectId, content });

/** Closed project-only stylesheet list, in real preview/export cascade order. */
export const listThemeStyles = (projectId: string) =>
  invoke<string[]>("list_theme_styles", { projectId });
export const loadThemeStyle = (projectId: string, name: string) =>
  invoke<string>("load_theme_style", { projectId, name });
export const saveThemeStyle = (projectId: string, name: string, content: string) =>
  invoke<void>("save_theme_style", { projectId, name, content });
export const createThemeStyle = (projectId: string, name: string) =>
  invoke<string[]>("create_theme_style", { projectId, name });
export const reorderThemeStyles = (projectId: string, names: string[]) =>
  invoke<string[]>("reorder_theme_styles", { projectId, names });
