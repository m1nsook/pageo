import type { ProjectDocument, ProjectSummary } from "@paglora/core";
import { invoke, isTauri } from "@tauri-apps/api/core";

export { isTauri };

function requireDesktop() {
  if (!isTauri()) throw new Error("Local projects require Paglora Desktop. Run 'bun run desktop' to launch it.");
}

export async function listProjects(): Promise<ProjectSummary[]> {
  requireDesktop();
  return invoke<ProjectSummary[]>("list_projects");
}

export async function createProject(name: string): Promise<ProjectDocument> {
  requireDesktop();
  return invoke<ProjectDocument>("create_project", { name });
}

export async function updateProjectVisual(id: string, visual: import("@paglora/core").ProjectVisual): Promise<ProjectSummary> {
  requireDesktop();
  return invoke<ProjectSummary>("update_project_visual", { id, ...visual });
}

export async function loadProject(id: string): Promise<ProjectDocument> {
  requireDesktop();
  return invoke<ProjectDocument>("load_project", { id });
}

export async function saveDocument(id: string, markdown: string): Promise<ProjectSummary> {
  requireDesktop();
  return invoke<ProjectSummary>("save_document", { id, markdown });
}

/** Remove a project from Studio, preserving its files under app-data/trash for recovery. */
export async function trashProject(id: string): Promise<string> {
  requireDesktop();
  return invoke<string>("trash_project", { id });
}

export type TrashedProject = {
  trashId: string;
  project: ProjectSummary;
  removedAt: number;
};

/** Read only trashed projects with a matching, validated project manifest. */
export async function listTrashedProjects(): Promise<TrashedProject[]> {
  requireDesktop();
  return invoke<TrashedProject[]>("list_trashed_projects");
}

/** Restore one opaque trash entry without overwriting a project with the same ID. */
export async function restoreTrashedProject(trashId: string): Promise<ProjectSummary> {
  requireDesktop();
  return invoke<ProjectSummary>("restore_trashed_project", { trashId });
}

/** Permanently destroy a validated app-owned trash entry, after exact-name confirmation. */
export async function permanentlyDeleteTrashedProject(trashId: string, confirmation: string): Promise<void> {
  requireDesktop();
  return invoke<void>("permanently_delete_trashed_project", { trashId, confirmation });
}

/** Copy and verify all projects into a new, nonexistent directory; originals are retained. */
export async function migrateProjectStorage(destination: string): Promise<string> {
  requireDesktop();
  return invoke<string>("migrate_project_storage", { destination });
}

export async function projectsDirectory(): Promise<string> {
  requireDesktop();
  return invoke<string>("projects_directory");
}


/** Save the complete editable source as a portable, offline .paglora backup. */
export async function exportProjectBackup(id: string): Promise<string> {
  requireDesktop();
  return invoke<string>("export_project_backup", { projectId: id });
}

/** Import a user-selected .paglora file as a new local project. Never overwrite. */
export async function importProjectBackup(archive: number[]): Promise<string> {
  requireDesktop();
  return invoke<string>("import_project_backup", { archive });
}
