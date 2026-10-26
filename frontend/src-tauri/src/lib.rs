pub mod backup;
pub mod db;

use std::sync::Arc;
use tauri::{Manager, WindowEvent};
use backup::{BackupState, handle_closing_backup, start_backup_scheduler};
use db::DbState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let backup_state = Arc::new(BackupState::new(app.handle()));
            app.manage(Arc::clone(&backup_state));

            let db_state = Arc::new(DbState::new());
            app.manage(Arc::clone(&db_state));

            // Start automated 23:59 safety backup scheduler
            start_backup_scheduler(Arc::clone(&backup_state));

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { .. } = event {
                if let Some(state) = window.try_state::<Arc<BackupState>>() {
                    handle_closing_backup(&state);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            backup::get_backup_config,
            backup::save_backup_config,
            backup::trigger_backup_now,
            backup::get_backup_history,
            backup::validate_backup_file,
            db::db_ping,
            db::db_get_config,
            db::db_save_config,
            db::db_test_connection,
            db::db_init_schema,
            db::db_get_dashboard_summary,
            db::db_get_customers,
            db::db_save_customer,
            db::db_get_customer_ledger,
            db::db_get_products,
            db::db_save_product,
            db::db_get_customer_prices,
            db::db_set_customer_price,
            db::db_get_opening_due,
            db::db_save_order,
            db::db_get_orders,
            db::db_get_order,
            db::db_record_payment,
            db::db_get_expenses,
            db::db_save_expense,
            db::db_delete_expense,
            db::db_get_staff,
            db::db_save_staff,
            db::db_get_attendance,
            db::db_save_attendance,
            db::db_get_settings,
            db::db_update_settings,
            db::db_verify_pin,
            db::db_get_documents,
            db::db_save_document,
            db::db_delete_document,
            db::db_get_sales_report,
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
