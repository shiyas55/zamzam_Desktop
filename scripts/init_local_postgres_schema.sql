-- ==============================================================================
-- Zamzam Foods Desktop — Clean Local PostgreSQL Schema
-- Database: zamzam_local
-- Single Role (Owner) | Complete Offline Capability | High Performance Indexes
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Owner & Security
CREATE TABLE IF NOT EXISTS owner_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL DEFAULT 'Business Owner',
    pin_code VARCHAR(10) NOT NULL DEFAULT '7667',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Products Catalog
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    packet_size VARCHAR(50) NOT NULL DEFAULT '',
    order_number INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_products_order_number ON products(order_number);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

-- 3. Customers / Shops
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    owner_name VARCHAR(100) NOT NULL DEFAULT '',
    phone VARCHAR(20) NOT NULL DEFAULT '',
    alternative_phone VARCHAR(20) NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    route_name VARCHAR(100) NOT NULL DEFAULT '',
    opening_due NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    current_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    notes TEXT NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_route ON customers(route_name);
CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(is_active);

-- 4. Customer-Specific Pricing Matrix
CREATE TABLE IF NOT EXISTS customer_product_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    price NUMERIC(12, 2) NOT NULL,
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cust_prod_active_unique ON customer_product_prices(customer_id, product_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_cust_prices_cust ON customer_product_prices(customer_id);

-- 5. Orders / Daily Bills
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bill_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    previous_due NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    remaining_due NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_method VARCHAR(30) NOT NULL DEFAULT 'CASH',
    payment_reference VARCHAR(100) NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_bill_date ON orders(bill_date);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- 6. Order Items / Line Items
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL DEFAULT 0,
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_order_product UNIQUE (order_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- 7. Payments / Financial Receipts
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_method VARCHAR(30) NOT NULL DEFAULT 'CASH',
    reference_number VARCHAR(100) NOT NULL DEFAULT '',
    received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
    reversal_reason TEXT NOT NULL DEFAULT '',
    reversed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(received_at);
CREATE INDEX IF NOT EXISTS idx_payments_method ON payments(payment_method);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- 8. Customer Credit Ledger (Double-Entry Financial History)
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    transaction_type VARCHAR(30) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    balance_after NUMERIC(12, 2) NOT NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_credit_cust ON credit_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_type ON credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_credit_created ON credit_transactions(created_at);

-- 9. General Business Expenses
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    category VARCHAR(50) NOT NULL DEFAULT 'Other',
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_method VARCHAR(30) NOT NULL DEFAULT 'CASH',
    description TEXT NOT NULL DEFAULT '',
    receipt_reference VARCHAR(100) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- 10. Staff Directory
CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(150) NOT NULL,
    phone_number VARCHAR(20) NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    joined_date DATE NOT NULL DEFAULT CURRENT_DATE,
    staff_type VARCHAR(50) NOT NULL DEFAULT 'Worker',
    salary_type VARCHAR(30) NOT NULL DEFAULT 'DAILY_WAGE',
    monthly_salary NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    daily_wage NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_staff_active ON staff(is_active);

-- 11. Staff Daily Attendance (Excel-style)
CREATE TABLE IF NOT EXISTS staff_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'PRESENT',
    daily_wage NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_staff_date UNIQUE (staff_id, date)
);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON staff_attendance(date);

-- 12. Staff Payouts (Advances, Wages, Salary)
CREATE TABLE IF NOT EXISTS staff_payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payout_type VARCHAR(30) NOT NULL DEFAULT 'SALARY',
    payment_method VARCHAR(30) NOT NULL DEFAULT 'CASH',
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    reference VARCHAR(100) NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_staff_payouts_date ON staff_payouts(date);

-- 13. Business Documentation & Records
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'Other',
    description TEXT NOT NULL DEFAULT '',
    document_date DATE NOT NULL DEFAULT CURRENT_DATE,
    file_path TEXT NOT NULL DEFAULT '',
    file_name VARCHAR(255) NOT NULL DEFAULT '',
    file_size BIGINT NOT NULL DEFAULT 0,
    mime_type VARCHAR(100) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_date ON documents(document_date);

-- 14. System Configuration & Backup Settings
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_name VARCHAR(200) NOT NULL DEFAULT 'Zamzam Foods',
    phone_number VARCHAR(50) NOT NULL DEFAULT '+91 98470 12345',
    gst_number VARCHAR(50) NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT 'Main Road, Pandikkad, Malappuram, Kerala',
    upi_id VARCHAR(100) NOT NULL DEFAULT '',
    invoice_footer_notes TEXT NOT NULL DEFAULT 'Thank you for your business. Fresh Kubbus & Romali rotis delivered daily.',
    pin_code VARCHAR(10) NOT NULL DEFAULT '7667',
    auto_backup_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    backup_folder TEXT NOT NULL DEFAULT '',
    backup_on_close BOOLEAN NOT NULL DEFAULT TRUE,
    fallback_backup_time VARCHAR(10) NOT NULL DEFAULT '23:59',
    retention_count INTEGER NOT NULL DEFAULT 30,
    last_backup_at TIMESTAMPTZ,
    last_cloud_upload_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
