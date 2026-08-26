import { getDb, initDatabase } from './connection.js'
import { logger } from '../utils/logger.js'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  cpf TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL DEFAULT '',
  photo TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'passenger',
  super_admin INTEGER NOT NULL DEFAULT 0,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_access TEXT NOT NULL DEFAULT (datetime('now')),
  reset_token TEXT DEFAULT NULL,
  reset_token_expires INTEGER DEFAULT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0,
  verify_token TEXT DEFAULT NULL,
  verify_token_expires INTEGER DEFAULT NULL,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS passengers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cpf TEXT NOT NULL UNIQUE,
  rg TEXT DEFAULT '',
  birth_date TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  whatsapp TEXT DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  zip_code TEXT DEFAULT '',
  street TEXT DEFAULT '',
  number TEXT DEFAULT '',
  complement TEXT DEFAULT '',
  neighborhood TEXT DEFAULT '',
  city TEXT DEFAULT '',
  state TEXT DEFAULT '',
  transport_type TEXT NOT NULL DEFAULT 'university',
  institution TEXT DEFAULT '',
  course TEXT DEFAULT '',
  class TEXT DEFAULT '',
  company TEXT DEFAULT '',
  school TEXT DEFAULT '',
  workplace TEXT DEFAULT '',
  monthly_fee REAL NOT NULL DEFAULT 0,
  due_day INTEGER NOT NULL DEFAULT 5,
  payment_method TEXT NOT NULL DEFAULT 'pix',
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT DEFAULT '',
  pickup_point TEXT DEFAULT '',
  destination TEXT DEFAULT '',
  contract_start_date TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS monthly_fees (
  id TEXT PRIMARY KEY,
  passenger_id TEXT NOT NULL REFERENCES passengers(id),
  passenger_name TEXT NOT NULL,
  cpf TEXT NOT NULL,
  transport_type TEXT NOT NULL,
  institution TEXT DEFAULT '',
  company TEXT DEFAULT '',
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  amount REAL NOT NULL,
  due_day INTEGER NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT DEFAULT '',
  cancellation_reason TEXT DEFAULT '',
  exemption_reason TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  monthly_fee_id TEXT NOT NULL REFERENCES monthly_fees(id),
  amount REAL NOT NULL,
  payment_date TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS availabilities (
  id TEXT PRIMARY KEY,
  passenger_id TEXT NOT NULL REFERENCES passengers(id),
  passenger_name TEXT NOT NULL,
  cpf TEXT NOT NULL,
  transport_type TEXT NOT NULL,
  institution TEXT DEFAULT '',
  company TEXT DEFAULT '',
  city TEXT DEFAULT '',
  type TEXT NOT NULL DEFAULT 'vacation',
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'scheduled',
  cancelled_at TEXT DEFAULT '',
  cancellation_reason TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS availability_history (
  id TEXT PRIMARY KEY,
  availability_id TEXT NOT NULL REFERENCES availabilities(id),
  action TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  performed_by_id TEXT NOT NULL,
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'individual',
  status TEXT NOT NULL DEFAULT 'draft',
  priority TEXT NOT NULL DEFAULT 'normal',
  channel TEXT NOT NULL DEFAULT 'app',
  template_id TEXT DEFAULT '',
  recipients TEXT NOT NULL DEFAULT '[]',
  scheduled_at TEXT DEFAULT NULL,
  sent_at TEXT DEFAULT NULL,
  failed_at TEXT DEFAULT NULL,
  error_message TEXT DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unread',
  type TEXT NOT NULL DEFAULT 'info',
  link TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  read_at TEXT DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,
  category TEXT NOT NULL,
  details TEXT DEFAULT '{}',
  ip TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pix_charges (
  id TEXT PRIMARY KEY,
  payment_intent_id TEXT NOT NULL,
  monthly_fee_id TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  pix_code TEXT DEFAULT '',
  qr_image TEXT DEFAULT '',
  superseded_at TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS message_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'custom',
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  variables TEXT NOT NULL DEFAULT '[]',
  channel TEXT NOT NULL DEFAULT 'app',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS message_history (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES messages(id),
  action TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  performed_by TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS app_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  user_name TEXT NOT NULL DEFAULT '',
  user_role TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`

export async function runMigrations(): Promise<void> {
  await initDatabase()
  const db = getDb()
  db.exec(SCHEMA)

  // Add new columns if missing (for existing databases)
  try { db.exec("ALTER TABLE monthly_fees ADD COLUMN due_date TEXT DEFAULT ''") } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN reset_token TEXT DEFAULT NULL") } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN reset_token_expires INTEGER DEFAULT NULL") } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0') } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN super_admin INTEGER NOT NULL DEFAULT 0') } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN verify_token TEXT DEFAULT NULL') } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN verify_token_expires INTEGER DEFAULT NULL') } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER NOT NULL DEFAULT 0') } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN locked_until INTEGER DEFAULT NULL') } catch {}
  try { db.exec('ALTER TABLE passengers ADD COLUMN pickup_point TEXT DEFAULT \'\'') } catch {}
  try { db.exec('ALTER TABLE passengers ADD COLUMN destination TEXT DEFAULT \'\'') } catch {}
  try { db.exec('ALTER TABLE passengers ADD COLUMN contract_start_date TEXT DEFAULT \'\'') } catch {}
  try { db.exec('ALTER TABLE payments ADD COLUMN late_fee REAL NOT NULL DEFAULT 0') } catch {}
  try { db.exec('ALTER TABLE payments ADD COLUMN interest REAL NOT NULL DEFAULT 0') } catch {}
  try {
    db.exec("UPDATE monthly_fees SET due_date = printf('%02d/%02d/%04d', due_day, month, year) WHERE length(due_date) <= 7")
  } catch {}

  // --- P1: multi-charge prevention migration ---
  // Add pix_charges columns if missing (for existing databases)
  try { db.exec("ALTER TABLE pix_charges ADD COLUMN pix_code TEXT DEFAULT ''") } catch {}
  try { db.exec("ALTER TABLE pix_charges ADD COLUMN qr_image TEXT DEFAULT ''") } catch {}
  try { db.exec("ALTER TABLE pix_charges ADD COLUMN superseded_at TEXT DEFAULT NULL") } catch {}

  // Supersede duplicate pending charges: keep the newest per fee, mark rest as superseded.
  // This ensures the unique partial index (below) can be created without conflict.
  try {
    const dupes = db.prepare(
      "SELECT monthly_fee_id FROM pix_charges WHERE status = 'pending' GROUP BY monthly_fee_id HAVING COUNT(*) > 1"
    ).all() as any[]
    for (const d of dupes) {
      const newest = db.prepare(
        "SELECT id FROM pix_charges WHERE monthly_fee_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1"
      ).get(d.monthly_fee_id) as any
      if (newest) {
        db.prepare(
          "UPDATE pix_charges SET status = 'superseded', superseded_at = datetime('now'), updated_at = datetime('now') WHERE monthly_fee_id = ? AND status = 'pending' AND id != ?"
        ).run(d.monthly_fee_id, newest.id)
      }
    }
  } catch {}

  // Unique partial index: at most one pending charge per monthly fee.
  // The INSERT path enforces this at the database engine level, making race conditions impossible.
  try {
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_one_pending_per_fee ON pix_charges(monthly_fee_id) WHERE status = 'pending'")
  } catch {}

  // Bump default billing tolerance from 5 to 0 days (fees flip to overdue right after the due date)
  try {
    const billing = db.prepare("SELECT * FROM settings WHERE category = 'billing'").get() as any
    if (billing) {
      const data = JSON.parse(billing.data)
      if (data && typeof data.toleranceDays === 'number' && data.toleranceDays === 5) {
        data.toleranceDays = 0
        db.prepare("UPDATE settings SET data = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(data), billing.id)
        logger.info('Billing toleranceDays updated from 5 to 0 (new default)')
      }
    }
  } catch {}

  logger.info('Migrations executed successfully')
}
