use serde::{Deserialize, Serialize};
use std::{collections::{HashMap, HashSet}, fs, path::{Path, PathBuf}};
use tauri::{AppHandle, Manager};

const CONFIG: &str = "site.json";
const EXPORTS: &str = "site-exports";
const SITE_CSS: &str = r#"
:root{color-scheme:light;--bg:#fff;--fg:#171717;--muted:#737373;--line:#e5e5e5;--brand:#171717}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--fg);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.7;-webkit-font-smoothing:antialiased}
a{color:inherit}a:hover{color:#52525b}a:focus-visible{outline:2px solid var(--brand);outline-offset:3px}
.site-header{position:sticky;top:0;z-index:10;background:rgba(255,255,255,.96);border-bottom:1px solid var(--line);backdrop-filter:blur(12px)}
.top-bar{max-width:1320px;height:68px;margin:auto;padding:0 28px;display:flex;align-items:center;justify-content:space-between;gap:18px}
.brand{text-decoration:none;font-size:18px;font-weight:750;letter-spacing:-.045em}.site-badge{font-size:11px;color:var(--muted);white-space:nowrap}
.site-body{max-width:1320px;margin:0 auto;display:grid;grid-template-columns:258px minmax(0,1fr);min-height:calc(100vh - 160px)}
.site-nav{padding:28px 16px 40px 24px;border-right:1px solid var(--line)}.site-nav h2{padding:0 12px;font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);font-weight:700}
.site-nav a{display:block;padding:8px 12px;margin:2px 0;border-radius:8px;text-decoration:none;font-size:14px;line-height:1.5}
.site-nav a[aria-current=page]{font-weight:650;background:#f4f4f5}.site-nav a:hover{background:#f4f4f5}
.site-main{width:100%;min-width:0;padding:55px clamp(24px,7vw,112px) 90px}.page-heading{margin:0 0 28px;font-size:12px;color:var(--muted)}
.docs{max-width:790px;font-size:16px;overflow-wrap:break-word}.docs h1{font-size:2.55em;line-height:1.15;letter-spacing:-.045em;margin:0 0 28px}.docs h2{font-size:1.75em;letter-spacing:-.035em;line-height:1.24;margin:42px 0 16px}.docs h3{font-size:1.25em;letter-spacing:-.025em;margin:30px 0 10px}
.docs p,.docs ul,.docs ol{margin:0 0 18px}.docs ul,.docs ol{padding-left:1.6em}.docs li{margin:.3em 0}
.docs blockquote{margin:22px 0;border-left:3px solid #a1a1aa;padding:7px 0 7px 22px;color:#52525b}
.docs pre{overflow-x:auto;border-radius:10px;background:#171717;color:#f5f5f5;padding:20px 22px;line-height:1.6;font-size:13px}
.docs :not(pre)>code{background:#f4f4f5;padding:2px 5px;border-radius:5px;font-size:.87em}
.docs img{max-width:100%;height:auto;border-radius:10px}.docs table{border-collapse:collapse;width:100%;display:block;overflow-x:auto}.docs th,.docs td{padding:10px 14px;border:1px solid var(--line);text-align:left}
.docs th{background:#fafafa}.docs hr{border:0;border-top:1px solid var(--line);margin:32px 0}
.site-footer{border-top:1px solid var(--line);background:#fafafa}.site-footer-inner{max-width:1320px;margin:auto;padding:25px 28px;font-size:12px;color:var(--muted)}
@media(max-width:800px){.top-bar{height:60px;padding:0 18px}.site-body{display:block}.site-nav{border-right:0;border-bottom:1px solid var(--line);padding:16px 18px;display:flex;overflow-x:auto;white-space:nowrap;gap:3px;align-items:center}.site-nav h2{display:none}.site-nav a{display:inline-block;margin:0}.site-main{padding:35px 22px 64px}.docs h1{font-size:2.1em}.site-footer-inner{padding:22px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
"#;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SiteSettings {
    title: String,
    description: String,
    footer_text: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderedPage {
    id: String,
    html: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PageManifest {
    format_version: u8,
    pages: Vec<crate::pages::Page>,
}

fn valid_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 80 &&
        id.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
}

fn project_folder(app: &AppHandle, project_id: &str) -> Result<(PathBuf, String), String> {
    if !valid_id(project_id) { return Err("Invalid project identifier".into()); }
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("projects").join(project_id);
    let data: serde_json::Value = serde_json::from_str(
        &fs::read_to_string(dir.join("pageo.json")).map_err(|e| e.to_string())?
    ).map_err(|e| e.to_string())?;
    if data["id"].as_str() != Some(project_id) { return Err("Project configuration mismatch".into()); }
    let name = data["name"].as_str().ok_or("Project name missing")?.to_string();
    Ok((dir, name))
}

fn default_settings(name: &str) -> SiteSettings {
    SiteSettings {
        title: name.into(),
        description: format!("Documentation for {name}"),
        footer_text: format!("{name} · Built with Pageo"),
    }
}

fn read_settings(dir: &Path, name: &str) -> Result<SiteSettings, String> {
    if !dir.join(CONFIG).exists() { return Ok(default_settings(name)); }
    serde_json::from_str(&fs::read_to_string(dir.join(CONFIG)).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())
}

fn validate_settings(settings: &SiteSettings) -> Result<(), String> {
    for (value, field, max) in [
        (&settings.title, "Site title", 100),
        (&settings.description, "Site description", 240),
        (&settings.footer_text, "Footer text", 240),
    ] {
        if (field == "Site title" && value.trim().is_empty()) ||
            value.chars().count() > max || value.chars().any(char::is_control) {
            return Err(format!("{field} must contain no control characters and fit within {max} characters"));
        }
    }
    Ok(())
}

fn read_pages(dir: &Path) -> Result<Vec<crate::pages::Page>, String> {
    if !dir.join("pages.json").exists() {
        if !dir.join("docs/index.md").exists() { return Err("Overview document missing".into()); }
        return Ok(vec![crate::pages::Page { id: "index".into(), title: "Overview".into(), is_public: true }]);
    }
    let manifest: PageManifest = serde_json::from_str(
        &fs::read_to_string(dir.join("pages.json")).map_err(|e| e.to_string())?
    ).map_err(|e| e.to_string())?;
    if manifest.format_version != 1 || manifest.pages.is_empty() ||
        manifest.pages.len() > 500 || manifest.pages[0].id != "index" ||
        !manifest.pages[0].is_public {
        return Err("Invalid public site page manifest".into());
    }
    let mut seen = HashSet::new();
    for page in &manifest.pages {
        if !valid_id(&page.id) || !seen.insert(page.id.as_str()) || page.title.trim().is_empty() {
            return Err("Invalid page identifier in site".into());
        }
    }
    Ok(manifest.pages)
}

fn escape(value: &str) -> String {
    value.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;")
        .replace('"', "&quot;").replace('\'', "&#39;")
}

fn filename(id: &str) -> String { format!("{id}.html") }

fn render_site_page(settings: &SiteSettings, pages: &[crate::pages::Page], page: &crate::pages::Page, body: &str) -> String {
    let mut links = String::new();
    for item in pages.iter().filter(|p| p.is_public) {
        let current = if item.id == page.id { " aria-current=\"page\"" } else { "" };
        links.push_str(&format!(
            "<a href=\"{}\"{}>{}</a>",
            filename(&item.id), current, escape(&item.title)
        ));
    }
    let page_title = format!("{} | {}", page.title, settings.title);
    format!(r#"<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="{}">
<title>{}</title>
<link rel="stylesheet" href="styles.css">
</head>
<body>
<header class="site-header"><div class="top-bar"><a class="brand" href="index.html">{}</a><span class="site-badge">Documentation</span></div></header>
<div class="site-body">
<nav class="site-nav" aria-label="Documentation navigation"><h2>Pages</h2>{}</nav>
<main class="site-main" id="content"><div class="page-heading">{}</div><article class="docs">{}</article></main>
</div>
<footer class="site-footer"><div class="site-footer-inner">{}</div></footer>
</body>
</html>"#,
        escape(&settings.description), escape(&page_title), escape(&settings.title),
        links, escape(&page.title), body, escape(&settings.footer_text)
    )
}

#[tauri::command]
pub fn load_site_settings(app: AppHandle, project_id: String) -> Result<SiteSettings, String> {
    let (dir, name) = project_folder(&app, &project_id)?;
    read_settings(&dir, &name)
}

#[tauri::command]
pub fn save_site_settings(app: AppHandle, project_id: String, settings: SiteSettings) -> Result<(), String> {
    validate_settings(&settings)?;
    let (dir, _) = project_folder(&app, &project_id)?;
    fs::write(dir.join(CONFIG),
        format!("{}\n", serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?)
    ).map_err(|e| e.to_string())
}

/// Preview uses the exact same HTML and CSS renderer as static export.
/// The caller supplies already sanitized HTML; no files are written.
#[tauri::command]
pub fn preview_site_page(app: AppHandle, project_id: String, rendered: RenderedPage) -> Result<String, String> {
    let (dir, project_name) = project_folder(&app, &project_id)?;
    let settings = read_settings(&dir, &project_name)?;
    validate_settings(&settings)?;
    let pages = read_pages(&dir)?;
    let page = pages.iter().find(|p| p.id == rendered.id && p.is_public)
        .ok_or("Page is private or not in this project")?;
    if rendered.html.len() > 15_000_000 { return Err("Page HTML is too large".into()); }
    let doc = render_site_page(&settings, &pages, page, &rendered.html);
    Ok(doc.replace(
        "<link rel=\"stylesheet\" href=\"styles.css\">",
        &format!("<style>{SITE_CSS}</style>"),
    ))
}

#[tauri::command]
pub fn build_site(app: AppHandle, project_id: String, rendered: Vec<RenderedPage>) -> Result<String, String> {
    let (dir, project_name) = project_folder(&app, &project_id)?;
    let settings = read_settings(&dir, &project_name)?;
    validate_settings(&settings)?;
    let pages = read_pages(&dir)?;
    let public_pages: Vec<_> = pages.iter().filter(|p| p.is_public).collect();
    let expected: HashSet<_> = public_pages.iter().map(|p| p.id.as_str()).collect();
    if rendered.len() != public_pages.len() { return Err("Public page count changed. Build again".into()); }
    let mut html_by_id = HashMap::new();
    for page in &rendered {
        if !expected.contains(page.id.as_str()) || !valid_id(&page.id) ||
            page.html.len() > 15_000_000 || html_by_id.insert(page.id.as_str(), page.html.as_str()).is_some() {
            return Err("Invalid page data for static site build".into());
        }
    }
    let exports_dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join(EXPORTS);
    fs::create_dir_all(&exports_dir).map_err(|e| e.to_string())?;
    let target = exports_dir.join(&project_id);
    let staged = exports_dir.join(format!(".{project_id}-building"));
    let backup = exports_dir.join(format!(".{project_id}-previous"));
    if staged.exists() { fs::remove_dir_all(&staged).map_err(|e| e.to_string())?; }
    fs::create_dir(&staged).map_err(|e| e.to_string())?;
    let write_result = (|| -> Result<(), String> {
        fs::write(staged.join("styles.css"), SITE_CSS).map_err(|e| e.to_string())?;
        for page in &public_pages {
            let html = html_by_id.get(page.id.as_str()).ok_or("Missing public page")?;
            let output = render_site_page(&settings, &pages, page, html);
            fs::write(staged.join(filename(&page.id)), output).map_err(|e| e.to_string())?;
        }
        Ok(())
    })();
    if let Err(error) = write_result { let _ = fs::remove_dir_all(&staged); return Err(error); }
    // Stage first so an unsuccessful generation never replaces a working export.
    if backup.exists() { fs::remove_dir_all(&backup).map_err(|e| e.to_string())?; }
    if target.exists() { fs::rename(&target, &backup).map_err(|e| e.to_string())?; }
    if let Err(error) = fs::rename(&staged, &target) {
        if backup.exists() { let _ = fs::rename(&backup, &target); }
        return Err(error.to_string());
    }
    if backup.exists() { let _ = fs::remove_dir_all(&backup); }
    Ok(target.display().to_string())
}
