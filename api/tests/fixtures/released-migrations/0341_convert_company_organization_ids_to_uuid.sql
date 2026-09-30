-- Company の組織と組織単位の ID を UUID へ置き換える (Issue )。
--
-- 導入ごとに一つだけの会社組織 'organization:default' は既知の UUID ad4f6cb1-774b-43ae-950f-80e9bc67c66d へ、
-- 最上位の組織単位 'company:root' は既知の UUID 282ccd01-cb30-4d0a-84b4-c675bbbe473c へ置き換える。
-- ほかの UUID でない組織単位の ID は新しい UUID へ置き換える。旧来の値は同じ行の legacy_id に残す。
--
-- 組織と組織単位を指す列（organization_id、organization_unit_id、parent_organization_unit_id）、
-- 資源の属性の organizationId・organizationUnitId・parentOrganizationUnitId、業務の組織単位の参照を
-- 新しい値へ移す。旧来の組織 ID を埋め込んだ CHECK・trigger・view も新しい値で作り直す。
-- 期間の ID と組織変更の ID、発令・取込の記録の JSON と digest は値を変えない。
--
-- 組織が二つ以上ある、または旧来の既定の組織以外の組織 ID があれば、作り直した validation の CHECK で止める。
--
-- 退避と削除は参照元から、作り直しは参照先から行う。外部キーは D1 の migration の transaction の終わりに検査する。
--
-- ALTER TABLE RENAME は trigger を含む全 schema を解析し直し、table ごとに数十 ms かかる。
-- 名前を変えずに行を退避し、同じ名前で作り直してから戻す。

PRAGMA defer_foreign_keys = true;

CREATE TABLE _company_organization_uuid_validation (
  resource TEXT PRIMARY KEY NOT NULL,
  source_count INTEGER NOT NULL,
  target_count INTEGER NOT NULL,
  orphan_count INTEGER NOT NULL,
  non_uuid_count INTEGER NOT NULL,
  blocked_count INTEGER NOT NULL,
  CHECK (source_count = target_count AND orphan_count = 0 AND non_uuid_count = 0 AND blocked_count = 0)
);

INSERT INTO _company_organization_uuid_validation VALUES ('company_organizations.singleton', 0, 0, 0, 0, (SELECT count(*) FROM company_organizations WHERE id NOT IN ('organization:default', 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d')) + max((SELECT count(*) FROM company_organizations) - 1, 0));

-- company_organizations
CREATE TABLE _company_organizations_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _company_organizations_id_map (old_id, new_id)
SELECT id, CASE WHEN id = 'organization:default' THEN 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d' WHEN length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]' THEN id ELSE lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) END
FROM company_organizations;

-- company_organization_units
CREATE TABLE _company_organization_units_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _company_organization_units_id_map (old_id, new_id)
SELECT id, CASE WHEN id = 'company:root' THEN '282ccd01-cb30-4d0a-84b4-c675bbbe473c' WHEN length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]' THEN id ELSE lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) END
FROM company_organization_units;

-- 外部キーの無い参照が移行前から指す先を持たない行の数。移行で増えないことを最後に確かめる。
CREATE TABLE _uuid_reference_orphans (
  resource TEXT PRIMARY KEY NOT NULL,
  orphan_count INTEGER NOT NULL
);
INSERT INTO _uuid_reference_orphans VALUES ('company_organization_unit_period_versions.organization_unit_id', (SELECT count(*) FROM company_organization_unit_period_versions child WHERE child.organization_unit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organization_units parent WHERE parent.id = child.organization_unit_id)));
INSERT INTO _uuid_reference_orphans VALUES ('company_organization_unit_period_versions.parent_organization_unit_id', (SELECT count(*) FROM company_organization_unit_period_versions child WHERE child.parent_organization_unit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organization_units parent WHERE parent.id = child.parent_organization_unit_id)));
INSERT INTO _uuid_reference_orphans VALUES ('company_organization_assignment_period_versions.organization_unit_id', (SELECT count(*) FROM company_organization_assignment_period_versions child WHERE child.organization_unit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organization_units parent WHERE parent.id = child.organization_unit_id)));
INSERT INTO _uuid_reference_orphans VALUES ('company_organization_responsibility_period_versions.organization_unit_id', (SELECT count(*) FROM company_organization_responsibility_period_versions child WHERE child.organization_unit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organization_units parent WHERE parent.id = child.organization_unit_id)));
INSERT INTO _uuid_reference_orphans VALUES ('company_command_receipts.organization_id', (SELECT count(*) FROM company_command_receipts child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)));
INSERT INTO _uuid_reference_orphans VALUES ('company_resource_heads.organization_id', (SELECT count(*) FROM company_resource_heads child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)));
INSERT INTO _uuid_reference_orphans VALUES ('company_resource_revisions.organization_id', (SELECT count(*) FROM company_resource_revisions child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)));
INSERT INTO _uuid_reference_orphans VALUES ('company_workforce_resource_bindings.organization_id', (SELECT count(*) FROM company_workforce_resource_bindings child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)));
INSERT INTO _uuid_reference_orphans VALUES ('company_account_employee_resource_bindings.organization_id', (SELECT count(*) FROM company_account_employee_resource_bindings child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)));
INSERT INTO _uuid_reference_orphans VALUES ('company_assignment_resource_bindings.organization_id', (SELECT count(*) FROM company_assignment_resource_bindings child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)));
INSERT INTO _uuid_reference_orphans VALUES ('company_responsibility_resource_bindings.organization_id', (SELECT count(*) FROM company_responsibility_resource_bindings child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)));
INSERT INTO _uuid_reference_orphans VALUES ('company_responsibility_resource_bindings.organization_unit_id', (SELECT count(*) FROM company_responsibility_resource_bindings child WHERE child.organization_unit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organization_units parent WHERE parent.id = child.organization_unit_id)));
INSERT INTO _uuid_reference_orphans VALUES ('company_personnel_reporting_bindings.organization_id', (SELECT count(*) FROM company_personnel_reporting_bindings child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)));
INSERT INTO _uuid_reference_orphans VALUES ('company_personnel_reporting_bindings.organization_unit_id', (SELECT count(*) FROM company_personnel_reporting_bindings child WHERE child.organization_unit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organization_units parent WHERE parent.id = child.organization_unit_id)));
INSERT INTO _uuid_reference_orphans VALUES ('company_organization_resource_bindings.organization_id', (SELECT count(*) FROM company_organization_resource_bindings child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)));
INSERT INTO _uuid_reference_orphans VALUES ('company_organization_resource_bindings.organization_unit_id', (SELECT count(*) FROM company_organization_resource_bindings child WHERE child.organization_unit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organization_units parent WHERE parent.id = child.organization_unit_id)));
INSERT INTO _uuid_reference_orphans VALUES ('company_definition_resource_adoptions.organization_id', (SELECT count(*) FROM company_definition_resource_adoptions child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)));
INSERT INTO _uuid_reference_orphans VALUES ('company_profile_change_receipts.organization_id', (SELECT count(*) FROM company_profile_change_receipts child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)));
INSERT INTO _uuid_reference_orphans VALUES ('company_organization_resource_adoptions.organization_unit_id', (SELECT count(*) FROM company_organization_resource_adoptions child WHERE child.organization_unit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organization_units parent WHERE parent.id = child.organization_unit_id)));
INSERT INTO _uuid_reference_orphans VALUES ('company_responsibility_source_adoptions.organization_id', (SELECT count(*) FROM company_responsibility_source_adoptions child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)));
INSERT INTO _uuid_reference_orphans VALUES ('company_responsibility_source_cutovers.organization_id', (SELECT count(*) FROM company_responsibility_source_cutovers child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)));
INSERT INTO _uuid_reference_orphans VALUES ('company_bootstrap_receipts.organization_id', (SELECT count(*) FROM company_bootstrap_receipts child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)));
INSERT INTO _uuid_reference_orphans VALUES ('company_grade_award_archives.organization_id', (SELECT count(*) FROM company_grade_award_archives child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)));
INSERT INTO _uuid_reference_orphans VALUES ('company_external_identity_imports.organization_id', (SELECT count(*) FROM company_external_identity_imports child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)));
INSERT INTO _uuid_reference_orphans VALUES ('company_external_identity_sources.organization_id', (SELECT count(*) FROM company_external_identity_sources child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)));
INSERT INTO _uuid_reference_orphans VALUES ('company_account_profiles.organization_id', (SELECT count(*) FROM company_account_profiles child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)));
INSERT INTO _uuid_reference_orphans VALUES ('company_workforce_connection_completions.organization_id', (SELECT count(*) FROM company_workforce_connection_completions child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)));
INSERT INTO _uuid_reference_orphans VALUES ('expense_budgets.organization_unit_id', (SELECT count(*) FROM expense_budgets child WHERE child.organization_unit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organization_units parent WHERE parent.id = child.organization_unit_id)));
INSERT INTO _uuid_reference_orphans VALUES ('expenses.organization_unit_id', (SELECT count(*) FROM expenses child WHERE child.organization_unit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organization_units parent WHERE parent.id = child.organization_unit_id)));
INSERT INTO _uuid_reference_orphans VALUES ('career_postings.organization_unit_id', (SELECT count(*) FROM career_postings child WHERE child.organization_unit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organization_units parent WHERE parent.id = child.organization_unit_id)));

