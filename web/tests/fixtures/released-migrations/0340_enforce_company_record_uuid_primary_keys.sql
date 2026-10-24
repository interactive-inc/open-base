-- Company の記録と受領の table を UUID の主キーへ揃える (Issue )。
--
-- 対象: 命令の受領、資源・組織・割当・責任・社員・定義の取込、初期化とプロフィール変更の受領、等級の保管、
-- 責任の出典の取込と切替、外部 ID の取込、Account の表示名、労務の接続の完了、組織・割当・責任・雇用・
-- 在籍状態の期間の版、資源の先頭と版、人事の注記、ライフサイクルの outbox。
--
-- 形を変える table:
-- - 命令 ID・複合の主キー・期間の版・資源の先頭と版は、新しい UUID の id を主キーにし、旧来の主キーは
--   一意な属性として残す。外部キーは一意な属性をそのまま指し、命令 ID は冪等性の鍵として値を変えない
-- - 人事の注記とライフサイクルの outbox は整数の主キーを UUID に置き換え、旧来の値を legacy_id に残す
--
-- 組織・組織単位・社員・雇用・人事の発令など、ほかの記録が値から組み立て直す識別子の値はここでは変えない。
--
-- 退避と削除は参照元から、作り直しは参照先から行う。外部キーは D1 の migration の transaction の終わりに検査する。
--
-- ALTER TABLE RENAME は trigger を含む全 schema を解析し直し、table ごとに数十 ms かかる。
-- 名前を変えずに行を退避し、同じ名前で作り直してから戻す。

PRAGMA defer_foreign_keys = true;

CREATE TABLE _company_record_uuid_primary_key_validation (
  resource TEXT PRIMARY KEY NOT NULL,
  source_count INTEGER NOT NULL,
  target_count INTEGER NOT NULL,
  orphan_count INTEGER NOT NULL,
  non_uuid_count INTEGER NOT NULL,
  blocked_count INTEGER NOT NULL,
  CHECK (source_count = target_count AND orphan_count = 0 AND non_uuid_count = 0 AND blocked_count = 0)
);

-- company_personnel_annotations
CREATE TABLE _company_personnel_annotations_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _company_personnel_annotations_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM company_personnel_annotations;

-- company_lifecycle_outbox_entries
CREATE TABLE _company_lifecycle_outbox_entries_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _company_lifecycle_outbox_entries_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM company_lifecycle_outbox_entries;

-- 参照元から順に行を退避して table を削除する。
CREATE TABLE "_stage_company_lifecycle_outbox_entries" AS SELECT * FROM company_lifecycle_outbox_entries;
DROP TABLE company_lifecycle_outbox_entries;
CREATE TABLE "_stage_company_personnel_annotations" AS SELECT * FROM company_personnel_annotations;
DROP TABLE company_personnel_annotations;
CREATE TABLE "_stage_company_workforce_connection_completions" AS SELECT * FROM company_workforce_connection_completions;
DROP TABLE company_workforce_connection_completions;
CREATE TABLE "_stage_company_account_profiles" AS SELECT * FROM company_account_profiles;
DROP TABLE company_account_profiles;
CREATE TABLE "_stage_company_external_identity_imports" AS SELECT * FROM company_external_identity_imports;
DROP TABLE company_external_identity_imports;
CREATE TABLE "_stage_company_grade_award_archives" AS SELECT * FROM company_grade_award_archives;
DROP TABLE company_grade_award_archives;
CREATE TABLE "_stage_company_bootstrap_receipts" AS SELECT * FROM company_bootstrap_receipts;
DROP TABLE company_bootstrap_receipts;
CREATE TABLE "_stage_company_responsibility_source_cutovers" AS SELECT * FROM company_responsibility_source_cutovers;
DROP TABLE company_responsibility_source_cutovers;
CREATE TABLE "_stage_company_responsibility_source_adoptions" AS SELECT * FROM company_responsibility_source_adoptions;
DROP TABLE company_responsibility_source_adoptions;
CREATE TABLE "_stage_company_employee_resource_adoptions" AS SELECT * FROM company_employee_resource_adoptions;
DROP TABLE company_employee_resource_adoptions;
CREATE TABLE "_stage_company_responsibility_resource_adoptions" AS SELECT * FROM company_responsibility_resource_adoptions;
DROP TABLE company_responsibility_resource_adoptions;
CREATE TABLE "_stage_company_assignment_resource_adoptions" AS SELECT * FROM company_assignment_resource_adoptions;
DROP TABLE company_assignment_resource_adoptions;
CREATE TABLE "_stage_company_organization_resource_adoptions" AS SELECT * FROM company_organization_resource_adoptions;
DROP TABLE company_organization_resource_adoptions;
CREATE TABLE "_stage_company_profile_change_receipts" AS SELECT * FROM company_profile_change_receipts;
DROP TABLE company_profile_change_receipts;
CREATE TABLE "_stage_company_definition_resource_adoptions" AS SELECT * FROM company_definition_resource_adoptions;
DROP TABLE company_definition_resource_adoptions;
CREATE TABLE "_stage_company_command_receipts" AS SELECT * FROM company_command_receipts;
DROP TABLE company_command_receipts;
CREATE TABLE "_stage_company_employee_status_period_versions" AS SELECT * FROM company_employee_status_period_versions;
DROP TABLE company_employee_status_period_versions;
CREATE TABLE "_stage_company_employment_period_versions" AS SELECT * FROM company_employment_period_versions;
DROP TABLE company_employment_period_versions;
CREATE TABLE "_stage_company_organization_responsibility_period_versions" AS SELECT * FROM company_organization_responsibility_period_versions;
DROP TABLE company_organization_responsibility_period_versions;
CREATE TABLE "_stage_company_organization_assignment_period_versions" AS SELECT * FROM company_organization_assignment_period_versions;
DROP TABLE company_organization_assignment_period_versions;
CREATE TABLE "_stage_company_organization_unit_period_versions" AS SELECT * FROM company_organization_unit_period_versions;
DROP TABLE company_organization_unit_period_versions;
CREATE TABLE "_stage_company_resource_revisions" AS SELECT * FROM company_resource_revisions;
DROP TABLE company_resource_revisions;
CREATE TABLE "_stage_company_resource_heads" AS SELECT * FROM company_resource_heads;
DROP TABLE company_resource_heads;

-- company_resource_heads
CREATE TABLE company_resource_heads (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  organization_revision INTEGER NOT NULL CHECK (organization_revision >= 1),
  state TEXT NOT NULL CHECK (state IN ('active', 'void')),
  effective_from TEXT NOT NULL,
  effective_to TEXT CHECK (effective_to IS NULL OR effective_to > effective_from),
  attributes_json TEXT NOT NULL CHECK (json_valid(attributes_json)),
  updated_at INTEGER NOT NULL CHECK (updated_at >= 0),
  UNIQUE (organization_id, resource_type, resource_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO company_resource_heads (id, organization_id, resource_type, resource_id, revision, organization_revision, state, effective_from, effective_to, attributes_json, updated_at)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.organization_id,
       source.resource_type,
       source.resource_id,
       source.revision,
       source.organization_revision,
       source.state,
       source.effective_from,
       source.effective_to,
       source.attributes_json,
       source.updated_at
FROM "_stage_company_resource_heads" source;
INSERT INTO _company_record_uuid_primary_key_validation
SELECT 'company_resource_heads',
       (SELECT count(*) FROM "_stage_company_resource_heads"),
       (SELECT count(*) FROM company_resource_heads),
       0,
       (SELECT count(*) FROM company_resource_heads WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'company' AND revision = 1);
DROP TABLE "_stage_company_resource_heads";
CREATE UNIQUE INDEX company_resource_heads_org_revision_idx
  ON company_resource_heads (organization_id, organization_revision, resource_type, resource_id);
CREATE INDEX company_resource_heads_type_effective_idx
  ON company_resource_heads (organization_id, resource_type, effective_from, effective_to);
CREATE UNIQUE INDEX company_active_site_code_uniq
  ON company_resource_heads (organization_id, json_extract(attributes_json, '$.code'))
  WHERE resource_type = 'site' AND state = 'active';
CREATE UNIQUE INDEX company_active_workplace_code_uniq
  ON company_resource_heads (
    organization_id,
    json_extract(attributes_json, '$.siteId'),
    json_extract(attributes_json, '$.code')
  )
  WHERE resource_type = 'workplace' AND state = 'active';
CREATE UNIQUE INDEX company_active_job_code_uniq
  ON company_resource_heads (organization_id, json_extract(attributes_json, '$.code'))
  WHERE resource_type = 'job' AND state = 'active';
CREATE UNIQUE INDEX company_single_active_profile_uniq
  ON company_resource_heads (organization_id)
  WHERE resource_type = 'company-profile' AND state = 'active';
CREATE UNIQUE INDEX company_active_legal_entity_registration_uniq
  ON company_resource_heads (
    organization_id,
    json_extract(attributes_json, '$.jurisdictionCountryCode'),
    json_extract(attributes_json, '$.registrationNumber')
  )
  WHERE resource_type = 'legal-entity'
    AND state = 'active'
    AND json_extract(attributes_json, '$.registrationNumber') IS NOT NULL;
CREATE UNIQUE INDEX company_active_organizational_office_code_uniq
  ON company_resource_heads (organization_id, json_extract(attributes_json, '$.code'))
  WHERE resource_type = 'organizational-office' AND state = 'active';
CREATE UNIQUE INDEX company_active_collective_body_code_uniq
  ON company_resource_heads (organization_id, json_extract(attributes_json, '$.code'))
  WHERE resource_type = 'collective-body' AND state = 'active';
CREATE UNIQUE INDEX company_active_office_holder_uniq
  ON company_resource_heads (
    organization_id,
    json_extract(attributes_json, '$.organizationalOfficeId')
  )
  WHERE resource_type = 'office-assignment' AND state = 'active';
CREATE UNIQUE INDEX company_active_collective_body_member_uniq
  ON company_resource_heads (
    organization_id,
    json_extract(attributes_json, '$.collectiveBodyId'),
    json_extract(attributes_json, '$.employeeId')
  )
  WHERE resource_type = 'collective-body-membership' AND state = 'active';
CREATE UNIQUE INDEX company_profile_organization_identity ON company_resource_heads (organization_id) WHERE resource_type = 'company-profile';
CREATE INDEX company_account_link_head_account_idx ON company_resource_heads
  (CAST(json_extract(attributes_json, '$.accountId') AS TEXT)) WHERE resource_type = 'account-employee-link';
CREATE INDEX company_account_link_head_employee_idx ON company_resource_heads
  (CAST(json_extract(attributes_json, '$.employeeId') AS TEXT)) WHERE resource_type = 'account-employee-link';
CREATE TRIGGER company_personnel_reporting_owner_guard
BEFORE UPDATE ON company_resource_heads
WHEN OLD.resource_type = 'reporting-relation'
  AND EXISTS (SELECT 1 FROM company_personnel_reporting_bindings binding
    WHERE binding.resource_id = OLD.resource_id AND binding.organization_id = OLD.organization_id)
BEGIN
  SELECT RAISE(ABORT, 'company personnel reporting owner is immutable')
  WHERE NEW.organization_id IS NOT OLD.organization_id OR NEW.resource_type IS NOT OLD.resource_type
    OR NEW.resource_id IS NOT OLD.resource_id
    OR json_extract(NEW.attributes_json, '$.employeeId') IS NOT json_extract(OLD.attributes_json, '$.employeeId')
    OR json_extract(NEW.attributes_json, '$.organizationUnitId') IS NOT json_extract(OLD.attributes_json, '$.organizationUnitId');
END;
CREATE TRIGGER company_resource_heads_identity_update
BEFORE UPDATE OF id ON company_resource_heads
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_resource_revisions
CREATE TABLE company_resource_revisions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  organization_revision INTEGER NOT NULL CHECK (organization_revision >= 1),
  state TEXT NOT NULL CHECK (state IN ('active', 'void')),
  effective_from TEXT NOT NULL,
  effective_to TEXT CHECK (effective_to IS NULL OR effective_to > effective_from),
  attributes_json TEXT NOT NULL CHECK (json_valid(attributes_json)),
  command_id TEXT NOT NULL,
  actor_account_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 2000),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0), evidence_references_json TEXT NOT NULL DEFAULT '[]'
  CHECK (json_valid(evidence_references_json) AND json_type(evidence_references_json) = 'array'), corrects_revision INTEGER
  CHECK (corrects_revision IS NULL OR (corrects_revision >= 1 AND corrects_revision < revision)),
  UNIQUE (organization_id, resource_type, resource_id, revision),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO company_resource_revisions (id, organization_id, resource_type, resource_id, revision, organization_revision, state, effective_from, effective_to, attributes_json, command_id, actor_account_id, reason, recorded_at, evidence_references_json, corrects_revision)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.organization_id,
       source.resource_type,
       source.resource_id,
       source.revision,
       source.organization_revision,
       source.state,
       source.effective_from,
       source.effective_to,
       source.attributes_json,
       source.command_id,
       source.actor_account_id,
       source.reason,
       source.recorded_at,
       source.evidence_references_json,
       source.corrects_revision
