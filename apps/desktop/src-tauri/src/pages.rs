use serde::{Deserialize, Serialize};
use std::{collections::HashSet, fs, path::{Path, PathBuf}, time::{SystemTime, UNIX_EPOCH}};
use tauri::{AppHandle, Manager};

const MANIFEST: &str = "pages.json";
const HOME: &str = "index";

fn layout_default() -> String { "docs".into() }
fn valid_layout(value: &str) -> bool { matches!(value, "docs" | "wide" | "landing") }

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Page {
    pub id: String,
    pub title: String,
    pub is_public: bool,
    pub layout: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PageDocument { pub page: Page, pub markdown: String }

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Manifest { format_version: u8, pages: Vec<Page> }

fn valid_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 80 &&
        id.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
}
fn folder(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    if !valid_id(id) { return Err("Invalid project identifier".into()); }
    let path = app.path().app_data_dir().map_err(|e| e.to_string())?.join("projects").join(id);
    let config: serde_json::Value = serde_json::from_str(
        &fs::read_to_string(path.join("paglora.json")).map_err(|e| e.to_string())?
    ).map_err(|e| e.to_string())?;
    if config["id"].as_str() != Some(id) { return Err("Project configuration mismatch".into()); }
    Ok(path)
}
fn document(folder: &Path, id: &str) -> Result<PathBuf, String> {
    if !valid_id(id) { return Err("Invalid page identifier".into()); }
    Ok(folder.join("docs").join(format!("{id}.md")))
}
fn read_pages(folder: &Path) -> Result<Manifest, String> {
    let manifest: Manifest = serde_json::from_str(
        &fs::read_to_string(folder.join(MANIFEST)).map_err(|e| e.to_string())?
    ).map_err(|e| e.to_string())?;
    if manifest.format_version != 1 || manifest.pages.is_empty() || manifest.pages.len() > 500 ||
        manifest.pages[0].id != HOME { return Err("Invalid pages manifest".into()); }
    let mut known = HashSet::new();
    for page in &manifest.pages {
        if !valid_id(&page.id) || !valid_layout(&page.layout) || page.title.trim().is_empty() ||
            page.title.chars().count() > 100 || page.title.chars().any(char::is_control) ||
            !known.insert(&page.id) { return Err("Invalid page entry".into()); }
    }
    Ok(manifest)
}
pub(crate) fn initialize_pages(folder: &Path) -> Result<(), String> {
    let manifest = Manifest { format_version: 1, pages: vec![
        Page { id: HOME.into(), title: "Overview".into(), is_public: true, layout: layout_default() }
    ] };
    save_pages(folder, &manifest)
}
fn save_pages(folder: &Path, manifest: &Manifest) -> Result<(), String> {
    let json = serde_json::to_string_pretty(manifest).map_err(|e| e.to_string())?;
    fs::write(folder.join(MANIFEST), format!("{json}\n")).map_err(|e| e.to_string())
}
fn title(value: &str) -> Result<String, String> {
    let value = value.trim();
    if value.is_empty() || value.chars().count() > 100 || value.chars().any(char::is_control) {
        return Err("Page title must be 1–100 characters".into());
    }
    Ok(value.into())
}
fn slug(pages: &[Page], title: &str) -> Result<String, String> {
    let mut result = String::new();
    let mut dash = false;
    for ch in title.chars() {
        if ch.is_ascii_alphanumeric() { result.push(ch.to_ascii_lowercase()); dash = false; }
        else if (ch.is_whitespace() || ch == '-' || ch == '_') && !result.is_empty() && !dash {
            result.push('-'); dash = true;
        }
    }
    let result = result.trim_end_matches('-').chars().take(40).collect::<String>();
    let result = if result.is_empty() { "page".to_string() } else { result };
    for n in 0..10000 {
        let id = if n == 0 { result.clone() } else { format!("{result}-{n}") };
        if !pages.iter().any(|page| page.id == id) { return Ok(id); }
    }
    Err("Too many pages with similar titles".into())
}
fn touch(folder: &Path) -> Result<serde_json::Value, String> {
    let path = folder.join("paglora.json");
    let mut config: serde_json::Value = serde_json::from_str(
        &fs::read_to_string(&path).map_err(|e| e.to_string())?
    ).map_err(|e| e.to_string())?;
    config["updatedAt"] = serde_json::json!(
        SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_secs()
    );
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(path, format!("{json}\n")).map_err(|e| e.to_string())?;
    Ok(config)
}