DROP TRIGGER company_assignment_adoption_insert_guard;
DROP TRIGGER company_responsibility_adoption_insert_guard;
DROP VIEW company_account_employee_link_period_violations;
-- 参照元から順に行を退避して table を削除する。
CREATE TABLE "_stage_career_postings" AS SELECT * FROM career_postings;
DROP TABLE career_postings;
CREATE TABLE "_stage_expenses" AS SELECT * FROM expenses;
DROP TABLE expenses;
CREATE TABLE "_stage_expense_budgets" AS SELECT * FROM expense_budgets;
DROP TABLE expense_budgets;
CREATE TABLE "_stage_company_workforce_connection_completions" AS SELECT * FROM company_workforce_connection_completions;
DROP TABLE company_workforce_connection_completions;
CREATE TABLE "_stage_company_account_profiles" AS SELECT * FROM company_account_profiles;
DROP TABLE company_account_profiles;
CREATE TABLE "_stage_company_external_identity_sources" AS SELECT * FROM company_external_identity_sources;
DROP TABLE company_external_identity_sources;
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
CREATE TABLE "_stage_company_organization_resource_adoptions" AS SELECT * FROM company_organization_resource_adoptions;
DROP TABLE company_organization_resource_adoptions;
CREATE TABLE "_stage_company_profile_change_receipts" AS SELECT * FROM company_profile_change_receipts;
DROP TABLE company_profile_change_receipts;
CREATE TABLE "_stage_company_definition_resource_adoptions" AS SELECT * FROM company_definition_resource_adoptions;
DROP TABLE company_definition_resource_adoptions;
CREATE TABLE "_stage_company_organization_resource_bindings" AS SELECT * FROM company_organization_resource_bindings;
DROP TABLE company_organization_resource_bindings;
CREATE TABLE "_stage_company_personnel_reporting_bindings" AS SELECT * FROM company_personnel_reporting_bindings;
DROP TABLE company_personnel_reporting_bindings;
CREATE TABLE "_stage_company_responsibility_resource_bindings" AS SELECT * FROM company_responsibility_resource_bindings;
DROP TABLE company_responsibility_resource_bindings;
CREATE TABLE "_stage_company_assignment_resource_bindings" AS SELECT * FROM company_assignment_resource_bindings;
DROP TABLE company_assignment_resource_bindings;
CREATE TABLE "_stage_company_account_employee_resource_bindings" AS SELECT * FROM company_account_employee_resource_bindings;
DROP TABLE company_account_employee_resource_bindings;
CREATE TABLE "_stage_company_workforce_resource_bindings" AS SELECT * FROM company_workforce_resource_bindings;
DROP TABLE company_workforce_resource_bindings;
CREATE TABLE "_stage_company_resource_revisions" AS SELECT * FROM company_resource_revisions;
DROP TABLE company_resource_revisions;
CREATE TABLE "_stage_company_resource_heads" AS SELECT * FROM company_resource_heads;
DROP TABLE company_resource_heads;
CREATE TABLE "_stage_company_command_receipts" AS SELECT * FROM company_command_receipts;
DROP TABLE company_command_receipts;
CREATE TABLE "_stage_company_organization_responsibility_period_versions" AS SELECT * FROM company_organization_responsibility_period_versions;
DROP TABLE company_organization_responsibility_period_versions;
CREATE TABLE "_stage_company_organization_assignment_period_versions" AS SELECT * FROM company_organization_assignment_period_versions;
DROP TABLE company_organization_assignment_period_versions;
CREATE TABLE "_stage_company_organization_unit_period_versions" AS SELECT * FROM company_organization_unit_period_versions;
DROP TABLE company_organization_unit_period_versions;
CREATE TABLE "_stage_company_organization_units" AS SELECT * FROM company_organization_units;
DROP TABLE company_organization_units;
CREATE TABLE "_stage_company_organizations" AS SELECT * FROM company_organizations;
DROP TABLE company_organizations;

-- company_organizations
CREATE TABLE company_organizations (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at)
, name TEXT NOT NULL DEFAULT ''
  CHECK (length(name) <= 200 AND trim(name) = name AND instr(name, char(0)) = 0), representative_name TEXT NOT NULL DEFAULT ''
  CHECK (
    length(representative_name) <= 200
    AND trim(representative_name) = representative_name
    AND instr(representative_name, char(0)) = 0
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO company_organizations (id, revision, created_at, updated_at, name, representative_name, legacy_id)
SELECT map.new_id,
       source.revision,
       source.created_at,
       source.updated_at,
       source.name,
       source.representative_name,
       CASE WHEN map.old_id IS NOT map.new_id THEN source.id END
FROM "_stage_company_organizations" source
INNER JOIN _company_organizations_id_map map ON map.old_id = source.id;
INSERT INTO _company_organization_uuid_validation
SELECT 'company_organizations',
       (SELECT count(*) FROM "_stage_company_organizations"),
       (SELECT count(*) FROM company_organizations),
       0,
       (SELECT count(*) FROM company_organizations WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'company' AND revision = 1);
DROP TABLE "_stage_company_organizations";
CREATE TRIGGER company_organizations_revision_step
BEFORE UPDATE OF revision ON company_organizations
WHEN NEW.revision <> OLD.revision + 1
BEGIN
  SELECT RAISE(ABORT, 'company_revision_step_invalid');
END;
CREATE TRIGGER company_workforce_projection_guard
BEFORE UPDATE OF revision ON company_organizations
WHEN NEW.revision != OLD.revision
BEGIN
  SELECT RAISE(ABORT, 'company_workforce_period_conflict')
  WHERE EXISTS (
    WITH latest AS (
      SELECT period.* FROM company_employment_period_versions AS period
      JOIN company_workforce_resource_bindings AS binding
        ON binding.employee_id = period.employee_id AND binding.resource_type = 'employee'
        AND binding.organization_id = NEW.id
      WHERE period.is_void = 0 AND NOT EXISTS (
        SELECT 1 FROM company_employment_period_versions AS newer
        WHERE newer.period_id = period.period_id AND newer.revision > period.revision
      )
    )
    SELECT 1 FROM latest AS left_period JOIN latest AS right_period
      ON left_period.employee_id = right_period.employee_id
      AND left_period.period_id < right_period.period_id
    WHERE (left_period.ends_on IS NULL OR right_period.starts_on < left_period.ends_on)
      AND (right_period.ends_on IS NULL OR left_period.starts_on < right_period.ends_on)
  );

  SELECT RAISE(ABORT, 'company_workforce_reference_period_conflict')
  WHERE EXISTS (
    WITH ranked AS (
      SELECT resource.*,
        row_number() OVER (PARTITION BY resource_type, resource_id, effective_from ORDER BY revision DESC) AS start_rank
      FROM company_resource_revisions AS resource
      WHERE organization_id = NEW.id AND resource_type IN ('person', 'employee')
    ),
    slices AS (
      SELECT resource_type, resource_id, state, attributes_json, effective_from AS starts_on,
        nullif(min(coalesce(effective_to, '9999-12-32'),
          coalesce(lead(effective_from) OVER (PARTITION BY resource_type, resource_id ORDER BY effective_from), '9999-12-32')), '9999-12-32') AS ends_on
      FROM ranked WHERE start_rank = 1
    ),
    reference_intervals AS (
      SELECT 'employee' AS reference_type, period.employee_id AS reference_id,
        period.starts_on, period.ends_on
      FROM company_employment_period_versions AS period
      JOIN company_workforce_resource_bindings AS binding ON binding.resource_type = 'employee'
        AND binding.employee_id = period.employee_id AND binding.organization_id = NEW.id
      WHERE period.is_void = 0 AND NOT EXISTS (
        SELECT 1 FROM company_employment_period_versions AS newer
        WHERE newer.period_id = period.period_id AND newer.revision > period.revision
      )
      UNION ALL
      SELECT 'person', json_extract(employee.attributes_json, '$.personId'),
        employee.starts_on, employee.ends_on
      FROM slices AS employee
      JOIN company_workforce_resource_bindings AS binding ON binding.resource_type = 'employee'
        AND binding.resource_id = employee.resource_id AND binding.organization_id = NEW.id
      WHERE employee.resource_type = 'employee' AND employee.state = 'active'
    ),
    reference_boundaries AS (
      SELECT resource_type, resource_id, starts_on AS boundary_on FROM slices
      UNION SELECT resource_type, resource_id, ends_on FROM slices WHERE ends_on IS NOT NULL
    ),
    reference_points AS (
      SELECT reference_type, reference_id, starts_on AS effective_on FROM reference_intervals
      UNION
      SELECT reference.reference_type, reference.reference_id, boundary.boundary_on
      FROM reference_intervals AS reference JOIN reference_boundaries AS boundary
        ON boundary.resource_type = reference.reference_type AND boundary.resource_id = reference.reference_id
      WHERE reference.starts_on <= boundary.boundary_on
        AND (reference.ends_on IS NULL OR boundary.boundary_on < reference.ends_on)
    )
    SELECT 1 FROM reference_points AS reference
    WHERE NOT EXISTS (
      SELECT 1 FROM slices AS target
      WHERE target.resource_type = reference.reference_type AND target.resource_id = reference.reference_id
        AND target.state = 'active' AND target.starts_on <= reference.effective_on
        AND (target.ends_on IS NULL OR reference.effective_on < target.ends_on)
    )
  );
END;
CREATE TRIGGER company_organization_resource_commit_guard
BEFORE UPDATE OF revision ON company_organizations
WHEN NEW.id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'
BEGIN
  SELECT RAISE(ABORT, 'organization resource history mismatch')
  WHERE EXISTS (SELECT 1 FROM company_organization_resource_mismatches);
END;
CREATE TRIGGER company_profile_legacy_write_guard
BEFORE UPDATE OF name, representative_name ON company_organizations
WHEN (NEW.name IS NOT OLD.name OR NEW.representative_name IS NOT OLD.representative_name)
AND EXISTS (SELECT 1 FROM company_resource_heads WHERE organization_id = OLD.id AND resource_type = 'company-profile')
BEGIN
  SELECT RAISE(ABORT, 'company profile legacy write is not canonical');
END;
CREATE TRIGGER company_assignment_employment_projection_guard
BEFORE UPDATE OF revision ON company_organizations
WHEN NEW.revision != OLD.revision
BEGIN
  SELECT RAISE(ABORT, 'organization assignment employment period is not covered')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_assignment_period_versions assignment
    JOIN company_assignment_period_bindings period_binding ON period_binding.period_id = assignment.period_id
    JOIN company_assignment_resource_bindings resource_binding ON resource_binding.resource_id = period_binding.resource_id
    WHERE resource_binding.organization_id = NEW.id AND assignment.is_void = 0
      AND assignment.revision = (
        SELECT max(latest.revision) FROM company_organization_assignment_period_versions latest
        WHERE latest.period_id = assignment.period_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM company_employment_period_versions employment
        WHERE employment.period_id = assignment.employment_id
          AND employment.employee_id = assignment.employee_id AND employment.is_void = 0
          AND employment.revision = (
            SELECT max(latest.revision) FROM company_employment_period_versions latest
            WHERE latest.period_id = employment.period_id
          )
          AND employment.starts_on <= assignment.starts_on
          AND (employment.ends_on IS NULL OR
            (assignment.ends_on IS NOT NULL AND assignment.ends_on <= employment.ends_on))
      )
  );
