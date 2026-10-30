use std::{env, path::PathBuf, process::Command};

fn main() {
    // Compile the browser-only runtime before rustc expands the include_str!
    // expressions in sites.rs. Keep bundled assets out of the Git tree.
    let manifest = PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR missing"));
    let runtime = manifest.join("../../../packages/site-runtime");
    for path in ["build.mjs", "src/index.js", "src/search.js"] {
        println!("cargo:rerun-if-changed={}", runtime.join(path).display());
    }

    let output = Command::new("bun")
        .arg("build.mjs")
        .current_dir(&runtime)
        .output()
        .unwrap_or_else(|error| panic!("Cannot build Paglora site runtime: Bun is required ({error})"));
    if !output.status.success() {
        panic!(
            "Paglora site runtime build failed ({}):\n{}\n{}",
            output.status,
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr),
        );
    }

    tauri_build::build()
}
