-- 閉鎖済み Account を再開できず、閉鎖時に既存 Session を一括失効できるようにする。

DROP TRIGGER IF EXISTS system_accounts_monotonic_security_state;

CREATE TRIGGER system_accounts_monotonic_security_state
BEFORE UPDATE ON system_accounts
WHEN
  NEW.id IS NOT OLD.id
  OR NEW.created_at IS NOT OLD.created_at
  OR NEW.token_version < OLD.token_version
  OR NEW.updated_at < OLD.updated_at
  OR (
    NEW.status IS NOT OLD.status
    AND NEW.token_version IS NOT OLD.token_version + 1
  )
  OR (
    OLD.closed_at IS NULL
    AND NEW.closed_at IS NOT NULL
    AND (
      NEW.status IS NOT 'suspended'
      OR NEW.token_version IS NOT OLD.token_version + 1
      OR NEW.updated_at IS NOT NEW.closed_at
      OR NEW.closed_at < OLD.updated_at
    )
  )
  OR (
    OLD.closed_at IS NOT NULL
    AND (
      NEW.status IS NOT OLD.status
      OR NEW.token_version IS NOT OLD.token_version
      OR NEW.updated_at IS NOT OLD.updated_at
      OR NEW.closed_at IS NOT OLD.closed_at
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'account security state is not monotonic');
END;
