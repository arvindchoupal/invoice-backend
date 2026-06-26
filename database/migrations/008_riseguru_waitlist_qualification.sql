ALTER TABLE riseguru_waitlist
  ADD COLUMN IF NOT EXISTS channel_size VARCHAR(40) NULL AFTER email,
  ADD COLUMN IF NOT EXISTS primary_goal VARCHAR(40) NULL AFTER channel_size;