END;
CREATE TRIGGER company_reporting_employment_commit_guard
AFTER UPDATE OF revision ON company_organizations
WHEN NOT EXISTS (
  SELECT 1 FROM company_workforce_resource_bindings binding
  JOIN company_employee_lifecycle_revisions lifecycle ON lifecycle.employee_id = binding.employee_id
  WHERE binding.organization_id = NEW.id AND binding.resource_type = 'employee'
    AND binding.lifecycle_revision != lifecycle.revision
)
BEGIN
  SELECT RAISE(ABORT, 'company reporting employment period is not covered')
  WHERE EXISTS (SELECT 1 FROM company_reporting_employment_violations WHERE organization_id = NEW.id);
END;
CREATE TRIGGER company_personnel_reporting_commit_guard
BEFORE UPDATE OF revision ON company_organizations
WHEN NEW.revision != OLD.revision AND NOT EXISTS (
  SELECT 1 FROM company_organization_change_operations WHERE status = 'PENDING'
)
BEGIN
  SELECT RAISE(ABORT, 'company personnel reporting assignment period is not covered')
  WHERE EXISTS (
    SELECT 1 FROM company_personnel_reporting_periods reporting
    WHERE NOT EXISTS (
      SELECT 1 FROM company_personnel_reporting_assignment_coverage assignment
      WHERE assignment.employee_id = reporting.employee_id AND assignment.employment_id = reporting.employment_id
        AND assignment.organization_unit_id = reporting.organization_unit_id
        AND assignment.assignment_type = reporting.assignment_type
        AND assignment.starts_on <= reporting.starts_on
        AND (assignment.ends_on IS NULL OR
          (reporting.ends_on IS NOT NULL AND reporting.ends_on <= assignment.ends_on))
    )
  );
END;
CREATE TRIGGER company_account_employee_resource_commit_guard
AFTER UPDATE OF revision ON company_organizations
BEGIN
  SELECT RAISE(ABORT, 'company account link employee is not connected') WHERE EXISTS (
    SELECT 1 FROM company_resource_heads resource
    WHERE resource.organization_id = NEW.id AND resource.resource_type = 'account-employee-link'
      AND NOT EXISTS (SELECT 1 FROM company_workforce_resource_bindings employee
        WHERE employee.organization_id = resource.organization_id AND employee.resource_type = 'employee'
          AND employee.resource_id = json_extract(resource.attributes_json, '$.employeeId'))
  );
  INSERT INTO company_account_employee_links (account_id, employee_id)
  SELECT json_extract(resource.attributes_json, '$.accountId'), json_extract(resource.attributes_json, '$.employeeId')
  FROM company_resource_heads resource WHERE resource.organization_id = NEW.id
    AND resource.resource_type = 'account-employee-link'
    AND NOT EXISTS (SELECT 1 FROM company_account_employee_links original
      WHERE original.account_id = json_extract(resource.attributes_json, '$.accountId'));
  INSERT INTO company_account_employee_resource_bindings
    (resource_id, organization_id, account_id, employee_id, recorded_at)
  SELECT resource_id, organization_id, json_extract(attributes_json, '$.accountId'),
    json_extract(attributes_json, '$.employeeId'), updated_at
  FROM company_resource_heads resource WHERE resource.organization_id = NEW.id
    AND resource.resource_type = 'account-employee-link'
    AND NOT EXISTS (SELECT 1 FROM company_account_employee_resource_bindings binding WHERE binding.resource_id = resource.resource_id);
  SELECT RAISE(ABORT, 'company account link period is not covered') WHERE EXISTS (
    SELECT 1 FROM company_account_employee_link_period_violations
  );
END;
CREATE TRIGGER company_governance_organization_revision_guard
BEFORE UPDATE OF revision ON company_organizations
WHEN EXISTS (
  SELECT 1 FROM company_governance_organization_reference_violations violation
  WHERE violation.organization_id = NEW.id
)
BEGIN
  SELECT RAISE(ABORT, 'company_governance_organization_reference_invalid');
END;
CREATE TRIGGER company_employment_authority_commit_guard
AFTER UPDATE OF revision ON company_organizations
WHEN NOT EXISTS (
  SELECT 1 FROM company_workforce_resource_bindings binding
  JOIN company_employee_lifecycle_revisions lifecycle ON lifecycle.employee_id = binding.employee_id
  WHERE binding.organization_id = NEW.id AND binding.resource_type = 'employee'
    AND binding.lifecycle_revision != lifecycle.revision
)
BEGIN
  SELECT RAISE(ABORT, 'company_employment_authority_period_not_covered')
  WHERE EXISTS (SELECT 1 FROM company_employment_authority_violations WHERE organization_id = NEW.id);
END;
CREATE TRIGGER company_organization_resource_operation_commit_guard
BEFORE UPDATE OF revision ON company_organizations
WHEN NEW.revision != OLD.revision
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is incomplete')
  WHERE EXISTS (
    SELECT 1 FROM company_command_receipts receipt
    JOIN company_organization_change_operations operation
      ON operation.id = 'org-resource:' || receipt.fingerprint
    WHERE receipt.organization_id = NEW.id AND receipt.organization_revision = NEW.revision
      AND operation.status != 'COMPLETED'
  );
END;
CREATE TRIGGER company_responsibility_source_revision_guard
BEFORE UPDATE OF revision ON company_organizations
WHEN NOT EXISTS (
  SELECT 1 FROM company_workforce_resource_bindings binding
  JOIN company_employee_lifecycle_revisions lifecycle ON lifecycle.employee_id = binding.employee_id
  WHERE binding.organization_id = NEW.id AND binding.resource_type = 'employee' AND binding.lifecycle_revision != lifecycle.revision
)
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility public source is stale')
  WHERE EXISTS (SELECT 1 FROM company_responsibility_source_mismatches WHERE organization_id = NEW.id);
END;
CREATE TRIGGER company_responsibility_assignment_revision_guard
BEFORE UPDATE OF revision ON company_organizations
WHEN NOT EXISTS (
  SELECT 1 FROM company_workforce_resource_bindings binding
  JOIN company_employee_lifecycle_revisions lifecycle ON lifecycle.employee_id = binding.employee_id
  WHERE binding.organization_id = NEW.id AND binding.resource_type = 'employee' AND binding.lifecycle_revision != lifecycle.revision
)
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility assignment periods overlap')
  WHERE EXISTS (SELECT 1 FROM company_responsibility_assignment_overlaps WHERE organization_id = NEW.id);
END;
CREATE TRIGGER company_governance_reference_period_commit_guard
BEFORE UPDATE OF revision ON company_organizations
BEGIN
  SELECT RAISE(ABORT, 'company_governance_reference_period_not_covered')
  WHERE EXISTS (SELECT 1 FROM company_governance_reference_period_violations WHERE organization_id = NEW.id);
END;
CREATE TRIGGER company_place_reference_period_commit_guard
BEFORE UPDATE OF revision ON company_organizations
BEGIN
  SELECT RAISE(ABORT, 'company_place_reference_period_not_covered')
  WHERE EXISTS (SELECT 1 FROM company_place_reference_period_violations WHERE organization_id = NEW.id);
END;
CREATE TRIGGER company_reporting_reference_period_commit_guard
BEFORE UPDATE OF revision ON company_organizations
WHEN NEW.revision != OLD.revision
BEGIN
  SELECT RAISE(ABORT, 'company_reporting_reference_period_not_covered')
  WHERE EXISTS (SELECT 1 FROM company_reporting_reference_period_violations WHERE organization_id = NEW.id);
END;
CREATE TRIGGER company_grade_assignment_commit_guard
BEFORE UPDATE OF revision ON company_organizations
WHEN NEW.revision != OLD.revision
BEGIN
  SELECT RAISE(ABORT, 'company_grade_assignment_invalid') WHERE EXISTS (
    SELECT 1 FROM company_grade_assignment_violations WHERE organization_id = NEW.id
  );
END;
CREATE TRIGGER company_employment_employer_commit_guard
BEFORE UPDATE OF revision ON company_organizations
BEGIN
  SELECT RAISE(ABORT, 'company_employment_employer_reference_invalid')
  WHERE EXISTS (
    SELECT 1 FROM company_employment_employer_reference_violations WHERE organization_id = NEW.id
  );
END;
CREATE TRIGGER company_organizations_legacy_id_insert
BEFORE INSERT ON company_organizations
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER company_organizations_identity_update
BEFORE UPDATE OF id, legacy_id ON company_organizations
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_organization_units
CREATE TABLE company_organization_units (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO company_organization_units (id, created_at, legacy_id)
SELECT map.new_id,
       source.created_at,
       CASE WHEN map.old_id IS NOT map.new_id THEN source.id END
FROM "_stage_company_organization_units" source
INNER JOIN _company_organization_units_id_map map ON map.old_id = source.id;
INSERT INTO _company_organization_uuid_validation
SELECT 'company_organization_units',
       (SELECT count(*) FROM "_stage_company_organization_units"),
       (SELECT count(*) FROM company_organization_units),
       0,
       (SELECT count(*) FROM company_organization_units WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'company' AND revision = 1);
DROP TABLE "_stage_company_organization_units";
CREATE TRIGGER company_organization_units_immutable_delete
BEFORE DELETE ON company_organization_units
BEGIN
  SELECT RAISE(ABORT, 'organization unit identity is append only');
END;
CREATE TRIGGER company_organization_units_immutable_update
BEFORE UPDATE ON company_organization_units
BEGIN
  SELECT RAISE(ABORT, 'organization unit identity is immutable');
END;
CREATE TRIGGER company_organization_units_legacy_id_insert
BEFORE INSERT ON company_organization_units
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER company_organization_units_identity_update
BEFORE UPDATE OF id, legacy_id ON company_organization_units
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
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
SELECT source.id,
       source.period_id,
       source.revision,
       CASE WHEN source.organization_unit_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _company_organization_units_id_map ref WHERE ref.old_id = source.organization_unit_id), CAST(source.organization_unit_id AS TEXT)) END,
       source.code,
       source.official_name,
       source.kind,
       CASE WHEN source.parent_organization_unit_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _company_organization_units_id_map ref WHERE ref.old_id = source.parent_organization_unit_id), CAST(source.parent_organization_unit_id AS TEXT)) END,
       source.starts_on,
       source.ends_on,
       source.is_void,
       source.recorded_by_action_id,
       source.recorded_at
