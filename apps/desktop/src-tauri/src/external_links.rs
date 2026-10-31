//! Restricted external navigation. Do not accept renderer-controlled URLs.
const DOCUMENTATION_URL: &str = "https://m1nsook.github.io/paglora-docs/";

#[tauri::command]
pub fn open_documentation() -> Result<(), String> {
    documentation_command().spawn().map(|_| ())
        .map_err(|error| format!("Unable to open the default browser: {error}"))
}

fn documentation_command() -> std::process::Command {
    #[cfg(target_os = "windows")]
    {
        let mut cmd = std::process::Command::new("rundll32.exe");
        cmd.arg("url.dll,FileProtocolHandler").arg(DOCUMENTATION_URL);
        cmd
    }
    #[cfg(target_os = "macos")]
    {
        let mut cmd = std::process::Command::new("open");
        cmd.arg(DOCUMENTATION_URL);
        cmd
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let mut cmd = std::process::Command::new("xdg-open");
        cmd.arg(DOCUMENTATION_URL);
        cmd
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn documentation_url_is_fixed_https_not_renderer_controlled() {
        assert_eq!(DOCUMENTATION_URL, "https://m1nsook.github.io/paglora-docs/");
        assert!(documentation_command().get_args().any(|arg| arg == DOCUMENTATION_URL));
    }
}
