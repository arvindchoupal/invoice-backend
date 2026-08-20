ALTER TABLE riseguru_waitlist
  ADD COLUMN channel_size VARCHAR(40) NULL AFTER email;

ALTER TABLE riseguru_waitlist
  ADD COLUMN primary_goal VARCHAR(40) NULL AFTER channel_size;
