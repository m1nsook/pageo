use std::{env, path::Path};

fn main() {
    let args: Vec<_> = env::args().skip(1).collect();
    if args.len() != 3 {
        eprintln!("Usage: paglora-build <project-folder> <website-output-folder> <prepared-pages.json>");
        std::process::exit(2);
    }
    match paglora_lib::build_headless(Path::new(&args[0]), Path::new(&args[1]), Path::new(&args[2])) {
        Ok(report) => println!("{report}"),
        Err(error) => { eprintln!("Paglora headless build failed: {error}"); std::process::exit(1); }
    }
}
