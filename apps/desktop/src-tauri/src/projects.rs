use serde::{Deserialize, Serialize};
use std::{fs, path::{Path, PathBuf}, time::{SystemTime, UNIX_EPOCH}};
use tauri::{AppHandle, Manager};

const FORMAT_VERSION: u8 = 1;
const DOC_FILE: &str = "docs/index.md";
const CONFIG_FILE: &str = "paglora.json";

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectConfig {
    format_version: u8,
    id: String,
    name: String,
    created_at: u64,
    updated_at: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummary {
    id: String,
    name: String,
    created_at: u64,
    updated_at: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDocument {
    project: ProjectSummary,
    markdown: String,
}

impl From<ProjectConfig> for ProjectSummary {
    fn from(c: ProjectConfig) -> Self {
        Self { id: c.id, name: c.name, created_at: c.created_at, updated_at: c.updated_at }
    }
}

fn now() -> Result<u64, String> {
    Ok(SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_secs())
}

fn root(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app.path().app_data_dir().map_err(|e| e.to_string())?.join("projects");
    fs::create_dir_all(&path).map_err(|e| format!("Unable to access project storage: {e}"))?;
    Ok(path)
}

fn check_id(id: &str) -> Result<(), String> {
    if id.is_empty() || id.len() > 120 || !id.bytes().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == b'-') {
        return Err("Invalid project identifier.".into());
    }
    Ok(())
}

fn read_config(path: &Path) -> Result<ProjectConfig, String> {
    let json = fs::read_to_string(path.join(CONFIG_FILE)).map_err(|e| e.to_string())?;
    let config: ProjectConfig = serde_json::from_str(&json).map_err(|e| e.to_string())?;
    if config.format_version != FORMAT_VERSION { return Err("Unsupported Paglora project format.".into()); }
    Ok(config)
}

fn write_config(folder: &Path, config: &ProjectConfig) -> Result<(), String> {
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(folder.join(CONFIG_FILE), format!("{json}\n")).map_err(|e| e.to_string())
}

fn slugify(name: &str) -> String {
    let mut out = String::new();
    let mut last_dash = false;
    for c in name.chars() {
        if c.is_ascii_alphanumeric() {
            out.push(c.to_ascii_lowercase());
            last_dash = false;
        } else if (c.is_whitespace() || c == '-' || c == '_') && !last_dash && !out.is_empty() {
            out.push('-');
            last_dash = true;
        }
    }
    let slug = out.trim_end_matches('-');
    if slug.is_empty() { "project".into() } else { slug.chars().take(48).collect::<String>().trim_end_matches('-').to_string() }
}

#[tauri::command]
pub fn projects_directory(app: AppHandle) -> Result<String, String> {
    Ok(root(&app)?.display().to_string())
}

#[tauri::command]
pub fn list_projects(app: AppHandle) -> Result<Vec<ProjectSummary>, String> {
    let mut projects = Vec::new();
    for entry in fs::read_dir(root(&app)?).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if !entry.path().is_dir() { continue; }
        if let Ok(config) = read_config(&entry.path()) {
            // Ignore malformed/misplaced projects rather than treating arbitrary folders as valid.
            if config.id == entry.file_name().to_string_lossy().as_ref() && check_id(&config.id).is_ok() {
                projects.push(config.into());
            }
        }
    }
    projects.sort_by(|a: &ProjectSummary, b: &ProjectSummary| b.updated_at.cmp(&a.updated_at).then_with(|| a.name.cmp(&b.name)));
    Ok(projects)
}

#[tauri::command]
pub fn create_project(app: AppHandle, name: String) -> Result<ProjectDocument, String> {
    let name = name.trim().to_string();
    if name.is_empty() || name.chars().count() > 80 || name.chars().any(char::is_control) {
        return Err("Project name must be 1–80 characters without control characters.".into());
    }
    let parent = root(&app)?;
    let slug = slugify(&name);
    let mut created = None;
    for suffix in 0..10_000 {
        let id = if suffix == 0 { slug.clone() } else { format!("{slug}-{suffix}") };
        let folder = parent.join(&id);
        match fs::create_dir(&folder) {
            Ok(()) => { created = Some((id, folder)); break; }
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error.to_string()),
        }
    }
    let (id, folder) = created.ok_or("Too many projects with similar names.")?;
    let time = now()?;
    let config = ProjectConfig { format_version: FORMAT_VERSION, id, name: name.clone(), created_at: time, updated_at: time };
    let markdown = format!("# {name}\n\nWelcome to your documentation. Start writing here.\n");
    let result = (|| -> Result<(), String> {
        fs::create_dir_all(folder.join("docs")).map_err(|e| e.to_string())?;
        fs::create_dir_all(folder.join("theme")).map_err(|e| e.to_string())?;
        fs::write(folder.join("theme/custom.css"), crate::source::STARTER_CSS).map_err(|e| e.to_string())?;
        fs::write(folder.join(DOC_FILE), &markdown).map_err(|e| e.to_string())?;
        write_config(&folder, &config)?;
        crate::pages::initialize_pages(&folder)?;
        Ok(())
    })();
    if let Err(error) = result { let _ = fs::remove_dir_all(&folder); return Err(error); }
    Ok(ProjectDocument { project: config.into(), markdown })
}

#[tauri::command]
pub fn load_project(app: AppHandle, id: String) -> Result<ProjectDocument, String> {
    check_id(&id)?;
    let folder = root(&app)?.join(&id);
    let config = read_config(&folder)?;
    if config.id != id { return Err("Project configuration does not match its folder.".into()); }
    let markdown = fs::read_to_string(folder.join(DOC_FILE)).map_err(|e| e.to_string())?;
    Ok(ProjectDocument { project: config.into(), markdown })
}

#[tauri::command]
pub fn save_document(app: AppHandle, id: String, markdown: String) -> Result<ProjectSummary, String> {
    check_id(&id)?;
    // Limit document size for now; project file management will be extended in later releases.
    if markdown.len() > 5_000_000 { return Err("Document exceeds the current 5 MB limit.".into()); }
    let folder = root(&app)?.join(&id);
    let mut config = read_config(&folder)?;
    if config.id != id { return Err("Project configuration does not match its folder.".into()); }
    fs::write(folder.join(DOC_FILE), markdown).map_err(|e| e.to_string())?;
    config.updated_at = now()?;
    write_config(&folder, &config)?;
    Ok(config.into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn project_manifest_uses_paglora_filename() {
        assert_eq!(CONFIG_FILE, "paglora.json");
        let config = ProjectConfig {
            format_version: FORMAT_VERSION, id: "test-docs".into(),
            name: "Test".into(), created_at: 1, updated_at: 1,
        };
        let json = serde_json::to_string(&config).unwrap();
        let saved: ProjectConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(saved.id, "test-docs");
        assert_eq!(saved.format_version, FORMAT_VERSION);
    }
}
