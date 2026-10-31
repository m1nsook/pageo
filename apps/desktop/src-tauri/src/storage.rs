//! Paglora Studio's project storage registry and conservative cross-volume migration.
//! No destination is activated until a complete verified copy has been staged.
//! The original projects remain untouched for manual recovery.
use serde::{Deserialize, Serialize};
use std::{fs, io::Read, path::{Path, PathBuf}, time::{SystemTime, UNIX_EPOCH}};
use tauri::{AppHandle, Manager};

const SETTINGS: &str = "project-storage.json";
const HISTORY: &str = "project-storage-history.json";
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
        if config["id"].as_str() != Some(name.as_str()) || config["formatVersion"] != 1 {
            return Err(format!("Invalid project manifest in {name}"));
        }
    }
    Ok(())
}


/// Path history is metadata only. It grants no extra filesystem permissions.
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct StorageHistory { version: u8, roots: Vec<String> }

fn read_history(data_dir: &Path) -> Result<Vec<String>, String> {
    let path=data_dir.join(HISTORY);
    if !path.exists() { return Ok(Vec::new()); }
    if !fs::symlink_metadata(&path).map_err(|e|e.to_string())?.file_type().is_file() {
        return Err("Unsafe storage history configuration".into());
    }
    let config: StorageHistory=serde_json::from_str(&fs::read_to_string(path).map_err(|e|e.to_string())?)
        .map_err(|e|format!("Invalid storage history: {e}"))?;
    if config.version!=1 || config.roots.len()>12 ||
        config.roots.iter().any(|p| !Path::new(p).is_absolute()) {
        return Err("Unsupported storage history".into());
    }
    Ok(config.roots)
}
fn remember_root(data_dir: &Path, previous: &Path) -> Result<(), String> {
    let old=previous.to_str().ok_or("Storage path must be UTF-8")?.to_string();
    let mut roots=read_history(data_dir)?;
    roots.retain(|p| p!=&old);
    roots.insert(0,old);
    roots.truncate(8);
    let bytes=serde_json::to_vec_pretty(&StorageHistory{version:1,roots}).map_err(|e|e.to_string())?;
    let stamp=SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e|e.to_string())?.as_nanos();
    let temp=data_dir.join(format!("project-storage-history-{stamp}.tmp"));
    let write=(|| -> Result<(),String> {
        use std::io::Write;
        let mut file=fs::OpenOptions::new().write(true).create_new(true).open(&temp).map_err(|e|e.to_string())?;
        file.write_all(&bytes).map_err(|e|e.to_string())?;
        file.sync_all().map_err(|e|e.to_string())?;
        fs::rename(&temp,data_dir.join(HISTORY)).map_err(|e|e.to_string())
    })();
    if write.is_err() { let _=fs::remove_file(temp); }
    write
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
    // Record where a safe, verified copy was migrated from before activating it.
    remember_root(data_dir, &source)?;
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


/// Status inspection never activates a new workspace or recreates a missing
/// custom storage root. The configured path remains the source of truth.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectStorageStatus {
    configured_path: String,
    available: bool,
    is_custom: bool,
    error: Option<String>,
    previous_location: Option<String>,
}
fn status_at(data_dir: &Path) -> Result<ProjectStorageStatus, String> {
    let prefs=data_dir.join(SETTINGS);
    if prefs.exists() {
        if !fs::symlink_metadata(&prefs).map_err(|e|e.to_string())?.file_type().is_file() {
            return Err("Unsafe project storage configuration".into());
        }
        let config: StorageSettings=serde_json::from_str(&fs::read_to_string(&prefs).map_err(|e|e.to_string())?)
            .map_err(|e|format!("Invalid storage preferences: {e}"))?;
        if config.version!=1 || config.root.trim().is_empty() {
            return Err("Unsupported project storage preferences".into());
        }
        let path=PathBuf::from(&config.root);
        if !path.is_absolute() {return Err("Configured storage path is not absolute".into());}
        let check=checked_existing_folder(&path);
        return Ok(ProjectStorageStatus {
            configured_path:config.root.clone(),available:check.is_ok(),is_custom:true,error:check.err(),
            previous_location:read_history(data_dir)?.into_iter().find(|path| path!=&config.root)
        });
    }
    let root=root_at(data_dir)?;
    Ok(ProjectStorageStatus {
        configured_path:root.to_string_lossy().into_owned(),available:true,is_custom:false,error:None,
        previous_location:read_history(data_dir)?.into_iter().find(|path| path.as_str()!=root.to_string_lossy().as_ref())
    })
}
#[tauri::command]
pub fn project_storage_status(app: AppHandle) -> Result<ProjectStorageStatus, String> {
    let data=app.path().app_data_dir().map_err(|e|e.to_string())?;
    status_at(&data)
}

