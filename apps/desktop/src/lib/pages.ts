import { invoke } from "@tauri-apps/api/core";
import type { ProjectSummary } from "@paglora/core";
export type Page = { id: string; title: string; isPublic: boolean; layout: "docs" | "wide" | "landing"; navGroup: string };
export type PageDocument = { page: Page; markdown: string };
export const listPages = (projectId: string) => invoke<Page[]>("list_pages", { projectId });
export const loadPage = (projectId: string, pageId: string) => invoke<PageDocument>("load_page", { projectId, pageId });
export const createPage = (projectId: string, name: string) => invoke<PageDocument>("create_page", { projectId, name });
export const renamePage = (projectId: string, pageId: string, name: string) => invoke<Page>("rename_page", { projectId, pageId, name });
export const duplicatePage = (projectId: string, pageId: string) => invoke<PageDocument>("duplicate_page", { projectId, pageId });
export const deletePage = (projectId: string, pageId: string) => invoke<void>("delete_page", { projectId, pageId });
export const reorderPages = (projectId: string, ids: string[]) => invoke<Page[]>("reorder_pages", { projectId, ids });
export const savePage = (projectId: string, pageId: string, markdown: string) => invoke<ProjectSummary>("save_page", { projectId, pageId, markdown });

export const setPageVisibility = (projectId: string, pageId: string, isPublic: boolean) => invoke<Page>("set_page_visibility", { projectId, pageId, isPublic });

export const setPageLayout = (projectId: string, pageId: string, layout: Page["layout"]) => invoke<Page>("set_page_layout", { projectId, pageId, layout });

export const setPageNavigationGroup = (projectId: string, pageId: string, group: string) => invoke<Page>("set_page_navigation_group", { projectId, pageId, group });
