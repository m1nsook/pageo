//! Studio release updater. Only stable GitHub releases are considered.
//! Tauri verifies the package signature against the embedded public key
//! before installing; no raw downloaded bytes or private keys are exposed.
use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AvailableStudioUpdate {
    version: String,
    notes: String,
}

#[tauri::command]
pub async fn check_studio_update(app: AppHandle) -> Result<Option<AvailableStudioUpdate>, String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    let update = updater.check().await.map_err(|e| e.to_string())?;
    Ok(update.map(|release| AvailableStudioUpdate {
        version: release.version,
        notes: release.body.unwrap_or_default(),
    }))
}

#[tauri::command]
pub async fn install_studio_update(app: AppHandle, expected_version: String) -> Result<(), String> {
    // Re-check the stable endpoint instead of trusting an unverified version
    // or URL supplied by the frontend. The plugin verifies the signed bundle.
    let updater = app.updater().map_err(|e| e.to_string())?;
    let available = updater.check().await.map_err(|e| e.to_string())?
        .ok_or("No newer stable Paglora release is available")?;
    if available.version != expected_version {
        return Err("Available release changed; check for updates again".into());
    }
    available.download_and_install(|_bytes, _total| {}, || {}).await
        .map_err(|e| format!("Signed Studio update could not be installed: {e}"))
}