FROM "_stage_company_organization_unit_period_versions" source;
INSERT INTO _company_organization_uuid_validation
SELECT 'company_organization_unit_period_versions',
       (SELECT count(*) FROM "_stage_company_organization_unit_period_versions"),
       (SELECT count(*) FROM company_organization_unit_period_versions),
       0,
       0,
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
SELECT source.id,
       source.period_id,
       source.revision,
       source.employment_id,
       source.employee_id,
       CASE WHEN source.organization_unit_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _company_organization_units_id_map ref WHERE ref.old_id = source.organization_unit_id), CAST(source.organization_unit_id AS TEXT)) END,
       source.assignment_type,
       source.position_title,
       source.manager_employee_id,
       source.starts_on,
       source.ends_on,
       source.is_void,
       source.recorded_by_action_id,
       source.recorded_at
FROM "_stage_company_organization_assignment_period_versions" source;
INSERT INTO _company_organization_uuid_validation
SELECT 'company_organization_assignment_period_versions',
       (SELECT count(*) FROM "_stage_company_organization_assignment_period_versions"),
       (SELECT count(*) FROM company_organization_assignment_period_versions),
       0,
       0,
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
SELECT source.id,
       source.period_id,
       source.revision,
       source.employment_id,
       source.employee_id,
       CASE WHEN source.organization_unit_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _company_organization_units_id_map ref WHERE ref.old_id = source.organization_unit_id), CAST(source.organization_unit_id AS TEXT)) END,
       source.responsibility_type,
       source.starts_on,
       source.ends_on,
       source.is_void,
       source.recorded_by_action_id,
       source.recorded_at
FROM "_stage_company_organization_responsibility_period_versions" source;
INSERT INTO _company_organization_uuid_validation
SELECT 'company_organization_responsibility_period_versions',
       (SELECT count(*) FROM "_stage_company_organization_responsibility_period_versions"),
       (SELECT count(*) FROM company_organization_responsibility_period_versions),
       0,
       0,
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
SELECT source.id,
       CASE WHEN source.organization_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _company_organizations_id_map ref WHERE ref.old_id = source.organization_id), CAST(source.organization_id AS TEXT)) END,
       source.command_id,
       source.fingerprint,
       source.expected_revision,
       source.organization_revision,
       source.recorded_at
FROM "_stage_company_command_receipts" source;
INSERT INTO _company_organization_uuid_validation
SELECT 'company_command_receipts',
       (SELECT count(*) FROM "_stage_company_command_receipts"),
       (SELECT count(*) FROM company_command_receipts),
       0,
       0,
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
SELECT source.id,
       CASE WHEN source.organization_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _company_organizations_id_map ref WHERE ref.old_id = source.organization_id), CAST(source.organization_id AS TEXT)) END,
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
INSERT INTO _company_organization_uuid_validation
SELECT 'company_resource_heads',
       (SELECT count(*) FROM "_stage_company_resource_heads"),
       (SELECT count(*) FROM company_resource_heads),
       0,
       0,
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'company' AND revision = 1);
DROP TABLE "_stage_company_resource_heads";
UPDATE company_resource_heads SET attributes_json = json_set(attributes_json, '$.organizationId', (SELECT map.new_id FROM _company_organizations_id_map map WHERE map.old_id = json_extract(company_resource_heads.attributes_json, '$.organizationId')))
WHERE json_type(attributes_json, '$.organizationId') = 'text'
  AND EXISTS (SELECT 1 FROM _company_organizations_id_map map WHERE map.old_id = json_extract(company_resource_heads.attributes_json, '$.organizationId') AND map.new_id IS NOT map.old_id);
UPDATE company_resource_heads SET attributes_json = json_set(attributes_json, '$.organizationUnitId', (SELECT map.new_id FROM _company_organization_units_id_map map WHERE map.old_id = json_extract(company_resource_heads.attributes_json, '$.organizationUnitId')))
WHERE json_type(attributes_json, '$.organizationUnitId') = 'text'
  AND EXISTS (SELECT 1 FROM _company_organization_units_id_map map WHERE map.old_id = json_extract(company_resource_heads.attributes_json, '$.organizationUnitId') AND map.new_id IS NOT map.old_id);
UPDATE company_resource_heads SET attributes_json = json_set(attributes_json, '$.parentOrganizationUnitId', (SELECT map.new_id FROM _company_organization_units_id_map map WHERE map.old_id = json_extract(company_resource_heads.attributes_json, '$.parentOrganizationUnitId')))
WHERE json_type(attributes_json, '$.parentOrganizationUnitId') = 'text'
  AND EXISTS (SELECT 1 FROM _company_organization_units_id_map map WHERE map.old_id = json_extract(company_resource_heads.attributes_json, '$.parentOrganizationUnitId') AND map.new_id IS NOT map.old_id);
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
SELECT source.id,
       CASE WHEN source.organization_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _company_organizations_id_map ref WHERE ref.old_id = source.organization_id), CAST(source.organization_id AS TEXT)) END,
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
INSERT INTO _company_organization_uuid_validation
SELECT 'company_resource_revisions',
       (SELECT count(*) FROM "_stage_company_resource_revisions"),
       (SELECT count(*) FROM company_resource_revisions),
       0,
       0,
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'company' AND revision = 1);
DROP TABLE "_stage_company_resource_revisions";
UPDATE company_resource_revisions SET attributes_json = json_set(attributes_json, '$.organizationId', (SELECT map.new_id FROM _company_organizations_id_map map WHERE map.old_id = json_extract(company_resource_revisions.attributes_json, '$.organizationId')))
WHERE json_type(attributes_json, '$.organizationId') = 'text'
  AND EXISTS (SELECT 1 FROM _company_organizations_id_map map WHERE map.old_id = json_extract(company_resource_revisions.attributes_json, '$.organizationId') AND map.new_id IS NOT map.old_id);
UPDATE company_resource_revisions SET attributes_json = json_set(attributes_json, '$.organizationUnitId', (SELECT map.new_id FROM _company_organization_units_id_map map WHERE map.old_id = json_extract(company_resource_revisions.attributes_json, '$.organizationUnitId')))
WHERE json_type(attributes_json, '$.organizationUnitId') = 'text'
  AND EXISTS (SELECT 1 FROM _company_organization_units_id_map map WHERE map.old_id = json_extract(company_resource_revisions.attributes_json, '$.organizationUnitId') AND map.new_id IS NOT map.old_id);
UPDATE company_resource_revisions SET attributes_json = json_set(attributes_json, '$.parentOrganizationUnitId', (SELECT map.new_id FROM _company_organization_units_id_map map WHERE map.old_id = json_extract(company_resource_revisions.attributes_json, '$.parentOrganizationUnitId')))
WHERE json_type(attributes_json, '$.parentOrganizationUnitId') = 'text'
  AND EXISTS (SELECT 1 FROM _company_organization_units_id_map map WHERE map.old_id = json_extract(company_resource_revisions.attributes_json, '$.parentOrganizationUnitId') AND map.new_id IS NOT map.old_id);
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
    NEW.organization_id != 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'
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

-- company_workforce_resource_bindings
CREATE TABLE company_workforce_resource_bindings (
  resource_type TEXT NOT NULL CHECK (resource_type IN ('employee', 'employment')),
  resource_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  employee_id TEXT NOT NULL REFERENCES company_employees(id) ON DELETE RESTRICT,
  resource_revision INTEGER NOT NULL CHECK (resource_revision > 0),
  lifecycle_revision INTEGER NOT NULL CHECK (lifecycle_revision >= 0),
  last_action_id TEXT,
  PRIMARY KEY (resource_type, resource_id),
  FOREIGN KEY (organization_id, resource_type, resource_id)
    REFERENCES company_resource_heads(organization_id, resource_type, resource_id)
    ON DELETE RESTRICT,
  CHECK (resource_type != 'employee' OR resource_id = employee_id)
);
INSERT INTO company_workforce_resource_bindings (resource_type, resource_id, organization_id, employee_id, resource_revision, lifecycle_revision, last_action_id)
SELECT source.resource_type,
       source.resource_id,
       CASE WHEN source.organization_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _company_organizations_id_map ref WHERE ref.old_id = source.organization_id), CAST(source.organization_id AS TEXT)) END,
       source.employee_id,
       source.resource_revision,
       source.lifecycle_revision,
       source.last_action_id
FROM "_stage_company_workforce_resource_bindings" source;
INSERT INTO _company_organization_uuid_validation
SELECT 'company_workforce_resource_bindings',
       (SELECT count(*) FROM "_stage_company_workforce_resource_bindings"),
       (SELECT count(*) FROM company_workforce_resource_bindings),
       0,
       0,
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'company' AND revision = 1);
DROP TABLE "_stage_company_workforce_resource_bindings";
CREATE INDEX company_workforce_resource_bindings_employee_idx
  ON company_workforce_resource_bindings(employee_id, resource_type);
CREATE TRIGGER company_reporting_employment_projection_guard
AFTER UPDATE OF lifecycle_revision ON company_workforce_resource_bindings
WHEN NEW.resource_type = 'employee' AND NEW.lifecycle_revision = (
  SELECT revision FROM company_employee_lifecycle_revisions WHERE employee_id = NEW.employee_id
)
BEGIN
  SELECT RAISE(ABORT, 'company reporting employment period is not covered')
  WHERE EXISTS (SELECT 1 FROM company_reporting_employment_violations
    WHERE organization_id = NEW.organization_id AND employee_id = NEW.employee_id);
END;
CREATE TRIGGER company_employment_authority_projection_guard
AFTER UPDATE OF lifecycle_revision ON company_workforce_resource_bindings
WHEN NEW.resource_type = 'employee' AND NEW.lifecycle_revision = (
  SELECT revision FROM company_employee_lifecycle_revisions WHERE employee_id = NEW.employee_id
) AND NOT EXISTS (
  SELECT 1 FROM company_resource_revisions resource
  JOIN company_organizations organization ON organization.id = resource.organization_id
  WHERE resource.organization_id = NEW.organization_id AND resource.organization_revision > organization.revision
)
BEGIN
  SELECT RAISE(ABORT, 'company_employment_authority_period_not_covered')
  WHERE EXISTS (SELECT 1 FROM company_employment_authority_violations
    WHERE organization_id = NEW.organization_id AND employee_id = NEW.employee_id);
