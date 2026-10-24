-- 原記録と移行時の公開履歴を照合し、一件でも未保全なら削除前に停止する。
CREATE TABLE IF NOT EXISTS company_legacy_retirement_guard (allowed INTEGER NOT NULL CHECK (allowed = 1));

WITH definitions AS (
  SELECT 'grade' AS resource_type, id, code, name, rank, description, created_at
  FROM company_grade_definitions
  UNION ALL
  SELECT 'position', id, code, name, rank, description, created_at
  FROM company_position_definitions
), unmatched_definitions AS (
  SELECT definition.resource_type FROM definitions definition
  WHERE NOT EXISTS (
    SELECT 1 FROM company_definition_resource_adoptions adoption
    WHERE adoption.organization_id = 'organization:default'
      AND adoption.resource_type = definition.resource_type
      AND adoption.definition_id = definition.id
      AND json_extract(adoption.source_json, '$.definition.type') IS definition.resource_type
      AND json_extract(adoption.source_json, '$.definition.id') IS definition.id
      AND json_extract(adoption.source_json, '$.definition.code') IS definition.code
      AND json_extract(adoption.source_json, '$.definition.name') IS definition.name
      AND json_extract(adoption.source_json, '$.definition.rank') IS definition.rank
      AND json_extract(adoption.source_json, '$.definition.description') IS definition.description
      AND json_extract(adoption.source_json, '$.definition.createdAt') IS definition.created_at
      AND json_type(adoption.source_json, '$.definition.description') IS NOT NULL
      AND json_type(adoption.source_json, '$.definition.createdAt') IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM company_resource_revisions revision
        JOIN company_command_receipts receipt
          ON receipt.organization_id = revision.organization_id
          AND receipt.command_id = revision.command_id
        WHERE revision.organization_id = adoption.organization_id
          AND revision.resource_type = adoption.resource_type
          AND revision.resource_id = adoption.resource_id
          AND revision.revision = 1 AND revision.state = 'active'
          AND revision.command_id = adoption.command_id
          AND revision.organization_revision = adoption.organization_revision
          AND revision.actor_account_id = adoption.actor_account_id
          AND revision.reason = adoption.reason
          AND revision.recorded_at = adoption.recorded_at
          AND revision.effective_from = adoption.observed_on
          AND revision.effective_to IS NULL
          AND receipt.expected_revision = adoption.expected_revision
          AND receipt.organization_revision = adoption.organization_revision
          AND receipt.recorded_at = adoption.recorded_at
          AND json_extract(revision.attributes_json, '$.code') IS definition.code
          AND json_extract(revision.attributes_json, '$.officialName') IS definition.name
          AND json_extract(revision.attributes_json, '$.rank') IS definition.rank
          AND json_extract(revision.attributes_json, '$.description') IS definition.description
          AND json_type(revision.attributes_json, '$.description') IS NOT NULL
      )
  )
), unmatched_awards AS (
  SELECT award.id FROM company_employee_grades award
  WHERE NOT EXISTS (
    SELECT 1 FROM company_grade_award_archives archive, json_each(archive.source_json, '$.awards') saved
    WHERE archive.organization_id = 'organization:default'
      AND archive.employee_id = award.employee_id
      AND json_extract(archive.source_json, '$.employeeId') IS award.employee_id
      AND json_extract(archive.source_json, '$.organizationRevision') IS archive.observed_company_revision
      AND CAST(json_extract(saved.value, '$.id') AS TEXT) IS CAST(award.id AS TEXT)
      AND json_extract(saved.value, '$.employeeId') IS award.employee_id
      AND CAST(json_extract(saved.value, '$.gradeId') AS TEXT) IS CAST(award.grade_id AS TEXT)
      AND json_extract(saved.value, '$.effectiveDate') IS award.effective_date
      AND json_extract(saved.value, '$.reason') IS award.reason
      AND json_extract(saved.value, '$.createdAt') IS award.created_at
      AND json_type(saved.value, '$.reason') IS NOT NULL
      AND json_type(saved.value, '$.createdAt') IS NOT NULL
  )
)
INSERT INTO company_legacy_retirement_guard (allowed)
SELECT CASE WHEN EXISTS (SELECT 1 FROM unmatched_definitions)
  OR EXISTS (SELECT 1 FROM unmatched_awards)
  THEN 0 ELSE 1 END;

DROP TABLE company_employee_grades;
DROP TABLE company_grade_definitions;
DROP TABLE company_position_definitions;
DROP TABLE company_legacy_retirement_guard;
