use chrono::{Local, Timelike};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupConfig {
    pub auto_backup_enabled: bool,
    pub backup_folder: String,
    pub retention_count: usize,
    pub backup_on_close: bool,
    pub safety_backup_2359: bool,
    pub last_successful_backup: Option<String>,
    pub last_backup_status: Option<String>,
    pub last_error: Option<String>,
    pub last_backup_date: Option<String>,
    pub last_backup_size_bytes: u64,
    pub last_backup_format: Option<String>,
    pub api_base_url: Option<String>,
    pub cached_token: Option<String>,
}

impl Default for BackupConfig {
    fn default() -> Self {
        let default_dir = dirs_fallback();
        Self {
            auto_backup_enabled: true,
            backup_folder: default_dir.to_string_lossy().to_string(),
            retention_count: 30,
            backup_on_close: true,
            safety_backup_2359: true,
            last_successful_backup: None,
            last_backup_status: None,
            last_error: None,
            last_backup_date: None,
            last_backup_size_bytes: 0,
            last_backup_format: None,
            api_base_url: Some("https://zamzamfood.up.railway.app/api/v1".to_string()),
            cached_token: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupFileInfo {
    pub filename: String,
    pub filepath: String,
    pub size_bytes: u64,
    pub size_formatted: String,
    pub created_at: String,
    pub is_valid: bool,
    pub format: String,
}

pub struct BackupState {
    pub config: Mutex<BackupConfig>,
    pub config_file_path: PathBuf,
}

fn dirs_fallback() -> PathBuf {
    if let Some(mut doc_dir) = dirs::document_dir() {
        doc_dir.push("ZamzamFoods_Backups");
        doc_dir
    } else if let Some(mut home) = dirs::home_dir() {
        home.push("ZamzamFoods_Backups");
        home
    } else {
        PathBuf::from("./zamzam_backups")
    }
}

pub fn get_config_path(app: &AppHandle) -> PathBuf {
    if let Ok(mut path) = app.path().app_config_dir() {
        let _ = fs::create_dir_all(&path);
        path.push("zamzam_backup_config.json");
        path
    } else {
        let mut path = dirs_fallback();
        let _ = fs::create_dir_all(&path);
        path.push("zamzam_backup_config.json");
        path
    }
}

impl BackupState {
    pub fn new(app: &AppHandle) -> Self {
        let config_file_path = get_config_path(app);
        let mut config = BackupConfig::default();

        if config_file_path.exists() {
            if let Ok(data) = fs::read_to_string(&config_file_path) {
                if let Ok(loaded) = serde_json::from_str::<BackupConfig>(&data) {
                    config = loaded;
                }
            }
        } else {
            // Write initial default config
            if let Ok(json_str) = serde_json::to_string_pretty(&config) {
                let _ = fs::write(&config_file_path, json_str);
            }
        }

        Self {
            config: Mutex::new(config),
            config_file_path,
        }
    }

    pub fn save(&self) -> Result<(), String> {
        let cfg = self.config.lock().map_err(|e| e.to_string())?.clone();
        let json_str = serde_json::to_string_pretty(&cfg).map_err(|e| e.to_string())?;
        if let Some(parent) = self.config_file_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        fs::write(&self.config_file_path, json_str).map_err(|e| e.to_string())?;
        Ok(())
    }
}

fn format_bytes(bytes: u64) -> String {
    if bytes < 1024 {
        format!("{} B", bytes)
    } else if bytes < 1024 * 1024 {
        format!("{:.1} KB", bytes as f64 / 1024.0)
    } else if bytes < 1024 * 1024 * 1024 {
        format!("{:.2} MB", bytes as f64 / (1024.0 * 1024.0))
    } else {
        format!("{:.2} GB", bytes as f64 / (1024.0 * 1024.0 * 1024.0))
    }
}

/// Strictly validates the downloaded backup file.
/// Validates that:
/// 1. File exists and has meaningful length (> 100 bytes)
/// 2. Has valid PostgreSQL SQL headers or valid SQL structure or valid JSON snapshot
/// 3. Does not contain error messages or HTML 404/500 responses
pub fn validate_backup_content(bytes: &[u8]) -> Result<(bool, String), String> {
    if bytes.len() < 100 {
        return Err(format!(
            "Backup verification failed: File size too small ({} bytes). Expected full database dump.",
            bytes.len()
        ));
    }

    // Inspect first 2048 bytes
    let sample_len = bytes.len().min(2048);
    let sample = String::from_utf8_lossy(&bytes[..sample_len]);

    // Check for HTTP errors masquerading as backup
    if sample.contains("<html") || sample.contains("<!DOCTYPE html") || sample.contains("\"error\":") {
        return Err("Backup verification failed: Received HTML or error response instead of SQL/dump data.".to_string());
    }

    if sample.contains("Zamzam Foods")
        || sample.contains("PostgreSQL")
        || sample.contains("BEGIN;")
        || sample.contains("INSERT INTO")
        || sample.contains("PRAGMA")
        || sample.contains("CREATE TABLE")
    {
        Ok((true, "postgresql-sql".to_string()))
    } else if sample.contains("\"backup_info\"") && sample.contains("\"records\"") {
        Ok((true, "json-snapshot".to_string()))
    } else if bytes.starts_with(&[0x1f, 0x8b]) {
        // Gzip header
        Ok((true, "gzip-compressed".to_string()))
    } else {
        // Generic SQL check
        if sample.contains("INSERT") || sample.contains("CREATE") || sample.contains("SELECT") {
            Ok((true, "sql".to_string()))
        } else {
            Err("Backup verification failed: Unknown format or invalid database dump structure.".to_string())
        }
    }
}

/// Executes a native database backup:
/// 1. Calls the Django backend backup API endpoint
/// 2. Validates the content before saving
/// 3. Atomically writes to the user's chosen folder
/// 4. Manages backup retention (never deleting previous backups on failure)
/// 5. Prevents duplicate daily backups if triggered automatically
pub async fn perform_native_backup(
    state: &BackupState,
    is_automated: bool,
    force_manual: bool,
    override_token: Option<String>,
) -> Result<BackupFileInfo, String> {
    let mut config = {
        let guard = state.config.lock().map_err(|e| e.to_string())?;
        guard.clone()
    };

    let today_str = Local::now().format("%Y-%m-%d").to_string();

    // Prevent duplicate daily backups for automated runs
    if is_automated && !force_manual {
        if let Some(ref last_date) = config.last_backup_date {
            if last_date == &today_str && config.last_backup_status.as_deref() == Some("SUCCESS") {
                log::info!("Daily backup already completed for today ({today_str}). Skipping duplicate.");
                return Ok(BackupFileInfo {
                    filename: config.last_successful_backup.clone().unwrap_or_default(),
                    filepath: config.backup_folder.clone(),
                    size_bytes: config.last_backup_size_bytes,
                    size_formatted: format_bytes(config.last_backup_size_bytes),
                    created_at: today_str,
                    is_valid: true,
                    format: config.last_backup_format.clone().unwrap_or_else(|| "postgresql-sql".to_string()),
                });
            }
        }
    }

    if let Some(tok) = override_token {
        if !tok.trim().is_empty() {
            config.cached_token = Some(tok.trim().to_string());
        }
    }

    let backup_dir = PathBuf::from(&config.backup_folder);
    if let Err(e) = fs::create_dir_all(&backup_dir) {
        let err = format!("Cannot create or access backup folder '{:?}': {}", backup_dir, e);
        let mut guard = state.config.lock().map_err(|e| e.to_string())?;
        guard.last_backup_status = Some("FAILED".to_string());
        guard.last_error = Some(err.clone());
        let _ = state.save();
        return Err(err);
    }

    let base_url = config
        .api_base_url
        .clone()
        .unwrap_or_else(|| "https://zamzamfood.up.railway.app/api/v1".to_string());
    let endpoint = format!("{}/database/backup/", base_url.trim_end_matches('/'));

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| format!("Failed to initialize HTTP client: {}", e))?;

    let mut req = client.post(&endpoint).json(&serde_json::json!({
        "format": "sql",
        "type": "full"
    }));

    if let Some(ref token) = config.cached_token {
        req = req.header("Authorization", format!("Bearer {}", token));
    }

    log::info!("Initiating native database backup from: {}", endpoint);

    let resp = match req.send().await {
        Ok(r) => r,
        Err(e) => {
            let err = format!("Network failure communicating with Zamzam backup API: {}", e);
            let mut guard = state.config.lock().map_err(|e| e.to_string())?;
            guard.last_backup_status = Some("FAILED".to_string());
            guard.last_error = Some(err.clone());
            let _ = state.save();
            return Err(err);
        }
    };

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        let err = format!("Backup request rejected by server (HTTP {}): {}", status, body);
        let mut guard = state.config.lock().map_err(|e| e.to_string())?;
        guard.last_backup_status = Some("FAILED".to_string());
        guard.last_error = Some(err.clone());
        let _ = state.save();
        return Err(err);
    }

    let raw_bytes = match resp.bytes().await {
        Ok(b) => b,
        Err(e) => {
            let err = format!("Failed reading backup payload stream: {}", e);
            let mut guard = state.config.lock().map_err(|e| e.to_string())?;
            guard.last_backup_status = Some("FAILED".to_string());
            guard.last_error = Some(err.clone());
            let _ = state.save();
            return Err(err);
        }
    };

    // 1. Strict Content Validation
    let (_, detected_format) = match validate_backup_content(&raw_bytes) {
        Ok(res) => res,
        Err(err) => {
            log::error!("Backup content validation failed: {}", err);
            let mut guard = state.config.lock().map_err(|e| e.to_string())?;
            guard.last_backup_status = Some("FAILED".to_string());
            guard.last_error = Some(err.clone());
            let _ = state.save();
            return Err(err);
        }
    };

    // 2. Compute Checksum
    let mut hasher = Sha256::new();
    hasher.update(&raw_bytes);
    let _computed_checksum = format!("{:x}", hasher.finalize());

    // 3. Atomic File Writing
    let now = Local::now();
    let timestamp = now.format("%Y%m%d_%H%M%S").to_string();
    let file_ext = if detected_format == "json-snapshot" { "json" } else { "sql" };
    let filename = format!("zamzam_backup_postgresql_{}.{}", timestamp, file_ext);
    let final_path = backup_dir.join(&filename);
    let temp_path = backup_dir.join(format!(".{}.tmp", filename));

    {
        let mut file = match File::create(&temp_path) {
            Ok(f) => f,
            Err(e) => {
                let err = format!("Failed creating temporary backup file '{:?}': {}", temp_path, e);
                let mut guard = state.config.lock().map_err(|e| e.to_string())?;
                guard.last_backup_status = Some("FAILED".to_string());
                guard.last_error = Some(err.clone());
                let _ = state.save();
                return Err(err);
            }
        };

        if let Err(e) = file.write_all(&raw_bytes) {
            let _ = fs::remove_file(&temp_path);
            let err = format!("Failed writing backup content: {}", e);
            let mut guard = state.config.lock().map_err(|e| e.to_string())?;
            guard.last_backup_status = Some("FAILED".to_string());
            guard.last_error = Some(err.clone());
            let _ = state.save();
            return Err(err);
        }

        if let Err(e) = file.sync_all() {
            let _ = fs::remove_file(&temp_path);
            let err = format!("Failed syncing backup to disk: {}", e);
            let mut guard = state.config.lock().map_err(|e| e.to_string())?;
            guard.last_backup_status = Some("FAILED".to_string());
            guard.last_error = Some(err.clone());
            let _ = state.save();
            return Err(err);
        }
    }

    // Atomic rename from temp to final
    if let Err(e) = fs::rename(&temp_path, &final_path) {
        let _ = fs::remove_file(&temp_path);
        let err = format!("Failed finalizing backup file: {}", e);
        let mut guard = state.config.lock().map_err(|e| e.to_string())?;
        guard.last_backup_status = Some("FAILED".to_string());
        guard.last_error = Some(err.clone());
        let _ = state.save();
        return Err(err);
    }

    let size_bytes = raw_bytes.len() as u64;

    // 4. Update and Persist Config on Success
    {
        let mut guard = state.config.lock().map_err(|e| e.to_string())?;
        guard.last_successful_backup = Some(filename.clone());
        guard.last_backup_status = Some("SUCCESS".to_string());
        guard.last_error = None;
        guard.last_backup_date = Some(today_str.clone());
        guard.last_backup_size_bytes = size_bytes;
        guard.last_backup_format = Some(detected_format.clone());
    }
    let _ = state.save();

    // 5. Configurable Retention Pruning (Only performed AFTER successful backup verification)
    apply_retention_policy(&backup_dir, config.retention_count);

    log::info!("Successfully created and verified backup: {:?}", final_path);

    Ok(BackupFileInfo {
        filename,
        filepath: final_path.to_string_lossy().to_string(),
        size_bytes,
        size_formatted: format_bytes(size_bytes),
        created_at: now.format("%Y-%m-%d %H:%M:%S").to_string(),
        is_valid: true,
        format: detected_format,
    })
}

/// Applies retention policy to keep the newest N backups.
/// Never deletes previous backups if the recent backup failed.
fn apply_retention_policy(dir: &Path, max_count: usize) {
    if max_count == 0 {
        return;
    }

    if let Ok(entries) = fs::read_dir(dir) {
        let mut backup_files: Vec<(PathBuf, std::time::SystemTime)> = Vec::new();

        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if name.starts_with("zamzam_backup_") && (name.ends_with(".sql") || name.ends_with(".json")) {
                        if let Ok(meta) = entry.metadata() {
                            if let Ok(modified) = meta.modified() {
                                backup_files.push((path, modified));
                            }
                        }
                    }
                }
            }
        }

        // Sort descending: newest first
        backup_files.sort_by(|a, b| b.1.cmp(&a.1));

        if backup_files.len() > max_count {
            for (old_path, _) in &backup_files[max_count..] {
                log::info!("Retention policy: removing older backup {:?}", old_path);
                let _ = fs::remove_file(old_path);
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// TAURI COMMANDS
// ─────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_backup_config(state: tauri::State<'_, Arc<BackupState>>) -> Result<BackupConfig, String> {
    let guard = state.config.lock().map_err(|e| e.to_string())?;
    Ok(guard.clone())
}

#[tauri::command]
pub fn save_backup_config(
    state: tauri::State<'_, Arc<BackupState>>,
    config: BackupConfig,
) -> Result<BackupConfig, String> {
    {
        let mut guard = state.config.lock().map_err(|e| e.to_string())?;
        *guard = config;
    }
    state.save()?;
    let guard = state.config.lock().map_err(|e| e.to_string())?;
    Ok(guard.clone())
}

#[tauri::command]
pub async fn trigger_backup_now(
    state: tauri::State<'_, Arc<BackupState>>,
    auth_token: Option<String>,
) -> Result<BackupFileInfo, String> {
    perform_native_backup(&state, false, true, auth_token).await
}

#[tauri::command]
pub fn get_backup_history(state: tauri::State<'_, Arc<BackupState>>) -> Result<Vec<BackupFileInfo>, String> {
    let config = {
        let guard = state.config.lock().map_err(|e| e.to_string())?;
        guard.clone()
    };

    let dir = PathBuf::from(&config.backup_folder);
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut list = Vec::new();

    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if name.starts_with("zamzam_backup_") && (name.ends_with(".sql") || name.ends_with(".json")) {
                        if let Ok(meta) = entry.metadata() {
                            let size_bytes = meta.len();
                            let modified_time = meta
                                .modified()
                                .map(|t| {
                                    let dt: chrono::DateTime<Local> = t.into();
                                    dt.format("%Y-%m-%d %H:%M:%S").to_string()
                                })
                                .unwrap_or_else(|_| "Unknown".to_string());

                            let is_sql = name.ends_with(".sql");
                            let format = if is_sql { "postgresql-sql".to_string() } else { "json-snapshot".to_string() };

                            list.push(BackupFileInfo {
                                filename: name.to_string(),
                                filepath: path.to_string_lossy().to_string(),
                                size_bytes,
                                size_formatted: format_bytes(size_bytes),
                                created_at: modified_time,
                                is_valid: size_bytes > 100,
                                format,
                            });
                        }
                    }
                }
            }
        }
    }

    // Sort newest first
    list.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(list)
}