FROM "_stage_company_resource_revisions" source;
INSERT INTO _company_record_uuid_primary_key_validation
SELECT 'company_resource_revisions',
       (SELECT count(*) FROM "_stage_company_resource_revisions"),
       (SELECT count(*) FROM company_resource_revisions),
       0,
       (SELECT count(*) FROM company_resource_revisions WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'company' AND revision = 1);
DROP TABLE "_stage_company_resource_revisions";
CREATE INDEX company_resource_revisions_command_idx
  ON company_resource_revisions (organization_id, command_id);
CREATE INDEX company_resource_revisions_org_revision_idx
  ON company_resource_revisions (organization_id, organization_revision, resource_type, resource_id);
CREATE INDEX `company_resource_revisions_account_link_idx`
  ON `company_resource_revisions` (`organization_id`, `resource_id`)
  WHERE `resource_type` = 'account-employee-link';
CREATE TRIGGER company_resource_revisions_expected_revision
BEFORE INSERT ON company_resource_revisions
WHEN NEW.revision <> COALESCE(
  (
    SELECT revision
    FROM company_resource_heads
    WHERE organization_id = NEW.organization_id
      AND resource_type = NEW.resource_type
      AND resource_id = NEW.resource_id
  ),
  0
) + 1
BEGIN
  SELECT RAISE(ABORT, 'company_resource_revision_conflict');
END;
CREATE TRIGGER company_resource_revisions_no_delete
BEFORE DELETE ON company_resource_revisions
BEGIN
  SELECT RAISE(ABORT, 'company_resource_revisions_are_append_only');
END;
CREATE TRIGGER company_resource_revisions_no_update
BEFORE UPDATE ON company_resource_revisions
BEGIN
  SELECT RAISE(ABORT, 'company_resource_revisions_are_append_only');
END;
CREATE TRIGGER company_workforce_resource_reference_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.state = 'active' AND (
  (NEW.resource_type = 'employee' AND NOT EXISTS (
    SELECT 1 FROM company_resource_heads AS person
    WHERE person.organization_id = NEW.organization_id
      AND person.resource_type = 'person'
      AND person.resource_id = json_extract(NEW.attributes_json, '$.personId')
      AND person.state = 'active'
  ))
  OR (NEW.resource_type IN (
    'employment', 'assignment', 'reporting-relation', 'office-assignment',
    'organizational-authority', 'account-employee-link'
  ) AND NOT EXISTS (
    SELECT 1 FROM company_resource_heads AS employee
    WHERE employee.organization_id = NEW.organization_id
      AND employee.resource_type = 'employee'
      AND employee.resource_id = json_extract(NEW.attributes_json, '$.employeeId')
      AND employee.state = 'active'
  ))
  OR (NEW.resource_type = 'reporting-relation' AND NOT EXISTS (
    SELECT 1 FROM company_resource_heads AS manager
    WHERE manager.organization_id = NEW.organization_id
      AND manager.resource_type = 'employee'
      AND manager.resource_id = json_extract(NEW.attributes_json, '$.managerEmployeeId')
      AND manager.state = 'active'
  ))
  OR (NEW.resource_type IN (
    'assignment', 'office-assignment', 'organizational-authority'
  ) AND NOT EXISTS (
    SELECT 1 FROM company_resource_heads AS employment
    WHERE employment.organization_id = NEW.organization_id
      AND employment.resource_type = 'employment'
      AND employment.resource_id = json_extract(NEW.attributes_json, '$.employmentId')
      AND json_extract(employment.attributes_json, '$.employeeId') =
          json_extract(NEW.attributes_json, '$.employeeId')
      AND employment.state = 'active'
  ))
)
BEGIN
  SELECT RAISE(ABORT, 'company_workforce_reference_not_found');
END;
CREATE TRIGGER company_workforce_resource_owner_guard
BEFORE INSERT ON company_resource_revisions
WHEN EXISTS (
  SELECT 1 FROM company_resource_heads AS previous
  WHERE previous.organization_id = NEW.organization_id
    AND previous.resource_type = NEW.resource_type
    AND previous.resource_id = NEW.resource_id
    AND (
      (NEW.resource_type = 'employee' AND
       json_extract(previous.attributes_json, '$.personId') IS NOT
       json_extract(NEW.attributes_json, '$.personId'))
      OR (NEW.resource_type = 'employment' AND
          json_extract(previous.attributes_json, '$.employeeId') IS NOT
          json_extract(NEW.attributes_json, '$.employeeId'))
    )
)
BEGIN
  SELECT RAISE(ABORT, 'company_workforce_owner_immutable');
END;
CREATE TRIGGER company_workforce_resource_void_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.state = 'void'
  AND NEW.resource_type IN ('person', 'employee', 'employment')
  AND EXISTS (
    SELECT 1 FROM company_resource_heads AS dependent
    WHERE dependent.organization_id = NEW.organization_id
      AND dependent.state = 'active'
      AND (
        (NEW.resource_type = 'person' AND dependent.resource_type = 'employee'
         AND json_extract(dependent.attributes_json, '$.personId') = NEW.resource_id)
        OR (NEW.resource_type = 'employee' AND (
          (dependent.resource_type IN (
            'employment', 'assignment', 'reporting-relation', 'office-assignment',
            'collective-body-membership', 'organizational-authority', 'account-employee-link'
          ) AND json_extract(dependent.attributes_json, '$.employeeId') = NEW.resource_id)
          OR (dependent.resource_type = 'reporting-relation'
              AND json_extract(dependent.attributes_json, '$.managerEmployeeId') = NEW.resource_id)
          OR (dependent.resource_type = 'responsibility-assignment'
              AND json_extract(dependent.attributes_json, '$.holderType') = 'employee'
              AND json_extract(dependent.attributes_json, '$.holderId') = NEW.resource_id)
        ))
        OR (NEW.resource_type = 'employment' AND dependent.resource_type IN (
          'assignment', 'office-assignment', 'organizational-authority'
        ) AND json_extract(dependent.attributes_json, '$.employmentId') = NEW.resource_id)
      )
  )
BEGIN
  SELECT RAISE(ABORT, 'company_workforce_resource_is_in_use');
END;
CREATE TRIGGER company_account_employee_resource_owner_guard
BEFORE INSERT ON company_resource_revisions WHEN NEW.resource_type = 'account-employee-link'
BEGIN
  SELECT RAISE(ABORT, 'company account link owner is immutable') WHERE
    NEW.organization_id != 'organization:default'
    OR EXISTS (SELECT 1 FROM company_resource_heads previous
      WHERE previous.organization_id = NEW.organization_id AND previous.resource_type = NEW.resource_type
        AND (previous.resource_id = NEW.resource_id AND (
          json_extract(previous.attributes_json, '$.accountId') IS NOT json_extract(NEW.attributes_json, '$.accountId')
          OR json_extract(previous.attributes_json, '$.employeeId') IS NOT json_extract(NEW.attributes_json, '$.employeeId'))
        OR previous.resource_id != NEW.resource_id AND (
          json_extract(previous.attributes_json, '$.accountId') = json_extract(NEW.attributes_json, '$.accountId')
          OR json_extract(previous.attributes_json, '$.employeeId') = json_extract(NEW.attributes_json, '$.employeeId'))))
    OR EXISTS (SELECT 1 FROM company_account_employee_links original WHERE
      original.account_id = json_extract(NEW.attributes_json, '$.accountId') AND original.employee_id IS NOT json_extract(NEW.attributes_json, '$.employeeId')
      OR original.employee_id = json_extract(NEW.attributes_json, '$.employeeId') AND original.account_id IS NOT json_extract(NEW.attributes_json, '$.accountId'));
  SELECT RAISE(ABORT, 'company account link account is missing') WHERE NOT EXISTS (
    SELECT 1 FROM system_accounts WHERE id = json_extract(NEW.attributes_json, '$.accountId')
  );
END;
CREATE TRIGGER company_position_job_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'position'
  AND NEW.state = 'active'
  AND json_extract(NEW.attributes_json, '$.jobId') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM company_resource_revisions AS job
    WHERE job.organization_id = NEW.organization_id
      AND job.resource_type = 'job'
      AND job.resource_id = json_extract(NEW.attributes_json, '$.jobId')
      AND job.state = 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'company_position_job_not_found');