END;
CREATE TRIGGER company_responsibility_lifecycle_completion_guard
AFTER UPDATE OF lifecycle_revision ON company_workforce_resource_bindings
WHEN NEW.resource_type = 'employee' AND NEW.lifecycle_revision != OLD.lifecycle_revision
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility public source is stale')
  WHERE EXISTS (
    SELECT 1 FROM company_responsibility_source_mismatches mismatch
    JOIN company_responsibility_resource_bindings source ON source.resource_id = mismatch.resource_id
    WHERE source.employee_id = NEW.employee_id AND source.organization_id = NEW.organization_id
  );
END;
CREATE TRIGGER company_responsibility_assignment_lifecycle_guard
AFTER UPDATE OF lifecycle_revision ON company_workforce_resource_bindings
WHEN NEW.resource_type = 'employee' AND NEW.lifecycle_revision != OLD.lifecycle_revision
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility assignment periods overlap')
  WHERE EXISTS (SELECT 1 FROM company_responsibility_assignment_overlaps
    WHERE organization_id = NEW.organization_id AND holder_type = 'employee' AND holder_id = NEW.employee_id);
END;

-- company_account_employee_resource_bindings
CREATE TABLE company_account_employee_resource_bindings (
  resource_id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL DEFAULT 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d' CHECK (organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'),
  resource_type TEXT NOT NULL DEFAULT 'account-employee-link' CHECK (resource_type = 'account-employee-link'),
  account_id TEXT NOT NULL UNIQUE REFERENCES system_accounts(id) ON DELETE RESTRICT,
  employee_id TEXT NOT NULL UNIQUE REFERENCES company_employees(id) ON DELETE RESTRICT,
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  FOREIGN KEY (organization_id, resource_type, resource_id)
    REFERENCES company_resource_heads(organization_id, resource_type, resource_id) ON DELETE RESTRICT
);
INSERT INTO company_account_employee_resource_bindings (resource_id, organization_id, resource_type, account_id, employee_id, recorded_at)
SELECT source.resource_id,
       CASE WHEN source.organization_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _company_organizations_id_map ref WHERE ref.old_id = source.organization_id), CAST(source.organization_id AS TEXT)) END,
       source.resource_type,
       source.account_id,
       source.employee_id,
       source.recorded_at
FROM "_stage_company_account_employee_resource_bindings" source;
INSERT INTO _company_organization_uuid_validation
SELECT 'company_account_employee_resource_bindings',
       (SELECT count(*) FROM "_stage_company_account_employee_resource_bindings"),
       (SELECT count(*) FROM company_account_employee_resource_bindings),
       0,
       0,
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'company' AND revision = 1);
DROP TABLE "_stage_company_account_employee_resource_bindings";
CREATE TRIGGER company_account_employee_resource_bindings_update_guard
BEFORE UPDATE ON company_account_employee_resource_bindings
BEGIN
  SELECT RAISE(ABORT, 'company account link bindings are immutable');
END;
CREATE TRIGGER company_account_employee_resource_bindings_delete_guard
BEFORE DELETE ON company_account_employee_resource_bindings
BEGIN
  SELECT RAISE(ABORT, 'company account link bindings are immutable');
END;

-- company_assignment_resource_bindings
CREATE TABLE company_assignment_resource_bindings (
  resource_id TEXT PRIMARY KEY NOT NULL CHECK (length(resource_id) BETWEEN 1 AND 255),
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT CHECK (organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'),
  employee_id TEXT NOT NULL REFERENCES company_employees(id) ON DELETE RESTRICT,
  resource_revision INTEGER NOT NULL CHECK (resource_revision >= 1),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0)
);
INSERT INTO company_assignment_resource_bindings (resource_id, organization_id, employee_id, resource_revision, recorded_at)
SELECT source.resource_id,
       CASE WHEN source.organization_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _company_organizations_id_map ref WHERE ref.old_id = source.organization_id), CAST(source.organization_id AS TEXT)) END,
       source.employee_id,
       source.resource_revision,
       source.recorded_at
FROM "_stage_company_assignment_resource_bindings" source;
INSERT INTO _company_organization_uuid_validation
SELECT 'company_assignment_resource_bindings',
       (SELECT count(*) FROM "_stage_company_assignment_resource_bindings"),
       (SELECT count(*) FROM company_assignment_resource_bindings),
       0,
       0,
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'company' AND revision = 1);
DROP TABLE "_stage_company_assignment_resource_bindings";
CREATE INDEX company_assignment_resource_bindings_employee_idx ON company_assignment_resource_bindings(employee_id);
CREATE TRIGGER company_assignment_resource_bindings_update_guard
BEFORE UPDATE ON company_assignment_resource_bindings
WHEN NEW.resource_id != OLD.resource_id OR NEW.organization_id != OLD.organization_id
  OR NEW.employee_id != OLD.employee_id OR NEW.resource_revision < OLD.resource_revision
BEGIN
  SELECT RAISE(ABORT, 'organization assignment source identity is immutable');
END;
CREATE TRIGGER company_assignment_resource_bindings_delete_guard
BEFORE DELETE ON company_assignment_resource_bindings
BEGIN
  SELECT RAISE(ABORT, 'organization assignment source identity is immutable');
END;

-- company_responsibility_resource_bindings
CREATE TABLE company_responsibility_resource_bindings (
  resource_id TEXT PRIMARY KEY NOT NULL CHECK (length(resource_id) BETWEEN 1 AND 255),
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT CHECK (organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'),
  employee_id TEXT NOT NULL REFERENCES company_employees(id) ON DELETE RESTRICT,
  employment_id TEXT NOT NULL REFERENCES company_employments(id) ON DELETE RESTRICT,
  organization_unit_id TEXT NOT NULL REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  responsibility_type TEXT NOT NULL CHECK (length(responsibility_type) BETWEEN 1 AND 100),
  responsibility_id TEXT NOT NULL,
  authority_scope_id TEXT NOT NULL,
  resource_revision INTEGER NOT NULL CHECK (resource_revision >= 1),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0)
);
INSERT INTO company_responsibility_resource_bindings (resource_id, organization_id, employee_id, employment_id, organization_unit_id, responsibility_type, responsibility_id, authority_scope_id, resource_revision, recorded_at)
SELECT source.resource_id,
       CASE WHEN source.organization_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _company_organizations_id_map ref WHERE ref.old_id = source.organization_id), CAST(source.organization_id AS TEXT)) END,
       source.employee_id,
       source.employment_id,
       CASE WHEN source.organization_unit_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _company_organization_units_id_map ref WHERE ref.old_id = source.organization_unit_id), CAST(source.organization_unit_id AS TEXT)) END,
       source.responsibility_type,
       source.responsibility_id,
       source.authority_scope_id,
       source.resource_revision,
       source.recorded_at
FROM "_stage_company_responsibility_resource_bindings" source;
INSERT INTO _company_organization_uuid_validation
SELECT 'company_responsibility_resource_bindings',
       (SELECT count(*) FROM "_stage_company_responsibility_resource_bindings"),
       (SELECT count(*) FROM company_responsibility_resource_bindings),
       0,
       0,
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'company' AND revision = 1);
DROP TABLE "_stage_company_responsibility_resource_bindings";
CREATE INDEX company_responsibility_resource_bindings_employee_idx ON company_responsibility_resource_bindings(employee_id);
CREATE TRIGGER company_responsibility_resource_binding_update_guard
BEFORE UPDATE ON company_responsibility_resource_bindings
WHEN NEW.resource_id != OLD.resource_id OR NEW.organization_id != OLD.organization_id
  OR NEW.employee_id != OLD.employee_id OR NEW.employment_id != OLD.employment_id
  OR NEW.organization_unit_id != OLD.organization_unit_id OR NEW.responsibility_type != OLD.responsibility_type
  OR NEW.responsibility_id != OLD.responsibility_id OR NEW.authority_scope_id != OLD.authority_scope_id
  OR NEW.resource_revision < OLD.resource_revision
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility source identity is immutable');
END;
CREATE TRIGGER company_responsibility_resource_binding_delete_guard
BEFORE DELETE ON company_responsibility_resource_bindings
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility source identity is immutable');
END;

-- company_personnel_reporting_bindings
CREATE TABLE company_personnel_reporting_bindings (
  resource_id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL DEFAULT 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d' CHECK (organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'),
  resource_type TEXT NOT NULL DEFAULT 'reporting-relation' CHECK (resource_type = 'reporting-relation'),
  employee_id TEXT NOT NULL REFERENCES company_employees(id) ON DELETE RESTRICT,
  employment_id TEXT NOT NULL REFERENCES company_employments(id) ON DELETE RESTRICT,
  organization_unit_id TEXT NOT NULL REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('PRIMARY', 'CONCURRENT')),
  recorded_by_action_id TEXT REFERENCES company_personnel_actions(id) ON DELETE RESTRICT,
  recorded_by_adoption_id TEXT REFERENCES company_assignment_resource_adoptions(command_id) ON DELETE RESTRICT,
  CHECK ((recorded_by_action_id IS NULL) != (recorded_by_adoption_id IS NULL)),
  UNIQUE (employee_id, employment_id, organization_unit_id, assignment_type),
  FOREIGN KEY (organization_id, resource_type, resource_id)
    REFERENCES company_resource_heads(organization_id, resource_type, resource_id) ON DELETE RESTRICT
);
INSERT INTO company_personnel_reporting_bindings (resource_id, organization_id, resource_type, employee_id, employment_id, organization_unit_id, assignment_type, recorded_by_action_id, recorded_by_adoption_id)
SELECT source.resource_id,
       CASE WHEN source.organization_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _company_organizations_id_map ref WHERE ref.old_id = source.organization_id), CAST(source.organization_id AS TEXT)) END,
       source.resource_type,
       source.employee_id,
       source.employment_id,
       CASE WHEN source.organization_unit_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _company_organization_units_id_map ref WHERE ref.old_id = source.organization_unit_id), CAST(source.organization_unit_id AS TEXT)) END,
       source.assignment_type,
       source.recorded_by_action_id,
       source.recorded_by_adoption_id
FROM "_stage_company_personnel_reporting_bindings" source;
INSERT INTO _company_organization_uuid_validation
SELECT 'company_personnel_reporting_bindings',
       (SELECT count(*) FROM "_stage_company_personnel_reporting_bindings"),
       (SELECT count(*) FROM company_personnel_reporting_bindings),
       0,
       0,
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'company' AND revision = 1);
DROP TABLE "_stage_company_personnel_reporting_bindings";
CREATE TRIGGER company_personnel_reporting_binding_update_guard
BEFORE UPDATE ON company_personnel_reporting_bindings
BEGIN
  SELECT RAISE(ABORT, 'company personnel reporting binding is immutable');
