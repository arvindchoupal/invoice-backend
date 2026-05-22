INSERT INTO users (id, name, email, password_hash, role)
VALUES
  (1, 'Admin User', 'admin@invoice.test', '$2a$12$rIBoe/qrzxGK/IDulodJAe46UizGnVEF9sgB3EzjDtZv0UvxzGW5m', 'admin'),
  (2, 'Avery Stone', 'avery@invoice.test', '$2a$12$rIBoe/qrzxGK/IDulodJAe46UizGnVEF9sgB3EzjDtZv0UvxzGW5m', 'user')
ON DUPLICATE KEY UPDATE email = VALUES(email);

INSERT INTO settings (user_id, company_name, company_email, company_address, company_tax_id, currency, tax_name, tax_rate, invoice_prefix, invoice_counter)
VALUES (2, 'Northstar Studio', 'billing@northstar.test', '14 Market Street, Austin, TX', 'VAT-930102', 'USD', 'VAT', 8.25, 'NST', 3)
ON DUPLICATE KEY UPDATE company_name = VALUES(company_name);

INSERT INTO clients (id, user_id, name, email, phone, tax_id, billing_address)
VALUES
  (1, 2, 'Brightlane Labs', 'finance@brightlane.test', '+1 555 0101', 'GST-7788', '500 Innovation Ave, Seattle, WA'),
  (2, 2, 'Kite Systems', 'ap@kite.test', '+1 555 0144', 'VAT-2255', '90 Cloud Drive, Denver, CO')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO invoices (id, user_id, client_id, invoice_number, issue_date, due_date, status, currency, business_name, business_email, business_tax_id, business_address, customer_name, customer_email, customer_tax_id, customer_address, notes, terms, subtotal, tax_total, discount_total, total)
VALUES
  (1, 2, 1, 'NST-00001', '2026-05-01', '2026-05-15', 'Paid', 'USD', 'Northstar Studio', 'billing@northstar.test', 'VAT-930102', '14 Market Street, Austin, TX', 'Brightlane Labs', 'finance@brightlane.test', 'GST-7788', '500 Innovation Ave, Seattle, WA', 'Thanks for your business.', 'Due within 14 days.', 3200, 264, 0, 3464),
  (2, 2, 2, 'NST-00002', '2026-05-10', '2026-05-24', 'Sent', 'USD', 'Northstar Studio', 'billing@northstar.test', 'VAT-930102', '14 Market Street, Austin, TX', 'Kite Systems', 'ap@kite.test', 'VAT-2255', '90 Cloud Drive, Denver, CO', 'Project milestone invoice.', 'Late fees may apply.', 1800, 148.50, 90, 1858.50)
ON DUPLICATE KEY UPDATE status = VALUES(status);

INSERT INTO invoice_items (invoice_id, name, description, quantity, unit_price, tax_rate, discount_rate)
VALUES
  (1, 'Product strategy sprint', 'Discovery, workshop, and roadmap', 1, 3200, 8.25, 0),
  (2, 'Dashboard build', 'Analytics dashboard implementation', 1, 1800, 8.25, 5);
