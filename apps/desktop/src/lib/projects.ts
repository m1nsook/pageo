import type { ProjectDocument, ProjectSummary } from "@pageo/core";
import { invoke, isTauri } from "@tauri-apps/api/core";

export { isTauri };

function requireDesktop() {
  if (!isTauri()) throw new Error("Local projects require Pageo Desktop. Run 'bun run desktop' to launch it.");
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

export async function projectsDirectory(): Promise<string> {
  requireDesktop();
  return invoke<string>("projects_directory");
}
