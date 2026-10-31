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
    #[serde(default, skip_serializing_if = "ProjectVisual::is_default")]
    visual: ProjectVisual,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProjectVisual {
    category: String,
    accent: String,
    icon: String,
}
impl Default for ProjectVisual {
    fn default() -> Self {
        Self { category: String::new(), accent: "blue".into(), icon: "book".into() }
    }
}
impl ProjectVisual {
    fn is_default(&self) -> bool { self == &Self::default() }
    fn validate(&self) -> Result<(), String> {
        if self.category.chars().count() > 40 || self.category.chars().any(char::is_control) {
            return Err("Category must be at most 40 characters without control characters.".into());
        }
        if !["blue", "violet", "cyan", "green", "amber", "rose"].contains(&self.accent.as_str()) {
            return Err("Unsupported project accent.".into());
        }
        if !["book", "code", "package", "rocket", "globe", "folder"].contains(&self.icon.as_str()) {
            return Err("Unsupported project icon.".into());
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummary {
    id: String,
    name: String,
    created_at: u64,
    updated_at: u64,
    visual: ProjectVisual,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDocument {
    project: ProjectSummary,
    markdown: String,
}

impl From<ProjectConfig> for ProjectSummary {
    fn from(c: ProjectConfig) -> Self {
        Self { id: c.id, name: c.name, created_at: c.created_at, updated_at: c.updated_at, visual: c.visual }
    }
}

fn now() -> Result<u64, String> {
    Ok(SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_secs())
}

fn root(app: &AppHandle) -> Result<PathBuf, String> {
    crate::storage::projects_root(app)
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
    config.visual.validate()?;
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
    let config = ProjectConfig { format_version: FORMAT_VERSION, id, name: name.clone(), created_at: time, updated_at: time, visual: ProjectVisual::default() };
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

/** Move a validated project out of the active workspace without deleting its files.
 * The destination stays inside Paglora application data, to allow manual recovery.
 */
fn move_project_to_trash(projects: &Path, trash: &Path, id: &str) -> Result<PathBuf, String> {
    check_id(id)?;
    let folder = projects.join(id);
    let meta = fs::symlink_metadata(&folder).map_err(|e| e.to_string())?;
    if !meta.file_type().is_dir() {
        return Err("Unsafe project folder (expected a real directory).".into());
    }
    let config = read_config(&folder)?;
    if config.id != id {
        return Err("Project configuration does not match its folder.".into());
    }
    if trash.exists() {
        if !fs::symlink_metadata(trash).map_err(|e| e.to_string())?.file_type().is_dir() {
            return Err("Unsafe trash folder.".into());
        }
    } else {
        fs::create_dir(trash).map_err(|e| format!("Unable to create project trash: {e}"))?;
    }
    let stamp = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_nanos();
    for attempt in 0..100 {
        let destination = trash.join(format!("{id}-{stamp}-{attempt}"));
        if destination.exists() { continue; }
        fs::rename(&folder, &destination).map_err(|e| format!("Unable to move project to trash: {e}"))?;
        return Ok(destination);
    }
    Err("Could not allocate a unique trash location.".into())
}


#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrashedProject {
    trash_id: String,
    project: ProjectSummary,
    removed_at: u64,
}

fn trash_folder_for(root: &Path) -> Result<PathBuf, String> {
    // Keep new removals on the same volume as active projects, even when a
    // custom project location is on a different drive from application data.
    Ok(root.parent().ok_or("Project location has no parent.")?.join(".paglora-trash"))
}

fn check_trash_dir(trash: &Path) -> Result<bool, String> {
    match fs::symlink_metadata(trash) {
        Ok(meta) if meta.file_type().is_dir() => Ok(true),
        Ok(_) => Err("Unsafe project trash directory.".into()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(error.to_string()),
    }
}

fn parse_trashed_project(trash_id: &str, folder: &Path) -> Result<TrashedProject, String> {
    let kind = fs::symlink_metadata(folder).map_err(|e| e.to_string())?.file_type();
    if !kind.is_dir() { return Err("Unsafe trashed project directory.".into()); }
    let manifest_path = folder.join(CONFIG_FILE);
    if !fs::symlink_metadata(&manifest_path).map_err(|e| e.to_string())?.file_type().is_file() {
        return Err("Unsafe trashed project manifest.".into());
    }
    let config = read_config(folder)?;
    check_id(&config.id)?;
    let suffix = trash_id.strip_prefix(&format!("{}-", config.id)).ok_or("Trash entry does not match project.")?;
    let (stamp, attempt) = suffix.rsplit_once('-').ok_or("Invalid trash identifier.")?;
    let nanos: u128 = stamp.parse().map_err(|_| "Invalid trash timestamp.")?;
    let attempt: u8 = attempt.parse().map_err(|_| "Invalid trash attempt.")?;
    if attempt >= 100 { return Err("Invalid trash attempt.".into()); }
    Ok(TrashedProject { trash_id: trash_id.to_string(), project: config.into(), removed_at: (nanos / 1_000_000_000) as u64 })
}

fn list_trash_at(trash: &Path) -> Result<Vec<TrashedProject>, String> {
    if !check_trash_dir(trash)? { return Ok(Vec::new()); }
    let mut found = Vec::new();
    for entry in fs::read_dir(trash).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let Some(name) = entry.file_name().to_str().map(str::to_owned) else { continue; };
        if let Ok(item) = parse_trashed_project(&name, &entry.path()) { found.push(item); }
    }
    Ok(found)
}

fn ensure_regular_project_tree(path: &Path, depth: usize, files: &mut usize) -> Result<(), String> {
    if depth > 16 { return Err("Project folder nesting is too deep.".into()); }
    for entry in fs::read_dir(path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let kind = fs::symlink_metadata(entry.path()).map_err(|e| e.to_string())?.file_type();
        if kind.is_dir() { ensure_regular_project_tree(&entry.path(), depth + 1, files)?; }
        else if kind.is_file() {
            *files += 1;
            if *files > 25_000 { return Err("Project contains too many files.".into()); }
        } else { return Err("Projects containing symlinks or special files cannot be restored.".into()); }
    }
    Ok(())
}

fn restore_from(trash: &Path, root: &Path, trash_id: &str) -> Result<ProjectSummary, String> {
    let entry = trash.join(trash_id);
    let item = parse_trashed_project(trash_id, &entry)?;
    let destination = root.join(&item.project.id);
    // Reject collisions (including broken symlinks) and keep the trashed copy.
    match fs::symlink_metadata(&destination) {
        Ok(_) => return Err("A project with this ID already exists. The trashed copy is unchanged.".into()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(error.to_string()),
    }
    let mut files = 0;
    ensure_regular_project_tree(&entry, 0, &mut files)?;
    fs::rename(&entry, &destination).map_err(|error|
        format!("Unable to restore project to active storage; original trash entry is intact: {error}")
    )?;
    Ok(item.project)
}

#[tauri::command]
pub fn list_trashed_projects(app: AppHandle) -> Result<Vec<TrashedProject>, String> {
    let active = root(&app)?;
    let current_trash = trash_folder_for(&active)?;
    let legacy = app.path().app_data_dir().map_err(|e| e.to_string())?.join("trash");
    let mut items = list_trash_at(&current_trash)?;
    if legacy != current_trash {
        // Legacy entries predate custom locations; include them if accessible.
        items.extend(list_trash_at(&legacy)?);
    }
    items.sort_by(|a,b| b.removed_at.cmp(&a.removed_at).then_with(|| a.trash_id.cmp(&b.trash_id)));
    Ok(items)
}

#[tauri::command]
pub fn restore_trashed_project(app: AppHandle, trash_id: String) -> Result<ProjectSummary, String> {
    // A trash identifier is an opaque, validated *name*, never a client path.
    if trash_id.len() > 180 || !trash_id.bytes().all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == b'-') {
        return Err("Invalid trash identifier.".into());
    }
    let active = root(&app)?;
    let current = trash_folder_for(&active)?;
    let legacy = app.path().app_data_dir().map_err(|e| e.to_string())?.join("trash");
    for folder in [&current, &legacy] {
        if !check_trash_dir(folder)? { continue; }
        if fs::symlink_metadata(folder.join(&trash_id)).is_ok() {
            return restore_from(folder, &active, &trash_id);
        }
    }
    Err("Trashed project not found.".into())
}

/// Irreversibly delete an app-owned trash entry; never accept a client path.
fn purge_from(trash: &Path, trash_id: &str) -> Result<(), String> {
    if !check_trash_dir(trash)? { return Err("Trashed project not found.".into()); }
    let entry = trash.join(trash_id);
    parse_trashed_project(trash_id, &entry)?;
    let mut files = 0;
    ensure_regular_project_tree(&entry, 0, &mut files)?;
    fs::remove_dir_all(&entry).map_err(|error| format!("Permanent deletion failed: {error}"))
}

#[tauri::command]
pub fn permanently_delete_trashed_project(app: AppHandle, trash_id: String, confirmation: String) -> Result<(), String> {
    if trash_id.is_empty() || trash_id.len() > 180 ||
        !trash_id.bytes().all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == b'-') {
        return Err("Invalid trash identifier.".into());
    }
    let root = root(&app)?;
    let current = trash_folder_for(&root)?;
    let legacy = app.path().app_data_dir().map_err(|e| e.to_string())?.join("trash");
    for folder in [&current, &legacy] {
        if !check_trash_dir(folder)? { continue; }
        let entry = folder.join(&trash_id);
        if fs::symlink_metadata(&entry).is_ok() {
            let item = parse_trashed_project(&trash_id, &entry)?;
            if confirmation != item.project.name {
                return Err("Enter the exact project name to confirm permanent deletion.".into());
            }
            return purge_from(folder, &trash_id);
        }
    }
    Err("Trashed project not found.".into())
}

#[tauri::command]
pub fn trash_project(app: AppHandle, id: String) -> Result<String, String> {
    let projects = root(&app)?;
    let destination = move_project_to_trash(&projects, &trash_folder_for(&projects)?, &id)?;
    Ok(destination.display().to_string())
}

#[tauri::command]
pub fn update_project_visual(app: AppHandle, id: String, category: String, accent: String, icon: String) -> Result<ProjectSummary, String> {
    check_id(&id)?;
    let folder = root(&app)?.join(&id);
    if !fs::symlink_metadata(&folder).map_err(|e| e.to_string())?.file_type().is_dir() {
        return Err("Project folder is missing or unsafe.".into());
    }
    let mut config = read_config(&folder)?;
    if config.id != id { return Err("Project manifest does not match folder.".into()); }
    let visual = ProjectVisual { category: category.trim().to_string(), accent, icon };
    visual.validate()?;
    config.visual = visual;
    config.updated_at = now()?;
    write_config(&folder, &config)?;
    Ok(config.into())
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
    fn trash_moves_only_valid_project_folder_and_preserves_contents() {
        let nonce = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let temp = std::env::temp_dir().join(format!("paglora-project-trash-{}-{nonce}", std::process::id()));
        let projects = temp.join("projects");
        let trash = temp.join("trash");
        fs::create_dir_all(projects.join("test-docs")).unwrap();
        let config = ProjectConfig {
            format_version: FORMAT_VERSION, id: "test-docs".into(), name: "Test".into(),
            created_at: 1, updated_at: 1, visual: ProjectVisual::default() };
        write_config(&projects.join("test-docs"), &config).unwrap();
        fs::write(projects.join("test-docs").join("user-content.md"), "keep my text").unwrap();
        assert!(move_project_to_trash(&projects, &trash, "../evil").is_err());
        let destination = move_project_to_trash(&projects, &trash, "test-docs").unwrap();
        assert!(!projects.join("test-docs").exists());
        assert_eq!(fs::read_to_string(destination.join("user-content.md")).unwrap(), "keep my text");
        fs::remove_dir_all(&temp).unwrap();
    }

    #[test]
    fn trash_rejects_a_project_with_mismatched_manifest() {
        let nonce = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let temp = std::env::temp_dir().join(format!("paglora-trash-manifest-{}-{nonce}", std::process::id()));
        let projects = temp.join("projects");
        fs::create_dir_all(projects.join("test-docs")).unwrap();
        let config = ProjectConfig {
            format_version: FORMAT_VERSION, id: "another-project".into(), name: "Test".into(),
            created_at: 1, updated_at: 1, visual: ProjectVisual::default() };
        write_config(&projects.join("test-docs"), &config).unwrap();
        assert!(move_project_to_trash(&projects, &temp.join("trash"), "test-docs").is_err());
        assert!(projects.join("test-docs").is_dir());
        fs::remove_dir_all(&temp).unwrap();
    }


    #[test]
    fn list_and_restore_trashed_project_preserves_files() {
        let nonce = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let temp = std::env::temp_dir().join(format!("paglora-restore-{}-{nonce}", std::process::id()));
        let projects = temp.join("projects");
        let trash = temp.join(".paglora-trash");
        fs::create_dir_all(projects.join("sample")).unwrap();
        let config = ProjectConfig { format_version: FORMAT_VERSION, id: "sample".into(), name: "Sample".into(), created_at: 1, updated_at: 5, visual: ProjectVisual::default() };
        write_config(&projects.join("sample"), &config).unwrap();
        fs::write(projects.join("sample").join("note.md"), "restore all source files").unwrap();
        let dest = move_project_to_trash(&projects, &trash, "sample").unwrap();
        let removed = list_trash_at(&trash).unwrap();
        assert_eq!(removed.len(), 1);
        assert_eq!(removed[0].project.name, "Sample");
        assert_eq!(removed[0].trash_id, dest.file_name().unwrap().to_str().unwrap());
        let restored = restore_from(&trash, &projects, &removed[0].trash_id).unwrap();
        assert_eq!(restored.id, "sample");
        assert_eq!(fs::read_to_string(projects.join("sample/note.md")).unwrap(), "restore all source files");
        assert!(list_trash_at(&trash).unwrap().is_empty());
        fs::remove_dir_all(temp).unwrap();
    }

    #[test]
    fn purge_only_removes_validated_trash_and_preserves_siblings() {
        let nonce = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let temp = std::env::temp_dir().join(format!("paglora-purge-{}-{nonce}", std::process::id()));
        let projects = temp.join("projects");
        let trash = temp.join("trash");
        fs::create_dir_all(projects.join("sample")).unwrap();
        let config = ProjectConfig { format_version: FORMAT_VERSION, id: "sample".into(), name: "Sample".into(), created_at: 1, updated_at: 5, visual: ProjectVisual::default() };
        write_config(&projects.join("sample"), &config).unwrap();
        fs::write(projects.join("sample").join("private.md"), "private file").unwrap();
        let removed = move_project_to_trash(&projects, &trash, "sample").unwrap();
        let id = removed.file_name().unwrap().to_str().unwrap().to_owned();
        fs::write(trash.join("keep.txt"), "untouched").unwrap();
        purge_from(&trash, &id).unwrap();
        assert!(!removed.exists());
        assert!(restore_from(&trash, &projects, &id).is_err());
        assert_eq!(fs::read_to_string(trash.join("keep.txt")).unwrap(), "untouched");
        fs::remove_dir_all(temp).unwrap();
    }

    #[test]
    fn purge_refuses_entries_without_matching_manifests() {
        let nonce = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let temp = std::env::temp_dir().join(format!("paglora-purge-invalid-{}-{nonce}", std::process::id()));
        let trash = temp.join("trash");
        fs::create_dir_all(trash.join("wrong-123-0")).unwrap();
        fs::write(trash.join("wrong-123-0/private.txt"), "untouched").unwrap();
        assert!(purge_from(&trash, "wrong-123-0").is_err());
        assert!(trash.join("wrong-123-0/private.txt").exists());
        fs::remove_dir_all(temp).unwrap();
    }

    #[test]
    fn restore_collision_never_overwrites_an_existing_project() {
        let nonce = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let temp = std::env::temp_dir().join(format!("paglora-restore-conflict-{}-{nonce}", std::process::id()));
        let projects = temp.join("projects");
        let trash = temp.join("trash");
        fs::create_dir_all(projects.join("sample")).unwrap();
        let config = ProjectConfig { format_version: FORMAT_VERSION, id: "sample".into(), name: "Sample".into(), created_at: 1, updated_at: 5, visual: ProjectVisual::default() };
        write_config(&projects.join("sample"), &config).unwrap();
        let removed = move_project_to_trash(&projects, &trash, "sample").unwrap();
        fs::create_dir_all(projects.join("sample")).unwrap();
        fs::write(projects.join("sample/untouched.txt"), "original").unwrap();
        assert!(restore_from(&trash, &projects, removed.file_name().unwrap().to_str().unwrap()).is_err());
        assert!(removed.exists());
        assert_eq!(fs::read_to_string(projects.join("sample/untouched.txt")).unwrap(), "original");
        fs::remove_dir_all(temp).unwrap();
    }
    #[test]
    fn project_visual_defaults_are_backward_compatible_and_validated() {
        let old = r#"{"formatVersion":1,"id":"docs","name":"Docs","createdAt":1,"updatedAt":1}"#;
        let mut config: ProjectConfig = serde_json::from_str(old).unwrap();
        assert_eq!(config.visual, ProjectVisual::default());
        let out = serde_json::to_string(&config).unwrap();
        assert!(!out.contains("visual"));
        config.visual = ProjectVisual { category: "Reference".into(), accent: "violet".into(), icon: "code".into() };
        config.visual.validate().unwrap();
        let roundtrip: ProjectConfig = serde_json::from_str(&serde_json::to_string(&config).unwrap()).unwrap();
        assert_eq!(roundtrip.visual, config.visual);
        assert!(ProjectVisual { category: "Test".into(), accent: "red;evil".into(), icon: "book".into() }.validate().is_err());
        assert!(ProjectVisual { category: "Test".into(), accent: "blue".into(), icon: "../etc".into() }.validate().is_err());
    }

    #[test]
    fn project_manifest_uses_paglora_filename() {
        assert_eq!(CONFIG_FILE, "paglora.json");
        let config = ProjectConfig {
            format_version: FORMAT_VERSION, id: "test-docs".into(),
            name: "Test".into(), created_at: 1, updated_at: 1, visual: ProjectVisual::default() };
        let json = serde_json::to_string(&config).unwrap();
        let saved: ProjectConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(saved.id, "test-docs");
        assert_eq!(saved.format_version, FORMAT_VERSION);
    }
}