END;
CREATE TRIGGER company_office_assignment_reference_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'office-assignment'
  AND NEW.state = 'active'
  AND (
    NOT EXISTS (
      SELECT 1 FROM company_resource_revisions AS employee
      WHERE employee.organization_id = NEW.organization_id
        AND employee.resource_type = 'employee'
        AND employee.resource_id = json_extract(NEW.attributes_json, '$.employeeId')
        AND employee.state = 'active'
    )
    OR NOT EXISTS (
      SELECT 1 FROM company_resource_revisions AS employment
      WHERE employment.organization_id = NEW.organization_id
        AND employment.resource_type = 'employment'
        AND employment.resource_id = json_extract(NEW.attributes_json, '$.employmentId')
        AND employment.state = 'active'
    )
    OR NOT EXISTS (
      SELECT 1 FROM company_resource_revisions AS office
      WHERE office.organization_id = NEW.organization_id
        AND office.resource_type = 'organizational-office'
        AND office.resource_id = json_extract(NEW.attributes_json, '$.organizationalOfficeId')
        AND office.state = 'active'
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'company_office_assignment_reference_not_found');
END;
CREATE TRIGGER company_responsibility_assignment_reference_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'responsibility-assignment'
  AND NEW.state = 'active'
  AND (
    NOT EXISTS (
      SELECT 1 FROM company_resource_revisions AS responsibility
      WHERE responsibility.organization_id = NEW.organization_id
        AND responsibility.resource_type = 'responsibility'
        AND responsibility.resource_id = json_extract(NEW.attributes_json, '$.responsibilityId')
        AND responsibility.state = 'active'
    )
    OR (
      json_extract(NEW.attributes_json, '$.authorityScopeId') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM company_resource_revisions AS scope
        WHERE scope.organization_id = NEW.organization_id
          AND scope.resource_type = 'authority-scope'
          AND scope.resource_id = json_extract(NEW.attributes_json, '$.authorityScopeId')
          AND scope.state = 'active'
      )
    )
    OR NOT EXISTS (
      SELECT 1 FROM company_resource_revisions AS holder
      WHERE holder.organization_id = NEW.organization_id
        AND holder.resource_type = json_extract(NEW.attributes_json, '$.holderType')
        AND holder.resource_id = json_extract(NEW.attributes_json, '$.holderId')
        AND holder.state = 'active'
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'company_responsibility_assignment_reference_not_found');
END;
CREATE TRIGGER company_collective_body_membership_reference_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'collective-body-membership'
  AND NEW.state = 'active'
  AND (
    NOT EXISTS (
      SELECT 1 FROM company_resource_revisions AS body
      WHERE body.organization_id = NEW.organization_id
        AND body.resource_type = 'collective-body'
        AND body.resource_id = json_extract(NEW.attributes_json, '$.collectiveBodyId')
        AND body.state = 'active'
    )
    OR NOT EXISTS (
      SELECT 1 FROM company_resource_revisions AS employee
      WHERE employee.organization_id = NEW.organization_id
        AND employee.resource_type = 'employee'
        AND employee.resource_id = json_extract(NEW.attributes_json, '$.employeeId')
        AND employee.state = 'active'
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'company_collective_body_membership_reference_not_found');
END;
CREATE TRIGGER company_organizational_authority_scope_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'organizational-authority'
  AND NEW.state = 'active'
  AND json_extract(NEW.attributes_json, '$.scopeType') = 'authority-scope'
  AND NOT EXISTS (
    SELECT 1 FROM company_resource_revisions AS scope
    WHERE scope.organization_id = NEW.organization_id
      AND scope.resource_type = 'authority-scope'
      AND scope.resource_id = json_extract(NEW.attributes_json, '$.scopeId')
      AND scope.state = 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'company_organizational_authority_scope_not_found');
END;
CREATE TRIGGER company_organizational_office_reference_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'organizational-office'
  AND NEW.state = 'active'
  AND (
    NOT EXISTS (
      SELECT 1
      FROM company_resource_revisions AS unit
      WHERE unit.organization_id = NEW.organization_id
        AND unit.resource_type = 'organization-unit'
        AND json_extract(unit.attributes_json, '$.organizationUnitId') = json_extract(NEW.attributes_json, '$.organizationUnitId')
        AND unit.state = 'active'
    )
    OR NOT EXISTS (
      SELECT 1
      FROM company_resource_revisions AS position
      WHERE position.organization_id = NEW.organization_id
        AND position.resource_type = 'position'
        AND position.resource_id = json_extract(NEW.attributes_json, '$.positionId')
        AND position.state = 'active'
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'company_governance_organization_reference_invalid');
END;
CREATE TRIGGER company_authority_scope_reference_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'authority-scope'
  AND NEW.state = 'active'
  AND json_extract(NEW.attributes_json, '$.scopeType') IN (
    'organization-unit', 'legal-entity', 'site', 'workplace'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM company_resource_revisions AS scoped
    WHERE scoped.organization_id = NEW.organization_id
      AND scoped.resource_type = json_extract(NEW.attributes_json, '$.scopeType')
      AND (CASE WHEN scoped.resource_type = 'organization-unit' THEN json_extract(scoped.attributes_json, '$.organizationUnitId') ELSE scoped.resource_id END) = json_extract(NEW.attributes_json, '$.scopeId')
      AND scoped.state = 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'company_governance_organization_reference_invalid');
END;
CREATE TRIGGER company_site_legal_entity_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'site' AND NEW.state = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM company_resource_revisions legal_entity
    WHERE legal_entity.organization_id = NEW.organization_id AND legal_entity.resource_type = 'legal-entity'
      AND legal_entity.resource_id = json_extract(NEW.attributes_json, '$.legalEntityId')
      AND legal_entity.state = 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'company_site_legal_entity_not_found');
END;
CREATE TRIGGER company_workplace_site_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'workplace' AND NEW.state = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM company_resource_revisions site
    WHERE site.organization_id = NEW.organization_id AND site.resource_type = 'site'
      AND site.resource_id = json_extract(NEW.attributes_json, '$.siteId') AND site.state = 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'company_workplace_site_not_found');
END;
CREATE TRIGGER company_legacy_personnel_action_write_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'personnel-action'
BEGIN
  SELECT RAISE(ABORT, 'company_legacy_personnel_action_write_retired');
END;
CREATE TRIGGER company_grade_assignment_owner_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'grade-assignment'
BEGIN
  SELECT RAISE(ABORT, 'company_grade_assignment_owner_changed') WHERE EXISTS (
    SELECT 1 FROM company_resource_revisions original
    WHERE original.organization_id = NEW.organization_id AND original.resource_type = NEW.resource_type
      AND original.resource_id = NEW.resource_id AND original.revision = 1
      AND (json_extract(original.attributes_json, '$.employeeId') IS NOT json_extract(NEW.attributes_json, '$.employeeId')
        OR json_extract(original.attributes_json, '$.employmentId') IS NOT json_extract(NEW.attributes_json, '$.employmentId'))
  );
END;
CREATE TRIGGER company_employment_contract_term_insert_guard
AFTER INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'employment'
BEGIN
  SELECT RAISE(ABORT, 'company_employment_contract_term_invalid')
  WHERE EXISTS (
    SELECT 1 FROM company_employment_contract_term_violations
    WHERE organization_id = NEW.organization_id AND resource_id = NEW.resource_id AND revision = NEW.revision
  );
END;
CREATE TRIGGER company_resource_revisions_identity_update
BEFORE UPDATE OF id ON company_resource_revisions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_organization_unit_period_versions
CREATE TABLE company_organization_unit_period_versions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  period_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  organization_unit_id TEXT NOT NULL
    REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  code TEXT NOT NULL
    CHECK (length(code) BETWEEN 1 AND 64 AND trim(code) = code),
  official_name TEXT NOT NULL
    CHECK (length(official_name) BETWEEN 1 AND 200 AND trim(official_name) = official_name),
  kind TEXT NOT NULL
    CHECK (kind IN ('COMPANY', 'DIVISION', 'DEPARTMENT', 'TEAM', 'OTHER')),
  parent_organization_unit_id TEXT
    REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  is_void INTEGER NOT NULL DEFAULT 0 CHECK (is_void IN (0, 1)),
  recorded_by_action_id TEXT NOT NULL
    REFERENCES company_organization_change_operations(id) ON DELETE RESTRICT,
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  UNIQUE (period_id, revision),
  CHECK (
    length(starts_on) = 10 AND date(starts_on) IS starts_on
    AND (ends_on IS NULL OR (length(ends_on) = 10 AND date(ends_on) IS ends_on))
    AND (ends_on IS NULL OR starts_on < ends_on)
  ),
  CHECK (
    parent_organization_unit_id IS NULL
    OR parent_organization_unit_id != organization_unit_id
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
) WITHOUT ROWID;
INSERT INTO company_organization_unit_period_versions (id, period_id, revision, organization_unit_id, code, official_name, kind, parent_organization_unit_id, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.period_id,
       source.revision,
       source.organization_unit_id,
       source.code,
       source.official_name,
       source.kind,
       source.parent_organization_unit_id,
       source.starts_on,
       source.ends_on,
       source.is_void,
       source.recorded_by_action_id,
       source.recorded_at
FROM "_stage_company_organization_unit_period_versions" source;
INSERT INTO _company_record_uuid_primary_key_validation
SELECT 'company_organization_unit_period_versions',
       (SELECT count(*) FROM "_stage_company_organization_unit_period_versions"),
       (SELECT count(*) FROM company_organization_unit_period_versions),
       0,
       (SELECT count(*) FROM company_organization_unit_period_versions WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'company' AND revision = 1);
DROP TABLE "_stage_company_organization_unit_period_versions";
CREATE INDEX company_organization_unit_period_versions_unit_idx
  ON company_organization_unit_period_versions(
    organization_unit_id, starts_on, ends_on, period_id, revision
  );
CREATE INDEX company_organization_unit_period_versions_code_idx
  ON company_organization_unit_period_versions(code, starts_on, ends_on, period_id, revision);
CREATE INDEX company_organization_unit_period_versions_parent_idx
  ON company_organization_unit_period_versions(parent_organization_unit_id, starts_on, ends_on);
CREATE TRIGGER company_organization_unit_period_versions_revision_guard
BEFORE INSERT ON company_organization_unit_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is missing or stale')
  WHERE NOT EXISTS (
    SELECT 1
    FROM company_organization_change_operations operation
    JOIN company_organization_lifecycle_states state ON state.id = 1
    WHERE operation.id = NEW.recorded_by_action_id
      AND operation.status = 'PENDING'
      AND operation.applied_count < operation.change_count
      AND state.revision = operation.expected_revision + operation.applied_count
  );

  SELECT RAISE(ABORT, 'organization unit revision is not sequential')
  WHERE NEW.revision != coalesce(
    (
      SELECT max(revision)
      FROM company_organization_unit_period_versions
      WHERE period_id = NEW.period_id
    ),
    0
  ) + 1;

  SELECT RAISE(ABORT, 'organization unit period owner is immutable')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_unit_period_versions previous
    WHERE previous.period_id = NEW.period_id
      AND previous.organization_unit_id != NEW.organization_unit_id
  );

  SELECT RAISE(ABORT, 'organization root requires canonical parent')
  WHERE (NEW.kind = 'COMPANY' AND NEW.parent_organization_unit_id IS NOT NULL)
     OR (NEW.kind != 'COMPANY' AND NEW.parent_organization_unit_id IS NULL);

  SELECT RAISE(ABORT, 'organization unit period overlaps')
  WHERE NEW.is_void = 0 AND EXISTS (
    SELECT 1 FROM company_organization_unit_period_versions current
    WHERE current.period_id != NEW.period_id
      AND current.organization_unit_id = NEW.organization_unit_id
      AND current.is_void = 0
      AND current.revision = (
        SELECT max(latest.revision)
        FROM company_organization_unit_period_versions latest
        WHERE latest.period_id = current.period_id
      )
      AND (current.ends_on IS NULL OR NEW.starts_on < current.ends_on)
      AND (NEW.ends_on IS NULL OR current.starts_on < NEW.ends_on)
  );

  SELECT RAISE(ABORT, 'organization unit code overlaps')
  WHERE NEW.is_void = 0 AND EXISTS (
    SELECT 1 FROM company_organization_unit_period_versions current
    WHERE current.period_id != NEW.period_id
      AND current.organization_unit_id != NEW.organization_unit_id
      AND current.code = NEW.code
      AND current.is_void = 0
      AND current.revision = (
        SELECT max(latest.revision)
        FROM company_organization_unit_period_versions latest
        WHERE latest.period_id = current.period_id
      )
      AND (current.ends_on IS NULL OR NEW.starts_on < current.ends_on)
      AND (NEW.ends_on IS NULL OR current.starts_on < NEW.ends_on)
  );

  SELECT RAISE(ABORT, 'company root period overlaps')
  WHERE NEW.is_void = 0 AND NEW.kind = 'COMPANY' AND EXISTS (
    SELECT 1 FROM company_organization_unit_period_versions current
    WHERE current.period_id != NEW.period_id
      AND current.kind = 'COMPANY'
      AND current.is_void = 0
      AND current.revision = (
        SELECT max(latest.revision)
        FROM company_organization_unit_period_versions latest
        WHERE latest.period_id = current.period_id
      )
      AND (current.ends_on IS NULL OR NEW.starts_on < current.ends_on)
      AND (NEW.ends_on IS NULL OR current.starts_on < NEW.ends_on)
  );
END;
CREATE TRIGGER company_organization_unit_period_versions_immutable_delete
BEFORE DELETE ON company_organization_unit_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization unit periods are append only');
END;
CREATE TRIGGER company_organization_unit_period_versions_immutable_update
BEFORE UPDATE ON company_organization_unit_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization unit periods are append only');
END;
CREATE TRIGGER company_organization_unit_period_versions_revision_state
AFTER INSERT ON company_organization_unit_period_versions
BEGIN
  UPDATE company_organization_change_operations
  SET applied_count = applied_count + 1
  WHERE id = NEW.recorded_by_action_id;

  UPDATE company_organization_lifecycle_states
  SET revision = revision + 1, updated_at = max(updated_at, NEW.recorded_at)
  WHERE id = 1;
END;
CREATE TRIGGER company_organization_unit_period_versions_identity_update
BEFORE UPDATE OF id ON company_organization_unit_period_versions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_organization_assignment_period_versions
CREATE TABLE company_organization_assignment_period_versions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  period_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  employment_id TEXT NOT NULL CHECK (length(employment_id) BETWEEN 1 AND 200),
  employee_id TEXT NOT NULL CHECK (length(employee_id) BETWEEN 1 AND 128),
  organization_unit_id TEXT NOT NULL
    REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('PRIMARY', 'CONCURRENT')),
  position_title TEXT CHECK (
    position_title IS NULL OR (
      length(position_title) BETWEEN 1 AND 200 AND trim(position_title) = position_title
    )
  ),
  manager_employee_id TEXT CHECK (
    manager_employee_id IS NULL OR manager_employee_id != employee_id
  ),
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  is_void INTEGER NOT NULL DEFAULT 0 CHECK (is_void IN (0, 1)),
  recorded_by_action_id TEXT NOT NULL
    REFERENCES company_organization_change_operations(id) ON DELETE RESTRICT,
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  UNIQUE (period_id, revision),
  CHECK (
    length(starts_on) = 10 AND date(starts_on) IS starts_on
    AND (ends_on IS NULL OR (length(ends_on) = 10 AND date(ends_on) IS ends_on))
    AND (ends_on IS NULL OR starts_on < ends_on)
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
) WITHOUT ROWID;
INSERT INTO company_organization_assignment_period_versions (id, period_id, revision, employment_id, employee_id, organization_unit_id, assignment_type, position_title, manager_employee_id, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.period_id,
       source.revision,
       source.employment_id,
       source.employee_id,
       source.organization_unit_id,
       source.assignment_type,
       source.position_title,
       source.manager_employee_id,
       source.starts_on,
       source.ends_on,
       source.is_void,
       source.recorded_by_action_id,
       source.recorded_at
FROM "_stage_company_organization_assignment_period_versions" source;
INSERT INTO _company_record_uuid_primary_key_validation
SELECT 'company_organization_assignment_period_versions',
       (SELECT count(*) FROM "_stage_company_organization_assignment_period_versions"),
       (SELECT count(*) FROM company_organization_assignment_period_versions),
       0,
       (SELECT count(*) FROM company_organization_assignment_period_versions WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'company' AND revision = 1);
DROP TABLE "_stage_company_organization_assignment_period_versions";
CREATE INDEX company_organization_assignment_period_versions_employee_idx
  ON company_organization_assignment_period_versions(
    employee_id, starts_on, ends_on, assignment_type, period_id, revision
  );
CREATE INDEX company_organization_assignment_period_versions_unit_idx
  ON company_organization_assignment_period_versions(
    organization_unit_id, starts_on, ends_on, period_id, revision
  );
CREATE TRIGGER company_organization_assignment_period_versions_immutable_delete
BEFORE DELETE ON company_organization_assignment_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization assignments are append only');
END;
CREATE TRIGGER company_organization_assignment_period_versions_immutable_update
BEFORE UPDATE ON company_organization_assignment_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization assignments are append only');
END;
CREATE TRIGGER company_organization_assignment_period_versions_revision_state
AFTER INSERT ON company_organization_assignment_period_versions
BEGIN
  UPDATE company_organization_change_operations
  SET applied_count = applied_count + 1
  WHERE id = NEW.recorded_by_action_id;

  UPDATE company_organization_lifecycle_states
  SET revision = revision + 1, updated_at = max(updated_at, NEW.recorded_at)
  WHERE id = 1;
END;
CREATE TRIGGER company_organization_assignment_period_versions_guard
BEFORE INSERT ON company_organization_assignment_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is missing or stale')
  WHERE NOT EXISTS (
    SELECT 1
    FROM company_organization_change_operations operation
    JOIN company_organization_lifecycle_states state ON state.id = 1
    WHERE operation.id = NEW.recorded_by_action_id
      AND operation.status = 'PENDING'
      AND operation.applied_count < operation.change_count
      AND state.revision = operation.expected_revision + operation.applied_count
  );

  SELECT RAISE(ABORT, 'organization assignment revision is not sequential')
  WHERE NEW.revision != coalesce(
    (
      SELECT max(revision)
      FROM company_organization_assignment_period_versions
      WHERE period_id = NEW.period_id
    ),
    0
  ) + 1;

  SELECT RAISE(ABORT, 'organization assignment owner is immutable')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_assignment_period_versions previous
    WHERE previous.period_id = NEW.period_id
      AND (
        previous.employment_id != NEW.employment_id
        OR previous.employee_id != NEW.employee_id
        OR previous.organization_unit_id != NEW.organization_unit_id
        OR previous.assignment_type != NEW.assignment_type
      )
  );

  SELECT RAISE(ABORT, 'organization assignment employment mismatch')
  WHERE NOT EXISTS (
    SELECT 1 FROM company_employments employment
    WHERE employment.id = NEW.employment_id
      AND employment.employee_id = NEW.employee_id
      AND employment.hire_date <= NEW.starts_on
      AND (
        employment.termination_date IS NULL
        OR (
          NEW.ends_on IS NOT NULL
          AND NEW.ends_on <= date(employment.termination_date, '+1 day')
        )
      )
  );

  SELECT RAISE(ABORT, 'organization assignment unit is not active')
  WHERE NEW.is_void = 0 AND NOT EXISTS (
    SELECT 1 FROM company_organization_unit_coverage unit
    WHERE unit.organization_unit_id = NEW.organization_unit_id
      AND unit.starts_on <= NEW.starts_on
      AND (
        unit.ends_on IS NULL
        OR (NEW.ends_on IS NOT NULL AND NEW.ends_on <= unit.ends_on)
      )
  );

  SELECT RAISE(ABORT, 'organization assignment overlaps')
  WHERE NEW.is_void = 0 AND EXISTS (
    SELECT 1 FROM company_organization_assignment_period_versions current
    WHERE current.period_id != NEW.period_id
      AND current.employee_id = NEW.employee_id
      AND current.is_void = 0
      AND current.revision = (
        SELECT max(latest.revision)
        FROM company_organization_assignment_period_versions latest
        WHERE latest.period_id = current.period_id
      )
      AND (
        (current.assignment_type = 'PRIMARY' AND NEW.assignment_type = 'PRIMARY')
        OR (
          current.organization_unit_id = NEW.organization_unit_id
          AND current.assignment_type = NEW.assignment_type
        )
      )
      AND (current.ends_on IS NULL OR NEW.starts_on < current.ends_on)
      AND (NEW.ends_on IS NULL OR current.starts_on < NEW.ends_on)
  );

  SELECT RAISE(ABORT, 'organization assignment manager is not employed')
  WHERE NEW.is_void = 0
    AND NEW.manager_employee_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM company_employments manager_employment
      WHERE manager_employment.employee_id = NEW.manager_employee_id
        AND manager_employment.hire_date <= NEW.starts_on
        AND (
          manager_employment.termination_date IS NULL
          OR (
            NEW.ends_on IS NOT NULL
            AND NEW.ends_on <= date(manager_employment.termination_date, '+1 day')
          )
        )
    );
