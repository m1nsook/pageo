//! Windows native folder selection without broad renderer file access.
//! A returned path is not permission to touch files: storage.rs validates it.
#[cfg(target_os = "windows")]
fn choose() -> Result<Option<String>, String> {
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize,
        CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED,
    };
    use windows::Win32::UI::Shell::{
        FileOpenDialog, IFileOpenDialog, FOS_PICKFOLDERS, FOS_FORCEFILESYSTEM,
        SIGDN_FILESYSPATH,
    };

    // Dialogs require an STA COM apartment; do not block Tauri's UI thread.
    unsafe {
        CoInitializeEx(None, COINIT_APARTMENTTHREADED)
            .ok().map_err(|error| format!("Folder picker initialization failed: {error}"))?;
        struct Apartment;
        impl Drop for Apartment {
            fn drop(&mut self) { unsafe { CoUninitialize(); } }
        }
        let _apartment = Apartment;
        let dialog: IFileOpenDialog = CoCreateInstance(&FileOpenDialog, None, CLSCTX_INPROC_SERVER)
            .map_err(|error| format!("Folder dialog unavailable: {error}"))?;
        let current = dialog.GetOptions().map_err(|error| error.to_string())?;
        dialog.SetOptions(current | FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM)
            .map_err(|error| error.to_string())?;
        // Dismissal is not an error and never updates the selected path.
        if dialog.Show(None).is_err() { return Ok(None); }
        let item = dialog.GetResult().map_err(|error| error.to_string())?;
        let selected = item.GetDisplayName(SIGDN_FILESYSPATH).map_err(|error| error.to_string())?;
        let text = selected.to_string().map_err(|error| error.to_string());
        CoTaskMemFree(Some(selected.0.cast()));
        text.map(Some)
    }
}

#[tauri::command]
pub async fn pick_storage_folder() -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        return tauri::async_runtime::spawn_blocking(choose).await
            .map_err(|error| format!("Folder picker failed: {error}"))?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Native folder selection currently requires Windows desktop.".into())
    }
}
