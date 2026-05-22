CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','user') NOT NULL DEFAULT 'user',
  avatar_url VARCHAR(500),
  reset_token VARCHAR(128),
  reset_expires DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clients (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(180) NOT NULL,
  email VARCHAR(190),
  phone VARCHAR(60),
  tax_id VARCHAR(80),
  billing_address TEXT,
  shipping_address TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_clients_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_clients_user_name (user_id, name)
);

CREATE TABLE IF NOT EXISTS settings (
  user_id BIGINT UNSIGNED PRIMARY KEY,
  company_name VARCHAR(180),
  company_email VARCHAR(190),
  company_address TEXT,
  company_tax_id VARCHAR(80),
  logo_url VARCHAR(500),
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  tax_name VARCHAR(30) NOT NULL DEFAULT 'VAT',
  tax_rate DECIMAL(7,2) NOT NULL DEFAULT 0,
  theme ENUM('light','dark','system') NOT NULL DEFAULT 'system',
  invoice_prefix VARCHAR(12) NOT NULL DEFAULT 'INV',
  invoice_counter INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS invoices (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NULL,
  invoice_number VARCHAR(60) NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  paid_at DATETIME NULL,
  status ENUM('Draft','Sent','Paid','Overdue') NOT NULL DEFAULT 'Draft',
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  business_name VARCHAR(180) NOT NULL,
  business_email VARCHAR(190),
  business_tax_id VARCHAR(80),
  business_address TEXT,
  customer_name VARCHAR(180) NOT NULL,
  customer_email VARCHAR(190),
  customer_tax_id VARCHAR(80),
  customer_address TEXT,
  notes TEXT,
  terms TEXT,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_invoices_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_invoices_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
  UNIQUE KEY uq_invoice_user_number (user_id, invoice_number),
  INDEX idx_invoices_user_status (user_id, status),
  INDEX idx_invoices_due_date (due_date)
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  invoice_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(180) NOT NULL,
  description TEXT,
  quantity DECIMAL(12,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(7,2) NOT NULL DEFAULT 0,
  discount_rate DECIMAL(7,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_items_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  invoice_id BIGINT UNSIGNED NOT NULL,
  provider ENUM('stripe','razorpay','manual') NOT NULL,
  provider_ref VARCHAR(190),
  amount DECIMAL(12,2) NOT NULL,
  currency CHAR(3) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'created',
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  invoice_id BIGINT UNSIGNED NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  type ENUM('invoice_email','reminder') NOT NULL,
  recipient VARCHAR(190) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'queued',
  sent_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL
);
