-- Session familyの絶対寿命の起点として、familyを始めた認証の時刻を保存する。
-- refreshで作る後継は同じ値を引き継ぎ、設定した寿命を過ぎたfamilyはrefreshを拒否する。

ALTER TABLE system_sessions ADD COLUMN authenticated_at INTEGER
  CHECK (authenticated_at IS NULL OR authenticated_at <= created_at);

-- 既存の行は、同じfamilyで最も早く作られた行の時刻を起点にする。
UPDATE system_sessions
SET authenticated_at = (
  SELECT min(family.created_at) FROM system_sessions AS family
  WHERE family.family_id = system_sessions.family_id
)
WHERE authenticated_at IS NULL;

-- 起点も一度決めたら変えられないようにする。
DROP TRIGGER IF EXISTS system_sessions_monotonic_lifecycle;

CREATE TRIGGER system_sessions_monotonic_lifecycle
BEFORE UPDATE ON system_sessions
WHEN
  NEW.id IS NOT OLD.id
  OR NEW.account_id IS NOT OLD.account_id
  OR NEW.family_id IS NOT OLD.family_id
  OR NEW.token_hash IS NOT OLD.token_hash
  OR NEW.token_version IS NOT OLD.token_version
  OR NEW.created_at IS NOT OLD.created_at
  OR NEW.expires_at IS NOT OLD.expires_at
  OR (OLD.authenticated_at IS NOT NULL AND NEW.authenticated_at IS NOT OLD.authenticated_at)
  OR (OLD.rotated_at IS NOT NULL AND NEW.rotated_at IS NOT OLD.rotated_at)
  OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NOT OLD.revoked_at)
BEGIN
  SELECT RAISE(ABORT, 'session lifecycle is not monotonic');
END;
