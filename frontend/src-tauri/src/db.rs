use chrono::{NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use std::env;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio_postgres::{Client, NoTls};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbConfig {
    pub host: String,
    pub port: u16,
    pub user: String,
    pub password: Option<String>,
    pub dbname: String,
}

impl Default for DbConfig {
    fn default() -> Self {
        Self {
            host: env::var("AIVEN_DB_HOST")
                .or_else(|_| env::var("LOCAL_DB_HOST"))
                .unwrap_or_else(|_| "pg-65e4170-zamzamfoods.h.aivencloud.com".to_string()),
            port: env::var("AIVEN_DB_PORT")
                .or_else(|_| env::var("LOCAL_DB_PORT"))
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(18638),
            user: env::var("AIVEN_DB_USER")
                .or_else(|_| env::var("LOCAL_DB_USER"))
                .unwrap_or_else(|_| "avnadmin".to_string()),
            password: env::var("AIVEN_DB_PASSWORD")
                .or_else(|_| env::var("DATABASE_PASSWORD"))
                .ok(),
            dbname: env::var("AIVEN_DB_NAME")
                .or_else(|_| env::var("LOCAL_DB_NAME"))
                .unwrap_or_else(|_| "defaultdb".to_string()),
        }
    }
}

impl DbConfig {
    pub fn config_path() -> std::path::PathBuf {
        let base = dirs::config_dir()
            .unwrap_or_else(|| std::path::PathBuf::from("."));
        let dir = base.join("ZamzamFoods");
        let _ = std::fs::create_dir_all(&dir);
        dir.join("db_config.json")
    }

    pub fn load() -> Self {
        let p = Self::config_path();
        if let Ok(content) = std::fs::read_to_string(&p) {
            if let Ok(cfg) = serde_json::from_str::<DbConfig>(&content) {
                return cfg;
            }
        }
        Self::default()
    }

    pub fn save(&self) -> Result<(), String> {
        let p = Self::config_path();
        let content = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Serialization error: {}", e))?;
        std::fs::write(&p, content)
            .map_err(|e| format!("Failed to write {}: {}", p.display(), e))
    }

    pub fn to_connection_string(&self) -> String {
        if let Ok(url) = env::var("DATABASE_URL") {
            if !url.trim().is_empty() {
                return url;
            }
        }
        let mut s = format!(
            "host={} port={} user={} dbname={}",
            self.host, self.port, self.user, self.dbname
        );
        if let Some(ref pwd) = self.password {
            if !pwd.is_empty() {
                s.push_str(&format!(" password={}", pwd));
            }
        }
        s
    }
}

pub struct DbState {
    pub config: Mutex<DbConfig>,
    pub client: Mutex<Option<Client>>,
}

impl DbState {
    pub fn new() -> Self {
        Self {
            config: Mutex::new(DbConfig::load()),
            client: Mutex::new(None),
        }
    }

    pub async fn get_client(&self) -> Result<Client, String> {
        let mut client_lock = self.client.lock().await;
        if let Some(ref client) = *client_lock {
            if !client.is_closed() {
                // Connection alive, but in tokio-postgres we need ownership or reference.
                // We'll create a fresh connection per request or maintain a pool.
            }
        }

        let cfg = self.config.lock().await.clone();
        let conn_str = cfg.to_connection_string();

        let (client, connection) = tokio_postgres::connect(&conn_str, NoTls)
            .await
            .map_err(|e| format!("Failed to connect to local PostgreSQL ({}): {}", conn_str, e))?;

        tokio::spawn(async move {
            if let Err(e) = connection.await {
                log::error!("Database connection error: {}", e);
            }
        });

        *client_lock = None;
        Ok(client)
    }
}

// ── Models & Payloads ────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct DashboardSummary {
    pub today_sales: f64,
    pub today_payments: f64,
    pub today_cash: f64,
    pub today_gpay: f64,
    pub total_outstanding: f64,
    pub today_expenses: f64,
    pub net_cash_in_hand: f64,
    pub total_customers: i64,
    pub customers_with_due: i64,
    pub staff_present: i64,
    pub staff_total: i64,
    pub recent_orders_count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CustomerItem {
    pub id: String,
    pub name: String,
    pub owner_name: String,
    pub phone: String,
    pub alternative_phone: String,
    pub address: String,
    pub route_name: String,
    pub opening_due: f64,
    pub current_balance: f64,
    pub notes: String,
    pub is_active: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProductItem {
    pub id: String,
    pub name: String,
    pub code: String,
    pub unit_price: f64,
    pub packet_size: String,
    pub order_number: i32,
    pub is_active: bool,
    pub notes: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CustomerPriceItem {
    pub id: String,
    pub customer_id: String,
    pub product_id: String,
    pub product_name: String,
    pub default_price: f64,
    pub price: f64,
    pub is_active: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OrderItemInput {
    pub product_id: String,
    pub quantity: i32,
    pub unit_price: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveOrderInput {
    pub order_id: Option<String>,
    pub customer_id: String,
    pub bill_date: String,
    pub bill_number: Option<String>,
    pub items: Vec<OrderItemInput>,
    pub discount: Option<f64>,
    pub cash_amount: Option<f64>,
    pub gpay_amount: Option<f64>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OrderItemDetail {
    pub id: String,
    pub product_id: String,
    pub product_name: String,
    pub quantity: i32,
    pub unit_price: f64,
    pub subtotal: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OrderDetail {
    pub id: String,
    pub bill_number: String,
    pub customer_id: String,
    pub customer_name: String,
    pub customer_phone: String,
    pub route_name: String,
    pub bill_date: String,
    pub subtotal: f64,
    pub discount: f64,
    pub total_amount: f64,
    pub previous_due: f64,
    pub payment_amount: f64,
    pub remaining_due: f64,
    pub payment_method: String,
    pub notes: String,
    pub status: String,
    pub items: Vec<OrderItemDetail>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExpenseItem {
    pub id: String,
    pub expense_date: String,
    pub category: String,
    pub amount: f64,
    pub payment_method: String,
    pub description: String,
    pub receipt_reference: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StaffItem {
    pub id: String,
    pub full_name: String,
    pub phone_number: String,
    pub address: String,
    pub joined_date: String,
    pub staff_type: String,
    pub salary_type: String,
    pub monthly_salary: f64,
    pub daily_wage: f64,
    pub is_active: bool,
    pub notes: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AttendanceItem {
    pub staff_id: String,
    pub staff_name: String,
    pub staff_type: String,
    pub default_daily_wage: f64,
    pub status: String,
    pub daily_wage: f64,
    pub notes: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveAttendanceRecord {
    pub staff_id: String,
    pub status: String,
    pub daily_wage: Option<f64>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DocumentItem {
    pub id: String,
    pub title: String,
    pub category: String,
    pub description: String,
    pub document_date: String,
    pub file_name: String,
    pub file_size: i64,
    pub mime_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemSettingsDto {
    pub business_name: String,
    pub phone_number: String,
    pub gst_number: String,
    pub address: String,
    pub upi_id: String,
    pub invoice_footer_notes: String,
    pub pin_code: String,
    pub auto_backup_enabled: bool,
    pub backup_folder: String,
    pub backup_on_close: bool,
    pub fallback_backup_time: String,
    pub retention_count: i32,
    pub last_backup_at: Option<String>,
    pub last_cloud_upload_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveCustomerInput {
    pub id: Option<String>,
    pub name: String,
    pub owner_name: Option<String>,
    pub phone: Option<String>,
    pub alternative_phone: Option<String>,
    pub address: Option<String>,
    pub route_name: Option<String>,
    pub opening_due: Option<f64>,
    pub is_active: Option<bool>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CustomerLedgerItem {
    pub id: String,
    pub created_at: String,
    pub transaction_type: String,
    pub amount: f64,
    pub balance_after: f64,
    pub order_id: Option<String>,
    pub payment_id: Option<String>,
    pub notes: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveProductInput {
    pub id: Option<String>,
    pub name: String,
    pub code: String,
    pub unit_price: f64,
    pub packet_size: Option<String>,
    pub order_number: Option<i32>,
    pub is_active: Option<bool>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RecordPaymentInput {
    pub customer_id: String,
    pub amount: f64,
    pub payment_method: String,
    pub reference_number: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveStaffInput {
    pub id: Option<String>,
    pub full_name: String,
    pub phone_number: Option<String>,
    pub address: Option<String>,
    pub joined_date: Option<String>,
    pub staff_type: Option<String>,
    pub salary_type: Option<String>,
    pub monthly_salary: Option<f64>,
    pub daily_wage: Option<f64>,
    pub is_active: Option<bool>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveDocumentInput {
    pub id: Option<String>,
    pub title: String,
    pub category: Option<String>,
    pub description: Option<String>,
    pub document_date: Option<String>,
    pub file_name: Option<String>,
    pub file_path: Option<String>,
    pub file_size: Option<i64>,
    pub mime_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SalesReportSummary {
    pub total_sales: f64,
    pub total_payments: f64,
    pub total_expenses: f64,
    pub order_count: i64,
    pub payment_count: i64,
    pub start_date: String,
    pub end_date: String,
}

// ── Database IPC Commands ───────────────────────────────────────────────────

#[derive(Serialize)]
pub struct DbTestResult {
    pub ok: bool,
    pub message: String,
    pub version: Option<String>,
}

#[tauri::command]
pub async fn db_get_config(state: tauri::State<'_, Arc<DbState>>) -> Result<DbConfig, String> {
    let cfg = state.config.lock().await.clone();
    Ok(cfg)
}

#[tauri::command]
pub async fn db_save_config(
    config: DbConfig,
    state: tauri::State<'_, Arc<DbState>>,
) -> Result<bool, String> {
    config.save()?;
    let mut cfg_lock = state.config.lock().await;
    *cfg_lock = config;
    let mut client_lock = state.client.lock().await;
    *client_lock = None;
    Ok(true)
}

#[tauri::command]
pub async fn db_test_connection(config: DbConfig) -> Result<DbTestResult, String> {
    let conn_str = config.to_connection_string();
    match tokio_postgres::connect(&conn_str, NoTls).await {
        Ok((client, connection)) => {
            tokio::spawn(async move {
                let _ = connection.await;
            });
            match client.query_one("SELECT version();", &[]).await {
                Ok(row) => {
                    let v: String = row.get(0);
                    Ok(DbTestResult {
                        ok: true,
                        message: "Successfully connected to local PostgreSQL database!".to_string(),
                        version: Some(v),
                    })
                }
                Err(e) => Ok(DbTestResult {
                    ok: false,
                    message: format!("Connected, but test query failed: {}", e),
                    version: None,
                }),
            }
        }
        Err(e) => Ok(DbTestResult {
            ok: false,
            message: format!("Connection failed: {}", e),
            version: None,
        }),
    }
}

#[tauri::command]
pub async fn db_init_schema(state: tauri::State<'_, Arc<DbState>>) -> Result<String, String> {
    let client = state.get_client().await?;
    let sql_schema = include_str!("../../../scripts/init_local_postgres_schema.sql");
    client.batch_execute(sql_schema)
        .await
        .map_err(|e| format!("Failed to apply schema: {}", e))?;
    Ok("Local database schema applied successfully!".to_string())
}

#[tauri::command]
pub async fn db_ping(state: tauri::State<'_, Arc<DbState>>) -> Result<bool, String> {
    let client = state.get_client().await?;
    let row = client
        .query_one("SELECT 1;", &[])
        .await
        .map_err(|e| format!("Ping query failed: {}", e))?;
    let val: i32 = row.get(0);
    Ok(val == 1)
}

#[tauri::command]
pub async fn db_get_dashboard_summary(
    date: Option<String>,
    state: tauri::State<'_, Arc<DbState>>,
) -> Result<DashboardSummary, String> {
    let client = state.get_client().await?;
    let target_date = date.unwrap_or_else(|| Utc::now().format("%Y-%m-%d").to_string());
    let parsed_date = NaiveDate::parse_from_str(&target_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid date: {}", e))?;

    // 1. Today sales
    let sales_row = client
        .query_one(
            "SELECT COALESCE(SUM(total_amount), 0.00), COUNT(*) FROM orders WHERE bill_date = $1 AND status != 'CANCELLED';",
            &[&parsed_date],
        )
        .await
        .map_err(|e| e.to_string())?;
    let today_sales: f64 = sales_row.get::<_, rust_decimal::Decimal>(0).to_string().parse().unwrap_or(0.0);
    let today_orders_count: i64 = sales_row.get(1);

    // 2. Payments today
    let pay_rows = client
        .query(
            "SELECT payment_method, COALESCE(SUM(amount), 0.00) FROM payments WHERE received_at::date = $1 AND status = 'COMPLETED' GROUP BY payment_method;",
            &[&parsed_date],
        )
        .await
        .map_err(|e| e.to_string())?;
    let mut today_cash = 0.0;
    let mut today_gpay = 0.0;
    for r in pay_rows {
        let m: String = r.get(0);
        let a: f64 = r.get::<_, rust_decimal::Decimal>(1).to_string().parse().unwrap_or(0.0);
        if m == "CASH" {
            today_cash += a;
        } else {
            today_gpay += a;
        }
    }
    let today_payments = today_cash + today_gpay;

    // 3. Outstanding balance total
    let bal_row = client
        .query_one(
            "SELECT COALESCE(SUM(current_balance), 0.00), COUNT(*), COUNT(CASE WHEN current_balance > 0 THEN 1 END) FROM customers WHERE is_active = TRUE;",
            &[],
        )
        .await
        .map_err(|e| e.to_string())?;
    let total_outstanding: f64 = bal_row.get::<_, rust_decimal::Decimal>(0).to_string().parse().unwrap_or(0.0);
    let total_customers: i64 = bal_row.get(1);
    let customers_with_due: i64 = bal_row.get(2);

    // 4. Expenses today
    let exp_row = client
        .query_one(
            "SELECT COALESCE(SUM(amount), 0.00) FROM expenses WHERE expense_date = $1;",
            &[&parsed_date],
        )
        .await
        .map_err(|e| e.to_string())?;
    let today_expenses: f64 = exp_row.get::<_, rust_decimal::Decimal>(0).to_string().parse().unwrap_or(0.0);

    // 5. Staff attendance count
    let staff_row = client
        .query_one(
            "SELECT COUNT(*), COUNT(CASE WHEN status = 'PRESENT' THEN 1 END) FROM staff_attendance WHERE date = $1;",
            &[&parsed_date],
        )
        .await
        .map_err(|e| e.to_string())?;
    let staff_total: i64 = staff_row.get(0);
    let staff_present: i64 = staff_row.get(1);

    let net_cash_in_hand = today_cash - today_expenses;

    Ok(DashboardSummary {
        today_sales,
        today_payments,
        today_cash,
        today_gpay,
        total_outstanding,
        today_expenses,
        net_cash_in_hand,
        total_customers,
        customers_with_due,
        staff_present,
        staff_total,
        recent_orders_count: today_orders_count,
    })
}

#[tauri::command]
pub async fn db_get_customers(
    search: Option<String>,
    route: Option<String>,
    active_only: Option<bool>,
    state: tauri::State<'_, Arc<DbState>>,
) -> Result<Vec<CustomerItem>, String> {
    let client = state.get_client().await?;
    let active_filter = active_only.unwrap_or(true);
    let mut sql = if active_filter {
        "SELECT id, name, owner_name, phone, alternative_phone, address, route_name, opening_due, current_balance, notes, is_active FROM customers WHERE is_active = TRUE".to_string()
    } else {
        "SELECT id, name, owner_name, phone, alternative_phone, address, route_name, opening_due, current_balance, notes, is_active FROM customers WHERE 1=1".to_string()
    };
    let mut params: Vec<Box<dyn tokio_postgres::types::ToSql + Sync + Send>> = Vec::new();
    let mut idx = 1;

    if let Some(ref s) = search {
        if !s.trim().is_empty() {
            sql.push_str(&format!(" AND (name ILIKE ${} OR phone ILIKE ${})", idx, idx));
            params.push(Box::new(format!("%{}%", s.trim())));
            idx += 1;
        }
    }
    if let Some(ref r) = route {
        if !r.trim().is_empty() && r != "all" {
            sql.push_str(&format!(" AND route_name = ${}", idx));
            params.push(Box::new(r.trim().to_string()));
        }
    }
    sql.push_str(" ORDER BY route_name, name;");

    let borrowed: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> =
        params.iter().map(|p| p.as_ref() as _).collect();
    let rows = client.query(&sql, &borrowed).await.map_err(|e| e.to_string())?;

    let list = rows
        .into_iter()
        .map(|r| {
            let id: Uuid = r.get(0);
            let opening: f64 = r.get::<_, rust_decimal::Decimal>(7).to_string().parse().unwrap_or(0.0);
            let bal: f64 = r.get::<_, rust_decimal::Decimal>(8).to_string().parse().unwrap_or(0.0);
            CustomerItem {
                id: id.to_string(),
                name: r.get(1),
                owner_name: r.get(2),
                phone: r.get(3),
                alternative_phone: r.get(4),
                address: r.get(5),
                route_name: r.get(6),
                opening_due: opening,
                current_balance: bal,
                notes: r.get(9),
                is_active: r.get(10),
            }
        })
        .collect();

    Ok(list)
}

#[tauri::command]
pub async fn db_get_products(
    active_only: Option<bool>,
    state: tauri::State<'_, Arc<DbState>>,
) -> Result<Vec<ProductItem>, String> {
    let client = state.get_client().await?;
    let active_filter = active_only.unwrap_or(true);
    let sql = if active_filter {
        "SELECT id, name, code, unit_price, packet_size, order_number, is_active, notes FROM products WHERE is_active = TRUE ORDER BY order_number, name;"
    } else {
        "SELECT id, name, code, unit_price, packet_size, order_number, is_active, notes FROM products ORDER BY order_number, name;"
    };
    let rows = client
        .query(sql, &[])
        .await
        .map_err(|e| e.to_string())?;

    let list = rows
        .into_iter()
        .map(|r| {
            let id: Uuid = r.get(0);
            let p: f64 = r.get::<_, rust_decimal::Decimal>(3).to_string().parse().unwrap_or(0.0);
            ProductItem {
                id: id.to_string(),
                name: r.get(1),
                code: r.get(2),
                unit_price: p,
                packet_size: r.get(4),
                order_number: r.get(5),
                is_active: r.get(6),
                notes: r.get(7),
            }
        })
        .collect();

    Ok(list)
}

#[tauri::command]
pub async fn db_get_customer_prices(
    customer_id: String,
    state: tauri::State<'_, Arc<DbState>>,
) -> Result<Vec<CustomerPriceItem>, String> {
    let client = state.get_client().await?;
    let cust_uuid = Uuid::parse_str(&customer_id).map_err(|e| e.to_string())?;

    let rows = client
        .query(
            r#"
            SELECT cp.id, cp.customer_id, cp.product_id, p.name, p.unit_price, cp.price, cp.is_active
            FROM customer_product_prices cp
            JOIN products p ON cp.product_id = p.id
            WHERE cp.customer_id = $1 AND cp.is_active = TRUE;
            "#,
            &[&cust_uuid],
        )
        .await
        .map_err(|e| e.to_string())?;

    let list = rows
        .into_iter()
        .map(|r| {
            let id: Uuid = r.get(0);
            let cid: Uuid = r.get(1);
            let pid: Uuid = r.get(2);
            let def_p: f64 = r.get::<_, rust_decimal::Decimal>(4).to_string().parse().unwrap_or(0.0);
            let cur_p: f64 = r.get::<_, rust_decimal::Decimal>(5).to_string().parse().unwrap_or(0.0);
            CustomerPriceItem {
                id: id.to_string(),
                customer_id: cid.to_string(),
                product_id: pid.to_string(),
                product_name: r.get(3),
                default_price: def_p,
                price: cur_p,
                is_active: r.get(6),
            }
        })
        .collect();

    Ok(list)
}

#[tauri::command]
pub async fn db_set_customer_price(
    customer_id: String,
    product_id: String,
    price: f64,
    state: tauri::State<'_, Arc<DbState>>,
) -> Result<bool, String> {
    let mut client = state.get_client().await?;
    let cust_uuid = Uuid::parse_str(&customer_id).map_err(|e| e.to_string())?;
    let prod_uuid = Uuid::parse_str(&product_id).map_err(|e| e.to_string())?;
    let dec_price = rust_decimal::Decimal::from_str_exact(&format!("{:.2}", price))
        .map_err(|e| e.to_string())?;

    let tx = client.transaction().await.map_err(|e| e.to_string())?;

    // Deactivate old active price
    tx.execute(
        "UPDATE customer_product_prices SET is_active = FALSE WHERE customer_id = $1 AND product_id = $2 AND is_active = TRUE;",
        &[&cust_uuid, &prod_uuid],
    )
    .await
    .map_err(|e| e.to_string())?;

    if price > 0.0 {
        let new_id = Uuid::new_v4();
        tx.execute(
            "INSERT INTO customer_product_prices (id, customer_id, product_id, price, is_active) VALUES ($1, $2, $3, $4, TRUE);",
            &[&new_id, &cust_uuid, &prod_uuid, &dec_price],
        )
        .await
        .map_err(|e| e.to_string())?;
    }

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub async fn db_get_opening_due(
    customer_id: String,
    date: String,
    state: tauri::State<'_, Arc<DbState>>,
) -> Result<f64, String> {
    let client = state.get_client().await?;
    let cust_uuid = Uuid::parse_str(&customer_id).map_err(|e| e.to_string())?;
    let parsed_date = NaiveDate::parse_from_str(&date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid date: {}", e))?;

    // 1. Current balance
    let cur_bal_row = client
        .query_one(
            "SELECT current_balance FROM customers WHERE id = $1;",
            &[&cust_uuid],
        )
        .await
        .map_err(|e| e.to_string())?;
    let cur_bal: f64 = cur_bal_row.get::<_, rust_decimal::Decimal>(0).to_string().parse().unwrap_or(0.0);

    // 2. Subsequent orders (>= target_date)
    let ord_row = client
        .query_one(
            "SELECT COALESCE(SUM(total_amount), 0.00) FROM orders WHERE customer_id = $1 AND bill_date >= $2 AND status != 'CANCELLED';",
            &[&cust_uuid, &parsed_date],
        )
        .await
        .map_err(|e| e.to_string())?;
    let sub_orders: f64 = ord_row.get::<_, rust_decimal::Decimal>(0).to_string().parse().unwrap_or(0.0);

    // 3. Subsequent payments (>= target_date)
    let pay_row = client
        .query_one(
            "SELECT COALESCE(SUM(amount), 0.00) FROM payments WHERE customer_id = $1 AND received_at::date >= $2 AND status = 'COMPLETED';",
            &[&cust_uuid, &parsed_date],
        )
        .await
        .map_err(|e| e.to_string())?;
    let sub_pays: f64 = pay_row.get::<_, rust_decimal::Decimal>(0).to_string().parse().unwrap_or(0.0);

    // Opening due = cur_bal - orders + payments
    let opening = (cur_bal - sub_orders + sub_pays).max(0.0);
    Ok((opening * 100.0).round() / 100.0)
}

#[tauri::command]
pub async fn db_save_order(
    input: SaveOrderInput,
    state: tauri::State<'_, Arc<DbState>>,
) -> Result<OrderDetail, String> {
    let mut client = state.get_client().await?;
    let cust_uuid = Uuid::parse_str(&input.customer_id).map_err(|e| e.to_string())?;
    let parsed_date = NaiveDate::parse_from_str(&input.bill_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid bill_date: {}", e))?;

    let tx = client.transaction().await.map_err(|e| e.to_string())?;

    // Lock customer row
    let cust_row = tx
        .query_one(
            "SELECT name, phone, route_name, current_balance FROM customers WHERE id = $1 FOR UPDATE;",
            &[&cust_uuid],
        )
        .await
        .map_err(|e| e.to_string())?;
    let cust_name: String = cust_row.get(0);
    let cust_phone: String = cust_row.get(1);
    let route_name: String = cust_row.get(2);
    let mut current_balance: f64 = cust_row.get::<_, rust_decimal::Decimal>(3).to_string().parse().unwrap_or(0.0);

    // Calculate line items total
    let mut subtotal: f64 = 0.0;
    for item in &input.items {
        subtotal += (item.quantity as f64) * item.unit_price;
    }
    let discount = input.discount.unwrap_or(0.0);
    let total_amount = (subtotal - discount).max(0.0);
    let cash_amt = input.cash_amount.unwrap_or(0.0);
    let gpay_amt = input.gpay_amount.unwrap_or(0.0);
    let total_payment = cash_amt + gpay_amt;

    let order_id = if let Some(ref oid) = input.order_id {
        Uuid::parse_str(oid).map_err(|e| e.to_string())?
    } else {
        Uuid::new_v4()
    };

    let bill_num = if let Some(ref bn) = input.bill_number {
        if !bn.trim().is_empty() {
            bn.clone()
        } else {
            let date_str = parsed_date.format("%Y%m%d").to_string();
            let count_row = tx
                .query_one(
                    "SELECT COUNT(*) FROM orders WHERE bill_date = $1;",
                    &[&parsed_date],
                )
                .await
                .map_err(|e| e.to_string())?;
            let count: i64 = count_row.get(0);
            format!("ORD-{}-{:04}", date_str, count + 1)
        }
    } else {
        let date_str = parsed_date.format("%Y%m%d").to_string();
        let count_row = tx
            .query_one(
                "SELECT COUNT(*) FROM orders WHERE bill_date = $1;",
                &[&parsed_date],
            )
            .await
            .map_err(|e| e.to_string())?;
        let count: i64 = count_row.get(0);
        format!("ORD-{}-{:04}", date_str, count + 1)
    };

    // Calculate previous due and remaining due
    let previous_due = (current_balance).max(0.0);
    let remaining_due = (previous_due + total_amount - total_payment).max(0.0);

    let dec_subtotal = rust_decimal::Decimal::from_str_exact(&format!("{:.2}", subtotal)).unwrap();
    let dec_discount = rust_decimal::Decimal::from_str_exact(&format!("{:.2}", discount)).unwrap();
    let dec_total = rust_decimal::Decimal::from_str_exact(&format!("{:.2}", total_amount)).unwrap();
    let dec_prev = rust_decimal::Decimal::from_str_exact(&format!("{:.2}", previous_due)).unwrap();
    let dec_pay = rust_decimal::Decimal::from_str_exact(&format!("{:.2}", total_payment)).unwrap();
    let dec_rem = rust_decimal::Decimal::from_str_exact(&format!("{:.2}", remaining_due)).unwrap();
    let payment_method = if gpay_amt > 0.0 && cash_amt == 0.0 {
        "GPAY_UPI"
    } else if gpay_amt > 0.0 && cash_amt > 0.0 {
        "SPLIT"
    } else {
        "CASH"
    };

    // Check if order already exists (editing)
    let existing_order = tx
        .query_opt("SELECT total_amount FROM orders WHERE id = $1;", &[&order_id])
        .await
        .map_err(|e| e.to_string())?;

    if let Some(ref ex_row) = existing_order {
        let old_total: f64 = ex_row.get::<_, rust_decimal::Decimal>(0).to_string().parse().unwrap_or(0.0);
        let delta = total_amount - old_total;
        current_balance += delta;

        tx.execute(
            r#"
            UPDATE orders SET
                subtotal = $1, discount = $2, total_amount = $3,
                payment_amount = $4, remaining_due = $5, payment_method = $6,
                notes = $7, updated_at = CURRENT_TIMESTAMP
            WHERE id = $8;
            "#,
            &[&dec_subtotal, &dec_discount, &dec_total, &dec_pay, &dec_rem, &payment_method, &input.notes.unwrap_or_default(), &order_id],
        )
        .await
        .map_err(|e| e.to_string())?;

        // Delete old line items
        tx.execute("DELETE FROM order_items WHERE order_id = $1;", &[&order_id])
            .await
            .map_err(|e| e.to_string())?;

        // Update credit transaction in-place
        tx.execute(
            "UPDATE credit_transactions SET amount = $1, balance_after = $2 WHERE order_id = $3 AND transaction_type = 'CREDIT_SALE';",
            &[&dec_total, &rust_decimal::Decimal::from_str_exact(&format!("{:.2}", current_balance)).unwrap(), &order_id],
        )
        .await
        .map_err(|e| e.to_string())?;
    } else {
        current_balance += total_amount;
        tx.execute(
            r#"
            INSERT INTO orders (id, bill_number, customer_id, bill_date, subtotal, discount, total_amount, previous_due, payment_amount, remaining_due, payment_method, notes, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'COMPLETED');
            "#,
            &[&order_id, &bill_num, &cust_uuid, &parsed_date, &dec_subtotal, &dec_discount, &dec_total, &dec_prev, &dec_pay, &dec_rem, &payment_method, &input.notes.unwrap_or_default()],
        )
        .await
        .map_err(|e| e.to_string())?;

        // Record credit sale
        let credit_id = Uuid::new_v4();
        tx.execute(
            "INSERT INTO credit_transactions (id, customer_id, transaction_type, amount, balance_after, order_id, notes) VALUES ($1, $2, 'CREDIT_SALE', $3, $4, $5, 'Wholesale counter order bill');",
            &[&credit_id, &cust_uuid, &dec_total, &rust_decimal::Decimal::from_str_exact(&format!("{:.2}", current_balance)).unwrap(), &order_id],
        )
        .await
        .map_err(|e| e.to_string())?;
    }

    // Insert new line items
    let mut detail_items = Vec::new();
    for it in input.items {
        let item_id = Uuid::new_v4();
        let prod_uuid = Uuid::parse_str(&it.product_id).map_err(|e| e.to_string())?;
        let item_sub = (it.quantity as f64) * it.unit_price;
        let dec_item_sub = rust_decimal::Decimal::from_str_exact(&format!("{:.2}", item_sub)).unwrap();
        let dec_unit = rust_decimal::Decimal::from_str_exact(&format!("{:.2}", it.unit_price)).unwrap();

        tx.execute(
            "INSERT INTO order_items (id, order_id, product_id, quantity, unit_price, subtotal) VALUES ($1, $2, $3, $4, $5, $6);",
            &[&item_id, &order_id, &prod_uuid, &it.quantity, &dec_unit, &dec_item_sub],
        )
        .await
        .map_err(|e| e.to_string())?;

        let pname_row = tx
            .query_one("SELECT name FROM products WHERE id = $1;", &[&prod_uuid])
            .await
            .map_err(|e| e.to_string())?;

        detail_items.push(OrderItemDetail {
            id: item_id.to_string(),
            product_id: it.product_id,
            product_name: pname_row.get(0),
            quantity: it.quantity,
            unit_price: it.unit_price,
            subtotal: item_sub,
        });
    }

    // Sync payments if payment amount was entered
    if total_payment > 0.0 {
        current_balance -= total_payment;
        let pay_id = Uuid::new_v4();
        let pay_num = format!("PAY-{}-{:04}", parsed_date.format("%Y%m%d"), rand_suffix());
        tx.execute(
            r#"
            INSERT INTO payments (id, payment_number, customer_id, order_id, amount, payment_method, notes, status)
            VALUES ($1, $2, $3, $4, $5, $6, 'Counter bill collection', 'COMPLETED');
            "#,
            &[&pay_id, &pay_num, &cust_uuid, &order_id, &dec_pay, &payment_method],
        )
        .await
        .map_err(|e| e.to_string())?;

        let p_credit_id = Uuid::new_v4();
        let tx_type = if payment_method == "GPAY_UPI" { "GPAY_PAYMENT" } else { "CASH_PAYMENT" };
        let neg_dec_pay = rust_decimal::Decimal::from_str_exact(&format!("-{:.2}", total_payment)).unwrap();
        tx.execute(
            "INSERT INTO credit_transactions (id, customer_id, transaction_type, amount, balance_after, order_id, payment_id, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Bill payment collection');",
            &[&p_credit_id, &cust_uuid, &tx_type, &neg_dec_pay, &rust_decimal::Decimal::from_str_exact(&format!("{:.2}", current_balance)).unwrap(), &order_id, &pay_id],
        )
        .await
        .map_err(|e| e.to_string())?;
    }

    // Update customer current balance
    tx.execute(
        "UPDATE customers SET current_balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;",
        &[&rust_decimal::Decimal::from_str_exact(&format!("{:.2}", current_balance)).unwrap(), &cust_uuid],
    )
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(OrderDetail {
        id: order_id.to_string(),
        bill_number: bill_num,
        customer_id: input.customer_id,
        customer_name: cust_name,
        customer_phone: cust_phone,
        route_name,
        bill_date: input.bill_date,
        subtotal,
        discount,
        total_amount,
        previous_due,
        payment_amount: total_payment,
        remaining_due,
        payment_method: payment_method.to_string(),
        notes: String::new(),
        status: "COMPLETED".to_string(),
        items: detail_items,
    })
}

fn rand_suffix() -> u32 {
    use std::time::SystemTime;
    (SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_millis() % 9000 + 1000) as u32
}

#[tauri::command]
pub async fn db_get_orders(
    start_date: Option<String>,
    end_date: Option<String>,
    date: Option<String>,
    customer_id: Option<String>,
    search: Option<String>,
    limit: Option<i64>,
    state: tauri::State<'_, Arc<DbState>>,
) -> Result<Vec<OrderDetail>, String> {
    let client = state.get_client().await?;
    let mut sql = r#"
        SELECT o.id, o.bill_number, o.customer_id, c.name, c.phone, c.route_name,
               o.bill_date, o.subtotal, o.discount, o.total_amount, o.previous_due,
               o.payment_amount, o.remaining_due, o.payment_method, o.notes, o.status
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        WHERE o.status != 'CANCELLED'
    "#.to_string();

    let mut params: Vec<Box<dyn tokio_postgres::types::ToSql + Sync + Send>> = Vec::new();
    let mut idx = 1;

    if let Some(ref s_date) = start_date {
        if let Ok(pd) = NaiveDate::parse_from_str(s_date, "%Y-%m-%d") {
            sql.push_str(&format!(" AND o.bill_date >= ${}", idx));
            params.push(Box::new(pd));
            idx += 1;
        }
    }
    if let Some(ref e_date) = end_date {
        if let Ok(pd) = NaiveDate::parse_from_str(e_date, "%Y-%m-%d") {
            sql.push_str(&format!(" AND o.bill_date <= ${}", idx));
            params.push(Box::new(pd));
            idx += 1;
        }
    }
    if let Some(ref d) = date {
        if let Ok(pd) = NaiveDate::parse_from_str(d, "%Y-%m-%d") {
            sql.push_str(&format!(" AND o.bill_date = ${}", idx));
            params.push(Box::new(pd));
            idx += 1;
        }
    }
    if let Some(ref cid) = customer_id {
        if let Ok(cuuid) = Uuid::parse_str(cid) {
            sql.push_str(&format!(" AND o.customer_id = ${}", idx));
            params.push(Box::new(cuuid));
            idx += 1;
        }
    }
    if let Some(ref s) = search {
        if !s.trim().is_empty() {
            sql.push_str(&format!(" AND (o.bill_number ILIKE ${} OR c.name ILIKE ${})", idx, idx));
            params.push(Box::new(format!("%{}%", s.trim())));
            idx += 1;
        }
    }
    sql.push_str(" ORDER BY o.bill_date DESC, o.created_at DESC");
    if let Some(lim) = limit {
        sql.push_str(&format!(" LIMIT ${}", idx));
        params.push(Box::new(lim));
    }
    sql.push_str(";");

    let borrowed: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> =
        params.iter().map(|p| p.as_ref() as _).collect();
    let rows = client.query(&sql, &borrowed).await.map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for r in rows {
        let oid: Uuid = r.get(0);
        let cid: Uuid = r.get(2);
        let sub: f64 = r.get::<_, rust_decimal::Decimal>(7).to_string().parse().unwrap_or(0.0);
        let disc: f64 = r.get::<_, rust_decimal::Decimal>(8).to_string().parse().unwrap_or(0.0);
        let tot: f64 = r.get::<_, rust_decimal::Decimal>(9).to_string().parse().unwrap_or(0.0);
        let prev: f64 = r.get::<_, rust_decimal::Decimal>(10).to_string().parse().unwrap_or(0.0);
        let pay: f64 = r.get::<_, rust_decimal::Decimal>(11).to_string().parse().unwrap_or(0.0);
        let rem: f64 = r.get::<_, rust_decimal::Decimal>(12).to_string().parse().unwrap_or(0.0);
        let bdate: NaiveDate = r.get(6);

        list.push(OrderDetail {
            id: oid.to_string(),
            bill_number: r.get(1),
            customer_id: cid.to_string(),
            customer_name: r.get(3),
            customer_phone: r.get(4),
            route_name: r.get(5),
            bill_date: bdate.to_string(),
            subtotal: sub,
            discount: disc,
            total_amount: tot,
            previous_due: prev,
            payment_amount: pay,
            remaining_due: rem,
            payment_method: r.get(13),
            notes: r.get(14),
            status: r.get(15),
            items: Vec::new(),
        });
    }

    Ok(list)
}

#[tauri::command]
pub async fn db_get_order(
    order_id: String,
    state: tauri::State<'_, Arc<DbState>>,
) -> Result<OrderDetail, String> {
    let client = state.get_client().await?;
    let oid = Uuid::parse_str(&order_id).map_err(|e| e.to_string())?;

    let r = client
        .query_one(
            r#"
            SELECT o.id, o.bill_number, o.customer_id, c.name, c.phone, c.route_name,
                   o.bill_date, o.subtotal, o.discount, o.total_amount, o.previous_due,
                   o.payment_amount, o.remaining_due, o.payment_method, o.notes, o.status
            FROM orders o
            JOIN customers c ON o.customer_id = c.id
            WHERE o.id = $1;
            "#,
            &[&oid],
        )
        .await
        .map_err(|e| e.to_string())?;

    let item_rows = client
        .query(
            r#"
            SELECT oi.id, oi.product_id, p.name, oi.quantity, oi.unit_price, oi.subtotal
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = $1
            ORDER BY p.order_number, p.name;
            "#,
            &[&oid],
        )
        .await
        .map_err(|e| e.to_string())?;

    let items = item_rows
        .into_iter()
        .map(|ir| {
            let iid: Uuid = ir.get(0);
            let pid: Uuid = ir.get(1);
            let u_price: f64 = ir.get::<_, rust_decimal::Decimal>(4).to_string().parse().unwrap_or(0.0);
            let sub: f64 = ir.get::<_, rust_decimal::Decimal>(5).to_string().parse().unwrap_or(0.0);
            OrderItemDetail {
                id: iid.to_string(),
                product_id: pid.to_string(),
                product_name: ir.get(2),
                quantity: ir.get(3),
                unit_price: u_price,
                subtotal: sub,
            }
        })
        .collect();

    let cid: Uuid = r.get(2);
    let sub: f64 = r.get::<_, rust_decimal::Decimal>(7).to_string().parse().unwrap_or(0.0);
    let disc: f64 = r.get::<_, rust_decimal::Decimal>(8).to_string().parse().unwrap_or(0.0);
    let tot: f64 = r.get::<_, rust_decimal::Decimal>(9).to_string().parse().unwrap_or(0.0);
    let prev: f64 = r.get::<_, rust_decimal::Decimal>(10).to_string().parse().unwrap_or(0.0);
    let pay: f64 = r.get::<_, rust_decimal::Decimal>(11).to_string().parse().unwrap_or(0.0);
    let rem: f64 = r.get::<_, rust_decimal::Decimal>(12).to_string().parse().unwrap_or(0.0);
    let bdate: NaiveDate = r.get(6);

    Ok(OrderDetail {
        id: oid.to_string(),
        bill_number: r.get(1),
        customer_id: cid.to_string(),
        customer_name: r.get(3),
        customer_phone: r.get(4),
        route_name: r.get(5),
        bill_date: bdate.to_string(),
        subtotal: sub,
        discount: disc,
        total_amount: tot,
        previous_due: prev,
        payment_amount: pay,
        remaining_due: rem,
        payment_method: r.get(13),
        notes: r.get(14),
        status: r.get(15),
        items,
    })
}

#[tauri::command]
pub async fn db_get_expenses(
    start_date: Option<String>,
    end_date: Option<String>,
    date: Option<String>,
    category: Option<String>,
    state: tauri::State<'_, Arc<DbState>>,
) -> Result<Vec<ExpenseItem>, String> {
    let client = state.get_client().await?;
    let mut sql = "SELECT id, expense_date, category, amount, payment_method, description, receipt_reference FROM expenses WHERE 1=1".to_string();
    let mut params: Vec<Box<dyn tokio_postgres::types::ToSql + Sync + Send>> = Vec::new();
    let mut idx = 1;

    if let Some(ref s_date) = start_date {
        if let Ok(pd) = NaiveDate::parse_from_str(s_date, "%Y-%m-%d") {
            sql.push_str(&format!(" AND expense_date >= ${}", idx));
            params.push(Box::new(pd));
            idx += 1;
        }
    }
    if let Some(ref e_date) = end_date {
        if let Ok(pd) = NaiveDate::parse_from_str(e_date, "%Y-%m-%d") {
            sql.push_str(&format!(" AND expense_date <= ${}", idx));
            params.push(Box::new(pd));
            idx += 1;
        }
    }
    if let Some(ref d) = date {
        if let Ok(pd) = NaiveDate::parse_from_str(d, "%Y-%m-%d") {
            sql.push_str(&format!(" AND expense_date = ${}", idx));
            params.push(Box::new(pd));
            idx += 1;
        }
    }
    if let Some(ref c) = category {
        if !c.trim().is_empty() && c != "all" {
            sql.push_str(&format!(" AND category = ${}", idx));
            params.push(Box::new(c.trim().to_string()));
        }
    }
    sql.push_str(" ORDER BY expense_date DESC, created_at DESC;");

    let borrowed: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> =
        params.iter().map(|p| p.as_ref() as _).collect();
    let rows = client.query(&sql, &borrowed).await.map_err(|e| e.to_string())?;

    let list = rows
        .into_iter()
        .map(|r| {
            let eid: Uuid = r.get(0);
            let edate: NaiveDate = r.get(1);
            let amt: f64 = r.get::<_, rust_decimal::Decimal>(3).to_string().parse().unwrap_or(0.0);
            ExpenseItem {
                id: eid.to_string(),
                expense_date: edate.to_string(),
                category: r.get(2),
                amount: amt,
                payment_method: r.get(4),
                description: r.get(5),
                receipt_reference: r.get(6),
            }
        })
        .collect();

    Ok(list)
}

#[derive(Debug, Deserialize)]
pub struct ExpenseInput {
    pub id: Option<String>,
    pub expense_date: String,
    pub category: String,
    pub amount: f64,
    pub payment_method: String,
    pub description: String,
    pub receipt_reference: Option<String>,
}

#[tauri::command]
pub async fn db_save_expense(
    input: ExpenseInput,
    state: tauri::State<'_, Arc<DbState>>,
) -> Result<bool, String> {
    let client = state.get_client().await?;
    let parsed_date = NaiveDate::parse_from_str(&input.expense_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid date: {}", e))?;
    let dec_amt = rust_decimal::Decimal::from_str_exact(&format!("{:.2}", input.amount))
        .map_err(|e| e.to_string())?;

    if let Some(ref eid_str) = input.id {
        let eid = Uuid::parse_str(eid_str).map_err(|e| e.to_string())?;
        client
            .execute(
                r#"
                UPDATE expenses SET
                    expense_date = $1, category = $2, amount = $3,
                    payment_method = $4, description = $5, receipt_reference = $6,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $7;
                "#,
                &[&parsed_date, &input.category, &dec_amt, &input.payment_method, &input.description, &input.receipt_reference.unwrap_or_default(), &eid],
            )
            .await
            .map_err(|e| e.to_string())?;
    } else {
        let new_id = Uuid::new_v4();
        client
            .execute(
                r#"
                INSERT INTO expenses (id, expense_date, category, amount, payment_method, description, receipt_reference)
                VALUES ($1, $2, $3, $4, $5, $6, $7);
                "#,
                &[&new_id, &parsed_date, &input.category, &dec_amt, &input.payment_method, &input.description, &input.receipt_reference.unwrap_or_default()],
            )
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(true)
}

#[tauri::command]
pub async fn db_get_staff(
    active_only: Option<bool>,
    state: tauri::State<'_, Arc<DbState>>,
) -> Result<Vec<StaffItem>, String> {
    let client = state.get_client().await?;
    let active_filter = active_only.unwrap_or(true);
    let sql = if active_filter {
        "SELECT id, full_name, phone_number, address, joined_date, staff_type, salary_type, monthly_salary, daily_wage, is_active, notes FROM staff WHERE is_active = TRUE ORDER BY full_name;"
    } else {
        "SELECT id, full_name, phone_number, address, joined_date, staff_type, salary_type, monthly_salary, daily_wage, is_active, notes FROM staff ORDER BY full_name;"
    };
    let rows = client
        .query(sql, &[])
        .await
        .map_err(|e| e.to_string())?;

    let list = rows
        .into_iter()
        .map(|r| {
            let sid: Uuid = r.get(0);
            let jdate: NaiveDate = r.get(4);
            let m_sal: f64 = r.get::<_, rust_decimal::Decimal>(7).to_string().parse().unwrap_or(0.0);
            let d_wage: f64 = r.get::<_, rust_decimal::Decimal>(8).to_string().parse().unwrap_or(0.0);
            StaffItem {
                id: sid.to_string(),
                full_name: r.get(1),
                phone_number: r.get(2),
                address: r.get(3),
                joined_date: jdate.to_string(),
                staff_type: r.get(5),
                salary_type: r.get(6),
                monthly_salary: m_sal,
                daily_wage: d_wage,
                is_active: r.get(9),
                notes: r.get(10),
            }
        })
        .collect();

    Ok(list)
}

#[tauri::command]
pub async fn db_get_attendance(
    date: String,
    state: tauri::State<'_, Arc<DbState>>,
) -> Result<Vec<AttendanceItem>, String> {
    let client = state.get_client().await?;
    let parsed_date = NaiveDate::parse_from_str(&date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid date: {}", e))?;

    let rows = client
        .query(
            r#"
            SELECT s.id, s.full_name, s.staff_type, s.daily_wage,
                   COALESCE(sa.status, 'PRESENT') as status,
                   COALESCE(sa.daily_wage, s.daily_wage) as daily_wage,
                   COALESCE(sa.notes, '') as notes
            FROM staff s
            LEFT JOIN staff_attendance sa ON s.id = sa.staff_id AND sa.date = $1
            WHERE s.is_active = TRUE
            ORDER BY s.full_name;
            "#,
            &[&parsed_date],
        )
        .await
        .map_err(|e| e.to_string())?;

    let list = rows
        .into_iter()
        .map(|r| {
            let sid: Uuid = r.get(0);
            let def_wage: f64 = r.get::<_, rust_decimal::Decimal>(3).to_string().parse().unwrap_or(0.0);
            let cur_wage: f64 = r.get::<_, rust_decimal::Decimal>(5).to_string().parse().unwrap_or(0.0);
            AttendanceItem {
                staff_id: sid.to_string(),
                staff_name: r.get(1),
                staff_type: r.get(2),
                default_daily_wage: def_wage,
                status: r.get(4),
                daily_wage: cur_wage,
                notes: r.get(6),
            }
        })
        .collect();

    Ok(list)
}

#[tauri::command]
pub async fn db_save_attendance(
    date: String,
    records: Vec<SaveAttendanceRecord>,
    state: tauri::State<'_, Arc<DbState>>,
) -> Result<bool, String> {
    let mut client = state.get_client().await?;
    let parsed_date = NaiveDate::parse_from_str(&date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid date: {}", e))?;

    let tx = client.transaction().await.map_err(|e| e.to_string())?;

    for rec in records {
        let sid = Uuid::parse_str(&rec.staff_id).map_err(|e| e.to_string())?;
        let wage_val = rec.daily_wage.unwrap_or(0.0);
        let dec_wage = rust_decimal::Decimal::from_str_exact(&format!("{:.2}", wage_val)).unwrap();
        let notes_val = rec.notes.unwrap_or_default();

        tx.execute(
            r#"
            INSERT INTO staff_attendance (id, staff_id, date, status, daily_wage, notes)
            VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5)
            ON CONFLICT (staff_id, date) DO UPDATE SET
                status = EXCLUDED.status,
                daily_wage = EXCLUDED.daily_wage,
                notes = EXCLUDED.notes,
                updated_at = CURRENT_TIMESTAMP;
            "#,
            &[&sid, &parsed_date, &rec.status, &dec_wage, &notes_val],
        )
        .await
        .map_err(|e| e.to_string())?;
    }

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub async fn db_get_settings(
    state: tauri::State<'_, Arc<DbState>>,
) -> Result<SystemSettingsDto, String> {
    let client = state.get_client().await?;
    let r = client
        .query_one(
            r#"
            SELECT business_name, phone_number, gst_number, address, upi_id,
                   invoice_footer_notes, pin_code, auto_backup_enabled, backup_folder,
                   backup_on_close, fallback_backup_time, retention_count,
                   last_backup_at::text, last_cloud_upload_at::text
            FROM system_settings LIMIT 1;
            "#,
            &[],
        )
        .await
        .map_err(|e| e.to_string())?;

    Ok(SystemSettingsDto {
        business_name: r.get(0),
        phone_number: r.get(1),
        gst_number: r.get(2),
        address: r.get(3),
        upi_id: r.get(4),
        invoice_footer_notes: r.get(5),
        pin_code: r.get(6),
        auto_backup_enabled: r.get(7),
        backup_folder: r.get(8),
        backup_on_close: r.get(9),
        fallback_backup_time: r.get(10),
        retention_count: r.get(11),
        last_backup_at: r.get(12),
        last_cloud_upload_at: r.get(13),
    })
}

#[tauri::command]
pub async fn db_verify_pin(
    pin: String,
    state: tauri::State<'_, Arc<DbState>>,
) -> Result<bool, String> {
    let client = state.get_client().await?;
    let r = client
        .query_one("SELECT pin_code FROM system_settings LIMIT 1;", &[])
        .await
        .map_err(|e| e.to_string())?;
    let actual: String = r.get(0);
    Ok(actual.trim() == pin.trim())
}

#[tauri::command]
pub async fn db_save_customer(
    input: SaveCustomerInput,
    state: tauri::State<'_, Arc<DbState>>,
) -> Result<String, String> {
    let mut client = state.get_client().await?;
    let tx = client.transaction().await.map_err(|e| e.to_string())?;

    let owner_name = input.owner_name.unwrap_or_default();
    let phone = input.phone.unwrap_or_default();
    let alt_phone = input.alternative_phone.unwrap_or_default();
    let address = input.address.unwrap_or_default();
    let route = input.route_name.unwrap_or_default();
    let notes = input.notes.unwrap_or_default();
    let is_active = input.is_active.unwrap_or(true);

    if let Some(ref id_str) = input.id {
        let cid = Uuid::parse_str(id_str).map_err(|e| e.to_string())?;
        tx.execute(
            r#"
            UPDATE customers
            SET name = $1, owner_name = $2, phone = $3, alternative_phone = $4,
                address = $5, route_name = $6, notes = $7, is_active = $8, updated_at = CURRENT_TIMESTAMP
            WHERE id = $9;
            "#,
            &[&input.name, &owner_name, &phone, &alt_phone, &address, &route, &notes, &is_active, &cid],
        )
        .await
        .map_err(|e| e.to_string())?;
        tx.commit().await.map_err(|e| e.to_string())?;
        Ok(cid.to_string())
    } else {
        let cid = Uuid::new_v4();
        let op_due = input.opening_due.unwrap_or(0.0);
        let dec_due: rust_decimal::Decimal = op_due.to_string().parse().unwrap_or_default();
        tx.execute(
            r#"
            INSERT INTO customers (id, name, owner_name, phone, alternative_phone, address, route_name, opening_due, current_balance, notes, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $10);
            "#,
            &[&cid, &input.name, &owner_name, &phone, &alt_phone, &address, &route, &dec_due, &notes, &is_active],
        )
        .await
        .map_err(|e| e.to_string())?;

        if op_due > 0.0 {
            tx.execute(
                r#"
                INSERT INTO credit_transactions (customer_id, transaction_type, amount, balance_after, notes)
                VALUES ($1, 'OPENING_BALANCE', $2, $2, 'Initial opening due recorded');
                "#,
                &[&cid, &dec_due],
            )
            .await
            .map_err(|e| e.to_string())?;
        }

        tx.commit().await.map_err(|e| e.to_string())?;
        Ok(cid.to_string())
    }
}

#[tauri::command]
pub async fn db_get_customer_ledger(
    customer_id: String,
    state: tauri::State<'_, Arc<DbState>>,
) -> Result<Vec<CustomerLedgerItem>, String> {
    let client = state.get_client().await?;
    let cid = Uuid::parse_str(&customer_id).map_err(|e| e.to_string())?;
    let rows = client
        .query(
            r#"
            SELECT id::text, created_at::text, transaction_type, amount, balance_after,
                   order_id::text, payment_id::text, notes
            FROM credit_transactions
            WHERE customer_id = $1
            ORDER BY created_at ASC;
            "#,
            &[&cid],
        )
        .await
        .map_err(|e| e.to_string())?;

    let mut items = Vec::new();
    for r in rows {
        let amt: f64 = r.get::<_, rust_decimal::Decimal>(3).to_string().parse().unwrap_or(0.0);
        let bal: f64 = r.get::<_, rust_decimal::Decimal>(4).to_string().parse().unwrap_or(0.0);
        items.push(CustomerLedgerItem {
            id: r.get(0),
            created_at: r.get(1),
            transaction_type: r.get(2),
            amount: amt,
            balance_after: bal,
            order_id: r.get(5),
            payment_id: r.get(6),
            notes: r.get(7),
        });
    }
    Ok(items)
}

#[tauri::command]
pub async fn db_save_product(
    input: SaveProductInput,
    state: tauri::State<'_, Arc<DbState>>,
) -> Result<String, String> {
    let client = state.get_client().await?;
    let packet_size = input.packet_size.unwrap_or_default();
    let order_num = input.order_number.unwrap_or(0);
    let is_active = input.is_active.unwrap_or(true);
    let notes = input.notes.unwrap_or_default();
    let dec_price: rust_decimal::Decimal = input.unit_price.to_string().parse().unwrap_or_default();

    if let Some(ref id_str) = input.id {
        let pid = Uuid::parse_str(id_str).map_err(|e| e.to_string())?;
        client.execute(
            r#"
            UPDATE products
            SET name = $1, code = $2, unit_price = $3, packet_size = $4,
                order_number = $5, is_active = $6, notes = $7, updated_at = CURRENT_TIMESTAMP
            WHERE id = $8;
            "#,
            &[&input.name, &input.code, &dec_price, &packet_size, &order_num, &is_active, &notes, &pid],
        )
        .await
        .map_err(|e| e.to_string())?;
        Ok(pid.to_string())
    } else {
        let pid = Uuid::new_v4();
        client.execute(
            r#"
            INSERT INTO products (id, name, code, unit_price, packet_size, order_number, is_active, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
            "#,
            &[&pid, &input.name, &input.code, &dec_price, &packet_size, &order_num, &is_active, &notes],
        )
        .await
        .map_err(|e| e.to_string())?;
        Ok(pid.to_string())
    }
}

#[tauri::command]
pub async fn db_record_payment(
    input: RecordPaymentInput,
    state: tauri::State<'_, Arc<DbState>>,
) -> Result<String, String> {
    let mut client = state.get_client().await?;
    let cid = Uuid::parse_str(&input.customer_id).map_err(|e| e.to_string())?;
    let pay_id = Uuid::new_v4();
    let pay_num = format!("PAY-{}", Utc::now().timestamp_millis());
    let ref_num = input.reference_number.unwrap_or_default();
    let notes = input.notes.unwrap_or_default();
    let dec_amt: rust_decimal::Decimal = input.amount.to_string().parse().unwrap_or_default();

    let tx = client.transaction().await.map_err(|e| e.to_string())?;

    tx.execute(
        r#"
        INSERT INTO payments (id, payment_number, customer_id, amount, payment_method, reference_number, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7);
        "#,
        &[&pay_id, &pay_num, &cid, &dec_amt, &input.payment_method, &ref_num, &notes],
    )
    .await
    .map_err(|e| e.to_string())?;

    let brow = tx
        .query_one("SELECT current_balance FROM customers WHERE id = $1 FOR UPDATE;", &[&cid])
        .await
        .map_err(|e| e.to_string())?;
    let cur_bal: rust_decimal::Decimal = brow.get(0);
    let new_bal = cur_bal - dec_amt;

    tx.execute(
        "UPDATE customers SET current_balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;",
        &[&new_bal, &cid],
    )
    .await
    .map_err(|e| e.to_string())?;

    let tx_notes = format!("Payment received via {}", input.payment_method);
    tx.execute(
        r#"
        INSERT INTO credit_transactions (customer_id, transaction_type, amount, balance_after, payment_id, notes)
        VALUES ($1, 'PAYMENT', $2, $3, $4, $5);
        "#,
        &[&cid, &dec_amt, &new_bal, &pay_id, &tx_notes],
    )
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(pay_id.to_string())
}

#[tauri::command]
pub async fn db_delete_expense(
    id: String,
    state: tauri::State<'_, Arc<DbState>>,
) -> Result<bool, String> {
    let client = state.get_client().await?;
    let eid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    client.execute("DELETE FROM expenses WHERE id = $1;", &[&eid])
        .await
        .map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub async fn db_save_staff(
    input: SaveStaffInput,
    state: tauri::State<'_, Arc<DbState>>,
) -> Result<String, String> {
    let client = state.get_client().await?;
    let phone = input.phone_number.unwrap_or_default();
    let addr = input.address.unwrap_or_default();
    let joined = input.joined_date
        .and_then(|d| NaiveDate::parse_from_str(&d, "%Y-%m-%d").ok())
        .unwrap_or_else(|| Utc::now().date_naive());
    let stype = input.staff_type.unwrap_or_else(|| "Worker".to_string());
    let saltype = input.salary_type.unwrap_or_else(|| "DAILY_WAGE".to_string());
    let dec_m_sal: rust_decimal::Decimal = input.monthly_salary.unwrap_or(0.0).to_string().parse().unwrap_or_default();
    let dec_d_wage: rust_decimal::Decimal = input.daily_wage.unwrap_or(0.0).to_string().parse().unwrap_or_default();
    let active = input.is_active.unwrap_or(true);
    let notes = input.notes.unwrap_or_default();

    if let Some(ref id_str) = input.id {
        let sid = Uuid::parse_str(id_str).map_err(|e| e.to_string())?;
        client.execute(
            r#"
            UPDATE staff
            SET full_name = $1, phone_number = $2, address = $3, joined_date = $4,
                staff_type = $5, salary_type = $6, monthly_salary = $7, daily_wage = $8,
                is_active = $9, notes = $10, updated_at = CURRENT_TIMESTAMP
            WHERE id = $11;
            "#,
            &[&input.full_name, &phone, &addr, &joined, &stype, &saltype, &dec_m_sal, &dec_d_wage, &active, &notes, &sid],
        )
        .await
        .map_err(|e| e.to_string())?;
        Ok(sid.to_string())
    } else {
        let sid = Uuid::new_v4();
        client.execute(
            r#"
            INSERT INTO staff (id, full_name, phone_number, address, joined_date, staff_type, salary_type, monthly_salary, daily_wage, is_active, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);
            "#,
            &[&sid, &input.full_name, &phone, &addr, &joined, &stype, &saltype, &dec_m_sal, &dec_d_wage, &active, &notes],
        )
        .await
        .map_err(|e| e.to_string())?;
        Ok(sid.to_string())
    }
}

#[tauri::command]
pub async fn db_get_documents(
    category: Option<String>,
    state: tauri::State<'_, Arc<DbState>>,
) -> Result<Vec<DocumentItem>, String> {
    let client = state.get_client().await?;
    let rows = if let Some(cat) = category {
        if !cat.trim().is_empty() && cat != "All" {
            client.query(
                "SELECT id::text, title, category, description, document_date::text, file_name, file_size, mime_type FROM documents WHERE category = $1 ORDER BY document_date DESC;",
                &[&cat],
            ).await.map_err(|e| e.to_string())?
        } else {
            client.query(
                "SELECT id::text, title, category, description, document_date::text, file_name, file_size, mime_type FROM documents ORDER BY document_date DESC;",
                &[],
            ).await.map_err(|e| e.to_string())?
        }
    } else {
        client.query(
            "SELECT id::text, title, category, description, document_date::text, file_name, file_size, mime_type FROM documents ORDER BY document_date DESC;",
            &[],
        ).await.map_err(|e| e.to_string())?
    };

    let mut list = Vec::new();
    for r in rows {
        list.push(DocumentItem {
            id: r.get(0),
            title: r.get(1),
            category: r.get(2),
            description: r.get(3),
            document_date: r.get(4),
            file_name: r.get(5),
            file_size: r.get(6),
            mime_type: r.get(7),
        });
    }
    Ok(list)
}

#[tauri::command]
pub async fn db_save_document(
    input: SaveDocumentInput,
    state: tauri::State<'_, Arc<DbState>>,
) -> Result<String, String> {
    let client = state.get_client().await?;
    let cat = input.category.unwrap_or_else(|| "General".to_string());
    let desc = input.description.unwrap_or_default();
    let doc_date = input.document_date
        .and_then(|d| NaiveDate::parse_from_str(&d, "%Y-%m-%d").ok())
        .unwrap_or_else(|| Utc::now().date_naive());
    let fname = input.file_name.unwrap_or_default();
    let fpath = input.file_path.unwrap_or_default();
    let fsize = input.file_size.unwrap_or(0);
    let mtype = input.mime_type.unwrap_or_default();

    if let Some(ref id_str) = input.id {
        let did = Uuid::parse_str(id_str).map_err(|e| e.to_string())?;
        client.execute(
            r#"
            UPDATE documents
            SET title = $1, category = $2, description = $3, document_date = $4,
                file_name = $5, file_path = $6, file_size = $7, mime_type = $8, updated_at = CURRENT_TIMESTAMP
            WHERE id = $9;
            "#,
            &[&input.title, &cat, &desc, &doc_date, &fname, &fpath, &fsize, &mtype, &did],
        )
        .await
        .map_err(|e| e.to_string())?;
        Ok(did.to_string())
    } else {
        let did = Uuid::new_v4();
        client.execute(
            r#"
            INSERT INTO documents (id, title, category, description, document_date, file_name, file_path, file_size, mime_type)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
            "#,
            &[&did, &input.title, &cat, &desc, &doc_date, &fname, &fpath, &fsize, &mtype],
        )
        .await
        .map_err(|e| e.to_string())?;
        Ok(did.to_string())
    }
}

#[tauri::command]
pub async fn db_delete_document(
    id: String,
    state: tauri::State<'_, Arc<DbState>>,
) -> Result<bool, String> {
    let client = state.get_client().await?;
    let did = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    client.execute("DELETE FROM documents WHERE id = $1;", &[&did])
        .await
        .map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub async fn db_update_settings(
    input: SystemSettingsDto,
    state: tauri::State<'_, Arc<DbState>>,
) -> Result<bool, String> {
    let client = state.get_client().await?;
    client.execute(
        r#"
        UPDATE system_settings
        SET business_name = $1, phone_number = $2, gst_number = $3, address = $4,
            upi_id = $5, invoice_footer_notes = $6, pin_code = $7, auto_backup_enabled = $8,
            backup_folder = $9, backup_on_close = $10, fallback_backup_time = $11,
            retention_count = $12, updated_at = CURRENT_TIMESTAMP;
        "#,
        &[
            &input.business_name, &input.phone_number, &input.gst_number, &input.address,
            &input.upi_id, &input.invoice_footer_notes, &input.pin_code, &input.auto_backup_enabled,
            &input.backup_folder, &input.backup_on_close, &input.fallback_backup_time,
            &input.retention_count,
        ],
    )
    .await
    .map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub async fn db_get_sales_report(
    start_date: String,
    end_date: String,
    state: tauri::State<'_, Arc<DbState>>,
) -> Result<SalesReportSummary, String> {
    let client = state.get_client().await?;
    let s_date = NaiveDate::parse_from_str(&start_date, "%Y-%m-%d").map_err(|e| e.to_string())?;
    let e_date = NaiveDate::parse_from_str(&end_date, "%Y-%m-%d").map_err(|e| e.to_string())?;

    let sales_row = client.query_one(
        "SELECT COALESCE(SUM(total_amount), 0), COUNT(id) FROM orders WHERE bill_date >= $1 AND bill_date <= $2;",
        &[&s_date, &e_date],
    ).await.map_err(|e| e.to_string())?;
    let total_sales: f64 = sales_row.get::<_, rust_decimal::Decimal>(0).to_string().parse().unwrap_or(0.0);
    let order_count: i64 = sales_row.get(1);

    let pay_row = client.query_one(
        "SELECT COALESCE(SUM(amount), 0), COUNT(id) FROM payments WHERE received_at::date >= $1 AND received_at::date <= $2 AND status = 'COMPLETED';",
        &[&s_date, &e_date],
    ).await.map_err(|e| e.to_string())?;
    let total_payments: f64 = pay_row.get::<_, rust_decimal::Decimal>(0).to_string().parse().unwrap_or(0.0);
    let payment_count: i64 = pay_row.get(1);

    let exp_row = client.query_one(
        "SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE expense_date >= $1 AND expense_date <= $2;",
        &[&s_date, &e_date],
    ).await.map_err(|e| e.to_string())?;
    let total_expenses: f64 = exp_row.get::<_, rust_decimal::Decimal>(0).to_string().parse().unwrap_or(0.0);

    Ok(SalesReportSummary {
        total_sales,
        total_payments,
        total_expenses,
        order_count,
        payment_count,
        start_date,
        end_date,
    })
}
