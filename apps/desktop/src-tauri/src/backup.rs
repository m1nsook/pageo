//! Portable, offline .paglora project backups.
//! V1 is a UTF-8 JSON container with individually base64-encoded files.
//! Only authored project sources (never site exports or executable content) are packed.
use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use std::{collections::{HashMap, HashSet}, fs, path::{Path, PathBuf}, time::{SystemTime, UNIX_EPOCH}};
use tauri::{AppHandle, Manager};

const MAX_TOTAL: usize = 64 * 1024 * 1024;
const MAX_ENTRIES: usize = 1000;
const MAX_ARCHIVE: usize = 96 * 1024 * 1024;

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Backup {
    format: String,
    archive_version: u8,
    project_id: String,
    files: Vec<BackupFile>,
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct BackupFile { path: String, data: String }

fn valid_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 120 &&
        id.bytes().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == b'-')
}
fn valid_source_path(name: &str) -> bool {
    if name.len() > 160 || name.contains('\\') || name.contains("..") ||
        name.starts_with('/') || name.contains('\0') { return false; }
    if matches!(name, "paglora.json" | "pages.json" | "site.json" | "theme/custom.css") {
        return true;
    }
    let subpath = if let Some(value) = name.strip_prefix("docs/") {
        if !value.ends_with(".md") { return false; }
        value
    } else if let Some(value) = name.strip_prefix("assets/") {
        if ![".png", ".jpg", ".webp", ".gif"].iter().any(|ext| value.ends_with(ext)) { return false; }
        value
    } else { return false; };
    !subpath.is_empty() && subpath.bytes().all(|c|
        c.is_ascii_lowercase() || c.is_ascii_digit() || c == b'-' || c == b'.')
}
fn source_files(folder: &Path) -> Result<Vec<(String, Vec<u8>)>, String> {
    let mut files = Vec::new();
    for name in ["paglora.json", "pages.json", "site.json", "theme/custom.css"] {
        let full = folder.join(name);
        if !full.exists() { continue; }
        let meta = fs::symlink_metadata(&full).map_err(|e| e.to_string())?;
        if !meta.file_type().is_file() { return Err(format!("Not a regular source file: {name}")); }
        files.push((name.into(), fs::read(full).map_err(|e| e.to_string())?));
    }
    for directory in ["docs", "assets"] {
        let full = folder.join(directory);
        if !full.exists() { continue; }
        if !fs::symlink_metadata(&full).map_err(|e| e.to_string())?.file_type().is_dir() {
            return Err(format!("Invalid project directory: {directory}"));
        }
        for entry in fs::read_dir(full).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = format!("{directory}/{}", entry.file_name().to_string_lossy());
            let metadata = fs::symlink_metadata(entry.path()).map_err(|e| e.to_string())?;
            if !metadata.file_type().is_file() || !valid_source_path(&path) {
                return Err(format!("Unsupported or unsafe project file: {path}"));
            }
            files.push((path, fs::read(entry.path()).map_err(|e| e.to_string())?));
        }
    }
    files.sort_by(|a,b| a.0.cmp(&b.0));
    Ok(files)
}
fn validate_project(files: &HashMap<String, Vec<u8>>, expected_id: &str) -> Result<(), String> {
    let config: serde_json::Value = serde_json::from_slice(files.get("paglora.json").ok_or("Missing paglora.json")?)
        .map_err(|e| format!("Invalid paglora.json: {e}"))?;
    if config["formatVersion"] != 1 || config["id"].as_str() != Some(expected_id) ||
        !valid_id(expected_id) || !config["name"].is_string() {
        return Err("Backup contains an invalid project manifest".into());
    }
    let manifest: serde_json::Value = serde_json::from_slice(files.get("pages.json").ok_or("Missing pages.json")?)
        .map_err(|e| format!("Invalid pages.json: {e}"))?;
    let pages = manifest["pages"].as_array().ok_or("Invalid page list")?;
    if manifest["formatVersion"] != 1 || pages.is_empty() || pages.len() > 500 ||
        pages[0]["id"] != "index" || pages[0]["isPublic"] != true {
        return Err("Invalid page manifest or private Overview".into());
    }
    let mut ids = HashSet::new();
    for page in pages {
        let id = page["id"].as_str().ok_or("Invalid page identifier")?;
        if !valid_id(id) || !ids.insert(id) || !files.contains_key(&format!("docs/{id}.md")) {
            return Err(format!("Invalid, duplicated or missing Markdown page: {id}"));
        }
        if !page["title"].is_string() || !page["isPublic"].is_boolean() {
            return Err(format!("Invalid metadata for page {id}"));
        }
    }
    if let Some(site) = files.get("site.json") {
        let _: serde_json::Value = serde_json::from_slice(site).map_err(|e| format!("Invalid site.json: {e}"))?;
    }
    Ok(())
}
fn make_backup(folder: &Path, id: &str) -> Result<Vec<u8>, String> {
    if !valid_id(id) { return Err("Invalid project ID".into()); }
    let entries = source_files(folder)?;
    if entries.len() > MAX_ENTRIES { return Err("Project contains too many source files".into()); }
    let total: usize = entries.iter().map(|(_,bytes)| bytes.len()).sum();
    if total > MAX_TOTAL { return Err("Project exceeds the 64 MiB backup limit".into()); }
    let map: HashMap<_,_> = entries.iter().cloned().collect();
    validate_project(&map,id)?;
    let archive = Backup {
        format: "paglora-project".into(), archive_version: 1, project_id: id.into(),
        files: entries.into_iter().map(|(path,bytes)| BackupFile {path,data:STANDARD.encode(bytes)}).collect()
    };
    let bytes = serde_json::to_vec(&archive).map_err(|e| e.to_string())?;
    if bytes.len() > MAX_ARCHIVE { return Err("Backup exceeds the size limit".into()); }
    Ok(bytes)
}
fn read_backup(bytes: &[u8]) -> Result<(String, HashMap<String, Vec<u8>>), String> {
    if bytes.len() > MAX_ARCHIVE { return Err("Backup exceeds the 96 MiB archive limit".into()); }
    let archive: Backup = serde_json::from_slice(bytes).map_err(|e| format!("Invalid .paglora file: {e}"))?;
    if archive.format != "paglora-project" || archive.archive_version != 1 ||
        !valid_id(&archive.project_id) || archive.files.len() > MAX_ENTRIES {
        return Err("Unsupported Paglora backup version or project ID".into());
    }
    let mut entries = HashMap::new();
    let mut total = 0usize;
    for file in archive.files {
        if !valid_source_path(&file.path) || entries.contains_key(&file.path) {
            return Err(format!("Invalid or duplicate backup path: {}",file.path));
        }
        // Bound encoded length before allocating decoded data.
        if file.data.len() > (MAX_TOTAL - total).saturating_mul(4)/3 + 8 {
            return Err("Backup exceeds the uncompressed size limit".into());
        }
        let data = STANDARD.decode(file.data.as_bytes()).map_err(|_|"Invalid base64 content")?;
        total = total.checked_add(data.len()).ok_or("Backup size overflow")?;
        if total > MAX_TOTAL { return Err("Backup exceeds the 64 MiB uncompressed limit".into()); }
        entries.insert(file.path,data);
    }
    validate_project(&entries, &archive.project_id)?;
    Ok((archive.project_id,entries))
}
fn install_backup(bytes: &[u8], projects_root: &Path) -> Result<String, String> {
    let (original_id,mut files) = read_backup(bytes)?;
    fs::create_dir_all(projects_root).map_err(|e| e.to_string())?;
    let mut target = None;
    for count in 0..10_000 {
        let id = if count == 0 { original_id.clone() } else { format!("{}-import-{count}", original_id.chars().take(48).collect::<String>()) };
        let folder = projects_root.join(&id);
        match fs::create_dir(&folder) {
            Ok(()) => { target = Some((id,folder)); break; }
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(e.to_string())
        }
    }
    let (id,folder) = target.ok_or("Too many projects with the same name")?;
    let result = (|| -> Result<(),String> {
        // A collision imports as a new project; both original and imported copy remain safe.
        let config = files.get_mut("paglora.json").ok_or("Missing manifest")?;
        let mut json: serde_json::Value = serde_json::from_slice(config).map_err(|e| e.to_string())?;
        json["id"] = serde_json::json!(id);
        if let Ok(timestamp) = SystemTime::now().duration_since(UNIX_EPOCH) {
            json["updatedAt"] = serde_json::json!(timestamp.as_secs());
        }
        *config = serde_json::to_vec_pretty(&json).map_err(|e| e.to_string())?;
        for (relative,data) in files {
            let dest = folder.join(&relative);
            fs::create_dir_all(dest.parent().ok_or("Invalid backup path")?).map_err(|e| e.to_string())?;
            fs::write(dest,data).map_err(|e| e.to_string())?;
        }
        Ok(())
    })();
    if let Err(error) = result { let _=fs::remove_dir_all(&folder);return Err(error); }
    Ok(id)
}
#[tauri::command]
pub fn export_project_backup(app: AppHandle, project_id: String) -> Result<String, String> {
    if !valid_id(&project_id) { return Err("Invalid project ID".into()); }
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let path = data_dir.join("projects").join(&project_id);
    if !path.is_dir() || fs::symlink_metadata(&path).map_err(|e| e.to_string())?.file_type().is_symlink() {
        return Err("Project folder missing or unsafe".into());
    }
    let bytes = make_backup(&path, &project_id)?;
    let backups = data_dir.join("backups");
    fs::create_dir_all(&backups).map_err(|e| e.to_string())?;
    let millis = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_millis();
    // create_new refuses overwrites if a backup already exists at that timestamp.
    let output = backups.join(format!("{project_id}-{millis}.paglora"));
    let mut file = fs::OpenOptions::new().write(true).create_new(true).open(&output).map_err(|e| e.to_string())?;
    use std::io::Write;
    if let Err(error) = file.write_all(&bytes) { let _ = fs::remove_file(&output);return Err(error.to_string()); }
    file.sync_all().map_err(|e| e.to_string())?;
    Ok(output.display().to_string())
}
#[tauri::command]
pub fn import_project_backup(app: AppHandle, archive: Vec<u8>) -> Result<String, String> {
    let storage = app.path().app_data_dir().map_err(|e| e.to_string())?.join("projects");
    install_backup(&archive,&storage)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn temp(label: &str) -> PathBuf {
        let id=SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let path=std::env::temp_dir().join(format!("paglora-backup-{label}-{id}"));
        fs::create_dir_all(&path).unwrap();path
    }
    fn sample(path: &Path) {
        fs::create_dir_all(path.join("docs")).unwrap();
        fs::create_dir_all(path.join("assets")).unwrap();
        fs::create_dir_all(path.join("theme")).unwrap();
        fs::write(path.join("paglora.json"),r#"{"formatVersion":1,"id":"example","name":"Example","createdAt":1,"updatedAt":1}"#).unwrap();
        fs::write(path.join("pages.json"),r#"{"formatVersion":1,"pages":[{"id":"index","title":"Welcome","isPublic":true,"layout":"docs","navGroup":"Guide"},{"id":"hidden","title":"Private","isPublic":false,"layout":"docs","navGroup":"Guide"}]}"#).unwrap();
        fs::write(path.join("site.json"),r#"{"title":"Example","themeMode":"dark"}"#).unwrap();
        fs::write(path.join("docs/index.md"),"# Hey\n안녕하세요").unwrap();
        fs::write(path.join("docs/hidden.md"),"# Secret").unwrap();
        fs::write(path.join("assets/picture.png"),[0,1,254,255,0,9]).unwrap();
        fs::write(path.join("theme/custom.css"),"body{}").unwrap();
    }
    #[test]
    fn roundtrip_preserves_private_markdown_and_binary_assets_without_overwriting() {
        let root=temp("roundtrip"); let original=root.join("example");
        fs::create_dir(&original).unwrap();sample(&original);
        let archive=make_backup(&original,"example").unwrap();
        let copies=root.join("copies");
        assert_eq!(install_backup(&archive,&copies).unwrap(),"example");
        assert_eq!(install_backup(&archive,&copies).unwrap(),"example-import-1");
        for copy in ["example","example-import-1"] {
            assert_eq!(fs::read(copies.join(copy).join("assets/picture.png")).unwrap(),[0,1,254,255,0,9]);
            assert!(fs::read_to_string(copies.join(copy).join("docs/hidden.md")).unwrap().contains("Secret"));
            assert_eq!(read_backup(&make_backup(&copies.join(copy),copy).unwrap()).unwrap().0,copy);
        }
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn refuses_traversal_duplicate_paths_and_corrupt_archives() {
        for path in ["../evil", "docs/../../evil.md", "assets/malicious.svg", "docs/sub/page.md", ".env", "docs\\evil.md"] {
            assert!(!valid_source_path(path),"{path}");
        }
        assert!(read_backup(b"garbage").is_err());
        let root=temp("invalid");let project=root.join("example");fs::create_dir(&project).unwrap();sample(&project);
        let good=make_backup(&project,"example").unwrap();
        let mut doc:serde_json::Value=serde_json::from_slice(&good).unwrap();
        doc["files"][0]["path"]=serde_json::json!("../../pwned");
        assert!(read_backup(&serde_json::to_vec(&doc).unwrap()).is_err());
        assert!(read_backup(&vec![b'x';MAX_ARCHIVE+1]).is_err());
        fs::remove_dir_all(root).unwrap();
    }
}
