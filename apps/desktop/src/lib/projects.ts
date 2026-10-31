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
