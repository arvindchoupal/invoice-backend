CREATE TABLE IF NOT EXISTS shop_settings (
  id TINYINT UNSIGNED NOT NULL DEFAULT 1,
  store_name VARCHAR(180) NOT NULL DEFAULT 'Nørdika Store',
  support_email VARCHAR(190) NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  country VARCHAR(100) NOT NULL DEFAULT 'India',
  free_shipping_threshold DECIMAL(12,2) NOT NULL DEFAULT 3500,
  flat_shipping_rate DECIMAL(12,2) NOT NULL DEFAULT 199,
  cod_enabled TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO shop_settings (id,store_name,support_email) VALUES (1,'Nørdika Store','support@nordika.in') ON DUPLICATE KEY UPDATE id=VALUES(id);
