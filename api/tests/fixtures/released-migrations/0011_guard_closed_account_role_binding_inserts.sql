-- 閉鎖済み Account へ権限を再付与できないようにする。

DROP TRIGGER IF EXISTS system_role_bindings_closed_account_guard;

CREATE TRIGGER system_role_bindings_closed_account_guard
BEFORE INSERT ON system_role_bindings
WHEN EXISTS (
  SELECT 1 FROM system_accounts
  WHERE id = NEW.account_id AND closed_at IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'closed account cannot receive a role binding');
END;
