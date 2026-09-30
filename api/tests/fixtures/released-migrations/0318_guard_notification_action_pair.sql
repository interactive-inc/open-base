DROP TRIGGER IF EXISTS system_notification_messages_action_pair_guard;

CREATE TRIGGER system_notification_messages_action_pair_guard
BEFORE INSERT ON system_notification_messages
WHEN (NEW.action_type IS NULL) != (NEW.action_id IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'notification action reference is incomplete');
END;
