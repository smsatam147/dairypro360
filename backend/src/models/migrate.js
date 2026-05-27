/**
 * DairyPro 360 — Database Migration Script
 * Creates all PostgreSQL tables with constraints, indexes, and foreign keys.
 * Run: node src/models/migrate.js
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const migrations = [
  // ── Users & Auth ─────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(150) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,
    role        VARCHAR(50) NOT NULL DEFAULT 'collection_agent',
    is_active   BOOLEAN DEFAULT TRUE,
    twofa_secret VARCHAR(100),
    twofa_enabled BOOLEAN DEFAULT FALSE,
    failed_logins INT DEFAULT 0,
    locked_until  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
  );`,

  `CREATE TABLE IF NOT EXISTS audit_logs (
    id          SERIAL PRIMARY KEY,
    user_id     INT REFERENCES users(id),
    action      VARCHAR(100) NOT NULL,
    entity      VARCHAR(50),
    entity_id   INT,
    ip_address  INET,
    details     JSONB,
    created_at  TIMESTAMPTZ DEFAULT NOW()
  );`,

  // ── Cattle & Farm ────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS cattle (
    id              SERIAL PRIMARY KEY,
    cattle_tag      VARCHAR(30) UNIQUE NOT NULL,
    name            VARCHAR(100),
    breed           VARCHAR(50) NOT NULL,
    date_of_birth   DATE NOT NULL,
    gender          VARCHAR(10) NOT NULL CHECK (gender IN ('Male','Female')),
    health_status   VARCHAR(20) NOT NULL DEFAULT 'Healthy'
                      CHECK (health_status IN ('Healthy','Sick','Quarantined','Sold','Deceased')),
    last_vaccination DATE,
    next_vaccination DATE,
    daily_yield_L   DECIMAL(6,2) DEFAULT 0,
    notes           TEXT,
    created_by      INT REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
  );`,

  `CREATE TABLE IF NOT EXISTS cattle_health_events (
    id          SERIAL PRIMARY KEY,
    cattle_id   INT NOT NULL REFERENCES cattle(id) ON DELETE CASCADE,
    event_type  VARCHAR(50) NOT NULL,
    description TEXT,
    vet_name    VARCHAR(100),
    event_date  DATE NOT NULL,
    cost        DECIMAL(10,2) DEFAULT 0,
    created_by  INT REFERENCES users(id),
    created_at  TIMESTAMPTZ DEFAULT NOW()
  );`,

  `CREATE TABLE IF NOT EXISTS cattle_yield_log (
    id          SERIAL PRIMARY KEY,
    cattle_id   INT NOT NULL REFERENCES cattle(id) ON DELETE CASCADE,
    log_date    DATE NOT NULL,
    shift       VARCHAR(5) NOT NULL CHECK (shift IN ('AM','PM')),
    yield_L     DECIMAL(6,2) NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(cattle_id, log_date, shift)
  );`,

  `CREATE TABLE IF NOT EXISTS breeding_events (
    id              SERIAL PRIMARY KEY,
    cattle_id       INT NOT NULL REFERENCES cattle(id),
    breeding_date   DATE NOT NULL,
    method          VARCHAR(30) CHECK (method IN ('Natural','Artificial')),
    expected_calving DATE,
    actual_calving  DATE,
    calf_gender     VARCHAR(10),
    notes           TEXT,
    created_by      INT REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
  );`,

  // ── Farmers/Suppliers ─────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS farmer_suppliers (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(20) UNIQUE NOT NULL,
    name        VARCHAR(150) NOT NULL,
    phone       VARCHAR(20),
    village     VARCHAR(100),
    bank_account VARCHAR(50),
    bank_ifsc   VARCHAR(20),
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
  );`,

  // ── Milk Collection ────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS milk_collection (
    id              SERIAL PRIMARY KEY,
    batch_id        VARCHAR(30) UNIQUE NOT NULL,
    farmer_id       INT NOT NULL REFERENCES farmer_suppliers(id),
    collection_date DATE NOT NULL,
    shift           VARCHAR(5) NOT NULL CHECK (shift IN ('AM','PM')),
    quantity_L      DECIMAL(8,2) NOT NULL,
    fat_pct         DECIMAL(5,2) NOT NULL,
    snf_pct         DECIMAL(5,2) NOT NULL,
    clr             DECIMAL(5,2),
    temperature_C   DECIMAL(5,2),
    quality_status  VARCHAR(10) NOT NULL DEFAULT 'Pass' CHECK (quality_status IN ('Pass','Reject')),
    rejection_reason TEXT,
    rate_per_L      DECIMAL(8,2),
    payment_amount  DECIMAL(10,2),
    synced          BOOLEAN DEFAULT TRUE,
    collected_by    INT REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
  );`,

  `CREATE INDEX IF NOT EXISTS idx_collection_date ON milk_collection(collection_date);`,
  `CREATE INDEX IF NOT EXISTS idx_collection_farmer ON milk_collection(farmer_id);`,
  // BUG-02 FIX: Enforce uniqueness — one collection per farmer per shift per day
  `CREATE UNIQUE INDEX IF NOT EXISTS uix_collection_farmer_date_shift
   ON milk_collection(farmer_id, collection_date, shift);`,

  // ── Processing & Production ───────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS production_batches (
    id              SERIAL PRIMARY KEY,
    batch_no        VARCHAR(30) UNIQUE NOT NULL,
    product_type    VARCHAR(50) NOT NULL,
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ,
    input_L         DECIMAL(10,2) NOT NULL,
    output_kg       DECIMAL(10,2),
    byproduct_kg    DECIMAL(10,2) DEFAULT 0,
    yield_efficiency DECIMAL(5,2),
    status          VARCHAR(20) DEFAULT 'In Progress'
                      CHECK (status IN ('In Progress','Completed','Cancelled')),
    supervisor_id   INT REFERENCES users(id),
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
  );`,

  `CREATE TABLE IF NOT EXISTS production_inputs (
    id          SERIAL PRIMARY KEY,
    batch_id    INT NOT NULL REFERENCES production_batches(id),
    collection_batch_id VARCHAR(30) REFERENCES milk_collection(batch_id),
    quantity_L  DECIMAL(8,2) NOT NULL
  );`,

  // ── Inventory ─────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS inventory_items (
    id              SERIAL PRIMARY KEY,
    sku             VARCHAR(50) UNIQUE NOT NULL,
    name            VARCHAR(150) NOT NULL,
    category        VARCHAR(50) NOT NULL,
    unit            VARCHAR(20) NOT NULL,
    reorder_level   DECIMAL(10,2) DEFAULT 0,
    current_stock   DECIMAL(12,2) DEFAULT 0,
    unit_cost       DECIMAL(10,2) DEFAULT 0,
    warehouse       VARCHAR(100) DEFAULT 'Main',
    created_at      TIMESTAMPTZ DEFAULT NOW()
  );`,

  `CREATE TABLE IF NOT EXISTS inventory_transactions (
    id          SERIAL PRIMARY KEY,
    item_id     INT NOT NULL REFERENCES inventory_items(id),
    txn_type    VARCHAR(20) NOT NULL CHECK (txn_type IN ('IN','OUT','ADJUST','TRANSFER')),
    quantity    DECIMAL(12,2) NOT NULL,
    reference   VARCHAR(100),
    batch_no    VARCHAR(50),
    expiry_date DATE,
    notes       TEXT,
    created_by  INT REFERENCES users(id),
    created_at  TIMESTAMPTZ DEFAULT NOW()
  );`,

  // ── Distribution & Delivery ───────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS customers (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(20) UNIQUE NOT NULL,
    name        VARCHAR(150) NOT NULL,
    gstin       VARCHAR(20),
    phone       VARCHAR(20),
    address     TEXT,
    credit_limit DECIMAL(12,2) DEFAULT 0,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
  );`,

  `CREATE TABLE IF NOT EXISTS delivery_routes (
    id          SERIAL PRIMARY KEY,
    route_name  VARCHAR(100) NOT NULL,
    vehicle_no  VARCHAR(20),
    driver_id   INT REFERENCES users(id),
    is_active   BOOLEAN DEFAULT TRUE
  );`,

  `CREATE TABLE IF NOT EXISTS deliveries (
    id              SERIAL PRIMARY KEY,
    delivery_no     VARCHAR(30) UNIQUE NOT NULL,
    route_id        INT REFERENCES delivery_routes(id),
    customer_id     INT NOT NULL REFERENCES customers(id),
    scheduled_date  DATE NOT NULL,
    dispatch_time   TIMESTAMPTZ,
    delivery_time   TIMESTAMPTZ,
    status          VARCHAR(20) DEFAULT 'Scheduled'
                      CHECK (status IN ('Scheduled','Dispatched','In-Transit','Delivered','Failed','Returned')),
    otp             VARCHAR(6),
    rejection_reason VARCHAR(100),
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
  );`,

  `CREATE TABLE IF NOT EXISTS delivery_items (
    id          SERIAL PRIMARY KEY,
    delivery_id INT NOT NULL REFERENCES deliveries(id),
    item_id     INT NOT NULL REFERENCES inventory_items(id),
    quantity    DECIMAL(10,2) NOT NULL,
    unit_price  DECIMAL(10,2) NOT NULL
  );`,

  // ── Finance & Billing ─────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS invoices (
    id              SERIAL PRIMARY KEY,
    invoice_no      VARCHAR(30) UNIQUE NOT NULL,
    customer_id     INT NOT NULL REFERENCES customers(id),
    delivery_id     INT REFERENCES deliveries(id),
    invoice_date    DATE NOT NULL,
    due_date        DATE,
    subtotal        DECIMAL(12,2) NOT NULL,
    cgst_amount     DECIMAL(10,2) DEFAULT 0,
    sgst_amount     DECIMAL(10,2) DEFAULT 0,
    igst_amount     DECIMAL(10,2) DEFAULT 0,
    total_amount    DECIMAL(12,2) NOT NULL,
    paid_amount     DECIMAL(12,2) DEFAULT 0,
    status          VARCHAR(20) DEFAULT 'Unpaid'
                      CHECK (status IN ('Unpaid','Partial','Paid','Overdue','Cancelled')),
    created_at      TIMESTAMPTZ DEFAULT NOW()
  );`,

  `CREATE TABLE IF NOT EXISTS farmer_payments (
    id              SERIAL PRIMARY KEY,
    farmer_id       INT NOT NULL REFERENCES farmer_suppliers(id),
    period_from     DATE NOT NULL,
    period_to       DATE NOT NULL,
    gross_amount    DECIMAL(12,2) NOT NULL,
    deductions      DECIMAL(10,2) DEFAULT 0,
    net_amount      DECIMAL(12,2) NOT NULL,
    payment_date    DATE,
    payment_mode    VARCHAR(30),
    status          VARCHAR(20) DEFAULT 'Pending'
                      CHECK (status IN ('Pending','Processed','Failed')),
    created_at      TIMESTAMPTZ DEFAULT NOW()
  );`,

  // ── HR & Payroll ──────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS employees (
    id              SERIAL PRIMARY KEY,
    emp_code        VARCHAR(20) UNIQUE NOT NULL,
    user_id         INT REFERENCES users(id),
    name            VARCHAR(100) NOT NULL,
    designation     VARCHAR(100),
    department      VARCHAR(100),
    joining_date    DATE NOT NULL,
    basic_salary    DECIMAL(10,2) NOT NULL,
    hra             DECIMAL(10,2) DEFAULT 0,
    special_allow   DECIMAL(10,2) DEFAULT 0,
    pf_enrolled     BOOLEAN DEFAULT TRUE,
    esi_enrolled    BOOLEAN DEFAULT TRUE,
    bank_account    VARCHAR(50),
    bank_ifsc       VARCHAR(20),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
  );`,

  `CREATE TABLE IF NOT EXISTS attendance (
    id          SERIAL PRIMARY KEY,
    employee_id INT NOT NULL REFERENCES employees(id),
    date        DATE NOT NULL,
    status      VARCHAR(20) DEFAULT 'Present'
                  CHECK (status IN ('Present','Absent','Half-Day','Leave')),
    check_in    TIME,
    check_out   TIME,
    UNIQUE(employee_id, date)
  );`,

  `CREATE TABLE IF NOT EXISTS leave_requests (
    id          SERIAL PRIMARY KEY,
    employee_id INT NOT NULL REFERENCES employees(id),
    leave_type  VARCHAR(20) NOT NULL CHECK (leave_type IN ('CL','PL','SL')),
    from_date   DATE NOT NULL,
    to_date     DATE NOT NULL,
    reason      TEXT,
    status      VARCHAR(20) DEFAULT 'Pending'
                  CHECK (status IN ('Pending','Approved','Rejected')),
    approved_by INT REFERENCES users(id),
    created_at  TIMESTAMPTZ DEFAULT NOW()
  );`,

  `CREATE TABLE IF NOT EXISTS payroll (
    id              SERIAL PRIMARY KEY,
    employee_id     INT NOT NULL REFERENCES employees(id),
    month           DATE NOT NULL,
    working_days    INT,
    present_days    INT,
    gross_salary    DECIMAL(10,2),
    pf_deduction    DECIMAL(10,2) DEFAULT 0,
    esi_deduction   DECIMAL(10,2) DEFAULT 0,
    tds_deduction   DECIMAL(10,2) DEFAULT 0,
    advance_recovery DECIMAL(10,2) DEFAULT 0,
    net_salary      DECIMAL(10,2),
    status          VARCHAR(20) DEFAULT 'Draft'
                      CHECK (status IN ('Draft','Processed','Paid')),
    processed_by    INT REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_id, month)
  );`,
];

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('Running DairyPro 360 database migrations...');
    for (let i = 0; i < migrations.length; i++) {
      await client.query(migrations[i]);
      process.stdout.write(`  ✓ Migration ${i + 1}/${migrations.length}\r`);
    }
    console.log('\n✅ All migrations completed successfully.');
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
