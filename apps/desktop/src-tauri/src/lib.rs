mod projects;
mod storage;
mod pages;
mod sites;
mod source;
mod backup;
mod updates;

/// Build a website from a local project without launching Desktop.
pub fn build_headless(project_dir: &std::path::Path, output: &std::path::Path, rendered: &std::path::Path) -> Result<String, String> {
    sites::build_headless(project_dir, output, rendered).and_then(|result| serde_json::to_string(&result).map_err(|e| e.to_string()))
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            projects::list_projects,
            projects::create_project,
            projects::load_project,
            projects::save_document,
            projects::projects_directory, projects::trash_project,
            storage::project_storage_directory, storage::migrate_project_storage,
            backup::export_project_backup, backup::import_project_backup,
            updates::check_studio_update, updates::install_studio_update,
            pages::list_pages, pages::load_page, pages::create_page,
            pages::rename_page, pages::duplicate_page, pages::delete_page,
            pages::reorder_pages, pages::save_page, pages::set_page_visibility,
            pages::set_page_layout, pages::set_page_navigation_group,
            sites::load_site_settings, sites::save_site_settings, sites::build_site,
            sites::preview_site_page, sites::import_site_asset,
            source::load_theme_css, source::save_theme_css
        ])
        .run(tauri::generate_context!())
        .expect("error while running Paglora");
}