END;
CREATE TRIGGER company_organization_assignment_period_versions_identity_update
BEFORE UPDATE OF id ON company_organization_assignment_period_versions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_organization_responsibility_period_versions
CREATE TABLE company_organization_responsibility_period_versions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  period_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  employment_id TEXT NOT NULL CHECK (length(employment_id) BETWEEN 1 AND 200),
  employee_id TEXT NOT NULL CHECK (length(employee_id) BETWEEN 1 AND 128),
  organization_unit_id TEXT NOT NULL
    REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  responsibility_type TEXT NOT NULL CHECK (
    length(responsibility_type) BETWEEN 1 AND 64
    AND responsibility_type GLOB '[A-Z]*'
    AND responsibility_type NOT GLOB '*[^A-Z0-9_]*'
  ),
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  is_void INTEGER NOT NULL DEFAULT 0 CHECK (is_void IN (0, 1)),
  recorded_by_action_id TEXT NOT NULL
    REFERENCES company_organization_change_operations(id) ON DELETE RESTRICT,
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  UNIQUE (period_id, revision),
  CHECK (
    length(starts_on) = 10 AND date(starts_on) IS starts_on
    AND (ends_on IS NULL OR (length(ends_on) = 10 AND date(ends_on) IS ends_on))
    AND (ends_on IS NULL OR starts_on < ends_on)
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
) WITHOUT ROWID;
INSERT INTO company_organization_responsibility_period_versions (id, period_id, revision, employment_id, employee_id, organization_unit_id, responsibility_type, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.period_id,
       source.revision,
       source.employment_id,
       source.employee_id,
       source.organization_unit_id,
       source.responsibility_type,
       source.starts_on,
       source.ends_on,
       source.is_void,
       source.recorded_by_action_id,
       source.recorded_at
FROM "_stage_company_organization_responsibility_period_versions" source;
INSERT INTO _company_record_uuid_primary_key_validation
SELECT 'company_organization_responsibility_period_versions',
       (SELECT count(*) FROM "_stage_company_organization_responsibility_period_versions"),
       (SELECT count(*) FROM company_organization_responsibility_period_versions),
       0,
       (SELECT count(*) FROM company_organization_responsibility_period_versions WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'company' AND revision = 1);
DROP TABLE "_stage_company_organization_responsibility_period_versions";
CREATE INDEX company_organization_responsibility_period_versions_employee_idx
  ON company_organization_responsibility_period_versions(
    employee_id, starts_on, ends_on, period_id, revision
  );
CREATE INDEX company_organization_responsibility_period_versions_unit_idx
  ON company_organization_responsibility_period_versions(
    organization_unit_id, responsibility_type, starts_on, ends_on, period_id, revision
  );
CREATE TRIGGER company_organization_responsibility_period_versions_immutable_delete
BEFORE DELETE ON company_organization_responsibility_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization responsibilities are append only');
END;
CREATE TRIGGER company_organization_responsibility_period_versions_immutable_update
BEFORE UPDATE ON company_organization_responsibility_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization responsibilities are append only');
END;
CREATE TRIGGER company_organization_responsibility_period_versions_revision_state
AFTER INSERT ON company_organization_responsibility_period_versions
BEGIN
  UPDATE company_organization_change_operations
  SET applied_count = applied_count + 1
  WHERE id = NEW.recorded_by_action_id;

  UPDATE company_organization_lifecycle_states
  SET revision = revision + 1, updated_at = max(updated_at, NEW.recorded_at)
  WHERE id = 1;
END;
CREATE TRIGGER company_organization_responsibility_period_versions_guard
BEFORE INSERT ON company_organization_responsibility_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is missing or stale')
  WHERE NOT EXISTS (
    SELECT 1
    FROM company_organization_change_operations operation
    JOIN company_organization_lifecycle_states state ON state.id = 1
    WHERE operation.id = NEW.recorded_by_action_id
      AND operation.status = 'PENDING'
      AND operation.applied_count < operation.change_count
      AND state.revision = operation.expected_revision + operation.applied_count
  );

  SELECT RAISE(ABORT, 'organization responsibility revision is not sequential')
  WHERE NEW.revision != coalesce(
    (
      SELECT max(revision)
      FROM company_organization_responsibility_period_versions
      WHERE period_id = NEW.period_id
    ),
    0
  ) + 1;

  SELECT RAISE(ABORT, 'organization responsibility owner is immutable')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_responsibility_period_versions previous
    WHERE previous.period_id = NEW.period_id
      AND (
        previous.employment_id != NEW.employment_id
        OR previous.employee_id != NEW.employee_id
        OR previous.organization_unit_id != NEW.organization_unit_id
        OR previous.responsibility_type != NEW.responsibility_type
      )
  );

  SELECT RAISE(ABORT, 'organization responsibility employment mismatch')
  WHERE NOT EXISTS (
    SELECT 1 FROM company_employments employment
    WHERE employment.id = NEW.employment_id
      AND employment.employee_id = NEW.employee_id
      AND employment.hire_date <= NEW.starts_on
      AND (
        employment.termination_date IS NULL
        OR (
          NEW.ends_on IS NOT NULL
          AND NEW.ends_on <= date(employment.termination_date, '+1 day')
        )
      )
  );

  SELECT RAISE(ABORT, 'organization responsibility unit is not active')
  WHERE NEW.is_void = 0 AND NOT EXISTS (
    SELECT 1 FROM company_organization_unit_coverage unit
    WHERE unit.organization_unit_id = NEW.organization_unit_id
      AND unit.starts_on <= NEW.starts_on
      AND (
        unit.ends_on IS NULL
        OR (NEW.ends_on IS NOT NULL AND NEW.ends_on <= unit.ends_on)
      )
  );

  SELECT RAISE(ABORT, 'organization responsibility requires matching assignment')
  WHERE NEW.is_void = 0 AND NOT EXISTS (
    SELECT 1 FROM company_organization_assignment_coverage assignment
    WHERE assignment.employment_id = NEW.employment_id
      AND assignment.employee_id = NEW.employee_id
      AND assignment.organization_unit_id = NEW.organization_unit_id
      AND assignment.starts_on <= NEW.starts_on
      AND (
        assignment.ends_on IS NULL
        OR (NEW.ends_on IS NOT NULL AND NEW.ends_on <= assignment.ends_on)
      )
  );

  SELECT RAISE(ABORT, 'organization responsibility overlaps')
  WHERE NEW.is_void = 0 AND EXISTS (
    SELECT 1 FROM company_organization_responsibility_period_versions current
    WHERE current.period_id != NEW.period_id
      AND current.employee_id = NEW.employee_id
      AND current.organization_unit_id = NEW.organization_unit_id
      AND current.responsibility_type = NEW.responsibility_type
      AND current.is_void = 0
      AND current.revision = (
        SELECT max(latest.revision)
        FROM company_organization_responsibility_period_versions latest
        WHERE latest.period_id = current.period_id
      )
      AND (current.ends_on IS NULL OR NEW.starts_on < current.ends_on)
      AND (NEW.ends_on IS NULL OR current.starts_on < NEW.ends_on)
  );
