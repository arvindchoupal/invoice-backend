INSERT INTO subscription_plans (name, invoice_limit, ai_import_limit, features)
VALUES
  ('pro', NULL, NULL, JSON_OBJECT('reports', 'advanced', 'brandingRemoval', true, 'reminders', true, 'aiAutomation', true, 'gstReports', true, 'priceMonthlyInr', 199, 'earlyAccess', true)),
  ('business', NULL, NULL, JSON_OBJECT('reports', 'advanced', 'teams', true, 'multiWorkspace', true, 'clientPortal', true, 'advancedAnalytics', true, 'priceMonthlyInr', 499, 'earlyAccess', true))
ON DUPLICATE KEY UPDATE invoice_limit = VALUES(invoice_limit), ai_import_limit = VALUES(ai_import_limit), features = VALUES(features);
