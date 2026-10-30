mod projects;
mod pages;
mod sites;
mod source;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            projects::list_projects,
            projects::create_project,
            projects::load_project,
            projects::save_document,
            projects::projects_directory,
            pages::list_pages, pages::load_page, pages::create_page,
            pages::rename_page, pages::duplicate_page, pages::delete_page,
            pages::reorder_pages, pages::save_page, pages::set_page_visibility,
            pages::set_page_layout, pages::set_page_navigation_group,
            sites::load_site_settings, sites::save_site_settings, sites::build_site,
            sites::preview_site_page,
            source::load_theme_css, source::save_theme_css
        ])
        .run(tauri::generate_context!())
        .expect("error while running Paglora");
}
