use serde::{Deserialize, Serialize};
use std::{collections::HashSet, fs, io::Write, path::{Path, PathBuf}, time::{SystemTime, UNIX_EPOCH}};
use tauri::{AppHandle, Manager};

const MANIFEST: &str = "pages.json";
const HOME: &str = "index";

fn layout_default() -> String { "docs".into() }
fn navigation_group_default() -> String { "Documentation".into() }
pub(crate) fn valid_navigation_group(group: &str) -> bool {
    !group.trim().is_empty() && group.trim() == group && group.chars().count() <= 60 && !group.chars().any(char::is_control)
}
fn valid_layout(value: &str) -> bool { matches!(value, "docs" | "wide" | "landing") }

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Page {
    pub id: String,
    pub title: String,
    pub is_public: bool,
    pub layout: String,
    #[serde(default = "navigation_group_default")]
    pub nav_group: String,
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
    let path = crate::storage::projects_root(app)?.join(id);
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
        manifest.pages[0].id != HOME || !manifest.pages[0].is_public {
        return Err("Invalid pages manifest: Overview must remain public".into());
    }
    let mut known = HashSet::new();
    for page in &manifest.pages {
        if !valid_id(&page.id) || !valid_layout(&page.layout) || !valid_navigation_group(&page.nav_group) || page.title.trim().is_empty() ||
            page.title.chars().count() > 100 || page.title.chars().any(char::is_control) ||
            !known.insert(&page.id) { return Err("Invalid page entry".into()); }
    }
    Ok(manifest)
}
pub(crate) fn initialize_pages(folder: &Path) -> Result<(), String> {
    let manifest = Manifest { format_version: 1, pages: vec![
        Page { id: HOME.into(), title: "Overview".into(), is_public: true, layout: layout_default(), nav_group: navigation_group_default() }
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

/// Local-only finder. Unlike published search indexes, this may include private
/// pages because its results never leave the desktop's Tauri command boundary.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PageSearchHit {
    id: String,
    title: String,
    nav_group: String,
    excerpt: String,
    is_public: bool,
}

fn search_pages_at(dir: &Path, raw_query: &str) -> Result<Vec<PageSearchHit>, String> {
    let query = raw_query.trim();
    if query.chars().count() < 2 || query.chars().count() > 80 || query.chars().any(char::is_control) {
        return Err("Search requires 2–80 printable characters.".into());
    }
    let needle = query.to_lowercase();
    let manifest = read_pages(dir)?;
    let mut ranked = Vec::new();
    let mut scanned_bytes: u64 = 0;
    for page in manifest.pages {
        let title_hit = page.title.to_lowercase().contains(&needle);
        let group_hit = page.nav_group.to_lowercase().contains(&needle);
        let path = document(dir, &page.id)?;
        let mut match_line: Option<String> = None;
        // Only regular project-owned Markdown, never symlinks, and never
        // arbitrary files referenced in a user-authored Markdown document.
        if let Ok(meta) = fs::symlink_metadata(&path) {
            if meta.file_type().is_file() && meta.len() <= 5_000_000 && scanned_bytes.saturating_add(meta.len()) <= 20_000_000 {
                scanned_bytes += meta.len();
                if let Ok(markdown) = fs::read_to_string(&path) {
                    match_line = markdown.lines()
                        .find(|line| line.to_lowercase().contains(&needle))
                        .map(|line| {
                            let clean = line.trim().trim_start_matches(|c: char| "#>`*- ".contains(c));
                            clean.chars().take(180).collect::<String>()
                        });
                }
            }
        }
        if !title_hit && !group_hit && match_line.is_none() { continue; }
        let excerpt = match_line.unwrap_or_else(|| format!("{} · docs/{}.md", page.nav_group, page.id));
        let rank = if title_hit { 0 } else if group_hit { 1 } else { 2 };
        ranked.push((rank, PageSearchHit {
            id: page.id, title: page.title, nav_group: page.nav_group,
            excerpt, is_public: page.is_public,
        }));
    }
    ranked.sort_by(|a,b| a.0.cmp(&b.0).then_with(|| a.1.title.cmp(&b.1.title)));
    Ok(ranked.into_iter().take(40).map(|(_, hit)| hit).collect())
}

#[tauri::command]
pub fn search_project_pages(app: AppHandle, project_id: String, query: String) -> Result<Vec<PageSearchHit>, String> {
    search_pages_at(&folder(&app, &project_id)?, &query)
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
// Never clobber a Markdown file that is present on disk but absent from
// pages.json (for example after a manual recovery or interrupted operation).
fn write_new_document(path: &Path, markdown: &str) -> Result<(), String> {
    let mut file = fs::OpenOptions::new().write(true).create_new(true).open(path)
        .map_err(|error| format!("Page file already exists or cannot be created: {error}"))?;
    if let Err(error) = file.write_all(markdown.as_bytes()) {
        drop(file);
        let _ = fs::remove_file(path);
        return Err(error.to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn create_page(app: AppHandle, project_id: String, name: String) -> Result<PageDocument, String> {
    let name = title(&name)?;
    let dir = folder(&app, &project_id)?;
    let mut manifest = read_pages(&dir)?;
    if manifest.pages.len() >= 500 { return Err("Project page limit reached".into()); }
    let page = Page { id: slug(&manifest.pages, &name)?, title: name, is_public: true, layout: layout_default(), nav_group: navigation_group_default() };
    let markdown = format!("# {}\n\n", page.title);
    let path = document(&dir, &page.id)?;
    write_new_document(&path, &markdown)?;
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
    let page = Page { id: slug(&manifest.pages, &name)?, title: name, is_public: source.is_public, layout: source.layout.clone(), nav_group: source.nav_group.clone() };
    let path = document(&dir, &page.id)?;
    write_new_document(&path, &markdown)?;
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

#[tauri::command]
pub fn set_page_navigation_group(app: AppHandle, project_id: String, page_id: String, group: String) -> Result<Page, String> {
    if !valid_navigation_group(&group) { return Err("Navigation group must be 1–60 characters".into()); }
    let dir = folder(&app, &project_id)?;
    let mut manifest = read_pages(&dir)?;
    let page = manifest.pages.iter_mut().find(|p| p.id == page_id).ok_or("Page not found")?;
    page.nav_group = group;
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
    fn navigation_group_defaults_and_validation() {
        let page: Page = serde_json::from_str(r#"{"id":"index","title":"Overview","isPublic":true,"layout":"docs"}"#).unwrap();
        assert_eq!(page.nav_group, "Documentation");
        assert!(valid_navigation_group("Getting Started"));
        assert!(valid_navigation_group("API Reference"));
        assert!(!valid_navigation_group(""));
        assert!(!valid_navigation_group(" Leading"));
        assert!(!valid_navigation_group("Bad\nGroup"));
        let updated = Page { nav_group: "Examples".into(), ..page };
        let json = serde_json::to_string(&updated).unwrap();
        assert!(json.contains(r#""navGroup":"Examples""#));
    }
    #[test]
    fn creating_a_page_never_overwrites_an_orphaned_markdown_file() {
        let nonce = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let dir = std::env::temp_dir().join(format!(
            "paglora-page-write-{}-{nonce}", std::process::id()
        ));
        fs::create_dir(&dir).unwrap();
        let existing = dir.join("existing.md");
        fs::write(&existing, "# Original user content").unwrap();
        assert!(write_new_document(&existing, "# Replacement").is_err());
        assert_eq!(fs::read_to_string(&existing).unwrap(), "# Original user content");

        let fresh = dir.join("fresh.md");
        write_new_document(&fresh, "# New page").unwrap();
        assert_eq!(fs::read_to_string(&fresh).unwrap(), "# New page");
        assert!(write_new_document(&fresh, "# Another").is_err());
        assert_eq!(fs::read_to_string(&fresh).unwrap(), "# New page");
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn malformed_manifest_cannot_make_overview_private() {
        let nonce = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let dir = std::env::temp_dir().join(format!(
            "paglora-private-overview-{}-{nonce}", std::process::id()
        ));
        fs::create_dir(&dir).unwrap();
        let manifest = dir.join(MANIFEST);
        fs::write(&manifest, r#"{"formatVersion":1,"pages":[{"id":"index","title":"Overview","isPublic":false,"layout":"docs"}]}"#).unwrap();
        assert!(read_pages(&dir).is_err(), "Overview cannot be hidden by editing pages.json");
        fs::write(&manifest, r#"{"formatVersion":1,"pages":[{"id":"index","title":"Overview","isPublic":true,"layout":"docs"}]}"#).unwrap();
        assert!(read_pages(&dir).is_ok(), "legacy manifests with default navGroup remain supported");
        fs::remove_dir_all(&dir).unwrap();
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
