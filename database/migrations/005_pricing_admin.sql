ALTER TABLE subscription_plans
  MODIFY name ENUM('free','starter','pro','business') NOT NULL UNIQUE;

ALTER TABLE user_plan_usage
  MODIFY plan_name ENUM('free','starter','pro','business') NOT NULL DEFAULT 'free';

INSERT INTO subscription_plans (name, invoice_limit, ai_import_limit, features)
VALUES
  ('free', 10, 2, JSON_OBJECT('reports', 'basic', 'brandingRemoval', false, 'reminders', false, 'clientPortal', false)),
  ('starter', 100, 10, JSON_OBJECT('reports', 'basic_plus', 'brandingRemoval', false, 'reminders', true, 'gstReports', true, 'priceMonthlyInr', 199)),
  ('pro', NULL, NULL, JSON_OBJECT('reports', 'advanced', 'brandingRemoval', true, 'reminders', true, 'aiAutomation', true, 'priceMonthlyInr', 999)),
  ('business', NULL, NULL, JSON_OBJECT('reports', 'advanced', 'teams', true, 'multiWorkspace', true, 'clientPortal', true, 'advancedAnalytics', true, 'priceMonthlyInr', 2499))
ON DUPLICATE KEY UPDATE invoice_limit = VALUES(invoice_limit), ai_import_limit = VALUES(ai_import_limit), features = VALUES(features);

UPDATE users SET role = 'admin' WHERE LOWER(email) = 'arvind@vtechserve.io';
