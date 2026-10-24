DROP TRIGGER IF EXISTS system_attestation_requires_human;
CREATE TRIGGER system_attestation_requires_human
BEFORE INSERT ON system_human_attestations
WHEN NOT EXISTS (
  SELECT 1 FROM system_accounts account
  JOIN system_principals principal ON principal.account_id = account.id
  WHERE account.id = NEW.actor_account_id AND account.status = 'active' AND account.closed_at IS NULL
    AND account.created_at <= NEW.decided_at AND principal.kind = 'human' AND principal.created_at <= NEW.decided_at
) OR NOT EXISTS (
  SELECT 1 FROM system_accounts account
  JOIN system_principals principal ON principal.account_id = account.id
  WHERE account.id = NEW.represented_account_id AND account.status = 'active' AND account.closed_at IS NULL
    AND account.created_at <= NEW.decided_at AND principal.kind = 'human' AND principal.created_at <= NEW.decided_at
)
BEGIN
  SELECT RAISE(ABORT, 'system_attestation_requires_human');
END;
