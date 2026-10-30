mod projects;
mod pages;

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
            pages::reorder_pages, pages::save_page
        ])
        .run(tauri::generate_context!())
        .expect("error while running Pageo");
}