#[tauri::command]
pub fn validate_backup_file(filepath: String) -> Result<bool, String> {
    let path = PathBuf::from(filepath);
    if !path.exists() {
        return Err("File does not exist".to_string());
    }
    let mut file = File::open(&path).map_err(|e| e.to_string())?;
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer).map_err(|e| e.to_string())?;
    let (valid, _) = validate_backup_content(&buffer)?;
    Ok(valid)
}

/// Starts the background scheduler for:
/// 1. Safety backup at 23:59 if the daily closing backup was not completed
pub fn start_backup_scheduler(state: Arc<BackupState>) {
    std::thread::spawn(move || {
        log::info!("Zamzam Foods native backup scheduler daemon started.");
        loop {
            std::thread::sleep(Duration::from_secs(30));

            let now = Local::now();
            let is_safety_time = now.hour() == 23 && now.minute() == 59;

            if is_safety_time {
                let should_run = {
                    if let Ok(guard) = state.config.lock() {
                        if guard.auto_backup_enabled && guard.safety_backup_2359 {
                            let today = now.format("%Y-%m-%d").to_string();
                            let already_done = guard.last_backup_date.as_deref() == Some(&today)
                                && guard.last_backup_status.as_deref() == Some("SUCCESS");
                            !already_done
                        } else {
                            false
                        }
                    } else {
                        false
                    }
                };

                if should_run {
                    log::info!("23:59 Safety Backup triggered: Daily closing backup was not completed.");
                    let rt = tokio::runtime::Builder::new_current_thread()
                        .enable_all()
                        .build();

                    if let Ok(runtime) = rt {
                        let state_clone = Arc::clone(&state);
                        runtime.block_on(async {
                            let _ = perform_native_backup(&state_clone, true, false, None).await;
                        });
                    }

                    // Sleep for 65s so we don't repeat in the same minute
                    std::thread::sleep(Duration::from_secs(65));
                }
            }
        }
    });
}

/// Handler for application shutdown:
/// If backup_on_close is enabled and today's backup has not yet run,
/// performs a clean backup before the application exits.
pub fn handle_closing_backup(state: &BackupState) {
    let should_run = {
        if let Ok(guard) = state.config.lock() {
            if guard.auto_backup_enabled && guard.backup_on_close {
                let today = Local::now().format("%Y-%m-%d").to_string();
                let already_done = guard.last_backup_date.as_deref() == Some(&today)
                    && guard.last_backup_status.as_deref() == Some("SUCCESS");
                !already_done
            } else {
                false
            }
        } else {
            false
        }
    };

    if should_run {
        log::info!("Application closing: executing automatic closing database backup...");
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build();

        if let Ok(runtime) = rt {
            runtime.block_on(async {
                match perform_native_backup(state, true, false, None).await {
                    Ok(info) => log::info!("Closing backup finished successfully: {}", info.filename),
                    Err(e) => log::error!("Closing backup encountered error: {}", e),
                }
            });
        }
    }
}
