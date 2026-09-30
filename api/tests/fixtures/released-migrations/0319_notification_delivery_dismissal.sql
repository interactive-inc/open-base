ALTER TABLE system_notification_deliveries ADD COLUMN dismissed_at INTEGER
  CHECK (dismissed_at IS NULL OR dismissed_at >= delivered_at);

DROP INDEX IF EXISTS system_notification_deliveries_unread_idx;

CREATE INDEX system_notification_deliveries_unread_idx
  ON system_notification_deliveries (recipient_account_id, delivered_at)
  WHERE read_at IS NULL AND dismissed_at IS NULL;
