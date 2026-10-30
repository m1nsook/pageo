mod projects;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            projects::list_projects,
            projects::create_project,
            projects::load_project,
            projects::save_document,
            projects::projects_directory
        ])
        .run(tauri::generate_context!())
        .expect("error while running Pageo");
}