END;
CREATE TRIGGER company_personnel_reporting_binding_delete_guard
BEFORE DELETE ON company_personnel_reporting_bindings
BEGIN
  SELECT RAISE(ABORT, 'company personnel reporting binding is immutable');
END;
CREATE TRIGGER company_personnel_reporting_binding_insert_guard
BEFORE INSERT ON company_personnel_reporting_bindings
BEGIN
  SELECT RAISE(ABORT, 'company personnel reporting owner does not match')
  WHERE NOT EXISTS (
    SELECT 1 FROM company_resource_heads resource
    JOIN company_employments employment ON employment.id = NEW.employment_id
    WHERE resource.organization_id = NEW.organization_id AND resource.resource_type = 'reporting-relation'
      AND resource.resource_id = NEW.resource_id AND employment.employee_id = NEW.employee_id
      AND json_extract(resource.attributes_json, '$.employeeId') = NEW.employee_id
      AND json_extract(resource.attributes_json, '$.organizationUnitId') = NEW.organization_unit_id
  );
END;
CREATE TRIGGER company_personnel_reporting_coverage_insert_guard
AFTER INSERT ON company_personnel_reporting_bindings
BEGIN
  SELECT RAISE(ABORT, 'company personnel reporting assignment period is not covered')
  WHERE EXISTS (
    SELECT 1 FROM company_personnel_reporting_periods reporting
    WHERE NOT EXISTS (
      SELECT 1 FROM company_personnel_reporting_assignment_coverage assignment
      WHERE assignment.employee_id = reporting.employee_id AND assignment.employment_id = reporting.employment_id
        AND assignment.organization_unit_id = reporting.organization_unit_id
        AND assignment.assignment_type = reporting.assignment_type
        AND assignment.starts_on <= reporting.starts_on
        AND (assignment.ends_on IS NULL OR
          (reporting.ends_on IS NOT NULL AND reporting.ends_on <= assignment.ends_on))
    )
  );
END;

-- company_organization_resource_bindings
CREATE TABLE company_organization_resource_bindings (
  organization_unit_id TEXT PRIMARY KEY NOT NULL REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT CHECK (organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0)
);
INSERT INTO company_organization_resource_bindings (organization_unit_id, organization_id, recorded_at)
SELECT CASE WHEN source.organization_unit_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _company_organization_units_id_map ref WHERE ref.old_id = source.organization_unit_id), CAST(source.organization_unit_id AS TEXT)) END,
       CASE WHEN source.organization_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _company_organizations_id_map ref WHERE ref.old_id = source.organization_id), CAST(source.organization_id AS TEXT)) END,
       source.recorded_at
FROM "_stage_company_organization_resource_bindings" source;
INSERT INTO _company_organization_uuid_validation
SELECT 'company_organization_resource_bindings',
       (SELECT count(*) FROM "_stage_company_organization_resource_bindings"),
       (SELECT count(*) FROM company_organization_resource_bindings),
       0,
       0,
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'company' AND revision = 1);
DROP TABLE "_stage_company_organization_resource_bindings";
CREATE TRIGGER company_organization_resource_bindings_no_update
BEFORE UPDATE ON company_organization_resource_bindings
BEGIN
  SELECT RAISE(ABORT, 'organization resource connection is immutable');
END;
CREATE TRIGGER company_organization_resource_bindings_no_delete
BEFORE DELETE ON company_organization_resource_bindings
BEGIN
  SELECT RAISE(ABORT, 'organization resource connection is immutable');
END;
CREATE TRIGGER company_organization_resource_binding_guard
AFTER INSERT ON company_organization_resource_bindings
WHEN 1
BEGIN
  SELECT RAISE(ABORT, 'organization resource history mismatch')
  WHERE EXISTS (SELECT 1 FROM company_organization_resource_mismatches WHERE organization_unit_id = NEW.organization_unit_id) OR NOT EXISTS (SELECT 1 FROM company_organization_unit_period_versions WHERE organization_unit_id = NEW.organization_unit_id);
END;

-- company_definition_resource_adoptions
CREATE TABLE company_definition_resource_adoptions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  organization_id TEXT NOT NULL DEFAULT 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d' CHECK (organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'),
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
SELECT source.id,
       CASE WHEN source.organization_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _company_organizations_id_map ref WHERE ref.old_id = source.organization_id), CAST(source.organization_id AS TEXT)) END,
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
INSERT INTO _company_organization_uuid_validation
SELECT 'company_definition_resource_adoptions',
       (SELECT count(*) FROM "_stage_company_definition_resource_adoptions"),
       (SELECT count(*) FROM company_definition_resource_adoptions),
       0,
       0,
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
SELECT source.id,
       CASE WHEN source.organization_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _company_organizations_id_map ref WHERE ref.old_id = source.organization_id), CAST(source.organization_id AS TEXT)) END,
       source.command_id,
       source.fingerprint,
       source.actor_account_id,
       source.organization_revision,
       source.declaration_json,
       source.source_json,
       source.recorded_at
FROM "_stage_company_profile_change_receipts" source;
INSERT INTO _company_organization_uuid_validation
SELECT 'company_profile_change_receipts',
       (SELECT count(*) FROM "_stage_company_profile_change_receipts"),
       (SELECT count(*) FROM company_profile_change_receipts),
       0,
       0,
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
SELECT source.id,
       source.command_id,
       CASE WHEN source.organization_unit_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _company_organization_units_id_map ref WHERE ref.old_id = source.organization_unit_id), CAST(source.organization_unit_id AS TEXT)) END,
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
INSERT INTO _company_organization_uuid_validation
SELECT 'company_organization_resource_adoptions',
       (SELECT count(*) FROM "_stage_company_organization_resource_adoptions"),
       (SELECT count(*) FROM company_organization_resource_adoptions),
       0,
       0,
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

-- company_responsibility_source_adoptions
CREATE TABLE company_responsibility_source_adoptions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  organization_id TEXT NOT NULL DEFAULT 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'
    CHECK (organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'),
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
SELECT source.id,
       CASE WHEN source.organization_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _company_organizations_id_map ref WHERE ref.old_id = source.organization_id), CAST(source.organization_id AS TEXT)) END,
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
INSERT INTO _company_organization_uuid_validation
SELECT 'company_responsibility_source_adoptions',
       (SELECT count(*) FROM "_stage_company_responsibility_source_adoptions"),
       (SELECT count(*) FROM company_responsibility_source_adoptions),
       0,
       0,
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
  organization_id TEXT NOT NULL DEFAULT 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'
    CHECK (organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'),
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
SELECT source.id,
       CASE WHEN source.organization_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _company_organizations_id_map ref WHERE ref.old_id = source.organization_id), CAST(source.organization_id AS TEXT)) END,
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
INSERT INTO _company_organization_uuid_validation
SELECT 'company_responsibility_source_cutovers',
       (SELECT count(*) FROM "_stage_company_responsibility_source_cutovers"),
       (SELECT count(*) FROM company_responsibility_source_cutovers),
       0,
       0,
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
  organization_id TEXT NOT NULL UNIQUE REFERENCES company_organizations(id) CHECK (organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'),
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
SELECT source.id,
       source.command_id,
       CASE WHEN source.organization_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _company_organizations_id_map ref WHERE ref.old_id = source.organization_id), CAST(source.organization_id AS TEXT)) END,
       source.actor_account_id,
       source.fingerprint,
       source.employee_id,
       source.organization_revision,
       source.declaration_json,
       source.source_json,
       source.recorded_at
FROM "_stage_company_bootstrap_receipts" source;
INSERT INTO _company_organization_uuid_validation
SELECT 'company_bootstrap_receipts',
       (SELECT count(*) FROM "_stage_company_bootstrap_receipts"),
       (SELECT count(*) FROM company_bootstrap_receipts),
       0,
       0,
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
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) CHECK (organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'),
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
SELECT source.id,
       CASE WHEN source.organization_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _company_organizations_id_map ref WHERE ref.old_id = source.organization_id), CAST(source.organization_id AS TEXT)) END,
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
INSERT INTO _company_organization_uuid_validation
SELECT 'company_grade_award_archives',
       (SELECT count(*) FROM "_stage_company_grade_award_archives"),
       (SELECT count(*) FROM company_grade_award_archives),
       0,
       0,
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
SELECT source.id,
       CASE WHEN source.organization_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _company_organizations_id_map ref WHERE ref.old_id = source.organization_id), CAST(source.organization_id AS TEXT)) END,
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
INSERT INTO _company_organization_uuid_validation
SELECT 'company_external_identity_imports',
       (SELECT count(*) FROM "_stage_company_external_identity_imports"),
       (SELECT count(*) FROM company_external_identity_imports),
       0,
       0,
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

-- company_external_identity_sources
CREATE TABLE company_external_identity_sources (
  identity_id TEXT PRIMARY KEY NOT NULL REFERENCES system_identity_bindings(id) ON DELETE RESTRICT,
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT,
  source_revision INTEGER NOT NULL CHECK (source_revision > 0),
  source_digest TEXT NOT NULL CHECK (length(source_digest) = 64 AND source_digest NOT GLOB '*[^0-9a-f]*'),
  updated_at INTEGER NOT NULL CHECK (updated_at >= 0)
);
INSERT INTO company_external_identity_sources (identity_id, organization_id, source_revision, source_digest, updated_at)
SELECT source.identity_id,
       CASE WHEN source.organization_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _company_organizations_id_map ref WHERE ref.old_id = source.organization_id), CAST(source.organization_id AS TEXT)) END,
       source.source_revision,
       source.source_digest,
       source.updated_at
FROM "_stage_company_external_identity_sources" source;
INSERT INTO _company_organization_uuid_validation
SELECT 'company_external_identity_sources',
       (SELECT count(*) FROM "_stage_company_external_identity_sources"),
       (SELECT count(*) FROM company_external_identity_sources),
       0,
       0,
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'company' AND revision = 1);
DROP TABLE "_stage_company_external_identity_sources";
CREATE TRIGGER company_external_identity_sources_revision
BEFORE UPDATE ON company_external_identity_sources
WHEN NEW.identity_id IS NOT OLD.identity_id
  OR NEW.organization_id IS NOT OLD.organization_id
  OR NEW.source_revision <= OLD.source_revision
  OR NEW.updated_at < OLD.updated_at
