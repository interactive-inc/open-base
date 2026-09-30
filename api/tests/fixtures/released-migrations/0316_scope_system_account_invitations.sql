-- Existing invitations have no verified business-resource relation.
ALTER TABLE system_account_invitations ADD COLUMN resource_type TEXT;
ALTER TABLE system_account_invitations ADD COLUMN resource_id TEXT
  CHECK ((resource_type IS NULL AND resource_id IS NULL) OR (
    resource_type IS NOT NULL AND resource_id IS NOT NULL
    AND length(resource_type) BETWEEN 3 AND 100
    AND length(resource_id) BETWEEN 1 AND 255
  ));
ALTER TABLE system_account_invitations ADD COLUMN related_resource_id TEXT
  CHECK (related_resource_id IS NULL OR (
    resource_type IS NOT NULL AND resource_id IS NOT NULL
    AND length(related_resource_id) BETWEEN 1 AND 255
  ));

CREATE INDEX system_account_invitations_resource_idx
  ON system_account_invitations (resource_type, resource_id);
