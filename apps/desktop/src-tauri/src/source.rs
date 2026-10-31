use std::{collections::HashSet, fs, io::Write, path::{Path, PathBuf}, time::{SystemTime, UNIX_EPOCH}};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

/// A local project controls its own site CSS; no system-wide stylesheet is edited.
const MAX_CSS_BYTES: usize = 256_000;
const MAX_TOTAL_CSS_BYTES: usize = 512_000;
const MAX_EXTRA_STYLES: usize = 12;
const ORDER_MANIFEST: &str = "styles.json";

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
    let path = crate::storage::projects_root(app)?.join(id);
    if fs::symlink_metadata(&path).map_err(|e| e.to_string())?.file_type().is_symlink() {
        return Err("Project directory cannot be a symlink".into());
    }
    let metadata = fs::read_to_string(path.join("paglora.json")).map_err(|e| e.to_string())?;
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

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct StyleOrder { version: u8, files: Vec<String> }

fn safe_style_name(name: &str) -> bool {
    let Some(stem) = name.strip_suffix(".css") else { return false };
    !stem.is_empty() && stem.len()<=32 && stem!="custom" &&
        !stem.starts_with('-') && !stem.ends_with('-') &&
        stem.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b==b'-')
}
fn read_style(path: &Path) -> Result<Option<String>, String> {
    if !path.exists() {return Ok(None)}
    if !fs::symlink_metadata(path).map_err(|e|e.to_string())?.file_type().is_file() {
        return Err("Stylesheet is not a regular file".into());
    }
    if fs::metadata(path).map_err(|e|e.to_string())?.len()>MAX_CSS_BYTES as u64 {
        return Err("Stylesheet exceeds the 256 KB limit".into());
    }
    let text=fs::read_to_string(path).map_err(|e|e.to_string())?;
    if text.as_bytes().contains(&0){return Err("NUL bytes are not allowed in CSS".into());}
    Ok(Some(text))
}
pub(crate) fn style_order(dir: &Path)->Result<Vec<String>,String>{
    let path=dir.join(ORDER_MANIFEST);
    if !path.exists(){return Ok(Vec::new())}
    if !fs::symlink_metadata(&path).map_err(|e|e.to_string())?.file_type().is_file(){
        return Err("Unsafe CSS order file".into());
    }
    let bytes=fs::read(&path).map_err(|e|e.to_string())?;
    if bytes.len()>4096{return Err("CSS order manifest is too large".into());}
    let order:StyleOrder=serde_json::from_slice(&bytes).map_err(|e|e.to_string())?;
    if order.version!=1 || order.files.len()>MAX_EXTRA_STYLES ||
        order.files.iter().any(|name|!safe_style_name(name)) ||
        order.files.iter().collect::<HashSet<_>>().len()!=order.files.len() {
        return Err("Invalid or duplicate CSS name in styles.json".into());
    }
    for name in &order.files {
        read_style(&dir.join(name))?.ok_or(format!("Missing CSS file {name}"))?;
    }
    Ok(order.files)
}
fn write_style_order(dir:&Path, files:&[String])->Result<(),String>{
    if files.len()>MAX_EXTRA_STYLES || files.iter().any(|n|!safe_style_name(n)) ||
       files.iter().collect::<HashSet<_>>().len()!=files.len(){
        return Err("Invalid CSS order".into());
    }
    let bytes=serde_json::to_vec_pretty(&StyleOrder{version:1,files:files.to_vec()}).map_err(|e|e.to_string())?;
    let nonce=SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e|e.to_string())?.as_nanos();
    let tmp=dir.join(format!("styles-order-{nonce}.tmp"));
    let write=(||->Result<(),String>{
        let mut f=fs::OpenOptions::new().write(true).create_new(true).open(&tmp).map_err(|e|e.to_string())?;
        f.write_all(&bytes).map_err(|e|e.to_string())?;
        f.sync_all().map_err(|e|e.to_string())?;
        let target=dir.join(ORDER_MANIFEST);
        let backup=dir.join("styles.json.previous");
        if target.exists() {
            if !fs::symlink_metadata(&target).map_err(|e|e.to_string())?.file_type().is_file(){
                return Err("Unsafe stylesheet manifest".into());
            }
            if backup.exists() {
                if !fs::symlink_metadata(&backup).map_err(|e|e.to_string())?.file_type().is_file(){
                    return Err("Unsafe stylesheet manifest backup".into());
                }
                fs::remove_file(&backup).map_err(|e|e.to_string())?;
            }
            fs::rename(&target,&backup).map_err(|e|e.to_string())?;
        }
        if let Err(e)=fs::rename(&tmp,&target){
            if backup.exists(){let _=fs::rename(&backup,&target);}
            return Err(e.to_string());
        }
        if backup.exists(){let _=fs::remove_file(&backup);}
        Ok(())
    })();
    if write.is_err(){let _=fs::remove_file(tmp);}
    write
}
/// Return every active portable theme file for project backup, in the same
/// validated order consumed by preview and static export. The manifest itself
/// must be archived so that restored styles retain their precedence.
pub(crate) fn portable_theme_files(project: &Path) -> Result<Vec<String>, String> {
    let dir=check_theme_dir(project)?;
    let extras=style_order(&dir)?;
    let mut files=Vec::new();
    if dir.join(ORDER_MANIFEST).exists() {
        files.push(format!("theme/{ORDER_MANIFEST}"));
    }
    for name in extras { files.push(format!("theme/{name}")); }
    // Fail rather than silently omitting an authored CSS file from a backup.
    // Transient .tmp/.previous files are deliberately not source files.
    if dir.exists() {
        for entry in fs::read_dir(&dir).map_err(|e|e.to_string())? {
            let entry=entry.map_err(|e|e.to_string())?;
            let name=entry.file_name().to_string_lossy().into_owned();
            if name.ends_with(".css") && name!="custom.css" &&
                !files.iter().any(|path|path==&format!("theme/{name}")) {
                return Err(format!("Unregistered CSS file in theme/: {name}. Add it to the theme order before backup."));
            }
        }
    }
    Ok(files)
}
pub fn site_css(project: &Path)->Result<Option<String>,String>{
    let dir=check_theme_dir(project)?;
    let order=style_order(&dir)?;
    let original=read_style(&dir.join("custom.css"))?;
    if original.is_none() && order.is_empty(){return Ok(None);}
    let mut combined=String::new();
    if let Some(text)=original {
        combined.push_str("/* source: theme/custom.css */\n");
        combined.push_str(&text);
        combined.push('\n');
    }
    for name in order {
        let css=read_style(&dir.join(&name))?.ok_or("Listed stylesheet disappeared")?;
        combined.push_str(&format!("\n/* source: theme/{name} */\n"));
        combined.push_str(&css);
        combined.push('\n');
        if combined.len()>MAX_TOTAL_CSS_BYTES{return Err("Combined CSS exceeds 512 KB".into());}
    }
    if combined.len()>MAX_TOTAL_CSS_BYTES{return Err("Combined CSS exceeds 512 KB".into());}
    Ok(Some(combined))
}
fn source_style(project:&Path,name:&str)->Result<String,String>{
    if name!="custom.css" && !safe_style_name(name){return Err("Invalid CSS file".into());}
    let dir=check_theme_dir(project)?;
    if name!="custom.css" && !style_order(&dir)?.contains(&name.to_string()){
        return Err("CSS file is not registered".into());
    }
    Ok(read_style(&dir.join(name))?.unwrap_or_else(||if name=="custom.css"{STARTER_CSS.into()}else{String::new()}))
}
fn save_css_at(dir:&Path,name:&str,content:&str)->Result<(),String>{
    if content.len()>MAX_CSS_BYTES || content.as_bytes().contains(&0){return Err("Invalid or oversized CSS".into());}
    fs::create_dir_all(dir).map_err(|e|e.to_string())?;
    let path=dir.join(name);
    if path.exists() && !fs::symlink_metadata(&path).map_err(|e|e.to_string())?.file_type().is_file(){
        return Err("Stylesheet is not a regular file".into());
    }
    let tmp=dir.join(format!("{name}.tmp"));
    if tmp.exists() && !fs::symlink_metadata(&tmp).map_err(|e|e.to_string())?.file_type().is_file(){
        return Err("Unsafe temporary CSS file".into());
    }
    fs::write(&tmp,content).map_err(|e|e.to_string())?;
    let backup=dir.join(format!("{name}.previous"));
    if backup.exists(){
        if !fs::symlink_metadata(&backup).map_err(|e|e.to_string())?.file_type().is_file(){
            let _=fs::remove_file(&tmp);
            return Err("Unsafe CSS backup".into());
        }
        fs::remove_file(&backup).map_err(|e|e.to_string())?;
    }
    if path.exists(){
        if let Err(e)=fs::rename(&path,&backup){let _=fs::remove_file(&tmp);return Err(e.to_string());}
    }
    if let Err(e)=fs::rename(&tmp,&path){
        if backup.exists(){let _=fs::rename(&backup,&path);}
        let _=fs::remove_file(&tmp);
        return Err(e.to_string());
    }
    if backup.exists(){let _=fs::remove_file(backup);}
    Ok(())
}
#[tauri::command]
pub fn list_theme_styles(app:AppHandle,project_id:String)->Result<Vec<String>,String>{
    let dir=check_theme_dir(&project_dir(&app,&project_id)?)?;
    let mut files=vec!["custom.css".to_owned()];
    files.extend(style_order(&dir)?);
    Ok(files)
}
#[tauri::command]
pub fn load_theme_style(app:AppHandle,project_id:String,name:String)->Result<String,String>{
    source_style(&project_dir(&app,&project_id)?,&name)
}
#[tauri::command]
pub fn save_theme_style(app:AppHandle,project_id:String,name:String,content:String)->Result<(),String>{
    if name!="custom.css" && !safe_style_name(&name){return Err("Invalid CSS filename".into());}
    let dir=check_theme_dir(&project_dir(&app,&project_id)?)?;
    if name!="custom.css" && !style_order(&dir)?.contains(&name){return Err("CSS file not in project order".into());}
    save_css_at(&dir,&name,&content)
}
#[tauri::command]
pub fn create_theme_style(app:AppHandle,project_id:String,name:String)->Result<Vec<String>,String>{
    if !safe_style_name(&name){return Err("Use a lowercase CSS filename with no path separators".into());}
    let dir=check_theme_dir(&project_dir(&app,&project_id)?)?;
    fs::create_dir_all(&dir).map_err(|e|e.to_string())?;
    let mut order=style_order(&dir)?;
    if order.len()>=MAX_EXTRA_STYLES{return Err("Limit: 12 additional CSS files".into());}
    if order.contains(&name){return Err("CSS filename already exists".into());}
    let path=dir.join(&name);
    let mut file=fs::OpenOptions::new().create_new(true).write(true).open(&path).map_err(|e|e.to_string())?;
    file.write_all(format!("/* {name} */\n").as_bytes()).map_err(|e|e.to_string())?;
    file.sync_all().map_err(|e|e.to_string())?;
    order.push(name);
    if let Err(e)=write_style_order(&dir,&order){let _=fs::remove_file(path);return Err(e);}
    let mut result=vec!["custom.css".into()];result.extend(order);Ok(result)
}
#[tauri::command]
pub fn reorder_theme_styles(app:AppHandle,project_id:String,names:Vec<String>)->Result<Vec<String>,String>{
    let dir=check_theme_dir(&project_dir(&app,&project_id)?)?;
    let current=style_order(&dir)?;
    if names.first().map(String::as_str)!=Some("custom.css") ||
      names.len()!=current.len()+1 || 
      names[1..].iter().collect::<HashSet<_>>()!=current.iter().collect::<HashSet<_>>() {
        return Err("Style order must preserve every file and keep custom.css first".into());
    }
    write_style_order(&dir,&names[1..])?;
    Ok(names)
}