BEGIN
  SELECT RAISE(ABORT, 'external identity source revision conflict');
END;
CREATE TRIGGER company_external_identity_sources_no_delete
BEFORE DELETE ON company_external_identity_sources
BEGIN
  SELECT RAISE(ABORT, 'external identity source is immutable');
END;

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
SELECT source.id,
       CASE WHEN source.organization_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _company_organizations_id_map ref WHERE ref.old_id = source.organization_id), CAST(source.organization_id AS TEXT)) END,
       source.account_id,
       source.display_name,
       source.created_at,
       source.updated_at
FROM "_stage_company_account_profiles" source;
INSERT INTO _company_organization_uuid_validation
SELECT 'company_account_profiles',
       (SELECT count(*) FROM "_stage_company_account_profiles"),
       (SELECT count(*) FROM company_account_profiles),
       0,
       0,
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
    CHECK (organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'),
  command_id TEXT NOT NULL UNIQUE CHECK (length(command_id) BETWEEN 1 AND 255),
  actor_account_id TEXT NOT NULL CHECK (length(actor_account_id) BETWEEN 1 AND 255),
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 2000),
  employee_count INTEGER NOT NULL CHECK (employee_count >= 0),
  employment_count INTEGER NOT NULL CHECK (employment_count >= 0),
  completed_at INTEGER NOT NULL CHECK (completed_at >= 0),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO company_workforce_connection_completions (id, organization_id, command_id, actor_account_id, reason, employee_count, employment_count, completed_at)
SELECT source.id,
       CASE WHEN source.organization_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _company_organizations_id_map ref WHERE ref.old_id = source.organization_id), CAST(source.organization_id AS TEXT)) END,
       source.command_id,
       source.actor_account_id,
       source.reason,
       source.employee_count,
       source.employment_count,
       source.completed_at
FROM "_stage_company_workforce_connection_completions" source;
INSERT INTO _company_organization_uuid_validation
SELECT 'company_workforce_connection_completions',
       (SELECT count(*) FROM "_stage_company_workforce_connection_completions"),
       (SELECT count(*) FROM company_workforce_connection_completions),
       0,
       0,
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

-- expense_budgets
CREATE TABLE expense_budgets (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  organization_unit_id TEXT NOT NULL
    REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  fiscal_period TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  amount INTEGER NOT NULL,
  name TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO expense_budgets (id, legacy_id, organization_unit_id, fiscal_period, period_start, period_end, amount, name, note, created_at)
SELECT source.id,
       source.legacy_id,
       CASE WHEN source.organization_unit_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _company_organization_units_id_map ref WHERE ref.old_id = source.organization_unit_id), CAST(source.organization_unit_id AS TEXT)) END,
       source.fiscal_period,
       source.period_start,
       source.period_end,
       source.amount,
       source.name,
       source.note,
       source.created_at
FROM "_stage_expense_budgets" source;
INSERT INTO _company_organization_uuid_validation
SELECT 'expense_budgets',
       (SELECT count(*) FROM "_stage_expense_budgets"),
       (SELECT count(*) FROM expense_budgets),
       0,
       0,
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'expense' AND revision = 1);
DROP TABLE "_stage_expense_budgets";
CREATE INDEX idx_expense_budgets_organization_unit
  ON expense_budgets(organization_unit_id);
CREATE INDEX idx_expense_budgets_fiscal_period
  ON expense_budgets(fiscal_period);
CREATE TRIGGER expense_budgets_source_freeze_insert
BEFORE INSERT ON expense_budgets
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'expense' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'expense_record_source_frozen');
END;
CREATE TRIGGER expense_budgets_source_freeze_update
BEFORE UPDATE ON expense_budgets
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'expense' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'expense_record_source_frozen');
END;
CREATE TRIGGER expense_budgets_source_freeze_delete
BEFORE DELETE ON expense_budgets
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'expense' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'expense_record_source_frozen');
END;
CREATE TRIGGER expense_budgets_legacy_id_insert
BEFORE INSERT ON expense_budgets
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER expense_budgets_identity_update
BEFORE UPDATE OF id, legacy_id ON expense_budgets
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- expenses
CREATE TABLE expenses (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  organization_unit_id TEXT REFERENCES company_organization_units(id) ON DELETE RESTRICT NOT NULL,
  category TEXT NOT NULL,
  amount INTEGER NOT NULL,
  spent_at TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO expenses (id, legacy_id, employee_id, organization_unit_id, category, amount, spent_at, note, status, created_at)
SELECT source.id,
       source.legacy_id,
       source.employee_id,
       CASE WHEN source.organization_unit_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _company_organization_units_id_map ref WHERE ref.old_id = source.organization_unit_id), CAST(source.organization_unit_id AS TEXT)) END,
       source.category,
       source.amount,
       source.spent_at,
       source.note,
       source.status,
       source.created_at
FROM "_stage_expenses" source;
INSERT INTO _company_organization_uuid_validation
SELECT 'expenses',
       (SELECT count(*) FROM "_stage_expenses"),
       (SELECT count(*) FROM expenses),
       0,
       0,
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'expense' AND revision = 1);
DROP TABLE "_stage_expenses";
CREATE INDEX idx_expenses_employee ON expenses (employee_id);
CREATE INDEX idx_expenses_organization_unit ON expenses (organization_unit_id);
CREATE INDEX idx_expenses_status ON expenses (status);
CREATE TRIGGER expense_procedure_request_immutable
BEFORE UPDATE ON expenses
WHEN EXISTS (SELECT 1 FROM expense_procedure_bindings WHERE expense_id = OLD.id)
 AND (NEW.id IS NOT OLD.id OR NEW.employee_id IS NOT OLD.employee_id
   OR NEW.organization_unit_id IS NOT OLD.organization_unit_id OR NEW.category IS NOT OLD.category
   OR NEW.amount IS NOT OLD.amount OR NEW.spent_at IS NOT OLD.spent_at OR NEW.note IS NOT OLD.note
   OR NEW.created_at IS NOT OLD.created_at OR OLD.status <> 'pending'
   OR NEW.status NOT IN ('approved', 'rejected'))
BEGIN
  SELECT RAISE(ABORT, 'expense_procedure_request_immutable');
END;
CREATE TRIGGER expense_procedure_request_requires_execution
BEFORE UPDATE ON expenses
WHEN EXISTS (SELECT 1 FROM expense_procedure_bindings WHERE expense_id = OLD.id)
 AND NOT EXISTS (
   SELECT 1 FROM expense_procedure_bindings binding
   JOIN system_cases workflow_case ON workflow_case.id = binding.case_id
   WHERE binding.expense_id = OLD.id
     AND ((NEW.status = 'rejected' AND workflow_case.status = 'rejected')
       OR (NEW.status = 'approved' AND workflow_case.status = 'approved' AND EXISTS (
         SELECT 1 FROM system_execution_authorizations authorization
         WHERE authorization.case_id = binding.case_id
           AND authorization.operation_key = 'expense.request.authorize'
           AND authorization.proposal_digest = binding.proposal_digest
           AND authorization.used_at IS NULL
           AND authorization.granted_at >= binding.created_at
       )))
 )
BEGIN
  SELECT RAISE(ABORT, 'expense_procedure_execution_required');
END;
CREATE TRIGGER expenses_source_freeze_insert
BEFORE INSERT ON expenses
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'expense' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'expense_record_source_frozen');
END;
CREATE TRIGGER expenses_source_freeze_update
BEFORE UPDATE ON expenses
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'expense' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'expense_record_source_frozen');
END;
CREATE TRIGGER expenses_source_freeze_delete
BEFORE DELETE ON expenses
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'expense' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'expense_record_source_frozen');
END;
CREATE TRIGGER expenses_legacy_id_insert
BEFORE INSERT ON expenses
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER expenses_identity_update
BEFORE UPDATE OF id, legacy_id ON expenses
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- career_postings
CREATE TABLE career_postings (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  legacy_id TEXT UNIQUE,
  title TEXT NOT NULL,
  dept_id INTEGER,
  dept_name TEXT,
  required_skills TEXT,
  status TEXT NOT NULL
, organization_unit_id TEXT REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO career_postings (id, created_at, legacy_id, title, dept_id, dept_name, required_skills, status, organization_unit_id)
SELECT source.id,
       source.created_at,
       source.legacy_id,
       source.title,
       source.dept_id,
       source.dept_name,
       source.required_skills,
       source.status,
       CASE WHEN source.organization_unit_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _company_organization_units_id_map ref WHERE ref.old_id = source.organization_unit_id), CAST(source.organization_unit_id AS TEXT)) END
