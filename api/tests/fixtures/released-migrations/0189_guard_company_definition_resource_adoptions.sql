DROP TRIGGER IF EXISTS company_definition_adoptions_update_guard;
CREATE TRIGGER company_definition_adoptions_update_guard
BEFORE UPDATE ON company_definition_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'company_definition_adoption_immutable');
END;
DROP TRIGGER IF EXISTS company_definition_adoptions_delete_guard;
CREATE TRIGGER company_definition_adoptions_delete_guard
BEFORE DELETE ON company_definition_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'company_definition_adoption_immutable');
END;
DROP TRIGGER IF EXISTS company_definition_adoptions_insert_guard;
CREATE TRIGGER company_definition_adoptions_insert_guard
BEFORE INSERT ON company_definition_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'company_definition_adoption_resource_invalid')
  WHERE NOT EXISTS (
    SELECT 1 FROM company_resource_revisions resource
    JOIN company_command_receipts receipt
      ON receipt.organization_id = resource.organization_id AND receipt.command_id = resource.command_id
    WHERE resource.organization_id = NEW.organization_id AND resource.resource_type = NEW.resource_type
      AND resource.resource_id = NEW.resource_id AND resource.revision = 1
      AND resource.command_id = NEW.command_id AND resource.organization_revision = NEW.organization_revision
      AND resource.effective_from = NEW.observed_on AND resource.effective_to IS NULL AND resource.state = 'active'
      AND resource.actor_account_id = NEW.actor_account_id AND resource.recorded_at = NEW.recorded_at
      AND resource.reason = NEW.reason AND receipt.expected_revision = NEW.expected_revision
      AND json_extract(resource.attributes_json, '$.code') = json_extract(NEW.source_json, '$.definition.code')
      AND json_extract(resource.attributes_json, '$.officialName') = json_extract(NEW.source_json, '$.definition.name')
      AND json_extract(resource.attributes_json, '$.rank') = json_extract(NEW.source_json, '$.definition.rank')
      AND json_extract(resource.attributes_json, '$.description') IS json_extract(NEW.source_json, '$.definition.description')
  );
END;