/// Reconnect an EXISTING workspace after the configured custom drive became
/// unavailable. Never create a new empty workspace, overwrite a healthy one,
/// or accept files outside a real validated directory.
fn reconnect_at(data_dir: &Path, requested: &Path, confirmation: &str) -> Result<PathBuf, String> {
    if confirmation!="RECONNECT" {return Err("Type RECONNECT to confirm the workspace switch.".into());}
    let status=status_at(data_dir)?;
    if !status.is_custom || status.available {
        return Err("Reconnection is only available when the configured custom workspace is offline.".into());
    }
    if !requested.is_absolute(){return Err("Enter an existing absolute directory path.".into());}
    let resolved=checked_existing_folder(requested)?;
    if resolved==PathBuf::from(&status.configured_path) {
        return Err("This workspace path is still unavailable.".into());
    }
    validate_project_folders(&resolved)?;
    let mut count=0;
    let mut bytes=0;
    safe_tree(&resolved,0,&mut count,&mut bytes)?;
    if fs::read_dir(&resolved).map_err(|e|e.to_string())?.next().is_none() {
        return Err("An empty folder is not an existing Paglora workspace. No changes made.".into());
    }
    // Preserve the unavailable previous path so a reattached drive can be found later.
    remember_root(data_dir, Path::new(&status.configured_path))?;
    let manifest=StorageSettings {version:1,root:resolved.to_string_lossy().into_owned()};
    let contents=serde_json::to_vec_pretty(&manifest).map_err(|e|e.to_string())?;
    let stamp=SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e|e.to_string())?.as_nanos();
    let old=data_dir.join(SETTINGS);
    let previous=data_dir.join(format!("project-storage.pre-reconnect-{stamp}.json"));
    // Retain original absolute-path record for manual recovery of an offline drive.
    fs::copy(&old,&previous).map_err(|e|format!("Could not preserve previous storage location: {e}"))?;
    let tmp=data_dir.join(format!("project-storage.reconnect-{stamp}.tmp"));
    let update=(|| -> Result<(),String> {
        use std::io::Write;
        let mut file=fs::OpenOptions::new().create_new(true).write(true).open(&tmp).map_err(|e|e.to_string())?;
        file.write_all(&contents).map_err(|e|e.to_string())?;
        file.sync_all().map_err(|e|e.to_string())?;
        // On Windows, destination replacement must be checked; if it fails the
        // previous configuration remains authoritative.
        fs::rename(&tmp,&old).map_err(|e|format!("Could not activate reconnected storage: {e}"))
    })();
    if let Err(error)=update {
        let _=fs::remove_file(&tmp);
        return Err(format!("Reconnection failed; original path is unchanged: {error}"));
    }
    Ok(resolved)
}
#[tauri::command]
pub fn reconnect_project_storage(app: AppHandle, destination: String, confirmation: String) -> Result<String,String> {
    let data=app.path().app_data_dir().map_err(|e|e.to_string())?;
    Ok(reconnect_at(&data,Path::new(destination.trim()),&confirmation)?.to_string_lossy().into_owned())
}