FROM "_stage_career_postings" source;
INSERT INTO _company_organization_uuid_validation
SELECT 'career_postings',
       (SELECT count(*) FROM "_stage_career_postings"),
       (SELECT count(*) FROM career_postings),
       0,
       0,
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'career' AND revision = 1);
DROP TABLE "_stage_career_postings";
CREATE INDEX idx_career_postings_organization_unit ON career_postings (organization_unit_id);
CREATE INDEX idx_career_postings_status ON career_postings (status);
CREATE TRIGGER career_postings_source_freeze_delete BEFORE DELETE ON career_postings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='career' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'career_record_source_frozen'); END;
CREATE TRIGGER career_postings_source_freeze_insert BEFORE INSERT ON career_postings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='career' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'career_record_source_frozen'); END;
CREATE TRIGGER career_postings_source_freeze_update BEFORE UPDATE ON career_postings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='career' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'career_record_source_frozen'); END;
CREATE TRIGGER career_postings_legacy_id_insert
BEFORE INSERT ON career_postings
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER career_postings_identity_update
BEFORE UPDATE OF id, legacy_id ON career_postings
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

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
    OR NEW.organization_revision != (SELECT revision FROM company_organizations WHERE id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d')
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
CREATE TRIGGER company_responsibility_adoption_insert_guard
BEFORE INSERT ON company_responsibility_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'responsibility adoption evidence is incomplete') WHERE NOT EXISTS (
    SELECT 1 FROM company_organization_change_operations operation
    WHERE operation.id = NEW.operation_id AND operation.status = 'PENDING'
      AND operation.change_count = NEW.adopted_periods AND operation.applied_count = NEW.adopted_periods
      AND operation.actor_account_id = NEW.actor_account_id AND operation.reason = NEW.reason
  ) OR NEW.organization_revision != (SELECT revision FROM company_organizations WHERE id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d')
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
CREATE VIEW company_account_employee_link_period_violations AS
WITH effective_versions AS (
  SELECT resource.* FROM company_resource_revisions resource
  WHERE resource.resource_type = 'employee' AND resource.revision = (
    SELECT max(latest.revision) FROM company_resource_revisions latest
    WHERE latest.organization_id = resource.organization_id AND latest.resource_type = resource.resource_type
      AND latest.resource_id = resource.resource_id AND latest.effective_from = resource.effective_from
  )
), next_versions AS (
  SELECT *, lead(effective_from) OVER (PARTITION BY organization_id, resource_id ORDER BY effective_from) AS next_from
  FROM effective_versions
), periods AS (
  SELECT organization_id, resource_id AS employee_id, effective_from AS starts_on,
    CASE WHEN next_from IS NULL OR (effective_to IS NOT NULL AND effective_to < next_from)
      THEN effective_to ELSE next_from END AS ends_on
  FROM next_versions WHERE state = 'active'
), prior AS (
  SELECT *, max(coalesce(ends_on, '9999-12-31')) OVER (
    PARTITION BY organization_id, employee_id ORDER BY starts_on, ends_on
    ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS covered_until
  FROM periods
), groups AS (
  SELECT *, sum(CASE WHEN covered_until IS NULL OR starts_on > covered_until THEN 1 ELSE 0 END) OVER (
    PARTITION BY organization_id, employee_id ORDER BY starts_on, ends_on ROWS UNBOUNDED PRECEDING) AS island
  FROM prior
), coverage AS (
  SELECT organization_id, employee_id, min(starts_on) AS starts_on,
    CASE WHEN max(ends_on IS NULL) = 1 THEN NULL ELSE max(ends_on) END AS ends_on
  FROM groups GROUP BY organization_id, employee_id, island
)
SELECT link.* FROM company_account_employee_link_periods link WHERE link.source = 'public'
  AND NOT EXISTS (SELECT 1 FROM coverage
    WHERE coverage.organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d' AND coverage.employee_id = link.employee_id
      AND coverage.starts_on <= link.starts_on
      AND (coverage.ends_on IS NULL OR (link.ends_on IS NOT NULL AND link.ends_on <= coverage.ends_on)));
INSERT INTO _company_organization_uuid_validation
SELECT 'company_organization_unit_period_versions.organization_unit_id', orphan_count, (SELECT count(*) FROM company_organization_unit_period_versions child WHERE child.organization_unit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organization_units parent WHERE parent.id = child.organization_unit_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'company_organization_unit_period_versions.organization_unit_id';
INSERT INTO _company_organization_uuid_validation
SELECT 'company_organization_unit_period_versions.parent_organization_unit_id', orphan_count, (SELECT count(*) FROM company_organization_unit_period_versions child WHERE child.parent_organization_unit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organization_units parent WHERE parent.id = child.parent_organization_unit_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'company_organization_unit_period_versions.parent_organization_unit_id';
INSERT INTO _company_organization_uuid_validation
SELECT 'company_organization_assignment_period_versions.organization_unit_id', orphan_count, (SELECT count(*) FROM company_organization_assignment_period_versions child WHERE child.organization_unit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organization_units parent WHERE parent.id = child.organization_unit_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'company_organization_assignment_period_versions.organization_unit_id';
INSERT INTO _company_organization_uuid_validation
SELECT 'company_organization_responsibility_period_versions.organization_unit_id', orphan_count, (SELECT count(*) FROM company_organization_responsibility_period_versions child WHERE child.organization_unit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organization_units parent WHERE parent.id = child.organization_unit_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'company_organization_responsibility_period_versions.organization_unit_id';
INSERT INTO _company_organization_uuid_validation
SELECT 'company_command_receipts.organization_id', orphan_count, (SELECT count(*) FROM company_command_receipts child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'company_command_receipts.organization_id';
INSERT INTO _company_organization_uuid_validation
SELECT 'company_resource_heads.organization_id', orphan_count, (SELECT count(*) FROM company_resource_heads child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'company_resource_heads.organization_id';
INSERT INTO _company_organization_uuid_validation
SELECT 'company_resource_revisions.organization_id', orphan_count, (SELECT count(*) FROM company_resource_revisions child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'company_resource_revisions.organization_id';
INSERT INTO _company_organization_uuid_validation
SELECT 'company_workforce_resource_bindings.organization_id', orphan_count, (SELECT count(*) FROM company_workforce_resource_bindings child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'company_workforce_resource_bindings.organization_id';
INSERT INTO _company_organization_uuid_validation
SELECT 'company_account_employee_resource_bindings.organization_id', orphan_count, (SELECT count(*) FROM company_account_employee_resource_bindings child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'company_account_employee_resource_bindings.organization_id';
INSERT INTO _company_organization_uuid_validation
SELECT 'company_assignment_resource_bindings.organization_id', orphan_count, (SELECT count(*) FROM company_assignment_resource_bindings child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'company_assignment_resource_bindings.organization_id';
INSERT INTO _company_organization_uuid_validation
SELECT 'company_responsibility_resource_bindings.organization_id', orphan_count, (SELECT count(*) FROM company_responsibility_resource_bindings child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'company_responsibility_resource_bindings.organization_id';
INSERT INTO _company_organization_uuid_validation
SELECT 'company_responsibility_resource_bindings.organization_unit_id', orphan_count, (SELECT count(*) FROM company_responsibility_resource_bindings child WHERE child.organization_unit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organization_units parent WHERE parent.id = child.organization_unit_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'company_responsibility_resource_bindings.organization_unit_id';
INSERT INTO _company_organization_uuid_validation
SELECT 'company_personnel_reporting_bindings.organization_id', orphan_count, (SELECT count(*) FROM company_personnel_reporting_bindings child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'company_personnel_reporting_bindings.organization_id';
INSERT INTO _company_organization_uuid_validation
SELECT 'company_personnel_reporting_bindings.organization_unit_id', orphan_count, (SELECT count(*) FROM company_personnel_reporting_bindings child WHERE child.organization_unit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organization_units parent WHERE parent.id = child.organization_unit_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'company_personnel_reporting_bindings.organization_unit_id';
INSERT INTO _company_organization_uuid_validation
SELECT 'company_organization_resource_bindings.organization_id', orphan_count, (SELECT count(*) FROM company_organization_resource_bindings child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'company_organization_resource_bindings.organization_id';
INSERT INTO _company_organization_uuid_validation
SELECT 'company_organization_resource_bindings.organization_unit_id', orphan_count, (SELECT count(*) FROM company_organization_resource_bindings child WHERE child.organization_unit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organization_units parent WHERE parent.id = child.organization_unit_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'company_organization_resource_bindings.organization_unit_id';
INSERT INTO _company_organization_uuid_validation
SELECT 'company_definition_resource_adoptions.organization_id', orphan_count, (SELECT count(*) FROM company_definition_resource_adoptions child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'company_definition_resource_adoptions.organization_id';
INSERT INTO _company_organization_uuid_validation
SELECT 'company_profile_change_receipts.organization_id', orphan_count, (SELECT count(*) FROM company_profile_change_receipts child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'company_profile_change_receipts.organization_id';
INSERT INTO _company_organization_uuid_validation
SELECT 'company_organization_resource_adoptions.organization_unit_id', orphan_count, (SELECT count(*) FROM company_organization_resource_adoptions child WHERE child.organization_unit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organization_units parent WHERE parent.id = child.organization_unit_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'company_organization_resource_adoptions.organization_unit_id';
INSERT INTO _company_organization_uuid_validation
SELECT 'company_responsibility_source_adoptions.organization_id', orphan_count, (SELECT count(*) FROM company_responsibility_source_adoptions child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'company_responsibility_source_adoptions.organization_id';
INSERT INTO _company_organization_uuid_validation
SELECT 'company_responsibility_source_cutovers.organization_id', orphan_count, (SELECT count(*) FROM company_responsibility_source_cutovers child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'company_responsibility_source_cutovers.organization_id';
INSERT INTO _company_organization_uuid_validation
SELECT 'company_bootstrap_receipts.organization_id', orphan_count, (SELECT count(*) FROM company_bootstrap_receipts child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'company_bootstrap_receipts.organization_id';
INSERT INTO _company_organization_uuid_validation
SELECT 'company_grade_award_archives.organization_id', orphan_count, (SELECT count(*) FROM company_grade_award_archives child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'company_grade_award_archives.organization_id';
INSERT INTO _company_organization_uuid_validation
SELECT 'company_external_identity_imports.organization_id', orphan_count, (SELECT count(*) FROM company_external_identity_imports child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'company_external_identity_imports.organization_id';
INSERT INTO _company_organization_uuid_validation
SELECT 'company_external_identity_sources.organization_id', orphan_count, (SELECT count(*) FROM company_external_identity_sources child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'company_external_identity_sources.organization_id';
INSERT INTO _company_organization_uuid_validation
SELECT 'company_account_profiles.organization_id', orphan_count, (SELECT count(*) FROM company_account_profiles child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'company_account_profiles.organization_id';
INSERT INTO _company_organization_uuid_validation
SELECT 'company_workforce_connection_completions.organization_id', orphan_count, (SELECT count(*) FROM company_workforce_connection_completions child WHERE child.organization_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organizations parent WHERE parent.id = child.organization_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'company_workforce_connection_completions.organization_id';
INSERT INTO _company_organization_uuid_validation
SELECT 'expense_budgets.organization_unit_id', orphan_count, (SELECT count(*) FROM expense_budgets child WHERE child.organization_unit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organization_units parent WHERE parent.id = child.organization_unit_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'expense_budgets.organization_unit_id';
INSERT INTO _company_organization_uuid_validation
SELECT 'expenses.organization_unit_id', orphan_count, (SELECT count(*) FROM expenses child WHERE child.organization_unit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organization_units parent WHERE parent.id = child.organization_unit_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'expenses.organization_unit_id';
INSERT INTO _company_organization_uuid_validation
SELECT 'career_postings.organization_unit_id', orphan_count, (SELECT count(*) FROM career_postings child WHERE child.organization_unit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM company_organization_units parent WHERE parent.id = child.organization_unit_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'career_postings.organization_unit_id';
DROP TABLE _uuid_reference_orphans;
DROP TABLE _company_organizations_id_map;
DROP TABLE _company_organization_units_id_map;
DROP TABLE _company_organization_uuid_validation;
