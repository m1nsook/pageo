//! Paglora Studio's project storage registry and conservative cross-volume migration.
//! No destination is activated until a complete verified copy has been staged.
//! The original projects remain untouched for manual recovery.
use serde::{Deserialize, Serialize};
use std::{fs, io::Read, path::{Path, PathBuf}, time::{SystemTime, UNIX_EPOCH}};
use tauri::{AppHandle, Manager};

const SETTINGS: &str = "project-storage.json";
const MAX_FILES: usize = 25_000;
const MAX_BYTES: u64 = 4 * 1024 * 1024 * 1024;

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct StorageSettings { version: u8, root: String }

fn checked_existing_folder(path: &Path) -> Result<PathBuf, String> {
    let metadata = fs::symlink_metadata(path).map_err(|e| format!("Project storage unavailable (no fallback): {e}"))?;
    if !metadata.file_type().is_dir() {
        return Err("Project storage must be an existing real directory, not a symlink or file.".into());
    }
    fs::canonicalize(path).map_err(|e| e.to_string())
}

fn root_at(data_dir: &Path) -> Result<PathBuf, String> {
    let prefs = data_dir.join(SETTINGS);
    if prefs.exists() {
        if !fs::symlink_metadata(&prefs).map_err(|e| e.to_string())?.file_type().is_file() {
            return Err("Unsafe project storage configuration.".into());
        }
        let json = fs::read_to_string(&prefs).map_err(|e| e.to_string())?;
        let config: StorageSettings = serde_json::from_str(&json).map_err(|e| format!("Invalid storage configuration: {e}"))?;
        if config.version != 1 || config.root.trim().is_empty() {
            return Err("Unsupported project storage configuration.".into());
        }
        let saved = PathBuf::from(config.root);
        if !saved.is_absolute() { return Err("Configured project storage path must be absolute.".into()); }
        return checked_existing_folder(&saved);
    }
    let default = data_dir.join("projects");
    if !default.exists() {
        fs::create_dir_all(&default).map_err(|e| format!("Unable to create default projects folder: {e}"))?;
    }
    checked_existing_folder(&default)
}

pub fn projects_root(app: &AppHandle) -> Result<PathBuf, String> {
    let data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    root_at(&data)
}

#[tauri::command]
pub fn project_storage_directory(app: AppHandle) -> Result<String, String> {
    Ok(projects_root(&app)?.to_string_lossy().into_owned())
}

fn project_id(name: &str) -> bool {
    !name.is_empty() && name.len() <= 120 &&
      name.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
}

fn safe_tree(path: &Path, depth: usize, files: &mut usize, bytes: &mut u64) -> Result<(), String> {
    if depth > 16 { return Err("Project folder nesting is too deep.".into()); }
    for entry in fs::read_dir(path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let meta = fs::symlink_metadata(entry.path()).map_err(|e| e.to_string())?;
        if meta.file_type().is_dir() {
            safe_tree(&entry.path(), depth + 1, files, bytes)?;
        } else if meta.file_type().is_file() {
            *files += 1;
            *bytes = bytes.checked_add(meta.len()).ok_or("Project storage size overflow")?;
            if *files > MAX_FILES || *bytes > MAX_BYTES { return Err("Storage exceeds migration safety limits.".into()); }
        } else {
            return Err(format!("Unsafe symlink or special file in project: {}", entry.path().display()));
        }
    }
    Ok(())
}

fn compare_file(a: &Path, b: &Path) -> Result<bool, String> {
    let mut first = fs::File::open(a).map_err(|e| e.to_string())?;
    let mut second = fs::File::open(b).map_err(|e| e.to_string())?;
    let mut left = [0u8; 65536];
    let mut right = [0u8; 65536];
    loop {
        let n = first.read(&mut left).map_err(|e| e.to_string())?;
        let m = second.read(&mut right).map_err(|e| e.to_string())?;
        if n != m || left[..n] != right[..m] { return Ok(false); }
        if n == 0 { return Ok(true); }
    }
}

fn copy_and_verify(from: &Path, to: &Path) -> Result<(), String> {
    fs::create_dir(to).map_err(|e| format!("Cannot create migration folder: {e}"))?;
    for entry in fs::read_dir(from).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let origin = entry.path();
        let dest = to.join(entry.file_name());
        let meta = fs::symlink_metadata(&origin).map_err(|e| e.to_string())?;
        if meta.file_type().is_dir() {
            copy_and_verify(&origin, &dest)?;
        } else if meta.file_type().is_file() {
            fs::copy(&origin, &dest).map_err(|e| format!("Copy failed for {}: {e}", origin.display()))?;
            if !compare_file(&origin, &dest)? {
                return Err(format!("Copied file failed verification: {}", origin.display()));
            }
        } else {
            return Err(format!("Unsafe source file: {}", origin.display()));
        }
    }
    Ok(())
}

fn validate_project_folders(source: &Path) -> Result<(), String> {
    for entry in fs::read_dir(source).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if !project_id(&name) || !fs::symlink_metadata(entry.path()).map_err(|e| e.to_string())?.file_type().is_dir() {
            return Err(format!("Unexpected or unsafe item in project storage: {name}"));
        }
        let metadata = fs::read_to_string(entry.path().join("paglora.json")).map_err(|e| format!("{name}: {e}"))?;
        let config: serde_json::Value = serde_json::from_str(&metadata).map_err(|e| format!("{name}: {e}"))?;
        if config["id"].as_str() != Some(&name) || config["formatVersion"] != 1 {
            return Err(format!("Invalid project manifest in {name}"));
        }
    }
    Ok(())
}

