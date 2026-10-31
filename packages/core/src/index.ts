export const PAGLORA_PROJECT_FORMAT_VERSION = 1 as const;
export type ProjectVisual = {
  category: string;
  accent: "blue" | "violet" | "cyan" | "green" | "amber" | "rose";
  icon: "book" | "code" | "package" | "rocket" | "globe" | "folder";
};

export type ProjectSummary = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  visual: ProjectVisual;
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
