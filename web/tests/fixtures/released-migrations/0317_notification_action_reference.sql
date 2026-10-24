ALTER TABLE system_notification_messages ADD COLUMN action_type TEXT
  CHECK (action_type IS NULL OR length(action_type) BETWEEN 3 AND 100);

ALTER TABLE system_notification_messages ADD COLUMN action_id TEXT
  CHECK (action_id IS NULL OR length(action_id) BETWEEN 1 AND 512);
