export const PAGLORA_PROJECT_FORMAT_VERSION = 1 as const;
// Legacy alias: do not break consumers of the original internal shared package.
export const PAGEO_PROJECT_FORMAT_VERSION = PAGLORA_PROJECT_FORMAT_VERSION;

export type ProjectSummary = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
};

export type ProjectDocument = {
  project: ProjectSummary;
  markdown: string;
};

export function validateProjectName(value: string): string | null {
  const name = value.trim();
  if (!name) return "Project name is required.";
  if ([...name].length > 80) return "Project name must be 80 characters or fewer.";
  if (/[\x00-\x1F\x7F]/.test(name)) return "Project name can't contain control characters.";
  return null;
}
