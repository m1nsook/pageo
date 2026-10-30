use std::{fs, path::{Path, PathBuf}};
use tauri::{AppHandle, Manager};

/// A local project controls its own site CSS; no system-wide stylesheet is edited.
/// Intentionally keep the legacy project manifest and Tauri identifier unchanged.
const MAX_CSS_BYTES: usize = 256_000;

pub const STARTER_CSS: &str = "/* Paglora project theme.
   This file is included AFTER the default site stylesheet, so your
   declarations override the default theme in Preview and Build.

   Examples:
   :root { --brand: #2196f3; }
   .site-header { border-bottom-width: 2px; }
   .docs { max-width: 850px; }
*/
";

fn project_dir(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    if id.is_empty() || id.len() > 120 ||
        !id.bytes().all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == b'-') {
        return Err("Invalid project ID".into());
    }
    let path = app.path().app_data_dir().map_err(|e| e.to_string())?.join("projects").join(id);
    if fs::symlink_metadata(&path).map_err(|e| e.to_string())?.file_type().is_symlink() {
        return Err("Project directory cannot be a symlink".into());
    }
    let metadata = fs::read_to_string(path.join("pageo.json")).map_err(|e| e.to_string())?;
    let json: serde_json::Value = serde_json::from_str(&metadata).map_err(|e| e.to_string())?;
    if json["id"].as_str() != Some(id) { return Err("Project ID does not match its manifest".into()); }
    Ok(path)
}

fn check_theme_dir(project: &Path) -> Result<PathBuf, String> {
    let dir = project.join("theme");
    if dir.exists() {
        let kind = fs::symlink_metadata(&dir).map_err(|e| e.to_string())?.file_type();
        if kind.is_symlink() || !kind.is_dir() { return Err("Theme folder is not a real directory".into()); }
    }
    Ok(dir)
}

/// Used by both preview and export, always reading the same source CSS file.
pub fn site_css(project: &Path) -> Result<Option<String>, String> {
    let path = check_theme_dir(project)?.join("custom.css");
    if !path.exists() { return Ok(None); }
    if !fs::symlink_metadata(&path).map_err(|e| e.to_string())?.file_type().is_file() {
        return Err("Theme CSS is not a regular file".into());
    }
    let size = fs::metadata(&path).map_err(|e| e.to_string())?.len();
    if size > MAX_CSS_BYTES as u64 { return Err("Theme CSS exceeds the 256 KB limit".into()); }
    let text = fs::read_to_string(path).map_err(|e| e.to_string())?;
    Ok(Some(text))
}

#[tauri::command]
pub fn load_theme_css(app: AppHandle, project_id: String) -> Result<String, String> {
    let project = project_dir(&app, &project_id)?;
    Ok(site_css(&project)?.unwrap_or_else(|| STARTER_CSS.to_string()))
}

#[tauri::command]
pub fn save_theme_css(app: AppHandle, project_id: String, content: String) -> Result<(), String> {
    if content.len() > MAX_CSS_BYTES || content.contains('\0') {
        return Err("Theme CSS is too large or contains NUL bytes".into());
    }
    let project = project_dir(&app, &project_id)?;
    let dir = check_theme_dir(&project)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join("custom.css");
    if path.exists() && !fs::symlink_metadata(&path).map_err(|e| e.to_string())?.file_type().is_file() {
        return Err("Theme CSS is not a regular file".into());
    }
    // A temporary file avoids replacing the last valid stylesheet on a partial write.
    let temp = dir.join("custom.css.tmp");
    if temp.exists() && !fs::symlink_metadata(&temp).map_err(|e| e.to_string())?.file_type().is_file() {
        return Err("Theme temporary file is not a regular file".into());
    }
    fs::write(&temp, content.as_bytes()).map_err(|e| e.to_string())?;
    let backup = dir.join("custom.css.previous");
    if backup.exists() { fs::remove_file(&backup).map_err(|e| e.to_string())?; }
    if path.exists() {
        if let Err(error) = fs::rename(&path, &backup) {
            let _ = fs::remove_file(&temp);
            return Err(format!("Unable to stage existing theme CSS: {error}"));
        }
    }
    if let Err(error) = fs::rename(&temp, &path) {
        if backup.exists() { let _ = fs::rename(&backup, &path); }
        let _ = fs::remove_file(&temp);
        return Err(format!("Could not replace theme CSS: {error}"));
    }
    if backup.exists() { let _ = fs::remove_file(&backup); }
    Ok(())
}