END;
CREATE TRIGGER company_organization_responsibility_period_versions_identity_update
BEFORE UPDATE OF id ON company_organization_responsibility_period_versions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_employment_period_versions
CREATE TABLE company_employment_period_versions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  period_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  employee_id TEXT NOT NULL,
  starts_on TEXT NOT NULL CHECK (
    length(starts_on) = 10 AND substr(starts_on, 5, 1) = '-' AND substr(starts_on, 8, 1) = '-'
  ),
  ends_on TEXT CHECK (
    ends_on IS NULL OR (
      length(ends_on) = 10 AND substr(ends_on, 5, 1) = '-' AND substr(ends_on, 8, 1) = '-'
    )
  ),
  is_void INTEGER NOT NULL DEFAULT 0 CHECK (is_void IN (0, 1)),
  recorded_by_action_id TEXT NOT NULL,
  recorded_at INTEGER NOT NULL,
  UNIQUE (period_id, revision),
  CHECK (ends_on IS NULL OR starts_on < ends_on),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
) WITHOUT ROWID;
INSERT INTO company_employment_period_versions (id, period_id, revision, employee_id, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.period_id,
       source.revision,
       source.employee_id,
       source.starts_on,
       source.ends_on,
       source.is_void,
       source.recorded_by_action_id,
       source.recorded_at
FROM "_stage_company_employment_period_versions" source;
INSERT INTO _company_record_uuid_primary_key_validation
SELECT 'company_employment_period_versions',
       (SELECT count(*) FROM "_stage_company_employment_period_versions"),
       (SELECT count(*) FROM company_employment_period_versions),
       0,
       (SELECT count(*) FROM company_employment_period_versions WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'company' AND revision = 1);
DROP TABLE "_stage_company_employment_period_versions";
CREATE INDEX idx_company_employment_period_versions_employee
  ON company_employment_period_versions(
    employee_id, starts_on, ends_on, period_id, revision DESC
  );
CREATE TRIGGER company_employment_period_versions_no_delete
BEFORE DELETE ON company_employment_period_versions
BEGIN
  SELECT RAISE(ABORT, 'company employment period versions are append only');
END;
CREATE TRIGGER company_employment_period_versions_no_update
BEFORE UPDATE ON company_employment_period_versions
BEGIN
  SELECT RAISE(ABORT, 'company employment period versions are append only');
END;
CREATE TRIGGER company_employment_period_versions_identity_update
BEFORE UPDATE OF id ON company_employment_period_versions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_employee_status_period_versions
CREATE TABLE company_employee_status_period_versions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  period_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  employment_period_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'leave')),
  starts_on TEXT NOT NULL CHECK (
    length(starts_on) = 10 AND substr(starts_on, 5, 1) = '-' AND substr(starts_on, 8, 1) = '-'
  ),
  ends_on TEXT CHECK (
    ends_on IS NULL OR (
      length(ends_on) = 10 AND substr(ends_on, 5, 1) = '-' AND substr(ends_on, 8, 1) = '-'
    )
  ),
  is_void INTEGER NOT NULL DEFAULT 0 CHECK (is_void IN (0, 1)),
  recorded_by_action_id TEXT NOT NULL,
  recorded_at INTEGER NOT NULL,
  UNIQUE (period_id, revision),
  CHECK (ends_on IS NULL OR starts_on < ends_on),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
) WITHOUT ROWID;
INSERT INTO company_employee_status_period_versions (id, period_id, revision, employment_period_id, employee_id, status, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.period_id,
       source.revision,
       source.employment_period_id,
       source.employee_id,
       source.status,
       source.starts_on,
       source.ends_on,
       source.is_void,
       source.recorded_by_action_id,
       source.recorded_at
FROM "_stage_company_employee_status_period_versions" source;
INSERT INTO _company_record_uuid_primary_key_validation
SELECT 'company_employee_status_period_versions',
       (SELECT count(*) FROM "_stage_company_employee_status_period_versions"),
       (SELECT count(*) FROM company_employee_status_period_versions),
       0,
       (SELECT count(*) FROM company_employee_status_period_versions WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'company' AND revision = 1);
DROP TABLE "_stage_company_employee_status_period_versions";
CREATE INDEX idx_company_employee_status_period_versions_employee
  ON company_employee_status_period_versions(
    employee_id, starts_on, ends_on, period_id, revision DESC
  );
CREATE INDEX idx_company_employee_status_period_versions_employment
  ON company_employee_status_period_versions(employment_period_id, period_id, revision DESC);
CREATE TRIGGER company_employee_status_period_versions_no_delete
BEFORE DELETE ON company_employee_status_period_versions
BEGIN
  SELECT RAISE(ABORT, 'company employee status period versions are append only');
END;
CREATE TRIGGER company_employee_status_period_versions_no_update
BEFORE UPDATE ON company_employee_status_period_versions
BEGIN
  SELECT RAISE(ABORT, 'company employee status period versions are append only');
END;
CREATE TRIGGER company_employee_status_period_versions_identity_update
BEFORE UPDATE OF id ON company_employee_status_period_versions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_command_receipts
CREATE TABLE company_command_receipts (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  command_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  organization_revision INTEGER NOT NULL CHECK (organization_revision = expected_revision + 1),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  UNIQUE (organization_id, command_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO company_command_receipts (id, organization_id, command_id, fingerprint, expected_revision, organization_revision, recorded_at)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.organization_id,
       source.command_id,
       source.fingerprint,
       source.expected_revision,
       source.organization_revision,
       source.recorded_at
FROM "_stage_company_command_receipts" source;
INSERT INTO _company_record_uuid_primary_key_validation
SELECT 'company_command_receipts',
       (SELECT count(*) FROM "_stage_company_command_receipts"),
       (SELECT count(*) FROM company_command_receipts),
       0,
       (SELECT count(*) FROM company_command_receipts WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'company' AND revision = 1);
DROP TABLE "_stage_company_command_receipts";
CREATE TRIGGER company_command_receipts_expected_revision
BEFORE INSERT ON company_command_receipts
WHEN COALESCE(
  (SELECT revision FROM company_organizations WHERE id = NEW.organization_id),
  -1
) <> NEW.expected_revision
BEGIN
  SELECT RAISE(ABORT, 'company_revision_conflict');
END;
CREATE TRIGGER company_command_receipts_no_delete
BEFORE DELETE ON company_command_receipts
BEGIN
  SELECT RAISE(ABORT, 'company_command_receipts_are_immutable');
END;
CREATE TRIGGER company_command_receipts_no_update
BEFORE UPDATE ON company_command_receipts
BEGIN
  SELECT RAISE(ABORT, 'company_command_receipts_are_immutable');
END;
CREATE TRIGGER company_command_receipts_identity_update
BEFORE UPDATE OF id ON company_command_receipts
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_definition_resource_adoptions
CREATE TABLE company_definition_resource_adoptions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  organization_id TEXT NOT NULL DEFAULT 'organization:default' CHECK (organization_id = 'organization:default'),
  command_id TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('grade', 'position')),
  definition_id INTEGER NOT NULL CHECK (definition_id > 0),
  resource_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 1000),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  organization_revision INTEGER NOT NULL CHECK (organization_revision = expected_revision + 1),
  observed_on TEXT NOT NULL CHECK (length(observed_on) = 10),
  snapshot_digest TEXT NOT NULL CHECK (length(snapshot_digest) = 64),
  source_json TEXT NOT NULL CHECK (json_valid(source_json) AND length(CAST(source_json AS BLOB)) <= 20000
    AND json_extract(source_json, '$.definition.type') IS resource_type
    AND json_extract(source_json, '$.definition.id') IS definition_id
    AND json_extract(source_json, '$.organizationRevision') IS expected_revision),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  UNIQUE (organization_id, command_id),
  UNIQUE (resource_type, definition_id),
  UNIQUE (organization_id, resource_type, resource_id),
  FOREIGN KEY (organization_id, resource_type, resource_id)
    REFERENCES company_resource_heads(organization_id, resource_type, resource_id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, command_id)
    REFERENCES company_command_receipts(organization_id, command_id) ON DELETE RESTRICT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO company_definition_resource_adoptions (id, organization_id, command_id, resource_type, definition_id, resource_id, fingerprint, actor_account_id, reason, expected_revision, organization_revision, observed_on, snapshot_digest, source_json, recorded_at)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.organization_id,
       source.command_id,
       source.resource_type,
       source.definition_id,
       source.resource_id,
       source.fingerprint,
       source.actor_account_id,
       source.reason,
       source.expected_revision,
       source.organization_revision,
       source.observed_on,
       source.snapshot_digest,
       source.source_json,
       source.recorded_at
FROM "_stage_company_definition_resource_adoptions" source;
INSERT INTO _company_record_uuid_primary_key_validation
SELECT 'company_definition_resource_adoptions',
       (SELECT count(*) FROM "_stage_company_definition_resource_adoptions"),
       (SELECT count(*) FROM company_definition_resource_adoptions),
       0,
       (SELECT count(*) FROM company_definition_resource_adoptions WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'company' AND revision = 1);
DROP TABLE "_stage_company_definition_resource_adoptions";
CREATE TRIGGER company_definition_adoptions_update_guard
BEFORE UPDATE ON company_definition_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'company_definition_adoption_immutable');
END;
CREATE TRIGGER company_definition_adoptions_delete_guard
BEFORE DELETE ON company_definition_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'company_definition_adoption_immutable');
END;
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
CREATE TRIGGER company_definition_resource_adoptions_identity_update
BEFORE UPDATE OF id ON company_definition_resource_adoptions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_profile_change_receipts
CREATE TABLE company_profile_change_receipts (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  organization_id TEXT NOT NULL REFERENCES company_organizations(id),
  command_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64 AND fingerprint NOT GLOB '*[^0-9a-f]*'),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id),
  organization_revision INTEGER NOT NULL CHECK (organization_revision > 0),
  declaration_json TEXT NOT NULL CHECK (json_valid(declaration_json)),
  source_json TEXT NOT NULL CHECK (json_valid(source_json)),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  UNIQUE (organization_id, command_id),
  FOREIGN KEY (organization_id, command_id) REFERENCES company_command_receipts(organization_id, command_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO company_profile_change_receipts (id, organization_id, command_id, fingerprint, actor_account_id, organization_revision, declaration_json, source_json, recorded_at)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.organization_id,
       source.command_id,
       source.fingerprint,
       source.actor_account_id,
       source.organization_revision,
       source.declaration_json,
       source.source_json,
       source.recorded_at
FROM "_stage_company_profile_change_receipts" source;
INSERT INTO _company_record_uuid_primary_key_validation
SELECT 'company_profile_change_receipts',
       (SELECT count(*) FROM "_stage_company_profile_change_receipts"),
       (SELECT count(*) FROM company_profile_change_receipts),
       0,
       (SELECT count(*) FROM company_profile_change_receipts WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'company' AND revision = 1);
DROP TABLE "_stage_company_profile_change_receipts";
CREATE TRIGGER company_profile_change_receipts_immutable_update
BEFORE UPDATE ON company_profile_change_receipts
BEGIN
  SELECT RAISE(ABORT, 'company profile change receipt is immutable');
END;
CREATE TRIGGER company_profile_change_receipts_immutable_delete
BEFORE DELETE ON company_profile_change_receipts
BEGIN
  SELECT RAISE(ABORT, 'company profile change receipt is immutable');
END;
CREATE TRIGGER company_profile_change_receipts_identity_update
BEFORE UPDATE OF id ON company_profile_change_receipts
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_organization_resource_adoptions
CREATE TABLE company_organization_resource_adoptions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  command_id TEXT NOT NULL UNIQUE CHECK (length(command_id) BETWEEN 1 AND 200),
  organization_unit_id TEXT NOT NULL UNIQUE REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64 AND fingerprint NOT GLOB '*[^0-9a-f]*'),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 1000),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  organization_revision INTEGER NOT NULL CHECK (organization_revision > expected_revision AND organization_revision <= expected_revision + 100),
  observed_on TEXT NOT NULL CHECK (length(observed_on) = 10),
  snapshot_digest TEXT NOT NULL CHECK (length(snapshot_digest) = 64 AND snapshot_digest NOT GLOB '*[^0-9a-f]*'),
  source_json TEXT NOT NULL CHECK (json_valid(source_json) AND length(CAST(source_json AS BLOB)) <= 750000),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO company_organization_resource_adoptions (id, command_id, organization_unit_id, fingerprint, actor_account_id, reason, expected_revision, organization_revision, observed_on, snapshot_digest, source_json, recorded_at)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.command_id,
       source.organization_unit_id,
       source.fingerprint,
       source.actor_account_id,
       source.reason,
       source.expected_revision,
       source.organization_revision,
       source.observed_on,
       source.snapshot_digest,
       source.source_json,
       source.recorded_at
FROM "_stage_company_organization_resource_adoptions" source;
INSERT INTO _company_record_uuid_primary_key_validation
SELECT 'company_organization_resource_adoptions',
       (SELECT count(*) FROM "_stage_company_organization_resource_adoptions"),
       (SELECT count(*) FROM company_organization_resource_adoptions),
       0,
       (SELECT count(*) FROM company_organization_resource_adoptions WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'company' AND revision = 1);
DROP TABLE "_stage_company_organization_resource_adoptions";
CREATE TRIGGER company_organization_resource_adoptions_no_update
BEFORE UPDATE ON company_organization_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'organization resource connection is immutable');
END;
CREATE TRIGGER company_organization_resource_adoptions_no_delete
BEFORE DELETE ON company_organization_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'organization resource connection is immutable');
END;
CREATE TRIGGER company_organization_resource_adoptions_identity_update
BEFORE UPDATE OF id ON company_organization_resource_adoptions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_assignment_resource_adoptions
CREATE TABLE company_assignment_resource_adoptions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  command_id TEXT NOT NULL UNIQUE CHECK (length(command_id) BETWEEN 1 AND 200),
  employee_id TEXT NOT NULL REFERENCES company_employees(id) ON DELETE RESTRICT,
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64),
  actor_account_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 1000),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  organization_revision INTEGER NOT NULL CHECK (organization_revision > expected_revision),
  observed_on TEXT NOT NULL,
  adopted_periods INTEGER NOT NULL CHECK (adopted_periods BETWEEN 1 AND 1000),
  snapshot_digest TEXT NOT NULL CHECK (length(snapshot_digest) = 64),
  source_json TEXT NOT NULL CHECK (json_valid(source_json)),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0), mappings_json TEXT CHECK (mappings_json IS NULL OR (json_valid(mappings_json) AND json_type(mappings_json) = 'array')),
  UNIQUE (employee_id, snapshot_digest),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO company_assignment_resource_adoptions (id, command_id, employee_id, fingerprint, actor_account_id, reason, expected_revision, organization_revision, observed_on, adopted_periods, snapshot_digest, source_json, recorded_at, mappings_json)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.command_id,
       source.employee_id,
       source.fingerprint,
       source.actor_account_id,
       source.reason,
       source.expected_revision,
       source.organization_revision,
       source.observed_on,
       source.adopted_periods,
       source.snapshot_digest,
       source.source_json,
       source.recorded_at,
       source.mappings_json
FROM "_stage_company_assignment_resource_adoptions" source;
INSERT INTO _company_record_uuid_primary_key_validation
SELECT 'company_assignment_resource_adoptions',
       (SELECT count(*) FROM "_stage_company_assignment_resource_adoptions"),
       (SELECT count(*) FROM company_assignment_resource_adoptions),
       0,
       (SELECT count(*) FROM company_assignment_resource_adoptions WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'company' AND revision = 1);
