-- 既存索引から期間の検査への置換は、一つの移行の同じ処理内で完了させる。
-- 事前検査・索引削除・ガード作成を別々の移行へ分けない。
-- 役職の任用と合議体の構成員は、同じ役職・同じ合議体の同じ職員について任期の重なりで重複を判定する。
-- 期間を見ない一意索引は、終了日を付けた前任の行が残るだけで後任や再任を拒むので、履歴の期間を比べる検査へ置き換える。
-- 既存の履歴に重なりがあれば索引を外す前に止め、行は書き換えない。
-- 期間は時点の参照と同じ版から組み立てる。同じ発効日では最も新しい版だけを使い、訂正のための取消の版と
-- 訂正された版を外す。開始日を直す訂正は訂正元と別の発効日を持つので、外さないと訂正前の期間が残る。
CREATE VIEW company_office_tenure_overlaps AS
WITH effective_versions AS (
  SELECT resource.* FROM company_resource_revisions resource
  WHERE resource.resource_type IN ('office-assignment', 'collective-body-membership')
    AND NOT (resource.state = 'void' AND resource.corrects_revision IS NOT NULL)
    AND NOT EXISTS (
      SELECT 1 FROM company_resource_revisions newer
      WHERE newer.organization_id = resource.organization_id AND newer.resource_type = resource.resource_type
        AND newer.resource_id = resource.resource_id AND newer.effective_from = resource.effective_from
        AND newer.revision > resource.revision
    )
    AND NOT EXISTS (
      SELECT 1 FROM company_resource_revisions correction
      WHERE correction.organization_id = resource.organization_id AND correction.resource_type = resource.resource_type
        AND correction.resource_id = resource.resource_id AND correction.corrects_revision = resource.revision
    )
), next_versions AS (
  SELECT *, lead(effective_from) OVER (
    PARTITION BY organization_id, resource_type, resource_id ORDER BY effective_from
  ) AS next_from
  FROM effective_versions
), intervals AS (
  SELECT organization_id, resource_type, resource_id, effective_from AS starts_on,
    CASE WHEN next_from IS NULL OR (effective_to IS NOT NULL AND effective_to < next_from)
      THEN effective_to ELSE next_from END AS ends_on,
    CASE WHEN resource_type = 'office-assignment'
      THEN json_array(json_extract(attributes_json, '$.organizationalOfficeId'))
      ELSE json_array(json_extract(attributes_json, '$.collectiveBodyId'), json_extract(attributes_json, '$.employeeId')) END AS tenure_key,
    json_extract(attributes_json, '$.employeeId') AS employee_id
  FROM next_versions WHERE state = 'active'
)
SELECT DISTINCT first.organization_id, first.resource_type,
  first.employee_id AS first_employee_id, second.employee_id AS second_employee_id
FROM intervals first JOIN intervals second
  ON first.organization_id = second.organization_id AND first.resource_type = second.resource_type
  AND first.resource_id < second.resource_id AND first.tenure_key = second.tenure_key
  AND (first.ends_on IS NULL OR second.starts_on < first.ends_on)
  AND (second.ends_on IS NULL OR first.starts_on < second.ends_on);
--> statement-breakpoint
SELECT json_extract('{}', 'company_office_tenure_overlap') FROM company_office_tenure_overlaps LIMIT 1;
--> statement-breakpoint
DROP INDEX company_active_office_holder_uniq;
--> statement-breakpoint
DROP INDEX company_active_collective_body_member_uniq;
--> statement-breakpoint
DROP TRIGGER IF EXISTS company_office_tenure_revision_guard;
--> statement-breakpoint
CREATE TRIGGER company_office_tenure_revision_guard
BEFORE UPDATE OF revision ON company_organizations
WHEN NOT EXISTS (
  SELECT 1 FROM company_workforce_resource_bindings binding
  JOIN company_employee_lifecycle_revisions lifecycle ON lifecycle.employee_id = binding.employee_id
  WHERE binding.organization_id = NEW.id AND binding.resource_type = 'employee' AND binding.lifecycle_revision != lifecycle.revision
)
BEGIN
  SELECT RAISE(ABORT, 'organization office tenure periods overlap')
  WHERE EXISTS (SELECT 1 FROM company_office_tenure_overlaps WHERE organization_id = NEW.id);
END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS company_office_tenure_operation_guard;
--> statement-breakpoint
CREATE TRIGGER company_office_tenure_operation_guard
BEFORE UPDATE OF status ON company_organization_change_operations
WHEN NEW.status = 'COMPLETED'
BEGIN
  SELECT RAISE(ABORT, 'organization office tenure periods overlap')
  WHERE EXISTS (SELECT 1 FROM company_office_tenure_overlaps);
END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS company_office_tenure_lifecycle_guard;
--> statement-breakpoint
CREATE TRIGGER company_office_tenure_lifecycle_guard
AFTER UPDATE OF lifecycle_revision ON company_workforce_resource_bindings
WHEN NEW.resource_type = 'employee' AND NEW.lifecycle_revision != OLD.lifecycle_revision
BEGIN
  SELECT RAISE(ABORT, 'organization office tenure periods overlap')
  WHERE EXISTS (SELECT 1 FROM company_office_tenure_overlaps
    WHERE organization_id = NEW.organization_id
      AND (first_employee_id = NEW.employee_id OR second_employee_id = NEW.employee_id));
END;
