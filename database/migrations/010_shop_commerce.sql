CREATE TABLE IF NOT EXISTS shop_products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(160) NOT NULL,
  name VARCHAR(220) NOT NULL,
  description TEXT NULL,
  category VARCHAR(120) NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  compare_at_price DECIMAL(12,2) NULL,
  image_url VARCHAR(1000) NOT NULL,
  images JSON NULL,
  colors JSON NULL,
  sizes JSON NULL,
  badge VARCHAR(60) NULL,
  inventory INT NOT NULL DEFAULT 0,
  status ENUM('draft','active','archived') NOT NULL DEFAULT 'active',
  featured TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY uq_shop_products_slug (slug),
  KEY idx_shop_products_status_category (status, category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shop_customers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(190) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(40) NULL,
  orders_count INT NOT NULL DEFAULT 0,
  total_spent DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY uq_shop_customers_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shop_orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_number VARCHAR(30) NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  status ENUM('pending','paid','processing','shipped','delivered','cancelled') NOT NULL DEFAULT 'pending',
  payment_method VARCHAR(40) NOT NULL DEFAULT 'cod',
  subtotal DECIMAL(12,2) NOT NULL,
  shipping_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,
  shipping_address JSON NOT NULL,
  notes VARCHAR(1000) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY uq_shop_orders_number (order_number),
  KEY idx_shop_orders_customer (customer_id), CONSTRAINT fk_shop_orders_customer FOREIGN KEY (customer_id) REFERENCES shop_customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shop_order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  product_name VARCHAR(220) NOT NULL,
  variant VARCHAR(120) NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  total DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (id), KEY idx_shop_items_order (order_id),
  CONSTRAINT fk_shop_items_order FOREIGN KEY (order_id) REFERENCES shop_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_shop_items_product FOREIGN KEY (product_id) REFERENCES shop_products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shop_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_name VARCHAR(100) NOT NULL,
  event_id VARCHAR(100) NULL,
  session_id VARCHAR(100) NULL,
  page_path VARCHAR(500) NULL,
  properties JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), KEY idx_shop_events_name_created (event_name, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO shop_products (slug,name,description,category,price,compare_at_price,image_url,colors,sizes,badge,inventory,featured) VALUES
('linen-overshirt','The Linen Overshirt','A relaxed layer cut from breathable European linen.','New arrivals',4890,5990,'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=1200&q=85','["#d7c8ad","#29332e","#eeeae2"]','["XS","S","M","L","XL"]','Bestseller',28,1),
('everyday-trouser','Everyday Wide Trouser','Soft tailoring with an easy, fluid drape.','Essentials',3690,NULL,'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?auto=format&fit=crop&w=1200&q=85','["#1f1f1d","#beb5a3"]','["26","28","30","32","34"]',NULL,34,1),
('studio-knit','Soft Studio Knit','A lightweight knit for slow mornings and cool evenings.','Knitwear',4290,NULL,'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=1200&q=85','["#b96b47","#e8ded0","#4a554d"]','["XS","S","M","L"]','New',21,1),
('structured-tote','Structured Day Tote','A spacious everyday companion with a sculptural silhouette.','Accessories',5490,NULL,'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1200&q=85','["#5e3928","#171716"]','["One size"]',NULL,16,1)
ON DUPLICATE KEY UPDATE name=VALUES(name), price=VALUES(price), inventory=VALUES(inventory);
