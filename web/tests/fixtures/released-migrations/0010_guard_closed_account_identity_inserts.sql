-- 閉鎖済み Account へ新しい認証 Identity を追加できないようにする。

DROP TRIGGER IF EXISTS system_identity_bindings_closed_account_guard;

CREATE TRIGGER system_identity_bindings_closed_account_guard
BEFORE INSERT ON system_identity_bindings
WHEN EXISTS (
  SELECT 1 FROM system_accounts
  WHERE id = NEW.account_id AND closed_at IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'closed account cannot receive an identity');
END;