#[tauri::command]
pub fn list_pages(app: AppHandle, project_id: String) -> Result<Vec<Page>, String> {
    Ok(read_pages(&folder(&app, &project_id)?)?.pages)
}
#[tauri::command]
pub fn load_page(app: AppHandle, project_id: String, page_id: String) -> Result<PageDocument, String> {
    let dir = folder(&app, &project_id)?;
    let page = read_pages(&dir)?.pages.into_iter().find(|p| p.id == page_id).ok_or("Page not found")?;
    let markdown = fs::read_to_string(document(&dir, &page.id)?).map_err(|e| e.to_string())?;
    Ok(PageDocument { page, markdown })
}
#[tauri::command]
pub fn create_page(app: AppHandle, project_id: String, name: String) -> Result<PageDocument, String> {
    let name = title(&name)?;
    let dir = folder(&app, &project_id)?;
    let mut manifest = read_pages(&dir)?;
    if manifest.pages.len() >= 500 { return Err("Project page limit reached".into()); }
    let page = Page { id: slug(&manifest.pages, &name)?, title: name, is_public: true, layout: layout_default() };
    let markdown = format!("# {}\n\n", page.title);
    let path = document(&dir, &page.id)?;
    fs::write(&path, &markdown).map_err(|e| e.to_string())?;
    manifest.pages.push(page.clone());
    if let Err(error) = save_pages(&dir, &manifest) { let _ = fs::remove_file(path); return Err(error); }
    touch(&dir)?;
    Ok(PageDocument { page, markdown })
}
#[tauri::command]
pub fn rename_page(app: AppHandle, project_id: String, page_id: String, name: String) -> Result<Page, String> {
    let new_title = title(&name)?;
    let dir = folder(&app, &project_id)?;
    let mut manifest = read_pages(&dir)?;
    let page = manifest.pages.iter_mut().find(|p| p.id == page_id).ok_or("Page not found")?;
    page.title = new_title;
    let updated = page.clone();
    save_pages(&dir, &manifest)?;
    touch(&dir)?;
    Ok(updated)
}
#[tauri::command]
pub fn duplicate_page(app: AppHandle, project_id: String, page_id: String) -> Result<PageDocument, String> {
    let dir = folder(&app, &project_id)?;
    let mut manifest = read_pages(&dir)?;
    if manifest.pages.len() >= 500 { return Err("Project page limit reached".into()); }
    let source = manifest.pages.iter().find(|p| p.id == page_id).ok_or("Page not found")?;
    let markdown = fs::read_to_string(document(&dir, &source.id)?).map_err(|e| e.to_string())?;
    let name = title(&format!("{} (Copy)", source.title))?;
    let page = Page { id: slug(&manifest.pages, &name)?, title: name, is_public: source.is_public, layout: source.layout.clone() };
    let path = document(&dir, &page.id)?;
    fs::write(&path, &markdown).map_err(|e| e.to_string())?;
    manifest.pages.push(page.clone());
    if let Err(error) = save_pages(&dir, &manifest) { let _ = fs::remove_file(path); return Err(error); }
    touch(&dir)?;
    Ok(PageDocument { page, markdown })
}
#[tauri::command]
pub fn delete_page(app: AppHandle, project_id: String, page_id: String) -> Result<(), String> {
    if page_id == HOME { return Err("The Overview page cannot be deleted".into()); }
    let dir = folder(&app, &project_id)?;
    let mut manifest = read_pages(&dir)?;
    if !manifest.pages.iter().any(|p| p.id == page_id) { return Err("Page not found".into()); }
    let trash = dir.join(".trash");
    fs::create_dir_all(&trash).map_err(|e| e.to_string())?;
    let nonce = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_nanos();
    let original = document(&dir, &page_id)?;
    let archived = trash.join(format!("{page_id}-{nonce}.md"));
    fs::rename(&original, &archived).map_err(|e| e.to_string())?;
    manifest.pages.retain(|p| p.id != page_id);
    if let Err(error) = save_pages(&dir, &manifest) {
        let _ = fs::rename(&archived, &original);
        return Err(error);
    }
    touch(&dir)?;
    Ok(())
}
#[tauri::command]
pub fn reorder_pages(app: AppHandle, project_id: String, ids: Vec<String>) -> Result<Vec<Page>, String> {
    let dir = folder(&app, &project_id)?;
    let mut manifest = read_pages(&dir)?;
    if ids.len() != manifest.pages.len() || ids.first().map(String::as_str) != Some(HOME) {
        return Err("Overview must remain first".into());
    }
    let mut reordered: Vec<Page> = Vec::new();
    for id in ids {
        let page = manifest.pages.iter().find(|p| p.id == id).ok_or("Unknown page in order")?;
        if reordered.iter().any(|p| p.id == id) { return Err("Duplicate page in order".into()); }
        reordered.push(page.clone());
    }
    manifest.pages = reordered.clone();
    save_pages(&dir, &manifest)?;
    touch(&dir)?;
    Ok(reordered)
}
#[tauri::command]
pub fn set_page_visibility(app: AppHandle, project_id: String, page_id: String, is_public: bool) -> Result<Page, String> {
    let dir = folder(&app, &project_id)?;
    let mut manifest = read_pages(&dir)?;
    if page_id == HOME && !is_public {
        return Err("Overview is the public home page and cannot be hidden".into());
    }
    let page = manifest.pages.iter_mut().find(|p| p.id == page_id).ok_or("Page not found")?;
    page.is_public = is_public;
    let updated = page.clone();
    save_pages(&dir, &manifest)?;
    touch(&dir)?;
    Ok(updated)
}