/// Returning to a previous drive creates a fresh VERIFIED copy beside the old
/// workspace rather than activating a stale snapshot (which would lose edits).
/// Neither the old previous folder nor the active source is modified.
fn return_to_previous_at(data_dir: &Path, confirmation: &str) -> Result<PathBuf, String> {
    if confirmation!="RETURN" {return Err("Type RETURN to confirm the storage change.".into());}
    let current=root_at(data_dir)?;
    let previous=read_history(data_dir)?.into_iter()
        .find(|path| Path::new(path)!=current)
        .ok_or("No previous storage location was recorded.")?;
    let original=PathBuf::from(previous);
    let parent=checked_existing_folder(original.parent().ok_or("Previous drive has no parent folder.")?)?;
    let stamp=SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e|e.to_string())?.as_nanos();
    let new_folder=parent.join(format!("Paglora Projects Returned-{stamp}"));
    if new_folder.starts_with(&current) || current.starts_with(&new_folder) {
        return Err("Previous location overlaps the current workspace.".into());
    }
    migrate_at(data_dir,&new_folder)
}
#[tauri::command]
pub fn return_to_previous_storage(app: AppHandle, confirmation: String) -> Result<String,String> {
    let data=app.path().app_data_dir().map_err(|e|e.to_string())?;
    Ok(return_to_previous_at(&data,&confirmation)?.to_string_lossy().into_owned())
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
        assert_eq!(fs::canonicalize(&moved).unwrap(), fs::canonicalize(&target).unwrap());
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
    fn missing_drive_requires_real_existing_workspace_and_exact_confirmation() {
        let tmp=temporary("reconnect");
        let data=tmp.join("data"); fs::create_dir(&data).unwrap();
        let offline=tmp.join("missing-drive");
        let prefs=StorageSettings {version:1,root:offline.to_string_lossy().into_owned()};
        fs::write(data.join(SETTINGS),serde_json::to_vec(&prefs).unwrap()).unwrap();
        let active=tmp.join("existing-projects");fs::create_dir(&active).unwrap();sample_project(&active);
        assert!(!status_at(&data).unwrap().available);
        assert!(reconnect_at(&data,&active,"").is_err());
        assert!(reconnect_at(&data,&tmp.join("unknown"),"RECONNECT").is_err());
        assert_eq!(status_at(&data).unwrap().configured_path,prefs.root);
        assert_eq!(reconnect_at(&data,&active,"RECONNECT").unwrap(),fs::canonicalize(&active).unwrap());
        assert_eq!(root_at(&data).unwrap(),fs::canonicalize(active).unwrap());
        assert!(status_at(&data).unwrap().available);
        assert!(reconnect_at(&data,&tmp.join("another"),"RECONNECT").is_err());
        assert!(!data.join("projects").exists());
        assert!(fs::read_dir(&data).unwrap().any(|e|e.unwrap().file_name().to_string_lossy().starts_with("project-storage.pre-reconnect-")));
        fs::remove_dir_all(tmp).unwrap();
    }
    #[test]
    fn recovery_rejects_empty_and_unsafe_workspaces_without_mutating_config() {
        let tmp=temporary("recovery-guards");
        let data=tmp.join("data");fs::create_dir(&data).unwrap();
        let offline=tmp.join("offline");
        let prefs=StorageSettings {version:1,root:offline.to_string_lossy().into_owned()};
        fs::write(data.join(SETTINGS),serde_json::to_vec(&prefs).unwrap()).unwrap();
        let candidate=tmp.join("candidate");fs::create_dir(&candidate).unwrap();
        assert!(reconnect_at(&data,&candidate,"RECONNECT").is_err());
        fs::create_dir(candidate.join("malicious!")).unwrap();
        assert!(reconnect_at(&data,&candidate,"RECONNECT").is_err());
        assert_eq!(status_at(&data).unwrap().configured_path,prefs.root);
        fs::remove_dir_all(tmp).unwrap();
    }

    #[test]
    fn returning_to_previous_drive_copies_latest_docs_without_touching_snapshot() {
        let tmp=temporary("return-history");
        let data=tmp.join("data"); fs::create_dir(&data).unwrap();
        let original=root_at(&data).unwrap();
        sample_project(&original);
        let alternate=tmp.join("on-other-drive");
        migrate_at(&data,&alternate).unwrap();
        assert_eq!(status_at(&data).unwrap().previous_location.as_deref(),original.to_str());
        // Simulate edits after the original location was left behind.
        fs::write(alternate.join("alpha/docs/index.md"),"# Changed after move").unwrap();
        assert!(return_to_previous_at(&data,"").is_err());
        let returned=return_to_previous_at(&data,"RETURN").unwrap();
        assert_eq!(returned.parent().unwrap(),original.parent().unwrap());
        assert_ne!(returned,original);
        assert_eq!(fs::read_to_string(returned.join("alpha/docs/index.md")).unwrap(),"# Changed after move");
        assert_eq!(fs::read_to_string(original.join("alpha/docs/index.md")).unwrap(),"# Alpha\nprivate content");
        assert_eq!(root_at(&data).unwrap(),fs::canonicalize(returned).unwrap());
        assert!(alternate.join("alpha/docs/index.md").exists());
        fs::remove_dir_all(tmp).unwrap();
    }
    #[test]
    fn returning_without_history_never_changes_an_active_workspace() {
        let tmp=temporary("return-without-history");
        let data=tmp.join("data");fs::create_dir(&data).unwrap();
        let current=root_at(&data).unwrap();
        sample_project(&current);
        assert!(return_to_previous_at(&data,"RETURN").is_err());
        assert_eq!(root_at(&data).unwrap(),current);
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