DROP TABLE "_stage_company_assignment_resource_adoptions";
CREATE TRIGGER company_assignment_resource_adoptions_update_guard
BEFORE UPDATE ON company_assignment_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'assignment adoption evidence is immutable');
END;
CREATE TRIGGER company_assignment_resource_adoptions_delete_guard
BEFORE DELETE ON company_assignment_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'assignment adoption evidence is immutable');
END;
CREATE TRIGGER company_assignment_adoption_insert_guard
BEFORE INSERT ON company_assignment_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'assignment adoption evidence is incomplete')
  WHERE json_type(NEW.mappings_json) IS NOT 'array'
    OR (SELECT count(*) FROM json_each(NEW.mappings_json)) !=
      (SELECT count(DISTINCT json_extract(mapping.value, '$.periodId')) FROM json_each(NEW.mappings_json) mapping)
    OR EXISTS (
      SELECT 1 FROM json_each(NEW.mappings_json) mapping
      WHERE json_type(mapping.value, '$.periodId') IS NOT 'text'
        OR json_type(mapping.value, '$.existingResourceId') IS NOT 'text'
        OR NOT EXISTS (
          SELECT 1 FROM company_organization_assignment_period_versions period
          WHERE period.period_id = json_extract(mapping.value, '$.periodId')
            AND period.recorded_by_action_id = 'assignment-adoption:' || NEW.snapshot_digest
        )
    )
    OR NEW.organization_revision != (SELECT revision FROM company_organizations WHERE id = 'organization:default')
    OR NOT EXISTS (
      SELECT 1 FROM company_organization_change_operations operation
      WHERE operation.id = 'assignment-adoption:' || NEW.snapshot_digest
        AND operation.status = 'PENDING'
        AND operation.change_count = NEW.adopted_periods
        AND operation.applied_count = NEW.adopted_periods
        AND operation.actor_account_id = NEW.actor_account_id AND operation.reason = NEW.reason
    )
    OR NEW.adopted_periods != (SELECT count(*) FROM company_organization_assignment_period_versions period
      WHERE period.recorded_by_action_id = 'assignment-adoption:' || NEW.snapshot_digest)
    OR EXISTS (
      SELECT 1 FROM company_organization_assignment_period_versions period
      WHERE period.recorded_by_action_id = 'assignment-adoption:' || NEW.snapshot_digest
        AND (period.employee_id != NEW.employee_id OR NOT EXISTS (
          SELECT 1 FROM company_assignment_period_bindings binding
          JOIN company_assignment_resource_bindings source ON source.resource_id = binding.resource_id
          JOIN company_resource_revisions applied ON applied.organization_id = source.organization_id
            AND applied.resource_type = 'assignment' AND applied.resource_id = source.resource_id
            AND applied.revision = source.resource_revision
          WHERE binding.period_id = period.period_id AND binding.period_revision = period.revision
            AND binding.source_revision = source.resource_revision AND source.employee_id = NEW.employee_id
            AND applied.organization_revision > NEW.expected_revision
            AND applied.organization_revision <= NEW.organization_revision
            AND applied.actor_account_id = NEW.actor_account_id AND applied.reason = NEW.reason
            AND (
              (source.resource_revision = 1 AND NOT EXISTS (
                SELECT 1 FROM json_each(NEW.mappings_json) mapping
                WHERE json_extract(mapping.value, '$.periodId') = period.period_id
              ))
              OR (source.resource_revision > 1 AND EXISTS (
                SELECT 1 FROM json_each(NEW.mappings_json) mapping
                WHERE json_extract(mapping.value, '$.periodId') = period.period_id
                  AND json_extract(mapping.value, '$.existingResourceId') = source.resource_id
                  AND source.resource_revision = 1 + (
                    SELECT max(json_extract(confirmed.value, '$.revision'))
                    FROM json_each(NEW.source_json, '$.publicAssignments') confirmed
                    WHERE json_extract(confirmed.value, '$.resourceId') = source.resource_id
                      AND json_type(confirmed.value, '$.bindingEmployeeId') = 'null'
                  )
              ))
            )
        ))
    );
END;
CREATE TRIGGER company_assignment_resource_adoptions_identity_update
BEFORE UPDATE OF id ON company_assignment_resource_adoptions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_responsibility_resource_adoptions
CREATE TABLE company_responsibility_resource_adoptions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  command_id TEXT NOT NULL UNIQUE CHECK (length(command_id) BETWEEN 1 AND 200),
  operation_id TEXT NOT NULL UNIQUE REFERENCES company_organization_change_operations(id) ON DELETE RESTRICT,
  employee_id TEXT NOT NULL REFERENCES company_employees(id) ON DELETE RESTRICT,
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 1000),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  organization_revision INTEGER NOT NULL CHECK (organization_revision > expected_revision AND organization_revision <= expected_revision + 10),
  observed_on TEXT NOT NULL CHECK (length(observed_on) = 10),
  adopted_periods INTEGER NOT NULL CHECK (adopted_periods BETWEEN 1 AND 1000),
  snapshot_digest TEXT NOT NULL CHECK (length(snapshot_digest) = 64),
  source_json TEXT NOT NULL CHECK (json_valid(source_json) AND length(CAST(source_json AS BLOB)) <= 750000),
  mappings_json TEXT NOT NULL CHECK (json_valid(mappings_json) AND json_type(mappings_json) = 'array' AND json_array_length(mappings_json) = adopted_periods AND length(CAST(mappings_json AS BLOB)) <= 750000),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  UNIQUE (employee_id, snapshot_digest),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO company_responsibility_resource_adoptions (id, command_id, operation_id, employee_id, fingerprint, actor_account_id, reason, expected_revision, organization_revision, observed_on, adopted_periods, snapshot_digest, source_json, mappings_json, recorded_at)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.command_id,
       source.operation_id,
       source.employee_id,
       source.fingerprint,
       source.actor_account_id,
       source.reason,
       source.expected_revision,
       source.organization_revision,
       source.observed_on,
       source.adopted_periods,
       source.snapshot_digest,
       source.source_json,
       source.mappings_json,
       source.recorded_at
FROM "_stage_company_responsibility_resource_adoptions" source;
INSERT INTO _company_record_uuid_primary_key_validation
SELECT 'company_responsibility_resource_adoptions',
       (SELECT count(*) FROM "_stage_company_responsibility_resource_adoptions"),
       (SELECT count(*) FROM company_responsibility_resource_adoptions),
       0,
       (SELECT count(*) FROM company_responsibility_resource_adoptions WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'company' AND revision = 1);
DROP TABLE "_stage_company_responsibility_resource_adoptions";
CREATE TRIGGER company_responsibility_adoption_update_guard
BEFORE UPDATE ON company_responsibility_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'responsibility adoption evidence is immutable');
END;
CREATE TRIGGER company_responsibility_adoption_delete_guard
BEFORE DELETE ON company_responsibility_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'responsibility adoption evidence is immutable');
END;
CREATE TRIGGER company_responsibility_adoption_insert_guard
BEFORE INSERT ON company_responsibility_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'responsibility adoption evidence is incomplete') WHERE NOT EXISTS (
    SELECT 1 FROM company_organization_change_operations operation
    WHERE operation.id = NEW.operation_id AND operation.status = 'PENDING'
      AND operation.change_count = NEW.adopted_periods AND operation.applied_count = NEW.adopted_periods
      AND operation.actor_account_id = NEW.actor_account_id AND operation.reason = NEW.reason
  ) OR NEW.organization_revision != (SELECT revision FROM company_organizations WHERE id = 'organization:default')
  OR NEW.adopted_periods != (SELECT count(*) FROM company_organization_responsibility_period_versions period WHERE period.recorded_by_action_id = NEW.operation_id)
  OR EXISTS (
    SELECT 1 FROM company_organization_responsibility_period_versions period
    WHERE period.recorded_by_action_id = NEW.operation_id AND (
      period.employee_id != NEW.employee_id OR NOT EXISTS (
        SELECT 1 FROM company_responsibility_period_bindings binding
        JOIN company_responsibility_resource_bindings source ON source.resource_id = binding.resource_id
        JOIN json_each(NEW.mappings_json) mapping ON json_extract(mapping.value, '$.periodId') = period.period_id
        WHERE binding.period_id = period.period_id AND binding.period_revision = period.revision AND binding.source_revision = source.resource_revision
          AND source.resource_revision >= 1 AND source.employee_id = NEW.employee_id
          AND source.responsibility_id = json_extract(mapping.value, '$.responsibilityId')
          AND source.authority_scope_id = json_extract(mapping.value, '$.authorityScopeId')
          AND EXISTS (SELECT 1 FROM company_resource_revisions applied
            WHERE applied.organization_id = source.organization_id
              AND applied.resource_type = 'responsibility-assignment'
              AND applied.resource_id = source.resource_id AND applied.revision = source.resource_revision
              AND applied.organization_revision > NEW.expected_revision
              AND applied.organization_revision <= NEW.organization_revision
              AND applied.actor_account_id = NEW.actor_account_id AND applied.reason = NEW.reason)
          AND (
            (json_type(mapping.value, '$.existingResourceId') IS NULL AND source.resource_revision = 1)
            OR (json_extract(mapping.value, '$.existingResourceId') = source.resource_id
              AND source.resource_revision > 1
              AND source.resource_revision = 1 + (
                SELECT max(json_extract(confirmed.value, '$.revision'))
                FROM json_each(NEW.source_json, '$.publicResponsibilities') confirmed
                WHERE json_extract(confirmed.value, '$.resourceId') = source.resource_id
                  AND json_type(confirmed.value, '$.bindingEmployeeId') = 'null'
              ))
          )
      )
    )
  );
END;
CREATE TRIGGER company_responsibility_resource_adoptions_identity_update
BEFORE UPDATE OF id ON company_responsibility_resource_adoptions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_employee_resource_adoptions
CREATE TABLE company_employee_resource_adoptions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  command_id TEXT NOT NULL UNIQUE CHECK (length(command_id) BETWEEN 1 AND 200),
  employee_id TEXT NOT NULL UNIQUE REFERENCES company_employees(id) ON DELETE RESTRICT,
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64 AND fingerprint NOT GLOB '*[^0-9a-f]*'),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 1500),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  organization_revision INTEGER NOT NULL CHECK (organization_revision > expected_revision AND organization_revision <= expected_revision + 100),
  observed_on TEXT NOT NULL CHECK (length(observed_on) = 10),
  snapshot_digest TEXT NOT NULL CHECK (length(snapshot_digest) = 64 AND snapshot_digest NOT GLOB '*[^0-9a-f]*'),
  source_json TEXT NOT NULL CHECK (json_valid(source_json) AND length(CAST(source_json AS BLOB)) <= 750000),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO company_employee_resource_adoptions (id, command_id, employee_id, fingerprint, actor_account_id, reason, expected_revision, organization_revision, observed_on, snapshot_digest, source_json, recorded_at)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.command_id,
       source.employee_id,
       source.fingerprint,
       source.actor_account_id,
       source.reason,
       source.expected_revision,
       source.organization_revision,
       source.observed_on,
       source.snapshot_digest,
       source.source_json,
       source.recorded_at
FROM "_stage_company_employee_resource_adoptions" source;
INSERT INTO _company_record_uuid_primary_key_validation
SELECT 'company_employee_resource_adoptions',
       (SELECT count(*) FROM "_stage_company_employee_resource_adoptions"),
       (SELECT count(*) FROM company_employee_resource_adoptions),
       0,
       (SELECT count(*) FROM company_employee_resource_adoptions WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'company' AND revision = 1);
DROP TABLE "_stage_company_employee_resource_adoptions";
CREATE TRIGGER company_employee_resource_adoptions_no_update
BEFORE UPDATE ON company_employee_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'employee resource adoption is immutable');
END;
CREATE TRIGGER company_employee_resource_adoptions_no_delete
BEFORE DELETE ON company_employee_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'employee resource adoption is immutable');
END;
CREATE TRIGGER company_employee_resource_adoptions_identity_update
BEFORE UPDATE OF id ON company_employee_resource_adoptions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_responsibility_source_adoptions
CREATE TABLE company_responsibility_source_adoptions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  organization_id TEXT NOT NULL DEFAULT 'organization:default'
    CHECK (organization_id = 'organization:default'),
  source_context TEXT NOT NULL CHECK (length(trim(source_context)) BETWEEN 1 AND 100),
  source_kind TEXT NOT NULL CHECK (length(trim(source_kind)) BETWEEN 1 AND 100),
  source_namespace TEXT NOT NULL CHECK (length(trim(source_namespace)) BETWEEN 1 AND 255),
  freeze_id TEXT NOT NULL,
  source_id TEXT NOT NULL CHECK (length(trim(source_id)) BETWEEN 1 AND 255),
  source_version TEXT NOT NULL CHECK (length(trim(source_version)) BETWEEN 1 AND 255),
  command_id TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT 'responsibility-assignment'
    CHECK (resource_type = 'responsibility-assignment'),
  resource_id TEXT NOT NULL,
  resource_revision INTEGER NOT NULL CHECK (resource_revision > 0),
  snapshot_digest TEXT NOT NULL
    CHECK (length(snapshot_digest) = 64 AND snapshot_digest NOT GLOB '*[^0-9a-f]*'),
  source_json TEXT NOT NULL
    CHECK (json_valid(source_json) AND json_type(source_json) = 'object'
      AND length(CAST(source_json AS BLOB)) <= 750000),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 2000),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  organization_revision INTEGER NOT NULL
    CHECK (organization_revision = expected_revision + 1),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  UNIQUE (organization_id, source_context, source_kind, source_id, source_version),
  UNIQUE (organization_id, command_id),
  FOREIGN KEY (organization_id, command_id)
    REFERENCES company_command_receipts(organization_id, command_id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, resource_type, resource_id)
    REFERENCES company_resource_heads(organization_id, resource_type, resource_id) ON DELETE RESTRICT,
  FOREIGN KEY (freeze_id) REFERENCES system_record_source_freezes(id) ON DELETE RESTRICT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO company_responsibility_source_adoptions (id, organization_id, source_context, source_kind, source_namespace, freeze_id, source_id, source_version, command_id, resource_type, resource_id, resource_revision, snapshot_digest, source_json, actor_account_id, reason, expected_revision, organization_revision, recorded_at)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.organization_id,
       source.source_context,
       source.source_kind,
       source.source_namespace,
       source.freeze_id,
       source.source_id,
       source.source_version,
       source.command_id,
       source.resource_type,
       source.resource_id,
       source.resource_revision,
       source.snapshot_digest,
       source.source_json,
       source.actor_account_id,
       source.reason,
       source.expected_revision,
       source.organization_revision,
       source.recorded_at
