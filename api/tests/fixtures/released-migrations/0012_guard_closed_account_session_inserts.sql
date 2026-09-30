-- 閉鎖済み Account へ新しい Session を発行できないようにする。

DROP TRIGGER IF EXISTS system_sessions_closed_account_guard;

CREATE TRIGGER system_sessions_closed_account_guard
BEFORE INSERT ON system_sessions
WHEN EXISTS (
  SELECT 1 FROM system_accounts
  WHERE id = NEW.account_id AND closed_at IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'closed account cannot receive a session');
END;
