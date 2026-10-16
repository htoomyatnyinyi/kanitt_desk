use std::{
    fs::{self, OpenOptions},
    io::Write,
    time::{SystemTime, UNIX_EPOCH},
};
#[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
use std::process::Command;
use serde::Serialize;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn print_receipt_silently(receipt_text: String, printer_name: Option<String>) -> Result<(), String> {
    if receipt_text.trim().is_empty() || receipt_text.len() > 64 * 1024 {
        return Err("Receipt content is empty or too large.".into());
    }

    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_nanos();
    let path = std::env::temp_dir().join(format!(
        "kanitt-receipt-{}-{stamp}.txt",
        std::process::id()
    ));
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&path)
        .map_err(|error| format!("Could not prepare receipt: {error}"))?;
    if let Err(error) = file.write_all(receipt_text.as_bytes()) {
        let _ = fs::remove_file(&path);
        return Err(format!("Could not write receipt: {error}"));
    }
    drop(file);

    let printer_name = printer_name
        .map(|name| name.trim().to_owned())
        .filter(|name| !name.is_empty());
    if printer_name.as_ref().is_some_and(|name| {
        name.len() > 256 || name.chars().any(char::is_control)
    }) {
        let _ = fs::remove_file(&path);
        return Err("Printer name is too long.".into());
    }

    #[cfg(target_os = "windows")]
    let result = {
        let path_literal = path.to_string_lossy().replace('\'', "''");
        let command = if let Some(name) = &printer_name {
            let printer_literal = name.replace('\'', "''");
            format!("$ErrorActionPreference='Stop'; Get-Content -LiteralPath '{path_literal}' -Raw -Encoding UTF8 | Out-Printer -Name '{printer_literal}'")
        } else {
            format!("$ErrorActionPreference='Stop'; Get-Content -LiteralPath '{path_literal}' -Raw -Encoding UTF8 | Out-Printer")
        };
        Command::new("powershell.exe")
            .args(["-NoProfile", "-NonInteractive", "-Command", &command])
            .output()
    };

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    let result = {
        let mut command = Command::new("lp");
        if let Some(name) = &printer_name {
            command.args(["-d", name]);
        }
        command.arg(&path).output()
    };

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    let result: Result<std::process::Output, std::io::Error> = Err(std::io::Error::new(
        std::io::ErrorKind::Unsupported,
        "Direct printing is not supported on this platform.",
    ));

    let _ = fs::remove_file(&path);
    let output = result.map_err(|error| format!("Could not start the system printer: {error}"))?;
    if !output.status.success() {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_owned();
        return Err(if detail.is_empty() {
            "The OS default printer did not accept the receipt.".into()
        } else {
            format!("The OS default printer rejected the receipt: {detail}")
        });
    }
    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PrinterOption {
    name: String,
    is_default: bool,
}

#[tauri::command]
fn list_printers() -> Result<Vec<PrinterOption>, String> {
    #[cfg(target_os = "windows")]
    let output = Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "Get-Printer | ForEach-Object { Write-Output ($_.Name + [char]9 + $_.Default) }",
        ])
        .output();

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    let output = Command::new("lpstat").arg("-a").output();

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    let output: Result<std::process::Output, std::io::Error> = Err(std::io::Error::new(
        std::io::ErrorKind::Unsupported,
        "Printer discovery is not supported on this platform.",
    ));

    let output = output.map_err(|error| format!("Could not list system printers: {error}"))?;
    if !output.status.success() {
        return Err("Could not list system printers. Check the OS printer setup.".into());
    }
    let stdout = String::from_utf8_lossy(&output.stdout);

    #[cfg(target_os = "windows")]
    let printers = stdout
        .lines()
        .filter_map(|line| {
            let (name, is_default) = line.split_once('\t')?;
            let name = name.trim();
            (!name.is_empty()).then(|| PrinterOption {
                name: name.to_owned(),
                is_default: is_default.trim().eq_ignore_ascii_case("true"),
            })
        })
        .collect();

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    let printers = {
        let default_output = Command::new("lpstat").arg("-d").output().ok();
        let default_name = default_output
            .filter(|result| result.status.success())
            .map(|result| String::from_utf8_lossy(&result.stdout).trim().to_owned())
            .and_then(|line| line.split_once(':').map(|(_, name)| name.trim().to_owned()));
        stdout
            .lines()
            .filter_map(|line| line.split_once(" accepting requests").map(|(name, _)| name.trim()))
            .filter(|name| !name.is_empty())
            .map(|name| PrinterOption {
                name: name.to_owned(),
                is_default: default_name.as_deref() == Some(name),
            })
            .collect()
    };

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    let printers: Vec<PrinterOption> = Vec::new();

    Ok(printers)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_thermal_printer::init())
        .invoke_handler(tauri::generate_handler![greet, list_printers, print_receipt_silently])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