FROM "_stage_company_responsibility_source_adoptions" source;
INSERT INTO _company_record_uuid_primary_key_validation
SELECT 'company_responsibility_source_adoptions',
       (SELECT count(*) FROM "_stage_company_responsibility_source_adoptions"),
       (SELECT count(*) FROM company_responsibility_source_adoptions),
       0,
       (SELECT count(*) FROM company_responsibility_source_adoptions WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'company' AND revision = 1);
DROP TABLE "_stage_company_responsibility_source_adoptions";
CREATE TRIGGER company_responsibility_source_adoptions_insert_guard
BEFORE INSERT ON company_responsibility_source_adoptions
BEGIN
  SELECT RAISE(ABORT, 'company_responsibility_source_adoption_freeze_invalid')
  WHERE NOT EXISTS (
    SELECT 1 FROM system_record_source_freezes freeze
    WHERE freeze.id = NEW.freeze_id
      AND freeze.source_namespace = NEW.source_namespace
      AND freeze.owner_context = NEW.source_context
      AND freeze.revision = 1
  );

  SELECT RAISE(ABORT, 'company_responsibility_source_adoption_resource_invalid')
  WHERE NOT EXISTS (
    SELECT 1
    FROM company_resource_revisions resource
    JOIN company_command_receipts receipt
      ON receipt.organization_id = resource.organization_id
      AND receipt.command_id = resource.command_id
    WHERE resource.organization_id = NEW.organization_id
      AND resource.resource_type = NEW.resource_type
      AND resource.resource_id = NEW.resource_id
      AND resource.revision = NEW.resource_revision
      AND resource.command_id = NEW.command_id
      AND resource.organization_revision = NEW.organization_revision
      AND resource.actor_account_id = NEW.actor_account_id
      AND resource.reason = NEW.reason
      AND resource.recorded_at = NEW.recorded_at
      AND receipt.expected_revision = NEW.expected_revision
  );
END;
CREATE TRIGGER company_responsibility_source_adoptions_update_guard
BEFORE UPDATE ON company_responsibility_source_adoptions
BEGIN
  SELECT RAISE(ABORT, 'company_responsibility_source_adoption_immutable');
END;
CREATE TRIGGER company_responsibility_source_adoptions_delete_guard
BEFORE DELETE ON company_responsibility_source_adoptions
BEGIN
  SELECT RAISE(ABORT, 'company_responsibility_source_adoption_immutable');
END;
CREATE TRIGGER company_responsibility_source_adoptions_identity_update
BEFORE UPDATE OF id ON company_responsibility_source_adoptions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_responsibility_source_cutovers
CREATE TABLE company_responsibility_source_cutovers (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  organization_id TEXT NOT NULL DEFAULT 'organization:default'
    CHECK (organization_id = 'organization:default'),
  source_context TEXT NOT NULL CHECK (length(trim(source_context)) BETWEEN 1 AND 100),
  source_kind TEXT NOT NULL CHECK (length(trim(source_kind)) BETWEEN 1 AND 100),
  source_namespace TEXT NOT NULL CHECK (length(trim(source_namespace)) BETWEEN 1 AND 255),
  freeze_id TEXT NOT NULL,
  source_count INTEGER NOT NULL CHECK (source_count >= 0),
  adopted_count INTEGER NOT NULL CHECK (adopted_count = source_count),
  source_manifest_digest TEXT NOT NULL
    CHECK (length(source_manifest_digest) = 64
      AND source_manifest_digest NOT GLOB '*[^0-9a-f]*'),
  source_manifest_json TEXT NOT NULL
    CHECK (json_valid(source_manifest_json) AND json_type(source_manifest_json) = 'array'
      AND json_array_length(source_manifest_json) = source_count
      AND length(CAST(source_manifest_json AS BLOB)) <= 750000),
  audit_event_id TEXT NOT NULL REFERENCES company_audit_events(event_id) ON DELETE RESTRICT,
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  completed_at INTEGER NOT NULL CHECK (completed_at >= 0),
  UNIQUE (organization_id, source_context, source_kind),
  UNIQUE (freeze_id),
  FOREIGN KEY (freeze_id) REFERENCES system_record_source_freezes(id) ON DELETE RESTRICT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO company_responsibility_source_cutovers (id, organization_id, source_context, source_kind, source_namespace, freeze_id, source_count, adopted_count, source_manifest_digest, source_manifest_json, audit_event_id, actor_account_id, completed_at)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.organization_id,
       source.source_context,
       source.source_kind,
       source.source_namespace,
       source.freeze_id,
       source.source_count,
       source.adopted_count,
       source.source_manifest_digest,
       source.source_manifest_json,
       source.audit_event_id,
       source.actor_account_id,
       source.completed_at
FROM "_stage_company_responsibility_source_cutovers" source;
INSERT INTO _company_record_uuid_primary_key_validation
SELECT 'company_responsibility_source_cutovers',
       (SELECT count(*) FROM "_stage_company_responsibility_source_cutovers"),
       (SELECT count(*) FROM company_responsibility_source_cutovers),
       0,
       (SELECT count(*) FROM company_responsibility_source_cutovers WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'company' AND revision = 1);
DROP TABLE "_stage_company_responsibility_source_cutovers";
CREATE TRIGGER company_responsibility_source_cutovers_insert_guard
BEFORE INSERT ON company_responsibility_source_cutovers
BEGIN
  SELECT RAISE(ABORT, 'company_responsibility_source_cutover_freeze_invalid')
  WHERE NOT EXISTS (
    SELECT 1 FROM system_record_source_freezes freeze
    WHERE freeze.id = NEW.freeze_id
      AND freeze.source_namespace = NEW.source_namespace
      AND freeze.owner_context = NEW.source_context
      AND freeze.revision = 1
  );

  SELECT RAISE(ABORT, 'company_responsibility_source_cutover_manifest_invalid')
  WHERE EXISTS (
    SELECT 1 FROM json_each(NEW.source_manifest_json) entry
    WHERE json_type(entry.value) <> 'object'
      OR NOT EXISTS (
        SELECT 1 FROM company_responsibility_source_adoptions adoption
        WHERE adoption.organization_id = NEW.organization_id
          AND adoption.source_context = NEW.source_context
          AND adoption.source_kind = NEW.source_kind
          AND adoption.source_namespace = NEW.source_namespace
          AND adoption.freeze_id = NEW.freeze_id
          AND adoption.source_id = json_extract(entry.value, '$.sourceId')
          AND adoption.source_version = json_extract(entry.value, '$.sourceVersion')
      )
  ) OR EXISTS (
    SELECT 1 FROM company_responsibility_source_adoptions adoption
    WHERE adoption.organization_id = NEW.organization_id
      AND adoption.source_context = NEW.source_context
      AND adoption.source_kind = NEW.source_kind
      AND adoption.source_namespace = NEW.source_namespace
      AND adoption.freeze_id = NEW.freeze_id
      AND NOT EXISTS (
        SELECT 1 FROM json_each(NEW.source_manifest_json) entry
        WHERE json_extract(entry.value, '$.sourceId') = adoption.source_id
          AND json_extract(entry.value, '$.sourceVersion') = adoption.source_version
      )
  );
END;
CREATE TRIGGER company_responsibility_source_cutovers_update_guard
BEFORE UPDATE ON company_responsibility_source_cutovers
BEGIN
  SELECT RAISE(ABORT, 'company_responsibility_source_cutover_immutable');
END;
CREATE TRIGGER company_responsibility_source_cutovers_delete_guard
BEFORE DELETE ON company_responsibility_source_cutovers
BEGIN
  SELECT RAISE(ABORT, 'company_responsibility_source_cutover_immutable');
END;
CREATE TRIGGER governance_responsibility_cutover_coverage_guard
BEFORE INSERT ON company_responsibility_source_cutovers
BEGIN
  SELECT RAISE(ABORT, 'company_responsibility_source_cutover_coverage_invalid')
  WHERE NEW.source_context <> 'governance'
    OR NEW.source_kind <> 'org-role-assignment'
    OR NEW.source_count <> (SELECT count(*) FROM governance_org_role_assignments)
    OR NEW.adopted_count <> (
      SELECT count(*) FROM company_responsibility_source_adoptions
      WHERE organization_id = NEW.organization_id
        AND source_context = NEW.source_context
        AND source_kind = NEW.source_kind
        AND source_namespace = NEW.source_namespace
        AND freeze_id = NEW.freeze_id
    )
    OR EXISTS (
      SELECT 1
      FROM governance_org_role_assignments source
      LEFT JOIN company_responsibility_source_adoptions adoption
        ON adoption.organization_id = NEW.organization_id
        AND adoption.source_context = NEW.source_context
        AND adoption.source_kind = NEW.source_kind
        AND adoption.source_namespace = NEW.source_namespace
        AND adoption.freeze_id = NEW.freeze_id
        AND adoption.source_id = CAST(source.id AS TEXT)
      LEFT JOIN company_resource_revisions resource
        ON resource.organization_id = adoption.organization_id
        AND resource.resource_type = adoption.resource_type
        AND resource.resource_id = adoption.resource_id
        AND resource.revision = adoption.resource_revision
      WHERE adoption.source_id IS NULL
        OR adoption.source_version <> adoption.snapshot_digest
        OR json_extract(adoption.source_json, '$.id') IS NOT source.id
        OR json_extract(adoption.source_json, '$.org_role_code') IS NOT source.org_role_code
        OR json_extract(adoption.source_json, '$.employee_id') IS NOT CAST(source.employee_id AS TEXT)
        OR json_extract(adoption.source_json, '$.department_code') IS NOT source.department_code
        OR json_extract(adoption.source_json, '$.starts_on') IS NOT source.starts_on
        OR json_extract(adoption.source_json, '$.ends_on') IS NOT source.ends_on
        OR json_extract(adoption.source_json, '$.source_document_code') IS NOT source.source_document_code
        OR json_extract(adoption.source_json, '$.created_by_account_id') IS NOT source.created_by_account_id
        OR json_extract(adoption.source_json, '$.created_at') IS NOT source.created_at
        OR json_extract(adoption.source_json, '$.revoked_by_account_id') IS NOT source.revoked_by_account_id
        OR json_extract(adoption.source_json, '$.revoked_at') IS NOT source.revoked_at
        OR resource.resource_id IS NULL
    );
END;
CREATE TRIGGER company_responsibility_source_cutovers_identity_update
BEFORE UPDATE OF id ON company_responsibility_source_cutovers
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_bootstrap_receipts
CREATE TABLE company_bootstrap_receipts (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  command_id TEXT NOT NULL UNIQUE CHECK (length(command_id) BETWEEN 1 AND 200),
  organization_id TEXT NOT NULL UNIQUE REFERENCES company_organizations(id) CHECK (organization_id = 'organization:default'),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id),
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64 AND fingerprint NOT GLOB '*[^0-9a-f]*'),
  employee_id TEXT NOT NULL REFERENCES company_employees(id),
  organization_revision INTEGER NOT NULL CHECK (organization_revision > 0),
  declaration_json TEXT NOT NULL CHECK (json_valid(declaration_json)),
  source_json TEXT NOT NULL CHECK (json_valid(source_json) AND length(CAST(source_json AS BLOB)) <= 750000),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO company_bootstrap_receipts (id, command_id, organization_id, actor_account_id, fingerprint, employee_id, organization_revision, declaration_json, source_json, recorded_at)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.command_id,
       source.organization_id,
       source.actor_account_id,
       source.fingerprint,
       source.employee_id,
       source.organization_revision,
       source.declaration_json,
       source.source_json,
       source.recorded_at
FROM "_stage_company_bootstrap_receipts" source;
INSERT INTO _company_record_uuid_primary_key_validation
SELECT 'company_bootstrap_receipts',
       (SELECT count(*) FROM "_stage_company_bootstrap_receipts"),
       (SELECT count(*) FROM company_bootstrap_receipts),
       0,
       (SELECT count(*) FROM company_bootstrap_receipts WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'company' AND revision = 1);