#[tauri::command]
pub fn load_theme_css(app: AppHandle, project_id: String) -> Result<String, String> {
    let project = project_dir(&app, &project_id)?;
    source_style(&project,"custom.css")
}

#[tauri::command]
pub fn save_theme_css(app: AppHandle, project_id: String, content: String) -> Result<(), String> {
    let dir=check_theme_dir(&project_dir(&app,&project_id)?)?;
    save_css_at(&dir,"custom.css",&content)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn temp() -> PathBuf {
        let nonce=SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let root=std::env::temp_dir().join(format!("paglora-css-{}-{nonce}",std::process::id()));
        fs::create_dir_all(root.join("theme")).unwrap();
        root
    }
    #[test]
    fn preview_and_export_share_explicit_order_and_legacy_css() {
        let root=temp();let dir=root.join("theme");
        assert!(site_css(&root).unwrap().is_none());
        fs::write(dir.join("custom.css"),":root{--z:0}").unwrap();
        assert_eq!(source_style(&root,"custom.css").unwrap(),":root{--z:0}");
        fs::write(dir.join("first.css"),":root{--z:1}").unwrap();
        fs::write(dir.join("last.css"),":root{--z:2}").unwrap();
        write_style_order(&dir,&["first.css".into(),"last.css".into()]).unwrap();
        let css=site_css(&root).unwrap().unwrap();
        assert!(css.find("theme/custom.css").unwrap()<css.find("theme/first.css").unwrap());
        assert!(css.find("theme/first.css").unwrap()<css.find("theme/last.css").unwrap());
        write_style_order(&dir,&["last.css".into(),"first.css".into()]).unwrap();
        let reordered=site_css(&root).unwrap().unwrap();
        assert!(reordered.find("theme/last.css").unwrap()<reordered.find("theme/first.css").unwrap());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn stylesheet_manifest_rejects_duplicates_traversal_and_missing_files() {
        let root=temp();let dir=root.join("theme");
        for value in ["../escape.css","custom.css","folder/child.css","Bad.css","-bad.css","bad-.css",".css"] {
            assert!(!safe_style_name(value),"{value}");
        }
        assert!(write_style_order(&dir,&["dup.css".into(),"dup.css".into()]).is_err());
        fs::write(dir.join("styles.json"),r#"{"version":1,"files":["../escape.css"]}"#).unwrap();
        assert!(site_css(&root).is_err());
        fs::write(dir.join("styles.json"),r#"{"version":1,"files":["absent.css"]}"#).unwrap();
        assert!(site_css(&root).is_err());
        fs::write(dir.join("absent.css"),"a{color:red}").unwrap();
        assert!(site_css(&root).unwrap().unwrap().contains("a{color:red}"));
        fs::write(dir.join("absent.css"),"x".repeat(MAX_CSS_BYTES+1)).unwrap();
        assert!(site_css(&root).is_err());
        fs::remove_dir_all(root).unwrap();
    }
}
