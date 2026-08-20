CREATE TABLE IF NOT EXISTS buildfast_sites (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  slug VARCHAR(90) NOT NULL UNIQUE,
  template_id VARCHAR(40) NOT NULL,
  industry VARCHAR(40) NOT NULL,
  business_name VARCHAR(180) NOT NULL,
  city VARCHAR(120) NOT NULL,
  country VARCHAR(120) NOT NULL,
  site_data JSON NOT NULL,
  status ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
  is_paid TINYINT(1) NOT NULL DEFAULT 0,
  published_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_buildfast_industry (industry),
  INDEX idx_buildfast_status_created (status, created_at)
);