DROP TABLE "_stage_company_bootstrap_receipts";
CREATE TRIGGER company_bootstrap_receipts_immutable_update
BEFORE UPDATE ON company_bootstrap_receipts
BEGIN
  SELECT RAISE(ABORT, 'company bootstrap receipt immutable');
END;
CREATE TRIGGER company_bootstrap_receipts_immutable_delete
BEFORE DELETE ON company_bootstrap_receipts
BEGIN
  SELECT RAISE(ABORT, 'company bootstrap receipt immutable');
END;
CREATE TRIGGER company_bootstrap_receipts_identity_update
BEFORE UPDATE OF id ON company_bootstrap_receipts
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_grade_award_archives
CREATE TABLE company_grade_award_archives (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) CHECK (organization_id = 'organization:default'),
  command_id TEXT NOT NULL,
  employee_id TEXT NOT NULL REFERENCES company_employees(id),
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 2000),
  observed_on TEXT NOT NULL CHECK (length(observed_on) = 10),
  observed_company_revision INTEGER NOT NULL CHECK (observed_company_revision >= 0),
  snapshot_digest TEXT NOT NULL CHECK (length(snapshot_digest) = 64),
  source_json TEXT NOT NULL CHECK (json_valid(source_json)),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  UNIQUE (organization_id, command_id),
  UNIQUE (organization_id, employee_id),
  CHECK (json_extract(source_json, '$.employeeId') IS employee_id),
  CHECK (json_extract(source_json, '$.organizationRevision') IS observed_company_revision),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO company_grade_award_archives (id, organization_id, command_id, employee_id, fingerprint, actor_account_id, reason, observed_on, observed_company_revision, snapshot_digest, source_json, recorded_at)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.organization_id,
       source.command_id,
       source.employee_id,
       source.fingerprint,
       source.actor_account_id,
       source.reason,
       source.observed_on,
       source.observed_company_revision,
       source.snapshot_digest,
       source.source_json,
       source.recorded_at
FROM "_stage_company_grade_award_archives" source;
INSERT INTO _company_record_uuid_primary_key_validation
SELECT 'company_grade_award_archives',
       (SELECT count(*) FROM "_stage_company_grade_award_archives"),
       (SELECT count(*) FROM company_grade_award_archives),
       0,
       (SELECT count(*) FROM company_grade_award_archives WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'company' AND revision = 1);
DROP TABLE "_stage_company_grade_award_archives";
CREATE TRIGGER company_grade_award_archive_no_update
BEFORE UPDATE ON company_grade_award_archives
BEGIN
  SELECT RAISE(ABORT, 'company grade award archives are immutable');
END;
CREATE TRIGGER company_grade_award_archive_no_delete
BEFORE DELETE ON company_grade_award_archives
BEGIN
  SELECT RAISE(ABORT, 'company grade award archives are immutable');
END;
CREATE TRIGGER company_grade_award_archives_identity_update
BEFORE UPDATE OF id ON company_grade_award_archives
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_external_identity_imports
CREATE TABLE company_external_identity_imports (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT,
  command_id TEXT NOT NULL CHECK (length(command_id) BETWEEN 1 AND 200),
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64 AND fingerprint NOT GLOB '*[^0-9a-f]*'),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  machine_credential_id TEXT NOT NULL REFERENCES system_machine_credentials(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 2000),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  organization_revision INTEGER NOT NULL CHECK (organization_revision = expected_revision + 1),
  result_json TEXT NOT NULL CHECK (json_valid(result_json)),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  UNIQUE (organization_id, command_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO company_external_identity_imports (id, organization_id, command_id, fingerprint, actor_account_id, machine_credential_id, reason, expected_revision, organization_revision, result_json, recorded_at)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.organization_id,
       source.command_id,
       source.fingerprint,
       source.actor_account_id,
       source.machine_credential_id,
       source.reason,
       source.expected_revision,
       source.organization_revision,
       source.result_json,
       source.recorded_at
FROM "_stage_company_external_identity_imports" source;
INSERT INTO _company_record_uuid_primary_key_validation
SELECT 'company_external_identity_imports',
       (SELECT count(*) FROM "_stage_company_external_identity_imports"),
       (SELECT count(*) FROM company_external_identity_imports),
       0,
       (SELECT count(*) FROM company_external_identity_imports WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'company' AND revision = 1);
DROP TABLE "_stage_company_external_identity_imports";
CREATE TRIGGER company_external_identity_imports_no_update
BEFORE UPDATE ON company_external_identity_imports
BEGIN
  SELECT RAISE(ABORT, 'external identity import is immutable');
END;
CREATE TRIGGER company_external_identity_imports_no_delete
BEFORE DELETE ON company_external_identity_imports
BEGIN
  SELECT RAISE(ABORT, 'external identity import is immutable');
END;
CREATE TRIGGER company_external_identity_imports_identity_update
BEFORE UPDATE OF id ON company_external_identity_imports
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_account_profiles
CREATE TABLE company_account_profiles (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE CASCADE ON UPDATE CASCADE,
  account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (
    length(display_name) BETWEEN 1 AND 200
    AND trim(display_name) = display_name
    AND instr(display_name, char(0)) = 0
  ),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  UNIQUE (organization_id, account_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO company_account_profiles (id, organization_id, account_id, display_name, created_at, updated_at)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.organization_id,
       source.account_id,
       source.display_name,
       source.created_at,
       source.updated_at
FROM "_stage_company_account_profiles" source;
INSERT INTO _company_record_uuid_primary_key_validation
SELECT 'company_account_profiles',
       (SELECT count(*) FROM "_stage_company_account_profiles"),
       (SELECT count(*) FROM company_account_profiles),
       0,
       (SELECT count(*) FROM company_account_profiles WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'company' AND revision = 1);
DROP TABLE "_stage_company_account_profiles";
CREATE INDEX company_account_profiles_account_idx
  ON company_account_profiles (account_id);
CREATE TRIGGER company_account_profiles_identity_update
BEFORE UPDATE OF id ON company_account_profiles
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_workforce_connection_completions
CREATE TABLE company_workforce_connection_completions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  organization_id TEXT NOT NULL UNIQUE REFERENCES company_organizations(id) ON DELETE RESTRICT
    CHECK (organization_id = 'organization:default'),
  command_id TEXT NOT NULL UNIQUE CHECK (length(command_id) BETWEEN 1 AND 255),
  actor_account_id TEXT NOT NULL CHECK (length(actor_account_id) BETWEEN 1 AND 255),
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 2000),
  employee_count INTEGER NOT NULL CHECK (employee_count >= 0),
  employment_count INTEGER NOT NULL CHECK (employment_count >= 0),
  completed_at INTEGER NOT NULL CHECK (completed_at >= 0),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO company_workforce_connection_completions (id, organization_id, command_id, actor_account_id, reason, employee_count, employment_count, completed_at)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.organization_id,
       source.command_id,
       source.actor_account_id,
       source.reason,
       source.employee_count,
       source.employment_count,
       source.completed_at
FROM "_stage_company_workforce_connection_completions" source;
INSERT INTO _company_record_uuid_primary_key_validation
SELECT 'company_workforce_connection_completions',
       (SELECT count(*) FROM "_stage_company_workforce_connection_completions"),
       (SELECT count(*) FROM company_workforce_connection_completions),
       0,
       (SELECT count(*) FROM company_workforce_connection_completions WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'company' AND revision = 1);
DROP TABLE "_stage_company_workforce_connection_completions";
CREATE TRIGGER company_workforce_connection_completions_no_update
BEFORE UPDATE ON company_workforce_connection_completions
BEGIN SELECT RAISE(ABORT, 'company_workforce_connection_completion_immutable'); END;
CREATE TRIGGER company_workforce_connection_completions_no_delete
BEFORE DELETE ON company_workforce_connection_completions
BEGIN SELECT RAISE(ABORT, 'company_workforce_connection_completion_immutable'); END;
CREATE TRIGGER company_workforce_connection_completions_requires_connection
BEFORE INSERT ON company_workforce_connection_completions
WHEN EXISTS (
  SELECT 1 FROM company_employees AS employee
  WHERE NOT EXISTS (
    SELECT 1 FROM company_workforce_resource_bindings AS binding
    WHERE binding.resource_type = 'employee' AND binding.employee_id = employee.id
  )
) OR EXISTS (
  SELECT 1 FROM company_employments AS employment
  WHERE NOT EXISTS (
    SELECT 1 FROM company_workforce_resource_bindings AS binding
    WHERE binding.resource_type = 'employment' AND binding.resource_id = employment.id
  )
)
BEGIN SELECT RAISE(ABORT, 'company_workforce_connection_incomplete'); END;
CREATE TRIGGER company_workforce_connection_completions_identity_update
BEFORE UPDATE OF id ON company_workforce_connection_completions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_personnel_annotations
CREATE TABLE company_personnel_annotations (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  employee_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  effective_date TEXT NOT NULL,
  from_department_code TEXT,
  to_department_code TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO company_personnel_annotations (id, employee_id, kind, effective_date, from_department_code, to_department_code, note, created_at, legacy_id)
SELECT map.new_id,
       source.employee_id,
       source.kind,
       source.effective_date,
       source.from_department_code,
       source.to_department_code,
       source.note,
       source.created_at,
       CAST(source.id AS TEXT)
FROM "_stage_company_personnel_annotations" source
INNER JOIN _company_personnel_annotations_id_map map ON map.old_id = source.id;
INSERT INTO _company_record_uuid_primary_key_validation
SELECT 'company_personnel_annotations',
       (SELECT count(*) FROM "_stage_company_personnel_annotations"),
       (SELECT count(*) FROM company_personnel_annotations),
       0,
       (SELECT count(*) FROM company_personnel_annotations WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'company' AND revision = 1);
DROP TABLE "_stage_company_personnel_annotations";
CREATE INDEX idx_company_personnel_annotations_employee ON company_personnel_annotations(employee_id);
CREATE INDEX idx_company_personnel_annotations_kind ON company_personnel_annotations(kind);
CREATE TRIGGER company_personnel_annotations_no_update
BEFORE UPDATE ON company_personnel_annotations
BEGIN
  SELECT RAISE(ABORT, 'company personnel annotations are immutable');
END;
CREATE TRIGGER company_personnel_annotations_no_delete
BEFORE DELETE ON company_personnel_annotations
BEGIN
  SELECT RAISE(ABORT, 'company personnel annotations are immutable');
END;
CREATE TRIGGER company_personnel_annotations_no_replace
BEFORE INSERT ON company_personnel_annotations
WHEN EXISTS (SELECT 1 FROM company_personnel_annotations WHERE id = NEW.id)
BEGIN
  SELECT RAISE(ABORT, 'company personnel annotations are immutable');
END;
CREATE TRIGGER company_personnel_annotations_legacy_id_insert
BEFORE INSERT ON company_personnel_annotations
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER company_personnel_annotations_identity_update
BEFORE UPDATE OF id, legacy_id ON company_personnel_annotations
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_lifecycle_outbox_entries
CREATE TABLE company_lifecycle_outbox_entries (
  -- 人事の発令と同じ batch で行を足すため、主キーは列の既定値で採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  legacy_id TEXT UNIQUE,
  personnel_action_id TEXT NOT NULL,
  effect_type TEXT NOT NULL CHECK (effect_type IN ('hire', 'retired')),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at INTEGER NOT NULL,
  processed_at INTEGER,
  last_error_code TEXT,
  created_at INTEGER NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO company_lifecycle_outbox_entries (id, personnel_action_id, effect_type, payload_json, attempt_count, next_attempt_at, processed_at, last_error_code, created_at, legacy_id)
SELECT map.new_id,
       source.personnel_action_id,
       source.effect_type,
       source.payload_json,
       source.attempt_count,
       source.next_attempt_at,
       source.processed_at,
       source.last_error_code,
       source.created_at,
       CAST(source.id AS TEXT)
FROM "_stage_company_lifecycle_outbox_entries" source
INNER JOIN _company_lifecycle_outbox_entries_id_map map ON map.old_id = source.id;
INSERT INTO _company_record_uuid_primary_key_validation
SELECT 'company_lifecycle_outbox_entries',
       (SELECT count(*) FROM "_stage_company_lifecycle_outbox_entries"),
       (SELECT count(*) FROM company_lifecycle_outbox_entries),
       0,
       (SELECT count(*) FROM company_lifecycle_outbox_entries WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'company' AND revision = 1);
DROP TABLE "_stage_company_lifecycle_outbox_entries";
CREATE INDEX idx_company_lifecycle_outbox_pending
  ON company_lifecycle_outbox_entries(processed_at, next_attempt_at, id);
CREATE UNIQUE INDEX uq_company_lifecycle_outbox_action_effect
  ON company_lifecycle_outbox_entries(personnel_action_id, effect_type);
CREATE TRIGGER company_lifecycle_outbox_entries_legacy_id_insert
BEFORE INSERT ON company_lifecycle_outbox_entries
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER company_lifecycle_outbox_entries_identity_update
BEFORE UPDATE OF id, legacy_id ON company_lifecycle_outbox_entries
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

DROP TABLE _company_personnel_annotations_id_map;
DROP TABLE _company_lifecycle_outbox_entries_id_map;
DROP TABLE _company_record_uuid_primary_key_validation;
