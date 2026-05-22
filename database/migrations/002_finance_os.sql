CREATE TABLE IF NOT EXISTS finance_documents (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NULL,
  source_invoice_id BIGINT UNSIGNED NULL,
  document_type ENUM('invoice','receipt','quotation','estimate','purchase_order','credit_note','expense_report','delivery_challan','tax_invoice') NOT NULL,
  document_number VARCHAR(80) NOT NULL,
  status ENUM('Draft','Sent','Accepted','Paid','Overdue','Cancelled') NOT NULL DEFAULT 'Draft',
  issue_date DATE NOT NULL,
  due_date DATE NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  party_name VARCHAR(180) NOT NULL,
  party_email VARCHAR(190),
  party_tax_id VARCHAR(80),
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_finance_documents_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_finance_documents_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
  CONSTRAINT fk_finance_documents_invoice FOREIGN KEY (source_invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
  UNIQUE KEY uq_finance_doc_user_number (user_id, document_number),
  INDEX idx_finance_docs_user_type (user_id, document_type),
  INDEX idx_finance_docs_user_status (user_id, status)
);

CREATE TABLE IF NOT EXISTS expenses (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  vendor_name VARCHAR(180) NOT NULL,
  vendor_tax_id VARCHAR(80),
  expense_number VARCHAR(80),
  category VARCHAR(80) NOT NULL DEFAULT 'Uncategorized',
  expense_date DATE NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_status ENUM('unpaid','paid','refunded') NOT NULL DEFAULT 'unpaid',
  source VARCHAR(40) NOT NULL DEFAULT 'manual',
  source_file VARCHAR(500),
  notes TEXT,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_expenses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_expenses_user_date (user_id, expense_date),
  INDEX idx_expenses_user_category (user_id, category)
);

CREATE TABLE IF NOT EXISTS purchases (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  vendor_name VARCHAR(180) NOT NULL,
  vendor_tax_id VARCHAR(80),
  purchase_number VARCHAR(80),
  purchase_date DATE NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  status ENUM('Draft','Ordered','Received','Paid','Cancelled') NOT NULL DEFAULT 'Received',
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_purchases_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_purchases_user_date (user_id, purchase_date)
);

CREATE TABLE IF NOT EXISTS recurring_invoices (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NULL,
  template_invoice_id BIGINT UNSIGNED NULL,
  frequency ENUM('weekly','monthly','yearly') NOT NULL,
  next_run_date DATE NOT NULL,
  auto_send BOOLEAN NOT NULL DEFAULT FALSE,
  status ENUM('active','paused','cancelled') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_recurring_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_recurring_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
  CONSTRAINT fk_recurring_invoice FOREIGN KEY (template_invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
  INDEX idx_recurring_user_next (user_id, next_run_date, status)
);

CREATE TABLE IF NOT EXISTS reminder_rules (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  channel ENUM('email','whatsapp') NOT NULL DEFAULT 'email',
  trigger_type ENUM('before_due','on_due','after_due') NOT NULL,
  days_offset INT NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reminder_rules_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS client_portal_tokens (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  invoice_id BIGINT UNSIGNED NOT NULL,
  token VARCHAR(128) NOT NULL UNIQUE,
  expires_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_portal_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS subscription_plans (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name ENUM('free','pro','business') NOT NULL UNIQUE,
  invoice_limit INT NULL,
  ai_import_limit INT NULL,
  features JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_plan_usage (
  user_id BIGINT UNSIGNED PRIMARY KEY,
  plan_name ENUM('free','pro','business') NOT NULL DEFAULT 'free',
  invoice_count INT NOT NULL DEFAULT 0,
  ai_import_count INT NOT NULL DEFAULT 0,
  period_start DATE NOT NULL DEFAULT (CURRENT_DATE),
  period_end DATE NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_usage_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO subscription_plans (name, invoice_limit, ai_import_limit, features)
VALUES
  ('free', 25, 5, JSON_OBJECT('reports', 'basic', 'brandingRemoval', false, 'teams', false, 'clientPortal', false)),
  ('pro', NULL, NULL, JSON_OBJECT('reports', 'advanced', 'brandingRemoval', true, 'reminders', true, 'aiAutomation', true)),
  ('business', NULL, NULL, JSON_OBJECT('reports', 'advanced', 'teams', true, 'multiWorkspace', true, 'clientPortal', true, 'advancedAnalytics', true))
ON DUPLICATE KEY UPDATE invoice_limit = VALUES(invoice_limit), ai_import_limit = VALUES(ai_import_limit), features = VALUES(features);