fn migrate_at(data_dir: &Path, requested: &Path) -> Result<PathBuf, String> {
    let source = root_at(data_dir)?;
    if !requested.is_absolute() { return Err("Enter an absolute storage folder path.".into()); }
    if requested.exists() { return Err("Choose a new folder name that does not exist yet, so existing files cannot be overwritten.".into()); }
    let parent = checked_existing_folder(requested.parent().ok_or("Invalid destination path.")?)?;
    let name = requested.file_name().ok_or("Destination must have a folder name.")?;
    let target = parent.join(name);
    if target.exists() || target.starts_with(&source) || source.starts_with(&target) {
        return Err("Destination overlaps existing projects or already exists.".into());
    }
    // Reject invalid source entries before creating anything in the destination.
    validate_project_folders(&source)?;
    let (mut count, mut bytes) = (0, 0);
    safe_tree(&source, 0, &mut count, &mut bytes)?;
    let stamp = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_nanos();
    let stage = parent.join(format!(".paglora-transfer-{}-{stamp}", std::process::id()));
    if stage.exists() { return Err("Migration staging folder already exists.".into()); }
    let staged = copy_and_verify(&source, &stage);
    if let Err(error) = staged {
        let _ = fs::remove_dir_all(&stage);
        return Err(format!("Project migration cancelled; original files unchanged: {error}"));
    }
    if let Err(error) = fs::rename(&stage, &target) {
        let _ = fs::remove_dir_all(&stage);
        return Err(format!("Cannot finalize destination; original files unchanged: {error}"));
    }
    let config = StorageSettings { version: 1, root: target.to_string_lossy().into_owned() };
    let bytes = serde_json::to_vec_pretty(&config).map_err(|e| e.to_string())?;
    let tmp = data_dir.join("project-storage.json.tmp");
    if tmp.exists() { return Err("Storage settings update is already staged; original location remains active.".into()); }
    let write = (|| -> Result<(), String> {
        use std::io::Write;
        let mut file = fs::OpenOptions::new().write(true).create_new(true).open(&tmp).map_err(|e| e.to_string())?;
        file.write_all(&bytes).map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
        fs::rename(&tmp, data_dir.join(SETTINGS)).map_err(|e| e.to_string())
    })();
    if let Err(err) = write {
        let _ = fs::remove_file(&tmp);
        return Err(format!("Copied projects verified at {}, but could not activate the new location. Originals were preserved: {err}", target.display()));
    }
    Ok(target)
}

#[tauri::command]
pub fn migrate_project_storage(app: AppHandle, destination: String) -> Result<String, String> {
    let data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let target = migrate_at(&data, Path::new(destination.trim()))?;
    Ok(target.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn temporary(label: &str) -> PathBuf {
        let nonce = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let path = std::env::temp_dir().join(format!("paglora-storage-{label}-{}-{nonce}", std::process::id()));
        fs::create_dir_all(&path).unwrap(); path
    }
    fn sample_project(root: &Path) {
        let project = root.join("alpha");
        fs::create_dir_all(project.join("docs")).unwrap();
        fs::write(project.join("paglora.json"), r#"{"formatVersion":1,"id":"alpha","name":"Alpha"}"#).unwrap();
        fs::write(project.join("docs").join("index.md"), "# Alpha\nprivate content").unwrap();
    }
    #[test]
    fn migrates_verified_copy_and_keeps_original() {
        let tmp = temporary("success");
        let data = tmp.join("data"); fs::create_dir(&data).unwrap();
        let source = root_at(&data).unwrap();
        sample_project(&source);
        let target = tmp.join("new-projects");
        let moved = migrate_at(&data, &target).unwrap();
        assert_eq!(moved, target);
        assert!(source.join("alpha/docs/index.md").exists());
        assert_eq!(fs::read(target.join("alpha/docs/index.md")).unwrap(), fs::read(source.join("alpha/docs/index.md")).unwrap());
        assert_eq!(root_at(&data).unwrap(), fs::canonicalize(target).unwrap());
        fs::remove_dir_all(tmp).unwrap();
    }
    #[test]
    fn rejects_existing_destination_without_changing_config() {
        let tmp = temporary("existing");
        let data = tmp.join("data"); fs::create_dir(&data).unwrap();
        let source = root_at(&data).unwrap(); sample_project(&source);
        let target = tmp.join("exists"); fs::create_dir(&target).unwrap();
        assert!(migrate_at(&data, &target).is_err());
        assert_eq!(root_at(&data).unwrap(), source);
        fs::remove_dir_all(tmp).unwrap();
    }
    #[test]
    fn missing_configured_drive_does_not_recreate_default_workspace() {
        let tmp = temporary("missing");
        let data = tmp.join("data"); fs::create_dir(&data).unwrap();
        let missing = tmp.join("missing-drive");
        let preferences = StorageSettings { version: 1, root: missing.to_string_lossy().into_owned() };
        fs::write(data.join(SETTINGS), serde_json::to_vec(&preferences).unwrap()).unwrap();
        assert!(root_at(&data).is_err());
        assert!(!data.join("projects").exists());
        fs::remove_dir_all(tmp).unwrap();
    }
    #[test]
    fn symlinks_and_invalid_manifests_block_migration() {
        let tmp = temporary("invalid");
        let data = tmp.join("data"); fs::create_dir(&data).unwrap();
        let source = root_at(&data).unwrap();
        fs::create_dir(source.join("bad_name!")).unwrap();
        assert!(migrate_at(&data, &tmp.join("dest")).is_err());
        assert!(!tmp.join("dest").exists());
        fs::remove_dir_all(tmp).unwrap();
    }
}