#[tauri::command]
pub fn set_page_layout(app: AppHandle, project_id: String, page_id: String, layout: String) -> Result<Page, String> {
    if !valid_layout(&layout) { return Err("Unsupported page layout".into()); }
    let dir = folder(&app, &project_id)?;
    let mut manifest = read_pages(&dir)?;
    let page = manifest.pages.iter_mut().find(|p| p.id == page_id).ok_or("Page not found")?;
    page.layout = layout;
    let updated = page.clone();
    save_pages(&dir, &manifest)?;
    touch(&dir)?;
    Ok(updated)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn page_manifest_requires_layout_and_visibility() {
        let page: Page = serde_json::from_str(r#"{"id":"index","title":"Overview","isPublic":true,"layout":"docs"}"#).unwrap();
        assert_eq!(page.layout, "docs");
        assert!(serde_json::from_str::<Page>(r#"{"id":"index","title":"Overview"}"#).is_err());
    }
    #[test]
    fn explicit_layout_round_trip() {
        let page: Page = serde_json::from_str(r#"{"id":"intro","title":"Hello","isPublic":true,"layout":"landing"}"#).unwrap();
        assert_eq!(page.layout, "landing");
        assert!(serde_json::to_string(&page).unwrap().contains("landing"));
    }
}

#[tauri::command]
pub fn save_page(app: AppHandle, project_id: String, page_id: String, markdown: String) -> Result<serde_json::Value, String> {
    if markdown.len() > 5_000_000 { return Err("Page exceeds the 5 MB limit".into()); }
    let dir = folder(&app, &project_id)?;
    if !read_pages(&dir)?.pages.iter().any(|p| p.id == page_id) { return Err("Page not found".into()); }
    fs::write(document(&dir, &page_id)?, markdown).map_err(|e| e.to_string())?;
    touch(&dir)
}
