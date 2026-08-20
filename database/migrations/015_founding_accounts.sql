CREATE TABLE IF NOT EXISTS launch_offers (
  offer_key VARCHAR(80) PRIMARY KEY,
  claim_limit INT UNSIGNED NOT NULL,
  claimed_count INT UNSIGNED NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS founding_members (
  member_number INT UNSIGNED PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_founding_member_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO launch_offers (offer_key, claim_limit, claimed_count, active)
VALUES ('founding-1000', 1000, 0, TRUE)
ON DUPLICATE KEY UPDATE claim_limit = VALUES(claim_limit);

INSERT IGNORE INTO founding_members (member_number, user_id)
SELECT ranked.member_number, ranked.id
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS member_number
  FROM users
  WHERE role = 'user'
) AS ranked
WHERE ranked.member_number <= 1000;

UPDATE launch_offers
SET claimed_count = (SELECT COUNT(*) FROM founding_members)
WHERE offer_key = 'founding-1000';

INSERT INTO user_plan_usage (user_id, plan_name)
SELECT user_id, 'pro' FROM founding_members
ON DUPLICATE KEY UPDATE plan_name = 'pro';
