CREATE TABLE company_organizations (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  name TEXT NOT NULL DEFAULT '' CHECK (
    length(name) <= 200
    AND trim(name) = name
    AND instr(name, char(0)) = 0
  ),
  representative_name TEXT NOT NULL DEFAULT '' CHECK (
    length(representative_name) <= 200
    AND trim(representative_name) = representative_name
    AND instr(representative_name, char(0)) = 0
  ),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TRIGGER company_organizations_legacy_id_insert
BEFORE INSERT ON company_organizations
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER company_organizations_identity_update
BEFORE UPDATE OF id, legacy_id ON company_organizations
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

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
CREATE TRIGGER company_account_profiles_identity_update
BEFORE UPDATE OF id ON company_account_profiles
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE INDEX company_account_profiles_account_idx
  ON company_account_profiles (account_id);

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
CREATE TRIGGER company_resource_heads_identity_update
BEFORE UPDATE OF id ON company_resource_heads
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE INDEX company_resource_heads_type_effective_idx
  ON company_resource_heads (organization_id, resource_type, effective_from, effective_to);

CREATE UNIQUE INDEX company_resource_heads_org_revision_idx
  ON company_resource_heads (organization_id, organization_revision, resource_type, resource_id);

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
CREATE TRIGGER company_resource_revisions_identity_update
BEFORE UPDATE OF id ON company_resource_revisions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE UNIQUE INDEX company_resource_revisions_org_revision_idx
  ON company_resource_revisions (organization_id, organization_revision, resource_type, resource_id);

CREATE INDEX company_resource_revisions_command_idx
  ON company_resource_revisions (organization_id, command_id);

CREATE INDEX company_resource_revisions_account_link_idx
  ON company_resource_revisions (organization_id, resource_id)
  WHERE resource_type = 'account-employee-link';

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
CREATE TRIGGER company_command_receipts_identity_update
BEFORE UPDATE OF id ON company_command_receipts
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER company_organizations_revision_step
BEFORE UPDATE OF revision ON company_organizations
WHEN NEW.revision <> OLD.revision + 1
BEGIN
  SELECT RAISE(ABORT, 'company_revision_step_invalid');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER company_command_receipts_expected_revision
BEFORE INSERT ON company_command_receipts
WHEN COALESCE(
  (SELECT revision FROM company_organizations WHERE id = NEW.organization_id),
  -1
) <> NEW.expected_revision
BEGIN
  SELECT RAISE(ABORT, 'company_revision_conflict');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
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

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER company_resource_revisions_no_update
BEFORE UPDATE ON company_resource_revisions
BEGIN
  SELECT RAISE(ABORT, 'company_resource_revisions_are_append_only');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER company_resource_revisions_no_delete
BEFORE DELETE ON company_resource_revisions
BEGIN
  SELECT RAISE(ABORT, 'company_resource_revisions_are_append_only');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER company_command_receipts_no_update
BEFORE UPDATE ON company_command_receipts
BEGIN
  SELECT RAISE(ABORT, 'company_command_receipts_are_immutable');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER company_command_receipts_no_delete
BEFORE DELETE ON company_command_receipts
BEGIN
  SELECT RAISE(ABORT, 'company_command_receipts_are_immutable');
END;

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

CREATE TRIGGER company_site_legal_entity_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'site'
  AND NEW.state = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM company_resource_heads AS legal_entity
    WHERE legal_entity.organization_id = NEW.organization_id
      AND legal_entity.resource_type = 'legal-entity'
      AND legal_entity.resource_id = json_extract(NEW.attributes_json, '$.legalEntityId')
      AND legal_entity.state = 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'company_site_legal_entity_not_found');
END;

CREATE TRIGGER company_workplace_site_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'workplace'
  AND NEW.state = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM company_resource_heads AS site
    WHERE site.organization_id = NEW.organization_id
      AND site.resource_type = 'site'
      AND site.resource_id = json_extract(NEW.attributes_json, '$.siteId')
      AND site.state = 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'company_workplace_site_not_found');
END;

CREATE TRIGGER company_site_void_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'site'
  AND NEW.state = 'void'
  AND EXISTS (
    SELECT 1
    FROM company_resource_heads AS workplace
    WHERE workplace.organization_id = NEW.organization_id
      AND workplace.resource_type = 'workplace'
      AND json_extract(workplace.attributes_json, '$.siteId') = NEW.resource_id
      AND workplace.state = 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'company_site_has_active_workplaces');
END;

CREATE TRIGGER company_legal_entity_void_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'legal-entity'
  AND NEW.state = 'void'
  AND EXISTS (
    SELECT 1
    FROM company_resource_heads AS site
    WHERE site.organization_id = NEW.organization_id
      AND site.resource_type = 'site'
      AND json_extract(site.attributes_json, '$.legalEntityId') = NEW.resource_id
      AND site.state = 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'company_legal_entity_has_active_sites');
END;

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

CREATE UNIQUE INDEX company_active_responsibility_assignment_uniq
  ON company_resource_heads (
    organization_id,
    json_extract(attributes_json, '$.responsibilityId'),
    json_extract(attributes_json, '$.holderType'),
    json_extract(attributes_json, '$.holderId'),
    COALESCE(json_extract(attributes_json, '$.authorityScopeId'), '')
  )
  WHERE resource_type = 'responsibility-assignment' AND state = 'active';

CREATE TRIGGER company_position_job_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'position'
  AND NEW.state = 'active'
  AND json_extract(NEW.attributes_json, '$.jobId') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM company_resource_heads AS job
    WHERE job.organization_id = NEW.organization_id
      AND job.resource_type = 'job'
      AND job.resource_id = json_extract(NEW.attributes_json, '$.jobId')
      AND job.state = 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'company_position_job_not_found');
END;

CREATE TRIGGER company_organizational_office_reference_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'organizational-office'
  AND NEW.state = 'active'
  AND (
    NOT EXISTS (
      SELECT 1
      FROM company_resource_heads AS unit
      WHERE unit.organization_id = NEW.organization_id
        AND unit.resource_type = 'organization-unit'
        AND unit.resource_id = json_extract(NEW.attributes_json, '$.organizationUnitId')
        AND unit.state = 'active'
    )
    OR NOT EXISTS (
      SELECT 1
      FROM company_resource_heads AS position
      WHERE position.organization_id = NEW.organization_id
        AND position.resource_type = 'position'
        AND position.resource_id = json_extract(NEW.attributes_json, '$.positionId')
        AND position.state = 'active'
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'company_organizational_office_reference_not_found');
END;

CREATE TRIGGER company_office_assignment_reference_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'office-assignment'
  AND NEW.state = 'active'
  AND (
    NOT EXISTS (
      SELECT 1 FROM company_resource_heads AS employee
      WHERE employee.organization_id = NEW.organization_id
        AND employee.resource_type = 'employee'
        AND employee.resource_id = json_extract(NEW.attributes_json, '$.employeeId')
        AND employee.state = 'active'
    )
    OR NOT EXISTS (
      SELECT 1 FROM company_resource_heads AS employment
      WHERE employment.organization_id = NEW.organization_id
        AND employment.resource_type = 'employment'
        AND employment.resource_id = json_extract(NEW.attributes_json, '$.employmentId')
        AND employment.state = 'active'
    )
    OR NOT EXISTS (
      SELECT 1 FROM company_resource_heads AS office
      WHERE office.organization_id = NEW.organization_id
        AND office.resource_type = 'organizational-office'
        AND office.resource_id = json_extract(NEW.attributes_json, '$.organizationalOfficeId')
        AND office.state = 'active'
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'company_office_assignment_reference_not_found');
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
    FROM company_resource_heads AS scoped
    WHERE scoped.organization_id = NEW.organization_id
      AND scoped.resource_type = json_extract(NEW.attributes_json, '$.scopeType')
      AND scoped.resource_id = json_extract(NEW.attributes_json, '$.scopeId')
      AND scoped.state = 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'company_authority_scope_reference_not_found');
END;

CREATE TRIGGER company_responsibility_assignment_reference_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'responsibility-assignment'
  AND NEW.state = 'active'
  AND (
    NOT EXISTS (
      SELECT 1 FROM company_resource_heads AS responsibility
      WHERE responsibility.organization_id = NEW.organization_id
        AND responsibility.resource_type = 'responsibility'
        AND responsibility.resource_id = json_extract(NEW.attributes_json, '$.responsibilityId')
        AND responsibility.state = 'active'
    )
    OR (
      json_extract(NEW.attributes_json, '$.authorityScopeId') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM company_resource_heads AS scope
        WHERE scope.organization_id = NEW.organization_id
          AND scope.resource_type = 'authority-scope'
          AND scope.resource_id = json_extract(NEW.attributes_json, '$.authorityScopeId')
          AND scope.state = 'active'
      )
    )
    OR NOT EXISTS (
      SELECT 1 FROM company_resource_heads AS holder
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
      SELECT 1 FROM company_resource_heads AS body
      WHERE body.organization_id = NEW.organization_id
        AND body.resource_type = 'collective-body'
        AND body.resource_id = json_extract(NEW.attributes_json, '$.collectiveBodyId')
        AND body.state = 'active'
    )
    OR NOT EXISTS (
      SELECT 1 FROM company_resource_heads AS employee
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
    SELECT 1 FROM company_resource_heads AS scope
    WHERE scope.organization_id = NEW.organization_id
      AND scope.resource_type = 'authority-scope'
      AND scope.resource_id = json_extract(NEW.attributes_json, '$.scopeId')
      AND scope.state = 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'company_organizational_authority_scope_not_found');
END;

CREATE TRIGGER company_governance_definition_void_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.state = 'void'
  AND (
    (NEW.resource_type = 'job' AND EXISTS (
      SELECT 1 FROM company_resource_heads AS position
      WHERE position.organization_id = NEW.organization_id
        AND position.resource_type = 'position'
        AND json_extract(position.attributes_json, '$.jobId') = NEW.resource_id
        AND position.state = 'active'
    ))
    OR (NEW.resource_type = 'organizational-office' AND EXISTS (
      SELECT 1 FROM company_resource_heads AS assignment
      WHERE assignment.organization_id = NEW.organization_id
        AND assignment.resource_type = 'office-assignment'
        AND json_extract(assignment.attributes_json, '$.organizationalOfficeId') = NEW.resource_id
        AND assignment.state = 'active'
    ))
    OR (NEW.resource_type = 'responsibility' AND EXISTS (
      SELECT 1 FROM company_resource_heads AS assignment
      WHERE assignment.organization_id = NEW.organization_id
        AND assignment.resource_type = 'responsibility-assignment'
        AND json_extract(assignment.attributes_json, '$.responsibilityId') = NEW.resource_id
        AND assignment.state = 'active'
    ))
    OR (NEW.resource_type = 'authority-scope' AND EXISTS (
      SELECT 1 FROM company_resource_heads AS assignment
      WHERE assignment.organization_id = NEW.organization_id
        AND (
          (
            assignment.resource_type = 'responsibility-assignment'
            AND json_extract(assignment.attributes_json, '$.authorityScopeId') = NEW.resource_id
          )
          OR (
            assignment.resource_type = 'organizational-authority'
            AND json_extract(assignment.attributes_json, '$.scopeType') = 'authority-scope'
            AND json_extract(assignment.attributes_json, '$.scopeId') = NEW.resource_id
          )
        )
        AND assignment.state = 'active'
    ))
    OR (NEW.resource_type = 'collective-body' AND EXISTS (
      SELECT 1 FROM company_resource_heads AS dependent
      WHERE dependent.organization_id = NEW.organization_id
        AND (
          (
            dependent.resource_type = 'collective-body-membership'
            AND json_extract(dependent.attributes_json, '$.collectiveBodyId') = NEW.resource_id
          )
          OR (
            dependent.resource_type = 'responsibility-assignment'
            AND json_extract(dependent.attributes_json, '$.holderType') = 'collective-body'
            AND json_extract(dependent.attributes_json, '$.holderId') = NEW.resource_id
          )
        )
        AND dependent.state = 'active'
    ))
  )
BEGIN
  SELECT RAISE(ABORT, 'company_governance_definition_is_in_use');
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


-- Company workforce identity and period projections.
CREATE TABLE company_employees (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  official_name TEXT NOT NULL
    CHECK (length(official_name) BETWEEN 1 AND 200 AND trim(official_name) = official_name),
  employee_code TEXT
    CHECK (
      employee_code IS NULL OR (
        length(employee_code) BETWEEN 1 AND 64 AND trim(employee_code) = employee_code
      )
    ),
  email TEXT
    CHECK (email IS NULL OR (length(email) BETWEEN 1 AND 320 AND trim(email) = email)),
  phone TEXT
    CHECK (phone IS NULL OR (length(phone) BETWEEN 1 AND 64 AND trim(phone) = phone)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
    CHECK (updated_at >= created_at),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TRIGGER company_employees_legacy_id_insert
BEFORE INSERT ON company_employees
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER company_employees_identity_update
BEFORE UPDATE OF id, legacy_id ON company_employees
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE UNIQUE INDEX company_employees_employee_code_uniq
  ON company_employees(employee_code);

CREATE TABLE company_employments (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  employee_id TEXT NOT NULL
    REFERENCES company_employees(id) ON DELETE RESTRICT,
  contract_name TEXT NOT NULL
    CHECK (length(contract_name) BETWEEN 1 AND 200 AND trim(contract_name) = contract_name),
  employment_type TEXT NOT NULL
    CHECK (employment_type IN ('FULL_TIME', 'PART_TIME')),
  hire_date TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('ACTIVE', 'ON_LEAVE', 'TERMINATED')),
  termination_date TEXT,
  created_at INTEGER NOT NULL
    CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL
    CHECK (updated_at >= created_at),
  CHECK (termination_date IS NULL OR hire_date <= termination_date),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TRIGGER company_employments_legacy_id_insert
BEFORE INSERT ON company_employments
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER company_employments_identity_update
BEFORE UPDATE OF id, legacy_id ON company_employments
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE UNIQUE INDEX company_employments_employee_active_unique
  ON company_employments(employee_id)
  WHERE termination_date IS NULL;

CREATE INDEX company_employments_employee_idx
  ON company_employments(employee_id);

CREATE INDEX company_employments_status_idx
  ON company_employments(status);

CREATE TABLE company_account_employee_links (
  account_id TEXT PRIMARY KEY NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  employee_id TEXT NOT NULL
    REFERENCES company_employees(id) ON DELETE RESTRICT,
  CHECK (length(account_id) = 36 AND account_id NOT GLOB '*[^0-9a-f-]*' AND substr(account_id, 9, 1) = '-' AND substr(account_id, 14, 1) = '-' AND substr(account_id, 19, 1) = '-' AND substr(account_id, 24, 1) = '-' AND length(replace(account_id, '-', '')) = 32 AND substr(account_id, 15, 1) GLOB '[1-8]' AND substr(account_id, 20, 1) GLOB '[89ab]')
);

CREATE INDEX company_account_employee_links_employee_idx
  ON company_account_employee_links(employee_id);

CREATE UNIQUE INDEX company_account_employee_links_employee_uniq
  ON company_account_employee_links(employee_id);

CREATE TABLE company_personnel_actions (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  employee_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN (
    'hire', 'rehire', 'primary_assignment_started', 'transferred',
    'concurrent_assignment_started', 'assignment_ended', 'position_changed',
    'manager_changed', 'department_responsibility_started',
    'department_responsibility_ended', 'leave_started', 'returned', 'retired',
    'corrected', 'initial_state', 'employment_revised'
  )),
  event_on TEXT NOT NULL CHECK (
    length(event_on) = 10 AND substr(event_on, 5, 1) = '-' AND substr(event_on, 8, 1) = '-'
  ),
  recorded_at INTEGER NOT NULL,
  recorded_by_account_id TEXT,
  requested_by_employee_id TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('application', 'direct', 'system')),
  source_application_id INTEGER,
  corrects_action_id TEXT,
  operation_id TEXT NOT NULL UNIQUE CHECK (length(operation_id) BETWEEN 1 AND 200),
  payload_fingerprint TEXT NOT NULL CHECK (length(payload_fingerprint) = 64),
  summary_json TEXT NOT NULL CHECK (json_valid(summary_json)),
  CHECK (
    (source_type = 'application' AND source_application_id IS NOT NULL)
    OR (source_type != 'application' AND source_application_id IS NULL)
  ),
  CHECK (corrects_action_id IS NULL OR corrects_action_id != id),
  CHECK (recorded_by_account_id IS NULL OR length(recorded_by_account_id) BETWEEN 1 AND 255),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TRIGGER company_personnel_actions_legacy_id_insert
BEFORE INSERT ON company_personnel_actions
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER company_personnel_actions_identity_update
BEFORE UPDATE OF id, legacy_id ON company_personnel_actions
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE INDEX idx_company_personnel_actions_employee_timeline
  ON company_personnel_actions(employee_id, event_on, recorded_at, id);

CREATE UNIQUE INDEX uq_company_personnel_actions_correction
  ON company_personnel_actions(corrects_action_id)
  WHERE corrects_action_id IS NOT NULL;

CREATE UNIQUE INDEX uq_company_personnel_actions_source_application
  ON company_personnel_actions(source_application_id)
  WHERE source_application_id IS NOT NULL;

CREATE TABLE company_employee_lifecycle_revisions (
  employee_id TEXT PRIMARY KEY NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at INTEGER NOT NULL,
  CHECK (length(employee_id) = 36 AND employee_id NOT GLOB '*[^0-9a-f-]*' AND substr(employee_id, 9, 1) = '-' AND substr(employee_id, 14, 1) = '-' AND substr(employee_id, 19, 1) = '-' AND substr(employee_id, 24, 1) = '-' AND length(replace(employee_id, '-', '')) = 32 AND substr(employee_id, 15, 1) GLOB '[1-8]' AND substr(employee_id, 20, 1) GLOB '[89ab]')
);

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
CREATE TRIGGER company_employment_period_versions_identity_update
BEFORE UPDATE OF id ON company_employment_period_versions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE INDEX idx_company_employment_period_versions_employee
  ON company_employment_period_versions(
    employee_id, starts_on, ends_on, period_id, revision DESC
  );

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
CREATE TRIGGER company_employee_status_period_versions_identity_update
BEFORE UPDATE OF id ON company_employee_status_period_versions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE INDEX idx_company_employee_status_period_versions_employee
  ON company_employee_status_period_versions(
    employee_id, starts_on, ends_on, period_id, revision DESC
  );

CREATE INDEX idx_company_employee_status_period_versions_employment
  ON company_employee_status_period_versions(employment_period_id, period_id, revision DESC);

CREATE TABLE company_workforce_resource_bindings (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  resource_type TEXT NOT NULL CHECK (resource_type IN ('employee', 'employment')),
  resource_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  employee_id TEXT NOT NULL REFERENCES company_employees(id) ON DELETE RESTRICT,
  resource_revision INTEGER NOT NULL CHECK (resource_revision > 0),
  lifecycle_revision INTEGER NOT NULL CHECK (lifecycle_revision >= 0),
  last_action_id TEXT,
  UNIQUE (resource_type, resource_id),
  FOREIGN KEY (organization_id, resource_type, resource_id)
    REFERENCES company_resource_heads(organization_id, resource_type, resource_id)
    ON DELETE RESTRICT,
  CHECK (resource_type != 'employee' OR resource_id = employee_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TRIGGER company_workforce_resource_bindings_identity_update
BEFORE UPDATE OF id ON company_workforce_resource_bindings
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE INDEX company_workforce_resource_bindings_employee_idx
  ON company_workforce_resource_bindings(employee_id, resource_type);

DROP INDEX IF EXISTS company_employments_employee_active_unique;
CREATE UNIQUE INDEX company_employments_employee_active_unique
  ON company_employments(employee_id)
  WHERE termination_date IS NULL AND status IN ('ACTIVE', 'ON_LEAVE');

DROP TRIGGER IF EXISTS company_workforce_projection_guard;
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

DROP TRIGGER IF EXISTS company_personnel_actions_no_delete;
CREATE TRIGGER company_personnel_actions_no_delete
BEFORE DELETE ON company_personnel_actions
BEGIN
  SELECT RAISE(ABORT, 'company personnel actions are append only');
END;

DROP TRIGGER IF EXISTS company_personnel_actions_no_update;
CREATE TRIGGER company_personnel_actions_no_update
BEFORE UPDATE ON company_personnel_actions
BEGIN
  SELECT RAISE(ABORT, 'company personnel actions are append only');
END;

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
CREATE TRIGGER company_external_identity_imports_identity_update
BEFORE UPDATE OF id ON company_external_identity_imports
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;
CREATE TABLE company_external_identity_sources (
  identity_id TEXT PRIMARY KEY NOT NULL REFERENCES system_identity_bindings(id) ON DELETE RESTRICT,
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT,
  source_revision INTEGER NOT NULL CHECK (source_revision > 0),
  source_digest TEXT NOT NULL CHECK (length(source_digest) = 64 AND source_digest NOT GLOB '*[^0-9a-f]*'),
  updated_at INTEGER NOT NULL CHECK (updated_at >= 0),
  CHECK (length(identity_id) = 36 AND identity_id NOT GLOB '*[^0-9a-f-]*' AND substr(identity_id, 9, 1) = '-' AND substr(identity_id, 14, 1) = '-' AND substr(identity_id, 19, 1) = '-' AND substr(identity_id, 24, 1) = '-' AND length(replace(identity_id, '-', '')) = 32 AND substr(identity_id, 15, 1) GLOB '[1-8]' AND substr(identity_id, 20, 1) GLOB '[89ab]')
);

DROP TRIGGER IF EXISTS company_external_identity_imports_no_update;
CREATE TRIGGER company_external_identity_imports_no_update
BEFORE UPDATE ON company_external_identity_imports
BEGIN
  SELECT RAISE(ABORT, 'external identity import is immutable');
END;

DROP TRIGGER IF EXISTS company_external_identity_imports_no_delete;
CREATE TRIGGER company_external_identity_imports_no_delete
BEFORE DELETE ON company_external_identity_imports
BEGIN
  SELECT RAISE(ABORT, 'external identity import is immutable');
END;

DROP TRIGGER IF EXISTS company_external_identity_sources_revision;
CREATE TRIGGER company_external_identity_sources_revision
BEFORE UPDATE ON company_external_identity_sources
WHEN NEW.identity_id IS NOT OLD.identity_id
  OR NEW.organization_id IS NOT OLD.organization_id
  OR NEW.source_revision <= OLD.source_revision
  OR NEW.updated_at < OLD.updated_at
BEGIN
  SELECT RAISE(ABORT, 'external identity source revision conflict');
END;

DROP TRIGGER IF EXISTS company_external_identity_sources_no_delete;
CREATE TRIGGER company_external_identity_sources_no_delete
BEFORE DELETE ON company_external_identity_sources
BEGIN
  SELECT RAISE(ABORT, 'external identity source is immutable');
END;

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
CREATE TRIGGER company_employee_resource_adoptions_identity_update
BEFORE UPDATE OF id ON company_employee_resource_adoptions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

DROP TRIGGER IF EXISTS company_employee_resource_adoptions_no_update;
CREATE TRIGGER company_employee_resource_adoptions_no_update
BEFORE UPDATE ON company_employee_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'employee resource adoption is immutable');
END;

DROP TRIGGER IF EXISTS company_employee_resource_adoptions_no_delete;
CREATE TRIGGER company_employee_resource_adoptions_no_delete
BEFORE DELETE ON company_employee_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'employee resource adoption is immutable');
END;

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
CREATE TRIGGER company_organization_assignment_period_versions_identity_update
BEFORE UPDATE OF id ON company_organization_assignment_period_versions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TABLE company_organization_change_operations (
  id TEXT PRIMARY KEY NOT NULL,
  operation_key TEXT UNIQUE CHECK (operation_key IS NULL OR length(operation_key) BETWEEN 1 AND 256),
  legacy_id TEXT UNIQUE,
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  change_count INTEGER NOT NULL CHECK (change_count >= 1),
  applied_count INTEGER NOT NULL DEFAULT 0 CHECK (applied_count BETWEEN 0 AND change_count),
  resulting_revision INTEGER NOT NULL
    CHECK (resulting_revision = expected_revision + change_count),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED')),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0)
, request_fingerprint TEXT NOT NULL
DEFAULT '0000000000000000000000000000000000000000000000000000000000000000'
CHECK (
  length(request_fingerprint) = 64
  AND request_fingerprint NOT GLOB '*[^0-9a-f]*'
), actor_account_id TEXT NOT NULL DEFAULT 'system:initialization'
CHECK (length(actor_account_id) BETWEEN 1 AND 255 AND trim(actor_account_id) = actor_account_id), reason TEXT NOT NULL DEFAULT 'Initialize organization change'
CHECK (length(reason) BETWEEN 1 AND 1000 AND trim(reason) = reason), evidence_references_json TEXT NOT NULL DEFAULT '[]'
CHECK (json_valid(evidence_references_json) AND json_type(evidence_references_json) = 'array'),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TRIGGER company_organization_change_operations_legacy_id_insert
BEFORE INSERT ON company_organization_change_operations
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER company_organization_change_operations_identity_update
BEFORE UPDATE OF id, legacy_id ON company_organization_change_operations
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TABLE "company_organization_lifecycle_states" (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at INTEGER NOT NULL
);

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
CREATE TRIGGER company_organization_responsibility_period_versions_identity_update
BEFORE UPDATE OF id ON company_organization_responsibility_period_versions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

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
CREATE TRIGGER company_organization_unit_period_versions_identity_update
BEFORE UPDATE OF id ON company_organization_unit_period_versions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TABLE company_organization_units (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TRIGGER company_organization_units_legacy_id_insert
BEFORE INSERT ON company_organization_units
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER company_organization_units_identity_update
BEFORE UPDATE OF id, legacy_id ON company_organization_units
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE INDEX company_organization_assignment_period_versions_employee_idx
  ON company_organization_assignment_period_versions(
    employee_id, starts_on, ends_on, assignment_type, period_id, revision
  );

CREATE INDEX company_organization_assignment_period_versions_unit_idx
  ON company_organization_assignment_period_versions(
    organization_unit_id, starts_on, ends_on, period_id, revision
  );

CREATE INDEX company_organization_responsibility_period_versions_employee_idx
  ON company_organization_responsibility_period_versions(
    employee_id, starts_on, ends_on, period_id, revision
  );

CREATE INDEX company_organization_responsibility_period_versions_unit_idx
  ON company_organization_responsibility_period_versions(
    organization_unit_id, responsibility_type, starts_on, ends_on, period_id, revision
  );

CREATE INDEX company_organization_unit_period_versions_code_idx
  ON company_organization_unit_period_versions(code, starts_on, ends_on, period_id, revision);

CREATE INDEX company_organization_unit_period_versions_parent_idx
  ON company_organization_unit_period_versions(parent_organization_unit_id, starts_on, ends_on);

CREATE INDEX company_organization_unit_period_versions_unit_idx
  ON company_organization_unit_period_versions(
    organization_unit_id, starts_on, ends_on, period_id, revision
  );

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
    SELECT 1 FROM company_organization_unit_period_versions unit
    WHERE unit.organization_unit_id = NEW.organization_unit_id
      AND unit.is_void = 0
      AND unit.revision = (
        SELECT max(latest.revision)
        FROM company_organization_unit_period_versions latest
        WHERE latest.period_id = unit.period_id
      )
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

CREATE TRIGGER company_organization_change_operations_command_immutable
BEFORE UPDATE OF request_fingerprint, actor_account_id, reason, evidence_references_json
ON company_organization_change_operations
BEGIN
  SELECT RAISE(ABORT, 'organization change command is immutable');
END;

CREATE TRIGGER company_organization_change_operations_completed_count_immutable
BEFORE UPDATE OF applied_count ON company_organization_change_operations
WHEN OLD.status = 'COMPLETED'
BEGIN
  SELECT RAISE(ABORT, 'completed organization change operation is immutable');
END;

CREATE TRIGGER company_organization_change_operations_completion_guard
BEFORE UPDATE OF status ON company_organization_change_operations
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is incomplete')
  WHERE OLD.status != 'PENDING'
    OR NEW.status != 'COMPLETED'
    OR NEW.applied_count != NEW.change_count
    OR NOT EXISTS (
      SELECT 1 FROM company_organization_lifecycle_states state
      WHERE state.id = 1 AND state.revision = NEW.resulting_revision
    );

  SELECT RAISE(ABORT, 'organization change leaves an orphan organization unit')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_unit_period_versions child
    WHERE child.is_void = 0
      AND child.parent_organization_unit_id IS NOT NULL
      AND child.revision = (
        SELECT max(latest.revision)
        FROM company_organization_unit_period_versions latest
        WHERE latest.period_id = child.period_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM company_organization_unit_period_versions parent
        WHERE parent.organization_unit_id = child.parent_organization_unit_id
          AND parent.is_void = 0
          AND parent.revision = (
            SELECT max(latest.revision)
            FROM company_organization_unit_period_versions latest
            WHERE latest.period_id = parent.period_id
          )
          AND parent.starts_on <= child.starts_on
          AND (
            parent.ends_on IS NULL
            OR (child.ends_on IS NOT NULL AND child.ends_on <= parent.ends_on)
          )
      )
  );

  SELECT RAISE(ABORT, 'organization change leaves an orphan assignment')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_assignment_period_versions assignment
    WHERE assignment.is_void = 0
      AND assignment.revision = (
        SELECT max(latest.revision)
        FROM company_organization_assignment_period_versions latest
        WHERE latest.period_id = assignment.period_id
      )
      AND (
        NOT EXISTS (
          SELECT 1 FROM company_employments employment
          WHERE employment.id = assignment.employment_id
            AND employment.employee_id = assignment.employee_id
            AND employment.hire_date <= assignment.starts_on
            AND (
              employment.termination_date IS NULL
              OR (
                assignment.ends_on IS NOT NULL
                AND assignment.ends_on <= date(employment.termination_date, '+1 day')
              )
            )
        )
        OR NOT EXISTS (
          SELECT 1 FROM company_organization_unit_period_versions unit
          WHERE unit.organization_unit_id = assignment.organization_unit_id
            AND unit.is_void = 0
            AND unit.revision = (
              SELECT max(latest.revision)
              FROM company_organization_unit_period_versions latest
              WHERE latest.period_id = unit.period_id
            )
            AND unit.starts_on <= assignment.starts_on
            AND (
              unit.ends_on IS NULL
              OR (assignment.ends_on IS NOT NULL AND assignment.ends_on <= unit.ends_on)
            )
        )
      )
  );

  SELECT RAISE(ABORT, 'organization change leaves an orphan responsibility')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_responsibility_period_versions responsibility
    WHERE responsibility.is_void = 0
      AND responsibility.revision = (
        SELECT max(latest.revision)
        FROM company_organization_responsibility_period_versions latest
        WHERE latest.period_id = responsibility.period_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM company_organization_assignment_period_versions assignment
        WHERE assignment.employment_id = responsibility.employment_id
          AND assignment.employee_id = responsibility.employee_id
          AND assignment.organization_unit_id = responsibility.organization_unit_id
          AND assignment.is_void = 0
          AND assignment.revision = (
            SELECT max(latest.revision)
            FROM company_organization_assignment_period_versions latest
            WHERE latest.period_id = assignment.period_id
          )
          AND assignment.starts_on <= responsibility.starts_on
          AND (
            assignment.ends_on IS NULL
            OR (
              responsibility.ends_on IS NOT NULL
              AND responsibility.ends_on <= assignment.ends_on
            )
          )
      )
  );
END;

CREATE TRIGGER company_organization_change_operations_immutable
BEFORE UPDATE OF id, expected_revision, change_count, resulting_revision, recorded_at
ON company_organization_change_operations
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is immutable');
END;

CREATE TRIGGER company_organization_change_operations_immutable_delete
BEFORE DELETE ON company_organization_change_operations
BEGIN
  SELECT RAISE(ABORT, 'organization change operations are append only');
END;

CREATE TRIGGER company_organization_change_operations_insert_guard
BEFORE INSERT ON company_organization_change_operations
BEGIN
  SELECT RAISE(ABORT, 'organization revision conflict')
  WHERE NEW.applied_count != 0
    OR NEW.status != 'PENDING'
    OR NOT EXISTS (
      SELECT 1 FROM company_organization_lifecycle_states state
      WHERE state.id = 1 AND state.revision = NEW.expected_revision
    );
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
    SELECT 1 FROM company_organization_unit_period_versions unit
    WHERE unit.organization_unit_id = NEW.organization_unit_id
      AND unit.is_void = 0
      AND unit.revision = (
        SELECT max(latest.revision)
        FROM company_organization_unit_period_versions latest
        WHERE latest.period_id = unit.period_id
      )
      AND unit.starts_on <= NEW.starts_on
      AND (
        unit.ends_on IS NULL
        OR (NEW.ends_on IS NOT NULL AND NEW.ends_on <= unit.ends_on)
      )
  );

  SELECT RAISE(ABORT, 'organization responsibility requires matching assignment')
  WHERE NEW.is_void = 0 AND NOT EXISTS (
    SELECT 1 FROM company_organization_assignment_period_versions assignment
    WHERE assignment.employment_id = NEW.employment_id
      AND assignment.employee_id = NEW.employee_id
      AND assignment.organization_unit_id = NEW.organization_unit_id
      AND assignment.is_void = 0
      AND assignment.revision = (
        SELECT max(latest.revision)
        FROM company_organization_assignment_period_versions latest
        WHERE latest.period_id = assignment.period_id
      )
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

INSERT INTO company_organization_lifecycle_states (id, revision, updated_at) VALUES (1, 0, 0);

CREATE TABLE company_organization_resource_bindings (
  organization_unit_id TEXT PRIMARY KEY NOT NULL REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT CHECK (organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  CHECK (length(organization_unit_id) = 36 AND organization_unit_id NOT GLOB '*[^0-9a-f-]*' AND substr(organization_unit_id, 9, 1) = '-' AND substr(organization_unit_id, 14, 1) = '-' AND substr(organization_unit_id, 19, 1) = '-' AND substr(organization_unit_id, 24, 1) = '-' AND length(replace(organization_unit_id, '-', '')) = 32 AND substr(organization_unit_id, 15, 1) GLOB '[1-8]' AND substr(organization_unit_id, 20, 1) GLOB '[89ab]')
);

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
CREATE TRIGGER company_organization_resource_adoptions_identity_update
BEFORE UPDATE OF id ON company_organization_resource_adoptions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

DROP TRIGGER IF EXISTS company_organization_resource_bindings_no_update;
CREATE TRIGGER company_organization_resource_bindings_no_update
BEFORE UPDATE ON company_organization_resource_bindings
BEGIN
  SELECT RAISE(ABORT, 'organization resource connection is immutable');
END;

DROP TRIGGER IF EXISTS company_organization_resource_bindings_no_delete;
CREATE TRIGGER company_organization_resource_bindings_no_delete
BEFORE DELETE ON company_organization_resource_bindings
BEGIN
  SELECT RAISE(ABORT, 'organization resource connection is immutable');
END;

DROP TRIGGER IF EXISTS company_organization_resource_adoptions_no_update;
CREATE TRIGGER company_organization_resource_adoptions_no_update
BEFORE UPDATE ON company_organization_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'organization resource connection is immutable');
END;

DROP TRIGGER IF EXISTS company_organization_resource_adoptions_no_delete;
CREATE TRIGGER company_organization_resource_adoptions_no_delete
BEFORE DELETE ON company_organization_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'organization resource connection is immutable');
END;

CREATE VIEW company_organization_resource_mismatches AS
SELECT binding.organization_unit_id
FROM company_organization_resource_bindings AS binding
JOIN company_organization_unit_period_versions AS period ON period.organization_unit_id = binding.organization_unit_id
WHERE period.revision = (SELECT max(latest.revision) FROM company_organization_unit_period_versions AS latest WHERE latest.period_id = period.period_id)
  AND NOT EXISTS (SELECT 1 FROM company_resource_heads AS head
    WHERE head.organization_id = binding.organization_id AND head.resource_type = 'organization-unit' AND head.resource_id = period.period_id
    AND head.revision = period.revision
    AND head.effective_from IS period.starts_on AND head.effective_to IS period.ends_on
    AND (head.state = 'void') = period.is_void
    AND json_extract(head.attributes_json, '$.organizationUnitId') IS period.organization_unit_id
    AND json_extract(head.attributes_json, '$.code') IS period.code
    AND json_extract(head.attributes_json, '$.officialName') IS period.official_name
    AND json_extract(head.attributes_json, '$.kind') IS period.kind
    AND json_extract(head.attributes_json, '$.parentOrganizationUnitId') IS period.parent_organization_unit_id)
UNION ALL
SELECT binding.organization_unit_id
FROM company_organization_resource_bindings AS binding
JOIN company_resource_heads AS head ON head.organization_id = binding.organization_id AND head.resource_type = 'organization-unit'
  AND json_extract(head.attributes_json, '$.organizationUnitId') = binding.organization_unit_id
WHERE NOT EXISTS (SELECT 1 FROM company_organization_unit_period_versions AS period
  WHERE period.revision = (SELECT max(latest.revision) FROM company_organization_unit_period_versions AS latest WHERE latest.period_id = period.period_id)
    AND head.resource_id = period.period_id
    AND head.revision = period.revision
    AND head.effective_from IS period.starts_on AND head.effective_to IS period.ends_on
    AND (head.state = 'void') = period.is_void
    AND json_extract(head.attributes_json, '$.organizationUnitId') IS period.organization_unit_id
    AND json_extract(head.attributes_json, '$.code') IS period.code
    AND json_extract(head.attributes_json, '$.officialName') IS period.official_name
    AND json_extract(head.attributes_json, '$.kind') IS period.kind
    AND json_extract(head.attributes_json, '$.parentOrganizationUnitId') IS period.parent_organization_unit_id);

DROP TRIGGER IF EXISTS company_organization_resource_commit_guard;
CREATE TRIGGER company_organization_resource_commit_guard
BEFORE UPDATE OF revision ON company_organizations
WHEN NEW.id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'
BEGIN
  SELECT RAISE(ABORT, 'organization resource history mismatch')
  WHERE EXISTS (SELECT 1 FROM company_organization_resource_mismatches);
END;

DROP TRIGGER IF EXISTS company_organization_resource_operation_guard;
CREATE TRIGGER company_organization_resource_operation_guard
BEFORE UPDATE OF status ON company_organization_change_operations
WHEN NEW.status = 'COMPLETED'
BEGIN
  SELECT RAISE(ABORT, 'organization resource history mismatch')
  WHERE EXISTS (SELECT 1 FROM company_organization_resource_mismatches);
END;

DROP TRIGGER IF EXISTS company_organization_resource_binding_guard;
CREATE TRIGGER company_organization_resource_binding_guard
AFTER INSERT ON company_organization_resource_bindings
WHEN 1
BEGIN
  SELECT RAISE(ABORT, 'organization resource history mismatch')
  WHERE EXISTS (SELECT 1 FROM company_organization_resource_mismatches WHERE organization_unit_id = NEW.organization_unit_id) OR NOT EXISTS (SELECT 1 FROM company_organization_unit_period_versions WHERE organization_unit_id = NEW.organization_unit_id);
END;

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
CREATE TRIGGER company_bootstrap_receipts_identity_update
BEFORE UPDATE OF id ON company_bootstrap_receipts
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

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

CREATE VIEW company_organization_unit_coverage AS
WITH heads AS (
  SELECT organization_unit_id, starts_on, ends_on FROM company_organization_unit_period_versions AS period
  WHERE is_void = 0 AND revision = (SELECT max(latest.revision) FROM company_organization_unit_period_versions AS latest WHERE latest.period_id = period.period_id)
), prior AS (
  SELECT *, max(coalesce(ends_on, '9999-12-31')) OVER (PARTITION BY organization_unit_id ORDER BY starts_on, ends_on ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS covered_until FROM heads
), groups AS (
  SELECT *, sum(CASE WHEN covered_until IS NULL OR starts_on > covered_until THEN 1 ELSE 0 END) OVER (PARTITION BY organization_unit_id ORDER BY starts_on, ends_on ROWS UNBOUNDED PRECEDING) AS island FROM prior
)
SELECT organization_unit_id, min(starts_on) AS starts_on, CASE WHEN max(ends_on IS NULL) = 1 THEN NULL ELSE max(ends_on) END AS ends_on
FROM groups GROUP BY organization_unit_id, island;

CREATE VIEW company_organization_assignment_coverage AS
WITH heads AS (
  SELECT employment_id, employee_id, organization_unit_id, starts_on, ends_on FROM company_organization_assignment_period_versions AS period
  WHERE is_void = 0 AND revision = (SELECT max(latest.revision) FROM company_organization_assignment_period_versions AS latest WHERE latest.period_id = period.period_id)
), prior AS (
  SELECT *, max(coalesce(ends_on, '9999-12-31')) OVER (PARTITION BY employment_id, employee_id, organization_unit_id ORDER BY starts_on, ends_on ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS covered_until FROM heads
), groups AS (
  SELECT *, sum(CASE WHEN covered_until IS NULL OR starts_on > covered_until THEN 1 ELSE 0 END) OVER (PARTITION BY employment_id, employee_id, organization_unit_id ORDER BY starts_on, ends_on ROWS UNBOUNDED PRECEDING) AS island FROM prior
)
SELECT employment_id, employee_id, organization_unit_id, min(starts_on) AS starts_on, CASE WHEN max(ends_on IS NULL) = 1 THEN NULL ELSE max(ends_on) END AS ends_on
FROM groups GROUP BY employment_id, employee_id, organization_unit_id, island;

DROP TRIGGER IF EXISTS organization_assignment_period_versions_guard;
DROP TRIGGER IF EXISTS company_organization_assignment_period_versions_guard;
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

DROP TRIGGER IF EXISTS organization_responsibility_period_versions_guard;
DROP TRIGGER IF EXISTS company_organization_responsibility_period_versions_guard;
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

DROP TRIGGER IF EXISTS organization_change_operations_completion_guard;
DROP TRIGGER IF EXISTS company_organization_change_operations_completion_guard;
CREATE TRIGGER company_organization_change_operations_completion_guard
BEFORE UPDATE OF status ON company_organization_change_operations
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is incomplete')
  WHERE OLD.status != 'PENDING'
    OR NEW.status != 'COMPLETED'
    OR NEW.applied_count != NEW.change_count
    OR NOT EXISTS (
      SELECT 1 FROM company_organization_lifecycle_states state
      WHERE state.id = 1 AND state.revision = NEW.resulting_revision
    );

  SELECT RAISE(ABORT, 'organization change leaves an orphan organization unit')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_unit_period_versions child
    WHERE child.is_void = 0
      AND child.parent_organization_unit_id IS NOT NULL
      AND child.revision = (
        SELECT max(latest.revision)
        FROM company_organization_unit_period_versions latest
        WHERE latest.period_id = child.period_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM company_organization_unit_coverage parent
        WHERE parent.organization_unit_id = child.parent_organization_unit_id
          AND parent.starts_on <= child.starts_on
          AND (
            parent.ends_on IS NULL
            OR (child.ends_on IS NOT NULL AND child.ends_on <= parent.ends_on)
          )
      )
  );

  SELECT RAISE(ABORT, 'organization change leaves an orphan assignment')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_assignment_period_versions assignment
    WHERE assignment.is_void = 0
      AND assignment.revision = (
        SELECT max(latest.revision)
        FROM company_organization_assignment_period_versions latest
        WHERE latest.period_id = assignment.period_id
      )
      AND (
        NOT EXISTS (
          SELECT 1 FROM company_employments employment
          WHERE employment.id = assignment.employment_id
            AND employment.employee_id = assignment.employee_id
            AND employment.hire_date <= assignment.starts_on
            AND (
              employment.termination_date IS NULL
              OR (
                assignment.ends_on IS NOT NULL
                AND assignment.ends_on <= date(employment.termination_date, '+1 day')
              )
            )
        )
        OR NOT EXISTS (
          SELECT 1 FROM company_organization_unit_coverage unit
          WHERE unit.organization_unit_id = assignment.organization_unit_id
            AND unit.starts_on <= assignment.starts_on
            AND (
              unit.ends_on IS NULL
              OR (assignment.ends_on IS NOT NULL AND assignment.ends_on <= unit.ends_on)
            )
        )
      )
  );

  SELECT RAISE(ABORT, 'organization change leaves an orphan responsibility')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_responsibility_period_versions responsibility
    WHERE responsibility.is_void = 0
      AND responsibility.revision = (
        SELECT max(latest.revision)
        FROM company_organization_responsibility_period_versions latest
        WHERE latest.period_id = responsibility.period_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM company_organization_assignment_coverage assignment
        WHERE assignment.employment_id = responsibility.employment_id
          AND assignment.employee_id = responsibility.employee_id
          AND assignment.organization_unit_id = responsibility.organization_unit_id
          AND assignment.starts_on <= responsibility.starts_on
          AND (
            assignment.ends_on IS NULL
            OR (
              responsibility.ends_on IS NOT NULL
              AND responsibility.ends_on <= assignment.ends_on
            )
          )
      )
  );
END;

CREATE UNIQUE INDEX company_profile_organization_identity ON company_resource_heads (organization_id) WHERE resource_type = 'company-profile';

DROP TRIGGER IF EXISTS company_profile_legacy_write_guard;
CREATE TRIGGER company_profile_legacy_write_guard
BEFORE UPDATE OF name, representative_name ON company_organizations
WHEN (NEW.name IS NOT OLD.name OR NEW.representative_name IS NOT OLD.representative_name)
AND EXISTS (SELECT 1 FROM company_resource_heads WHERE organization_id = OLD.id AND resource_type = 'company-profile')
BEGIN
  SELECT RAISE(ABORT, 'company profile legacy write is not canonical');
END;

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
CREATE TRIGGER company_profile_change_receipts_identity_update
BEFORE UPDATE OF id ON company_profile_change_receipts
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

DROP TRIGGER IF EXISTS company_profile_change_receipts_immutable_update;
CREATE TRIGGER company_profile_change_receipts_immutable_update
BEFORE UPDATE ON company_profile_change_receipts
BEGIN
  SELECT RAISE(ABORT, 'company profile change receipt is immutable');
END;

DROP TRIGGER IF EXISTS company_profile_change_receipts_immutable_delete;
CREATE TRIGGER company_profile_change_receipts_immutable_delete
BEFORE DELETE ON company_profile_change_receipts
BEGIN
  SELECT RAISE(ABORT, 'company profile change receipt is immutable');
END;

CREATE TABLE company_assignment_resource_bindings (
  resource_id TEXT PRIMARY KEY NOT NULL CHECK (length(resource_id) BETWEEN 1 AND 255),
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT CHECK (organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'),
  employee_id TEXT NOT NULL REFERENCES company_employees(id) ON DELETE RESTRICT,
  resource_revision INTEGER NOT NULL CHECK (resource_revision >= 1),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  CHECK (length(resource_id) = 36 AND resource_id NOT GLOB '*[^0-9a-f-]*' AND substr(resource_id, 9, 1) = '-' AND substr(resource_id, 14, 1) = '-' AND substr(resource_id, 19, 1) = '-' AND substr(resource_id, 24, 1) = '-' AND length(replace(resource_id, '-', '')) = 32 AND substr(resource_id, 15, 1) GLOB '[1-8]' AND substr(resource_id, 20, 1) GLOB '[89ab]')
);
CREATE INDEX company_assignment_resource_bindings_employee_idx ON company_assignment_resource_bindings(employee_id);
CREATE TABLE company_assignment_period_bindings (
  period_id TEXT PRIMARY KEY NOT NULL,
  resource_id TEXT NOT NULL REFERENCES company_assignment_resource_bindings(resource_id) ON DELETE RESTRICT,
  period_revision INTEGER NOT NULL CHECK (period_revision >= 1),
  source_revision INTEGER NOT NULL CHECK (source_revision >= 1),
  FOREIGN KEY (period_id, period_revision) REFERENCES company_organization_assignment_period_versions(period_id, revision) ON DELETE RESTRICT,
  CHECK (length(period_id) = 36 AND period_id NOT GLOB '*[^0-9a-f-]*' AND substr(period_id, 9, 1) = '-' AND substr(period_id, 14, 1) = '-' AND substr(period_id, 19, 1) = '-' AND substr(period_id, 24, 1) = '-' AND length(replace(period_id, '-', '')) = 32 AND substr(period_id, 15, 1) GLOB '[1-8]' AND substr(period_id, 20, 1) GLOB '[89ab]')
);
CREATE INDEX company_assignment_period_bindings_resource_idx ON company_assignment_period_bindings(resource_id);

DROP TRIGGER IF EXISTS company_assignment_resource_bindings_update_guard;
CREATE TRIGGER company_assignment_resource_bindings_update_guard
BEFORE UPDATE ON company_assignment_resource_bindings
WHEN NEW.resource_id != OLD.resource_id OR NEW.organization_id != OLD.organization_id
  OR NEW.employee_id != OLD.employee_id OR NEW.resource_revision < OLD.resource_revision
BEGIN
  SELECT RAISE(ABORT, 'organization assignment source identity is immutable');
END;

DROP TRIGGER IF EXISTS company_assignment_resource_bindings_delete_guard;
CREATE TRIGGER company_assignment_resource_bindings_delete_guard
BEFORE DELETE ON company_assignment_resource_bindings
BEGIN
  SELECT RAISE(ABORT, 'organization assignment source identity is immutable');
END;

DROP TRIGGER IF EXISTS company_assignment_period_bindings_update_guard;
CREATE TRIGGER company_assignment_period_bindings_update_guard
BEFORE UPDATE ON company_assignment_period_bindings
WHEN NEW.period_id != OLD.period_id OR NEW.resource_id != OLD.resource_id OR NEW.period_revision < OLD.period_revision
BEGIN
  SELECT RAISE(ABORT, 'organization assignment period source is immutable');
END;

DROP TRIGGER IF EXISTS company_assignment_period_bindings_delete_guard;
CREATE TRIGGER company_assignment_period_bindings_delete_guard
BEFORE DELETE ON company_assignment_period_bindings
BEGIN
  SELECT RAISE(ABORT, 'organization assignment period source is immutable');
END;

DROP TRIGGER IF EXISTS company_organization_assignment_source_completion_guard;
CREATE TRIGGER company_organization_assignment_source_completion_guard
BEFORE UPDATE OF status ON company_organization_change_operations
WHEN NEW.status = 'COMPLETED'
BEGIN
  SELECT RAISE(ABORT, 'organization assignment source is stale')
  WHERE EXISTS (
    SELECT 1 FROM company_assignment_period_bindings binding
    JOIN company_assignment_resource_bindings resource ON resource.resource_id = binding.resource_id
    JOIN company_organization_assignment_period_versions period ON period.period_id = binding.period_id
    WHERE period.revision = (SELECT max(latest.revision) FROM company_organization_assignment_period_versions latest WHERE latest.period_id = period.period_id)
      AND (period.revision != binding.period_revision OR period.employee_id != resource.employee_id
        OR period.manager_employee_id IS NOT NULL)
  );
  SELECT RAISE(ABORT, 'organization assignment public source is stale')
  WHERE EXISTS (
    SELECT 1 FROM company_assignment_resource_bindings binding
    WHERE NOT EXISTS (
      SELECT 1 FROM company_resource_heads head WHERE head.organization_id = binding.organization_id
        AND head.resource_type = 'assignment' AND head.resource_id = binding.resource_id
        AND head.revision = binding.resource_revision
    )
  );
END;

DROP TRIGGER IF EXISTS company_assignment_employment_projection_guard;
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
    REFERENCES company_resource_heads(organization_id, resource_type, resource_id) ON DELETE RESTRICT,
  CHECK (length(resource_id) = 36 AND resource_id NOT GLOB '*[^0-9a-f-]*' AND substr(resource_id, 9, 1) = '-' AND substr(resource_id, 14, 1) = '-' AND substr(resource_id, 19, 1) = '-' AND substr(resource_id, 24, 1) = '-' AND length(replace(resource_id, '-', '')) = 32 AND substr(resource_id, 15, 1) GLOB '[1-8]' AND substr(resource_id, 20, 1) GLOB '[89ab]')
);

DROP TRIGGER IF EXISTS company_personnel_reporting_binding_update_guard;
CREATE TRIGGER company_personnel_reporting_binding_update_guard
BEFORE UPDATE ON company_personnel_reporting_bindings
BEGIN
  SELECT RAISE(ABORT, 'company personnel reporting binding is immutable');
END;

DROP TRIGGER IF EXISTS company_personnel_reporting_binding_delete_guard;
CREATE TRIGGER company_personnel_reporting_binding_delete_guard
BEFORE DELETE ON company_personnel_reporting_bindings
BEGIN
  SELECT RAISE(ABORT, 'company personnel reporting binding is immutable');
END;

DROP TRIGGER IF EXISTS company_personnel_reporting_owner_guard;
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

DROP TRIGGER IF EXISTS company_personnel_reporting_binding_insert_guard;
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

CREATE VIEW company_personnel_reporting_periods AS
WITH effective_versions AS (
  SELECT resource.*, binding.employee_id, binding.employment_id, binding.organization_unit_id, binding.assignment_type
  FROM company_resource_revisions resource
  JOIN company_personnel_reporting_bindings binding
    ON binding.organization_id = resource.organization_id AND resource.resource_type = 'reporting-relation'
      AND binding.resource_id = resource.resource_id
  WHERE resource.revision = (
    SELECT max(latest.revision) FROM company_resource_revisions latest
    WHERE latest.organization_id = resource.organization_id AND latest.resource_type = resource.resource_type
      AND latest.resource_id = resource.resource_id AND latest.effective_from = resource.effective_from
  )
), next_versions AS (
  SELECT *, lead(effective_from) OVER (PARTITION BY organization_id, resource_id ORDER BY effective_from) AS next_from
  FROM effective_versions
)
SELECT organization_id, resource_id, employee_id, employment_id, organization_unit_id, assignment_type,
  effective_from AS starts_on,
  CASE WHEN next_from IS NULL OR (effective_to IS NOT NULL AND effective_to < next_from)
    THEN effective_to ELSE next_from END AS ends_on
FROM next_versions WHERE state = 'active';

CREATE VIEW company_personnel_reporting_assignment_coverage AS
WITH heads AS (
  SELECT employment_id, employee_id, organization_unit_id, assignment_type, starts_on, ends_on
  FROM company_organization_assignment_period_versions period
  JOIN company_assignment_period_bindings binding ON binding.period_id = period.period_id
  WHERE is_void = 0 AND revision = (SELECT max(latest.revision)
    FROM company_organization_assignment_period_versions latest WHERE latest.period_id = period.period_id)
), prior AS (
  SELECT *, max(coalesce(ends_on, '9999-12-31')) OVER (
    PARTITION BY employment_id, employee_id, organization_unit_id, assignment_type
    ORDER BY starts_on, ends_on ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS covered_until
  FROM heads
), groups AS (
  SELECT *, sum(CASE WHEN covered_until IS NULL OR starts_on > covered_until THEN 1 ELSE 0 END) OVER (
    PARTITION BY employment_id, employee_id, organization_unit_id, assignment_type
    ORDER BY starts_on, ends_on ROWS UNBOUNDED PRECEDING) AS island
  FROM prior
)
SELECT employment_id, employee_id, organization_unit_id, assignment_type, min(starts_on) AS starts_on,
  CASE WHEN max(ends_on IS NULL) = 1 THEN NULL ELSE max(ends_on) END AS ends_on
FROM groups GROUP BY employment_id, employee_id, organization_unit_id, assignment_type, island;

DROP TRIGGER IF EXISTS company_personnel_reporting_commit_guard;
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

DROP TRIGGER IF EXISTS company_personnel_reporting_completion_guard;
CREATE TRIGGER company_personnel_reporting_completion_guard
BEFORE UPDATE OF status ON company_organization_change_operations
WHEN NEW.status = 'COMPLETED'
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

DROP TRIGGER IF EXISTS company_personnel_reporting_coverage_insert_guard;
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

CREATE VIEW company_reporting_employment_violations AS
WITH effective_versions AS (
  SELECT resource.* FROM company_resource_revisions resource
  WHERE resource.resource_type = 'reporting-relation' AND resource.revision = (
    SELECT max(latest.revision) FROM company_resource_revisions latest
    WHERE latest.organization_id = resource.organization_id AND latest.resource_type = resource.resource_type
      AND latest.resource_id = resource.resource_id AND latest.effective_from = resource.effective_from
  )
), next_versions AS (
  SELECT *, lead(effective_from) OVER (PARTITION BY organization_id, resource_id ORDER BY effective_from) AS next_from
  FROM effective_versions
), relations AS (
  SELECT organization_id, resource_id, attributes_json, effective_from AS starts_on,
    CASE WHEN next_from IS NULL OR (effective_to IS NOT NULL AND effective_to < next_from)
      THEN effective_to ELSE next_from END AS ends_on
  FROM next_versions WHERE state = 'active'
), participants AS (
  SELECT organization_id, resource_id, starts_on, ends_on,
    json_extract(attributes_json, '$.employeeId') AS employee_id FROM relations
  UNION ALL
  SELECT organization_id, resource_id, starts_on, ends_on,
    json_extract(attributes_json, '$.managerEmployeeId') AS employee_id FROM relations
), heads AS (
  SELECT binding.organization_id, period.employee_id, period.starts_on, period.ends_on
  FROM company_employment_period_versions period
  JOIN company_workforce_resource_bindings binding
    ON binding.resource_type = 'employee' AND binding.resource_id = period.employee_id
  WHERE period.is_void = 0 AND period.revision = (SELECT max(latest.revision)
    FROM company_employment_period_versions latest WHERE latest.period_id = period.period_id)
), prior AS (
  SELECT *, max(coalesce(ends_on, '9999-12-31')) OVER (
    PARTITION BY organization_id, employee_id ORDER BY starts_on, ends_on
    ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS covered_until
  FROM heads
), groups AS (
  SELECT *, sum(CASE WHEN covered_until IS NULL OR starts_on > covered_until THEN 1 ELSE 0 END) OVER (
    PARTITION BY organization_id, employee_id ORDER BY starts_on, ends_on ROWS UNBOUNDED PRECEDING) AS island
  FROM prior
), coverage AS (
  SELECT organization_id, employee_id, min(starts_on) AS starts_on,
    CASE WHEN max(ends_on IS NULL) = 1 THEN NULL ELSE max(ends_on) END AS ends_on
  FROM groups GROUP BY organization_id, employee_id, island
)
SELECT participant.* FROM participants participant WHERE NOT EXISTS (
  SELECT 1 FROM coverage WHERE coverage.organization_id = participant.organization_id
    AND coverage.employee_id = participant.employee_id AND coverage.starts_on <= participant.starts_on
    AND (coverage.ends_on IS NULL OR
      (participant.ends_on IS NOT NULL AND participant.ends_on <= coverage.ends_on))
);

DROP TRIGGER IF EXISTS company_reporting_employment_commit_guard;
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

DROP TRIGGER IF EXISTS company_reporting_employment_projection_guard;
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
CREATE TRIGGER company_assignment_resource_adoptions_identity_update
BEFORE UPDATE OF id ON company_assignment_resource_adoptions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

DROP TRIGGER IF EXISTS company_assignment_resource_adoptions_update_guard;
CREATE TRIGGER company_assignment_resource_adoptions_update_guard
BEFORE UPDATE ON company_assignment_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'assignment adoption evidence is immutable');
END;

DROP TRIGGER IF EXISTS company_assignment_resource_adoptions_delete_guard;
CREATE TRIGGER company_assignment_resource_adoptions_delete_guard
BEFORE DELETE ON company_assignment_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'assignment adoption evidence is immutable');
END;

CREATE TABLE _company_reporting_bindings_with_adoptions (
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

INSERT INTO _company_reporting_bindings_with_adoptions (rowid, resource_id, organization_id, resource_type, employee_id, employment_id, organization_unit_id, assignment_type, recorded_by_action_id)
SELECT rowid, resource_id, organization_id, resource_type, employee_id, employment_id, organization_unit_id, assignment_type, recorded_by_action_id FROM company_personnel_reporting_bindings;
CREATE TABLE _company_reporting_binding_copy_check (ok INTEGER NOT NULL CHECK (ok = 1));
INSERT INTO _company_reporting_binding_copy_check (ok)
SELECT NOT EXISTS (
  SELECT rowid, resource_id, organization_id, resource_type, employee_id, employment_id, organization_unit_id, assignment_type, recorded_by_action_id FROM company_personnel_reporting_bindings
  EXCEPT SELECT rowid, resource_id, organization_id, resource_type, employee_id, employment_id, organization_unit_id, assignment_type, recorded_by_action_id FROM _company_reporting_bindings_with_adoptions
) AND NOT EXISTS (
  SELECT rowid, resource_id, organization_id, resource_type, employee_id, employment_id, organization_unit_id, assignment_type, recorded_by_action_id FROM _company_reporting_bindings_with_adoptions
  EXCEPT SELECT rowid, resource_id, organization_id, resource_type, employee_id, employment_id, organization_unit_id, assignment_type, recorded_by_action_id FROM company_personnel_reporting_bindings
);
DROP TRIGGER IF EXISTS company_personnel_reporting_binding_update_guard;
DROP TRIGGER IF EXISTS company_personnel_reporting_binding_delete_guard;
DROP TRIGGER IF EXISTS company_personnel_reporting_binding_insert_guard;
DROP TRIGGER IF EXISTS company_personnel_reporting_coverage_insert_guard;
DROP TRIGGER IF EXISTS company_personnel_reporting_owner_guard;
DROP TRIGGER IF EXISTS company_personnel_reporting_commit_guard;
DROP TRIGGER IF EXISTS company_personnel_reporting_completion_guard;
DROP VIEW company_personnel_reporting_periods;
DROP TABLE company_personnel_reporting_bindings;
ALTER TABLE _company_reporting_bindings_with_adoptions RENAME TO company_personnel_reporting_bindings;
DROP TABLE _company_reporting_binding_copy_check;

CREATE VIEW company_personnel_reporting_periods AS
WITH effective_versions AS (
  SELECT resource.*, binding.employee_id, binding.employment_id, binding.organization_unit_id, binding.assignment_type
  FROM company_resource_revisions resource
  JOIN company_personnel_reporting_bindings binding
    ON binding.organization_id = resource.organization_id AND resource.resource_type = 'reporting-relation'
      AND binding.resource_id = resource.resource_id
  WHERE resource.revision = (
    SELECT max(latest.revision) FROM company_resource_revisions latest
    WHERE latest.organization_id = resource.organization_id AND latest.resource_type = resource.resource_type
      AND latest.resource_id = resource.resource_id AND latest.effective_from = resource.effective_from
  )
), next_versions AS (
  SELECT *, lead(effective_from) OVER (PARTITION BY organization_id, resource_id ORDER BY effective_from) AS next_from
  FROM effective_versions
)
SELECT organization_id, resource_id, employee_id, employment_id, organization_unit_id, assignment_type,
  effective_from AS starts_on,
  CASE WHEN next_from IS NULL OR (effective_to IS NOT NULL AND effective_to < next_from)
    THEN effective_to ELSE next_from END AS ends_on
FROM next_versions WHERE state = 'active';


DROP TRIGGER IF EXISTS company_personnel_reporting_binding_update_guard;
CREATE TRIGGER company_personnel_reporting_binding_update_guard
BEFORE UPDATE ON company_personnel_reporting_bindings
BEGIN
  SELECT RAISE(ABORT, 'company personnel reporting binding is immutable');
END;

DROP TRIGGER IF EXISTS company_personnel_reporting_binding_delete_guard;
CREATE TRIGGER company_personnel_reporting_binding_delete_guard
BEFORE DELETE ON company_personnel_reporting_bindings
BEGIN
  SELECT RAISE(ABORT, 'company personnel reporting binding is immutable');
END;

DROP TRIGGER IF EXISTS company_personnel_reporting_owner_guard;
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

DROP TRIGGER IF EXISTS company_personnel_reporting_binding_insert_guard;
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

DROP TRIGGER IF EXISTS company_personnel_reporting_commit_guard;
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

DROP TRIGGER IF EXISTS company_personnel_reporting_completion_guard;
CREATE TRIGGER company_personnel_reporting_completion_guard
BEFORE UPDATE OF status ON company_organization_change_operations
WHEN NEW.status = 'COMPLETED'
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

DROP TRIGGER IF EXISTS company_personnel_reporting_coverage_insert_guard;
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

-- Account-to-Employee identity and effective public history.
CREATE TABLE company_account_employee_resource_bindings (
  resource_id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL DEFAULT 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d' CHECK (organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'),
  resource_type TEXT NOT NULL DEFAULT 'account-employee-link' CHECK (resource_type = 'account-employee-link'),
  account_id TEXT NOT NULL UNIQUE REFERENCES system_accounts(id) ON DELETE RESTRICT,
  employee_id TEXT NOT NULL UNIQUE REFERENCES company_employees(id) ON DELETE RESTRICT,
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  FOREIGN KEY (organization_id, resource_type, resource_id)
    REFERENCES company_resource_heads(organization_id, resource_type, resource_id) ON DELETE RESTRICT,
  CHECK (length(resource_id) = 36 AND resource_id NOT GLOB '*[^0-9a-f-]*' AND substr(resource_id, 9, 1) = '-' AND substr(resource_id, 14, 1) = '-' AND substr(resource_id, 19, 1) = '-' AND substr(resource_id, 24, 1) = '-' AND length(replace(resource_id, '-', '')) = 32 AND substr(resource_id, 15, 1) GLOB '[1-8]' AND substr(resource_id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE _company_account_link_copy_check (ok INTEGER NOT NULL CHECK (ok = 1));
INSERT INTO _company_account_link_copy_check (ok)
SELECT NOT EXISTS (
  SELECT 1 FROM company_resource_revisions resource
  JOIN company_resource_heads head ON head.organization_id = resource.organization_id
    AND head.resource_type = resource.resource_type AND head.resource_id = resource.resource_id
  WHERE resource.resource_type = 'account-employee-link' AND (
    resource.organization_id != 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'
    OR json_extract(resource.attributes_json, '$.accountId') IS NOT json_extract(head.attributes_json, '$.accountId')
    OR json_extract(resource.attributes_json, '$.employeeId') IS NOT json_extract(head.attributes_json, '$.employeeId')
    OR EXISTS (SELECT 1 FROM company_account_employee_links original WHERE
      (original.account_id = json_extract(resource.attributes_json, '$.accountId')
        AND original.employee_id IS NOT json_extract(resource.attributes_json, '$.employeeId'))
      OR (original.employee_id = json_extract(resource.attributes_json, '$.employeeId')
        AND original.account_id IS NOT json_extract(resource.attributes_json, '$.accountId')))
  )
);
INSERT INTO company_account_employee_links (account_id, employee_id)
SELECT json_extract(head.attributes_json, '$.accountId'), json_extract(head.attributes_json, '$.employeeId')
FROM company_resource_heads head WHERE head.resource_type = 'account-employee-link'
  AND NOT EXISTS (SELECT 1 FROM company_account_employee_links original
    WHERE original.account_id = json_extract(head.attributes_json, '$.accountId'));
INSERT INTO company_account_employee_resource_bindings
  (resource_id, organization_id, account_id, employee_id, recorded_at)
SELECT resource_id, organization_id, json_extract(attributes_json, '$.accountId'),
  json_extract(attributes_json, '$.employeeId'), updated_at
FROM company_resource_heads WHERE resource_type = 'account-employee-link';
DROP TABLE _company_account_link_copy_check;
CREATE VIEW company_account_employee_link_periods AS
WITH effective_versions AS (
  SELECT resource.*, (
    SELECT min(later.effective_from) FROM company_resource_revisions later
    WHERE later.organization_id = resource.organization_id AND later.resource_type = resource.resource_type
      AND later.resource_id = resource.resource_id AND later.effective_from > resource.effective_from
  ) AS next_from FROM company_resource_revisions resource
  WHERE resource.resource_type = 'account-employee-link' AND resource.revision = (
    SELECT max(latest.revision) FROM company_resource_revisions latest
    WHERE latest.organization_id = resource.organization_id AND latest.resource_type = resource.resource_type
      AND latest.resource_id = resource.resource_id AND latest.effective_from = resource.effective_from
  )
)
SELECT binding.account_id, binding.employee_id, resource.effective_from AS starts_on,
  CASE WHEN resource.next_from IS NULL OR (resource.effective_to IS NOT NULL AND resource.effective_to < resource.next_from)
    THEN resource.effective_to ELSE resource.next_from END AS ends_on,
  binding.resource_id, resource.revision, resource.organization_revision, 'public' AS source
FROM effective_versions resource
JOIN company_account_employee_resource_bindings binding
  ON binding.organization_id = resource.organization_id AND binding.resource_id = resource.resource_id
WHERE resource.state = 'active'
UNION ALL
SELECT original.account_id, original.employee_id, NULL, NULL, NULL, NULL, NULL, 'legacy'
FROM company_account_employee_links original
WHERE NOT EXISTS (SELECT 1 FROM company_account_employee_resource_bindings binding
  WHERE binding.account_id = original.account_id OR binding.employee_id = original.employee_id)
  AND NOT EXISTS (SELECT 1 FROM company_resource_heads resource WHERE resource.resource_type = 'account-employee-link'
    AND CAST(json_extract(resource.attributes_json, '$.accountId') AS TEXT) = original.account_id)
  AND NOT EXISTS (SELECT 1 FROM company_resource_heads resource WHERE resource.resource_type = 'account-employee-link'
    AND CAST(json_extract(resource.attributes_json, '$.employeeId') AS TEXT) = original.employee_id);
CREATE INDEX company_account_link_head_account_idx ON company_resource_heads
  (CAST(json_extract(attributes_json, '$.accountId') AS TEXT)) WHERE resource_type = 'account-employee-link';
CREATE INDEX company_account_link_head_employee_idx ON company_resource_heads
  (CAST(json_extract(attributes_json, '$.employeeId') AS TEXT)) WHERE resource_type = 'account-employee-link';
DROP TRIGGER IF EXISTS company_account_employee_resource_bindings_update_guard;
CREATE TRIGGER company_account_employee_resource_bindings_update_guard
BEFORE UPDATE ON company_account_employee_resource_bindings
BEGIN
  SELECT RAISE(ABORT, 'company account link bindings are immutable');
END;
DROP TRIGGER IF EXISTS company_account_employee_resource_bindings_delete_guard;
CREATE TRIGGER company_account_employee_resource_bindings_delete_guard
BEFORE DELETE ON company_account_employee_resource_bindings
BEGIN
  SELECT RAISE(ABORT, 'company account link bindings are immutable');
END;
DROP TRIGGER IF EXISTS company_account_employee_resource_owner_guard;
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
DROP TRIGGER IF EXISTS company_account_employee_resource_commit_guard;
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
CREATE TABLE _company_account_link_period_check (ok INTEGER NOT NULL CHECK (ok = 1));
INSERT INTO _company_account_link_period_check (ok)
SELECT NOT EXISTS (SELECT 1 FROM company_account_employee_link_period_violations)
  AND NOT EXISTS (SELECT 1 FROM company_account_employee_resource_bindings link
    WHERE NOT EXISTS (SELECT 1 FROM company_workforce_resource_bindings employee
      WHERE employee.organization_id = link.organization_id AND employee.resource_type = 'employee'
        AND employee.resource_id = link.employee_id));
DROP TABLE _company_account_link_period_check;

DROP VIEW IF EXISTS company_governance_organization_reference_violations;
DROP VIEW IF EXISTS company_governance_organization_unit_coverage;
CREATE VIEW company_governance_organization_unit_coverage AS
WITH periods AS (
  SELECT organization_id, json_extract(attributes_json, '$.organizationUnitId') AS organization_unit_id,
    effective_from AS starts_on, effective_to AS ends_on
  FROM company_resource_heads WHERE resource_type = 'organization-unit' AND state = 'active'
), prior AS (
  SELECT *, max(coalesce(ends_on, '9999-12-31')) OVER (
    PARTITION BY organization_id, organization_unit_id
    ORDER BY starts_on, ends_on ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
  ) AS covered_until FROM periods
), islands AS (
  SELECT *, sum(CASE WHEN covered_until IS NULL OR starts_on > covered_until THEN 1 ELSE 0 END) OVER (
    PARTITION BY organization_id, organization_unit_id ORDER BY starts_on, ends_on
    ROWS UNBOUNDED PRECEDING
  ) AS island FROM prior
)
SELECT organization_id, organization_unit_id, min(starts_on) AS starts_on,
  CASE WHEN max(ends_on IS NULL) = 1 THEN NULL ELSE max(ends_on) END AS ends_on
FROM islands GROUP BY organization_id, organization_unit_id, island;

CREATE VIEW company_governance_organization_reference_violations AS
SELECT resource.organization_id, resource.resource_type, resource.resource_id
FROM company_resource_heads resource
WHERE resource.state = 'active' AND (
  (resource.resource_type = 'organizational-office' AND (
    NOT EXISTS (
      SELECT 1 FROM company_governance_organization_unit_coverage unit
      WHERE unit.organization_id = resource.organization_id
        AND unit.organization_unit_id = json_extract(resource.attributes_json, '$.organizationUnitId')
        AND unit.starts_on <= resource.effective_from
        AND (unit.ends_on IS NULL OR (resource.effective_to IS NOT NULL AND resource.effective_to <= unit.ends_on))
    ) OR NOT EXISTS (
      SELECT 1 FROM company_resource_heads position
      WHERE position.organization_id = resource.organization_id AND position.resource_type = 'position'
        AND position.resource_id = json_extract(resource.attributes_json, '$.positionId')
        AND position.state = 'active' AND position.effective_from <= resource.effective_from
        AND (position.effective_to IS NULL OR (resource.effective_to IS NOT NULL AND resource.effective_to <= position.effective_to))
    )
  )) OR (resource.resource_type = 'authority-scope'
    AND json_extract(resource.attributes_json, '$.scopeType') = 'organization-unit'
    AND NOT EXISTS (
      SELECT 1 FROM company_governance_organization_unit_coverage unit
      WHERE unit.organization_id = resource.organization_id
        AND unit.organization_unit_id = json_extract(resource.attributes_json, '$.scopeId')
        AND unit.starts_on <= resource.effective_from
        AND (unit.ends_on IS NULL OR (resource.effective_to IS NOT NULL AND resource.effective_to <= unit.ends_on))
    )
  )
);

SELECT json_extract('{}', 'company_governance_organization_reference_invalid')
FROM company_governance_organization_reference_violations LIMIT 1;

DROP TRIGGER IF EXISTS company_organizational_office_reference_guard;
CREATE TRIGGER company_organizational_office_reference_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'organizational-office' AND NEW.state = 'active' AND (
  NOT EXISTS (
    SELECT 1 FROM company_governance_organization_unit_coverage unit
    WHERE unit.organization_id = NEW.organization_id
      AND unit.organization_unit_id = json_extract(NEW.attributes_json, '$.organizationUnitId')
      AND unit.starts_on <= NEW.effective_from
      AND (unit.ends_on IS NULL OR (NEW.effective_to IS NOT NULL AND NEW.effective_to <= unit.ends_on))
  ) OR NOT EXISTS (
    SELECT 1 FROM company_resource_heads position
    WHERE position.organization_id = NEW.organization_id AND position.resource_type = 'position'
      AND position.resource_id = json_extract(NEW.attributes_json, '$.positionId')
      AND position.state = 'active' AND position.effective_from <= NEW.effective_from
      AND (position.effective_to IS NULL OR (NEW.effective_to IS NOT NULL AND NEW.effective_to <= position.effective_to))
  )
)
BEGIN
  SELECT RAISE(ABORT, 'company_governance_organization_reference_invalid');
END;

DROP TRIGGER IF EXISTS company_authority_scope_reference_guard;
CREATE TRIGGER company_authority_scope_reference_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'authority-scope' AND NEW.state = 'active' AND (
  (json_extract(NEW.attributes_json, '$.scopeType') = 'organization-unit' AND NOT EXISTS (
    SELECT 1 FROM company_governance_organization_unit_coverage unit
    WHERE unit.organization_id = NEW.organization_id
      AND unit.organization_unit_id = json_extract(NEW.attributes_json, '$.scopeId')
      AND unit.starts_on <= NEW.effective_from
      AND (unit.ends_on IS NULL OR (NEW.effective_to IS NOT NULL AND NEW.effective_to <= unit.ends_on))
  )) OR (json_extract(NEW.attributes_json, '$.scopeType') IN ('legal-entity', 'site', 'workplace') AND NOT EXISTS (
    SELECT 1 FROM company_resource_heads scoped
    WHERE scoped.organization_id = NEW.organization_id
      AND scoped.resource_type = json_extract(NEW.attributes_json, '$.scopeType')
      AND scoped.resource_id = json_extract(NEW.attributes_json, '$.scopeId') AND scoped.state = 'active'
  ))
)
BEGIN
  SELECT RAISE(ABORT, 'company_governance_organization_reference_invalid');
END;

DROP TRIGGER IF EXISTS company_governance_organization_revision_guard;
CREATE TRIGGER company_governance_organization_revision_guard
BEFORE UPDATE OF revision ON company_organizations
WHEN EXISTS (
  SELECT 1 FROM company_governance_organization_reference_violations violation
  WHERE violation.organization_id = NEW.id
)
BEGIN
  SELECT RAISE(ABORT, 'company_governance_organization_reference_invalid');
END;

DROP VIEW IF EXISTS company_employment_authority_violations;
CREATE VIEW company_employment_authority_violations AS
WITH effective_versions AS (
  SELECT resource.* FROM company_resource_revisions resource
  WHERE resource.resource_type IN ('office-assignment', 'organizational-authority')
    AND resource.revision = (
      SELECT max(latest.revision) FROM company_resource_revisions latest
      WHERE latest.organization_id = resource.organization_id AND latest.resource_type = resource.resource_type
        AND latest.resource_id = resource.resource_id AND latest.effective_from = resource.effective_from
    )
), next_versions AS (
  SELECT *, lead(effective_from) OVER (
    PARTITION BY organization_id, resource_type, resource_id ORDER BY effective_from
  ) AS next_from FROM effective_versions
), appointments AS (
  SELECT organization_id, resource_type, resource_id,
    json_extract(attributes_json, '$.employeeId') AS employee_id,
    json_extract(attributes_json, '$.employmentId') AS employment_id,
    json_extract(attributes_json, '$.scopeType') AS scope_type,
    json_extract(attributes_json, '$.scopeId') AS scope_id,
    effective_from AS starts_on,
    CASE WHEN next_from IS NULL OR (effective_to IS NOT NULL AND effective_to < next_from)
      THEN effective_to ELSE next_from END AS ends_on
  FROM next_versions WHERE state = 'active'
), periods AS (
  SELECT binding.organization_id, period.employee_id, period.period_id AS employment_id,
    'employment' AS kind, NULL AS scope_id, period.starts_on, period.ends_on
  FROM company_employment_period_versions period
  JOIN company_workforce_resource_bindings binding
    ON binding.resource_type = 'employee' AND binding.resource_id = period.employee_id
  WHERE period.is_void = 0 AND period.revision = (SELECT max(latest.revision)
    FROM company_employment_period_versions latest WHERE latest.period_id = period.period_id)
  UNION ALL
  SELECT binding.organization_id, period.employee_id, period.employment_id,
    'assignment', period.organization_unit_id, period.starts_on, period.ends_on
  FROM company_organization_assignment_coverage period
  JOIN company_workforce_resource_bindings binding
    ON binding.resource_type = 'employee' AND binding.resource_id = period.employee_id
  UNION ALL
  SELECT binding.organization_id, period.employee_id, period.employment_id,
    'assignment', NULL, period.starts_on, period.ends_on
  FROM company_organization_assignment_coverage period
  JOIN company_workforce_resource_bindings binding
    ON binding.resource_type = 'employee' AND binding.resource_id = period.employee_id
), prior AS (
  SELECT *, max(coalesce(ends_on, '9999-12-31')) OVER (
    PARTITION BY organization_id, employee_id, employment_id, kind, scope_id
    ORDER BY starts_on, ends_on ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
  ) AS covered_until FROM periods
), islands AS (
  SELECT *, sum(CASE WHEN covered_until IS NULL OR starts_on > covered_until THEN 1 ELSE 0 END) OVER (
    PARTITION BY organization_id, employee_id, employment_id, kind, scope_id
    ORDER BY starts_on, ends_on ROWS UNBOUNDED PRECEDING
  ) AS island FROM prior
), coverage AS (
  SELECT organization_id, employee_id, employment_id, kind, scope_id, min(starts_on) AS starts_on,
    CASE WHEN max(ends_on IS NULL) = 1 THEN NULL ELSE max(ends_on) END AS ends_on
  FROM islands GROUP BY organization_id, employee_id, employment_id, kind, scope_id, island
)
SELECT appointment.* FROM appointments appointment WHERE
  NOT EXISTS (
    SELECT 1 FROM coverage WHERE coverage.organization_id = appointment.organization_id
      AND coverage.employee_id = appointment.employee_id AND coverage.employment_id = appointment.employment_id
      AND coverage.kind = 'employment' AND coverage.starts_on <= appointment.starts_on
      AND (coverage.ends_on IS NULL OR (appointment.ends_on IS NOT NULL AND appointment.ends_on <= coverage.ends_on))
  ) OR (appointment.resource_type = 'organizational-authority' AND NOT EXISTS (
    SELECT 1 FROM coverage WHERE coverage.organization_id = appointment.organization_id
      AND coverage.employee_id = appointment.employee_id AND coverage.employment_id = appointment.employment_id
      AND coverage.kind = 'assignment' AND coverage.starts_on <= appointment.starts_on
      AND (coverage.ends_on IS NULL OR (appointment.ends_on IS NOT NULL AND appointment.ends_on <= coverage.ends_on))
      AND ((appointment.scope_type = 'organization-unit' AND coverage.scope_id = appointment.scope_id)
        OR (appointment.scope_type = 'authority-scope' AND coverage.scope_id IS NULL))
  ));

SELECT json_extract('{}', 'company_employment_authority_period_not_covered')
FROM company_employment_authority_violations LIMIT 1;

DROP TRIGGER IF EXISTS company_employment_authority_commit_guard;
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

DROP TRIGGER IF EXISTS company_employment_authority_projection_guard;
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

DROP TRIGGER IF EXISTS company_employment_authority_organization_guard;
CREATE TRIGGER company_employment_authority_organization_guard
AFTER UPDATE OF status ON company_organization_change_operations
WHEN NEW.status = 'COMPLETED' AND NOT EXISTS (
  SELECT 1 FROM company_resource_revisions resource
  JOIN company_organizations organization ON organization.id = resource.organization_id
  WHERE resource.organization_revision > organization.revision
)
BEGIN
  SELECT RAISE(ABORT, 'company_employment_authority_period_not_covered')
  WHERE EXISTS (SELECT 1 FROM company_employment_authority_violations);
END;

SELECT json_extract('{}', 'company_organization_resource_operation_incomplete')
FROM company_command_receipts receipt
JOIN company_organizations organization ON organization.id = receipt.organization_id
JOIN company_organization_change_operations operation
  ON operation.id = (SELECT key_operation.id FROM company_organization_change_operations key_operation WHERE key_operation.operation_key = 'org-resource:' || receipt.fingerprint)
WHERE receipt.organization_revision <= organization.revision AND operation.status != 'COMPLETED'
LIMIT 1;

DROP TRIGGER IF EXISTS company_employments_organization_period_guard;
CREATE TRIGGER company_employments_organization_period_guard
BEFORE UPDATE OF hire_date, termination_date ON company_employments
BEGIN
  SELECT RAISE(ABORT, 'employment change would orphan an organization assignment')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_assignment_period_versions assignment
    WHERE assignment.employment_id = NEW.id
      AND assignment.is_void = 0
      AND assignment.revision = (
        SELECT max(latest.revision)
        FROM company_organization_assignment_period_versions latest
        WHERE latest.period_id = assignment.period_id
      )
      AND (
        NEW.hire_date > assignment.starts_on
        OR (
          NEW.termination_date IS NOT NULL
          AND (
            assignment.ends_on IS NULL
            OR assignment.ends_on > date(NEW.termination_date, '+1 day')
          )
        )
      )
  );

  SELECT RAISE(ABORT, 'employment change would orphan an organization responsibility')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_responsibility_period_versions responsibility
    WHERE responsibility.employment_id = NEW.id
      AND responsibility.is_void = 0
      AND responsibility.revision = (
        SELECT max(latest.revision)
        FROM company_organization_responsibility_period_versions latest
        WHERE latest.period_id = responsibility.period_id
      )
      AND (
        NEW.hire_date > responsibility.starts_on
        OR (
          NEW.termination_date IS NOT NULL
          AND (
            responsibility.ends_on IS NULL
            OR responsibility.ends_on > date(NEW.termination_date, '+1 day')
          )
        )
      )
  );

  SELECT RAISE(ABORT, 'employment change would leave an assigned employee without manager')
  WHERE NEW.termination_date IS NOT NULL AND EXISTS (
    SELECT 1 FROM company_organization_assignment_period_versions assignment
    WHERE assignment.manager_employee_id = NEW.employee_id
      AND assignment.is_void = 0
      AND assignment.revision = (
        SELECT max(latest.revision)
        FROM company_organization_assignment_period_versions latest
        WHERE latest.period_id = assignment.period_id
      )
      AND (
        assignment.ends_on IS NULL
        OR assignment.ends_on > date(NEW.termination_date, '+1 day')
      )
  );
END;

DROP TRIGGER IF EXISTS company_organization_resource_operation_commit_guard;
CREATE TRIGGER company_organization_resource_operation_commit_guard
BEFORE UPDATE OF revision ON company_organizations
WHEN NEW.revision != OLD.revision
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is incomplete')
  WHERE EXISTS (
    SELECT 1 FROM company_command_receipts receipt
    JOIN company_organization_change_operations operation
      ON operation.id = (SELECT key_operation.id FROM company_organization_change_operations key_operation WHERE key_operation.operation_key = 'org-resource:' || receipt.fingerprint)
    WHERE receipt.organization_id = NEW.id AND receipt.organization_revision = NEW.revision
      AND operation.status != 'COMPLETED'
  );
END;

WITH effective_versions AS (
  SELECT resource.* FROM company_resource_revisions resource
  WHERE resource.resource_type IN ('office-assignment', 'organizational-authority',
      'responsibility-assignment', 'collective-body-membership')
    AND resource.revision = (
      SELECT max(latest.revision) FROM company_resource_revisions latest
      WHERE latest.organization_id = resource.organization_id AND latest.resource_type = resource.resource_type
        AND latest.resource_id = resource.resource_id AND latest.effective_from = resource.effective_from
    )
), next_versions AS (
  SELECT *, lead(effective_from) OVER (
    PARTITION BY organization_id, resource_type, resource_id ORDER BY effective_from
  ) AS next_from FROM effective_versions
), appointments AS (
  SELECT organization_id, resource_type, resource_id,
    CASE WHEN resource_type = 'responsibility-assignment'
      THEN json_extract(attributes_json, '$.holderId')
      ELSE json_extract(attributes_json, '$.employeeId') END AS employee_id,
    json_extract(attributes_json, '$.employmentId') AS employment_id,
    json_extract(attributes_json, '$.scopeType') AS scope_type,
    json_extract(attributes_json, '$.scopeId') AS scope_id,
    effective_from AS starts_on,
    CASE WHEN next_from IS NULL OR (effective_to IS NOT NULL AND effective_to < next_from)
      THEN effective_to ELSE next_from END AS ends_on
  FROM next_versions WHERE state = 'active'
    AND (resource_type != 'responsibility-assignment' OR json_extract(attributes_json, '$.holderType') = 'employee')
), periods AS (
  SELECT binding.organization_id, period.employee_id, period.period_id AS employment_id,
    'employment' AS kind, NULL AS scope_id, period.starts_on, period.ends_on
  FROM company_employment_period_versions period
  JOIN company_workforce_resource_bindings binding
    ON binding.resource_type = 'employee' AND binding.resource_id = period.employee_id
  WHERE period.is_void = 0 AND period.revision = (SELECT max(latest.revision)
    FROM company_employment_period_versions latest WHERE latest.period_id = period.period_id)
  UNION ALL
  SELECT binding.organization_id, period.employee_id, NULL AS employment_id,
    'employment' AS kind, NULL AS scope_id, period.starts_on, period.ends_on
  FROM company_employment_period_versions period
  JOIN company_workforce_resource_bindings binding
    ON binding.resource_type = 'employee' AND binding.resource_id = period.employee_id
  WHERE period.is_void = 0 AND period.revision = (SELECT max(latest.revision)
    FROM company_employment_period_versions latest WHERE latest.period_id = period.period_id)
  UNION ALL
  SELECT binding.organization_id, period.employee_id, period.employment_id,
    'assignment', period.organization_unit_id, period.starts_on, period.ends_on
  FROM company_organization_assignment_coverage period
  JOIN company_workforce_resource_bindings binding
    ON binding.resource_type = 'employee' AND binding.resource_id = period.employee_id
  UNION ALL
  SELECT binding.organization_id, period.employee_id, period.employment_id,
    'assignment', NULL, period.starts_on, period.ends_on
  FROM company_organization_assignment_coverage period
  JOIN company_workforce_resource_bindings binding
    ON binding.resource_type = 'employee' AND binding.resource_id = period.employee_id
), prior AS (
  SELECT *, max(coalesce(ends_on, '9999-12-31')) OVER (
    PARTITION BY organization_id, employee_id, employment_id, kind, scope_id
    ORDER BY starts_on, ends_on ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
  ) AS covered_until FROM periods
), islands AS (
  SELECT *, sum(CASE WHEN covered_until IS NULL OR starts_on > covered_until THEN 1 ELSE 0 END) OVER (
    PARTITION BY organization_id, employee_id, employment_id, kind, scope_id
    ORDER BY starts_on, ends_on ROWS UNBOUNDED PRECEDING
  ) AS island FROM prior
), coverage AS (
  SELECT organization_id, employee_id, employment_id, kind, scope_id, min(starts_on) AS starts_on,
    CASE WHEN max(ends_on IS NULL) = 1 THEN NULL ELSE max(ends_on) END AS ends_on
  FROM islands GROUP BY organization_id, employee_id, employment_id, kind, scope_id, island
)
SELECT json_extract('{}', 'company_personal_governance_period_not_covered')
FROM appointments appointment WHERE
  NOT EXISTS (
    SELECT 1 FROM coverage WHERE coverage.organization_id = appointment.organization_id
      AND coverage.employee_id = appointment.employee_id AND coverage.employment_id IS appointment.employment_id
      AND coverage.kind = 'employment' AND coverage.starts_on <= appointment.starts_on
      AND (coverage.ends_on IS NULL OR (appointment.ends_on IS NOT NULL AND appointment.ends_on <= coverage.ends_on))
  ) OR (appointment.resource_type = 'organizational-authority' AND NOT EXISTS (
    SELECT 1 FROM coverage WHERE coverage.organization_id = appointment.organization_id
      AND coverage.employee_id = appointment.employee_id AND coverage.employment_id IS appointment.employment_id
      AND coverage.kind = 'assignment' AND coverage.starts_on <= appointment.starts_on
      AND (coverage.ends_on IS NULL OR (appointment.ends_on IS NOT NULL AND appointment.ends_on <= coverage.ends_on))
      AND ((appointment.scope_type = 'organization-unit' AND coverage.scope_id = appointment.scope_id)
        OR (appointment.scope_type = 'authority-scope' AND coverage.scope_id IS NULL))
  )) LIMIT 1;

DROP VIEW IF EXISTS company_employment_authority_violations;
CREATE VIEW company_employment_authority_violations AS
WITH effective_versions AS (
  SELECT resource.* FROM company_resource_revisions resource
  WHERE resource.resource_type IN ('office-assignment', 'organizational-authority',
      'responsibility-assignment', 'collective-body-membership')
    AND resource.revision = (
      SELECT max(latest.revision) FROM company_resource_revisions latest
      WHERE latest.organization_id = resource.organization_id AND latest.resource_type = resource.resource_type
        AND latest.resource_id = resource.resource_id AND latest.effective_from = resource.effective_from
    )
), next_versions AS (
  SELECT *, lead(effective_from) OVER (
    PARTITION BY organization_id, resource_type, resource_id ORDER BY effective_from
  ) AS next_from FROM effective_versions
), appointments AS (
  SELECT organization_id, resource_type, resource_id,
    CASE WHEN resource_type = 'responsibility-assignment'
      THEN json_extract(attributes_json, '$.holderId')
      ELSE json_extract(attributes_json, '$.employeeId') END AS employee_id,
    json_extract(attributes_json, '$.employmentId') AS employment_id,
    json_extract(attributes_json, '$.scopeType') AS scope_type,
    json_extract(attributes_json, '$.scopeId') AS scope_id,
    effective_from AS starts_on,
    CASE WHEN next_from IS NULL OR (effective_to IS NOT NULL AND effective_to < next_from)
      THEN effective_to ELSE next_from END AS ends_on
  FROM next_versions WHERE state = 'active'
    AND (resource_type != 'responsibility-assignment' OR json_extract(attributes_json, '$.holderType') = 'employee')
), periods AS (
  SELECT binding.organization_id, period.employee_id, period.period_id AS employment_id,
    'employment' AS kind, NULL AS scope_id, period.starts_on, period.ends_on
  FROM company_employment_period_versions period
  JOIN company_workforce_resource_bindings binding
    ON binding.resource_type = 'employee' AND binding.resource_id = period.employee_id
  WHERE period.is_void = 0 AND period.revision = (SELECT max(latest.revision)
    FROM company_employment_period_versions latest WHERE latest.period_id = period.period_id)
  UNION ALL
  SELECT binding.organization_id, period.employee_id, NULL AS employment_id,
    'employment' AS kind, NULL AS scope_id, period.starts_on, period.ends_on
  FROM company_employment_period_versions period
  JOIN company_workforce_resource_bindings binding
    ON binding.resource_type = 'employee' AND binding.resource_id = period.employee_id
  WHERE period.is_void = 0 AND period.revision = (SELECT max(latest.revision)
    FROM company_employment_period_versions latest WHERE latest.period_id = period.period_id)
  UNION ALL
  SELECT binding.organization_id, period.employee_id, period.employment_id,
    'assignment', period.organization_unit_id, period.starts_on, period.ends_on
  FROM company_organization_assignment_coverage period
  JOIN company_workforce_resource_bindings binding
    ON binding.resource_type = 'employee' AND binding.resource_id = period.employee_id
  UNION ALL
  SELECT binding.organization_id, period.employee_id, period.employment_id,
    'assignment', NULL, period.starts_on, period.ends_on
  FROM company_organization_assignment_coverage period
  JOIN company_workforce_resource_bindings binding
    ON binding.resource_type = 'employee' AND binding.resource_id = period.employee_id
), prior AS (
  SELECT *, max(coalesce(ends_on, '9999-12-31')) OVER (
    PARTITION BY organization_id, employee_id, employment_id, kind, scope_id
    ORDER BY starts_on, ends_on ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
  ) AS covered_until FROM periods
), islands AS (
  SELECT *, sum(CASE WHEN covered_until IS NULL OR starts_on > covered_until THEN 1 ELSE 0 END) OVER (
    PARTITION BY organization_id, employee_id, employment_id, kind, scope_id
    ORDER BY starts_on, ends_on ROWS UNBOUNDED PRECEDING
  ) AS island FROM prior
), coverage AS (
  SELECT organization_id, employee_id, employment_id, kind, scope_id, min(starts_on) AS starts_on,
    CASE WHEN max(ends_on IS NULL) = 1 THEN NULL ELSE max(ends_on) END AS ends_on
  FROM islands GROUP BY organization_id, employee_id, employment_id, kind, scope_id, island
)
SELECT appointment.* FROM appointments appointment WHERE
  NOT EXISTS (
    SELECT 1 FROM coverage WHERE coverage.organization_id = appointment.organization_id
      AND coverage.employee_id = appointment.employee_id AND coverage.employment_id IS appointment.employment_id
      AND coverage.kind = 'employment' AND coverage.starts_on <= appointment.starts_on
      AND (coverage.ends_on IS NULL OR (appointment.ends_on IS NOT NULL AND appointment.ends_on <= coverage.ends_on))
  ) OR (appointment.resource_type = 'organizational-authority' AND NOT EXISTS (
    SELECT 1 FROM coverage WHERE coverage.organization_id = appointment.organization_id
      AND coverage.employee_id = appointment.employee_id AND coverage.employment_id IS appointment.employment_id
      AND coverage.kind = 'assignment' AND coverage.starts_on <= appointment.starts_on
      AND (coverage.ends_on IS NULL OR (appointment.ends_on IS NOT NULL AND appointment.ends_on <= coverage.ends_on))
      AND ((appointment.scope_type = 'organization-unit' AND coverage.scope_id = appointment.scope_id)
        OR (appointment.scope_type = 'authority-scope' AND coverage.scope_id IS NULL))
  ));

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
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  CHECK (length(resource_id) = 36 AND resource_id NOT GLOB '*[^0-9a-f-]*' AND substr(resource_id, 9, 1) = '-' AND substr(resource_id, 14, 1) = '-' AND substr(resource_id, 19, 1) = '-' AND substr(resource_id, 24, 1) = '-' AND length(replace(resource_id, '-', '')) = 32 AND substr(resource_id, 15, 1) GLOB '[1-8]' AND substr(resource_id, 20, 1) GLOB '[89ab]')
);
CREATE INDEX company_responsibility_resource_bindings_employee_idx ON company_responsibility_resource_bindings(employee_id);
CREATE TABLE company_responsibility_period_bindings (
  period_id TEXT PRIMARY KEY NOT NULL,
  resource_id TEXT NOT NULL REFERENCES company_responsibility_resource_bindings(resource_id) ON DELETE RESTRICT,
  period_revision INTEGER NOT NULL CHECK (period_revision >= 1),
  source_revision INTEGER NOT NULL CHECK (source_revision >= 1),
  FOREIGN KEY (period_id, period_revision) REFERENCES company_organization_responsibility_period_versions(period_id, revision) ON DELETE RESTRICT,
  CHECK (length(period_id) = 36 AND period_id NOT GLOB '*[^0-9a-f-]*' AND substr(period_id, 9, 1) = '-' AND substr(period_id, 14, 1) = '-' AND substr(period_id, 19, 1) = '-' AND substr(period_id, 24, 1) = '-' AND length(replace(period_id, '-', '')) = 32 AND substr(period_id, 15, 1) GLOB '[1-8]' AND substr(period_id, 20, 1) GLOB '[89ab]')
);
CREATE INDEX company_responsibility_period_bindings_resource_idx ON company_responsibility_period_bindings(resource_id);

DROP TRIGGER IF EXISTS company_responsibility_resource_binding_update_guard;
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
DROP TRIGGER IF EXISTS company_responsibility_resource_binding_delete_guard;
CREATE TRIGGER company_responsibility_resource_binding_delete_guard
BEFORE DELETE ON company_responsibility_resource_bindings
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility source identity is immutable');
END;
DROP TRIGGER IF EXISTS company_responsibility_period_binding_update_guard;
CREATE TRIGGER company_responsibility_period_binding_update_guard
BEFORE UPDATE ON company_responsibility_period_bindings
WHEN NEW.period_id != OLD.period_id OR NEW.resource_id != OLD.resource_id OR NEW.period_revision < OLD.period_revision
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility period source is immutable');
END;
DROP TRIGGER IF EXISTS company_responsibility_period_binding_delete_guard;
CREATE TRIGGER company_responsibility_period_binding_delete_guard
BEFORE DELETE ON company_responsibility_period_bindings
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility period source is immutable');
END;

CREATE VIEW company_responsibility_source_mismatches AS
WITH effective_versions AS (
  SELECT resource.* FROM company_resource_revisions resource
  JOIN company_responsibility_resource_bindings binding
    ON binding.organization_id = resource.organization_id AND binding.resource_id = resource.resource_id
  WHERE resource.resource_type = 'responsibility-assignment' AND resource.revision = (
    SELECT max(latest.revision) FROM company_resource_revisions latest
    WHERE latest.organization_id = resource.organization_id AND latest.resource_type = resource.resource_type
      AND latest.resource_id = resource.resource_id AND latest.effective_from = resource.effective_from
  )
), next_versions AS (
  SELECT *, lead(effective_from) OVER (PARTITION BY organization_id, resource_id ORDER BY effective_from) AS next_from
  FROM effective_versions
), definition_versions AS (
  SELECT resource.* FROM company_resource_revisions resource
  WHERE resource.resource_type IN ('responsibility', 'authority-scope') AND resource.revision = (
    SELECT max(latest.revision) FROM company_resource_revisions latest
    WHERE latest.organization_id = resource.organization_id AND latest.resource_type = resource.resource_type
      AND latest.resource_id = resource.resource_id AND latest.effective_from = resource.effective_from
  )
), definition_intervals AS (
  SELECT *, lead(effective_from) OVER (PARTITION BY organization_id, resource_type, resource_id ORDER BY effective_from) AS next_from
  FROM definition_versions
), intervals AS (
  SELECT organization_id, resource_id, 'public' AS kind, effective_from AS starts_on,
    CASE WHEN next_from IS NULL OR (effective_to IS NOT NULL AND effective_to < next_from)
      THEN effective_to ELSE next_from END AS ends_on
  FROM next_versions WHERE state = 'active'
  UNION ALL
  SELECT source.organization_id, source.resource_id, 'period', period.starts_on, period.ends_on
  FROM company_responsibility_resource_bindings source
  JOIN company_responsibility_period_bindings binding ON binding.resource_id = source.resource_id
  JOIN company_organization_responsibility_period_versions period ON period.period_id = binding.period_id
  WHERE period.is_void = 0 AND period.revision = (
    SELECT max(latest.revision) FROM company_organization_responsibility_period_versions latest WHERE latest.period_id = period.period_id
  )
  UNION ALL
  SELECT source.organization_id, source.resource_id, definition.resource_type, definition.effective_from,
    CASE WHEN definition.next_from IS NULL OR (definition.effective_to IS NOT NULL AND definition.effective_to < definition.next_from)
      THEN definition.effective_to ELSE definition.next_from END
  FROM company_responsibility_resource_bindings source
  JOIN definition_intervals definition ON definition.organization_id = source.organization_id AND (
    (definition.resource_type = 'responsibility' AND definition.resource_id = source.responsibility_id
      AND json_extract(definition.attributes_json, '$.code') = source.responsibility_type)
    OR (definition.resource_type = 'authority-scope' AND definition.resource_id = source.authority_scope_id
      AND json_extract(definition.attributes_json, '$.scopeType') = 'organization-unit'
      AND json_extract(definition.attributes_json, '$.scopeId') = source.organization_unit_id)
  ) WHERE definition.state = 'active'
), prior AS (
  SELECT *, max(coalesce(ends_on, '9999-12-31')) OVER (
    PARTITION BY organization_id, resource_id, kind ORDER BY starts_on, ends_on
    ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
  ) AS covered_until FROM intervals
), islands AS (
  SELECT *, sum(CASE WHEN covered_until IS NULL OR starts_on > covered_until THEN 1 ELSE 0 END) OVER (
    PARTITION BY organization_id, resource_id, kind ORDER BY starts_on, ends_on ROWS UNBOUNDED PRECEDING
  ) AS island FROM prior
), coverage AS (
  SELECT organization_id, resource_id, kind, min(starts_on) AS starts_on,
    CASE WHEN max(ends_on IS NULL) = 1 THEN NULL ELSE max(ends_on) END AS ends_on
  FROM islands GROUP BY organization_id, resource_id, kind, island
)
SELECT source.organization_id, source.resource_id FROM company_responsibility_resource_bindings source
WHERE NOT EXISTS (
  SELECT 1 FROM company_resource_heads head WHERE head.organization_id = source.organization_id
    AND head.resource_type = 'responsibility-assignment' AND head.resource_id = source.resource_id
    AND head.revision = source.resource_revision
) OR NOT EXISTS (
  SELECT 1 FROM company_resource_heads definition WHERE definition.organization_id = source.organization_id
    AND definition.resource_type = 'responsibility' AND definition.resource_id = source.responsibility_id
    AND json_extract(definition.attributes_json, '$.code') = source.responsibility_type
) OR NOT EXISTS (
  SELECT 1 FROM company_resource_heads scope WHERE scope.organization_id = source.organization_id
    AND scope.resource_type = 'authority-scope' AND scope.resource_id = source.authority_scope_id
    AND json_extract(scope.attributes_json, '$.scopeType') = 'organization-unit'
    AND json_extract(scope.attributes_json, '$.scopeId') = source.organization_unit_id
) OR EXISTS (
  SELECT 1 FROM company_resource_revisions resource WHERE resource.organization_id = source.organization_id
    AND resource.resource_type = 'responsibility-assignment' AND resource.resource_id = source.resource_id
    AND (json_extract(resource.attributes_json, '$.holderType') IS NOT 'employee'
      OR json_extract(resource.attributes_json, '$.holderId') IS NOT source.employee_id
      OR json_extract(resource.attributes_json, '$.responsibilityId') IS NOT source.responsibility_id
      OR json_extract(resource.attributes_json, '$.authorityScopeId') IS NOT source.authority_scope_id)
) OR EXISTS (
  SELECT 1 FROM company_responsibility_period_bindings binding
  JOIN company_organization_responsibility_period_versions period ON period.period_id = binding.period_id
  WHERE binding.resource_id = source.resource_id AND period.revision = (
    SELECT max(latest.revision) FROM company_organization_responsibility_period_versions latest WHERE latest.period_id = period.period_id
  ) AND (period.revision != binding.period_revision OR period.employee_id != source.employee_id
    OR period.employment_id != source.employment_id OR period.organization_unit_id != source.organization_unit_id
    OR period.responsibility_type != source.responsibility_type
    OR NOT EXISTS (SELECT 1 FROM company_resource_revisions resource WHERE resource.organization_id = source.organization_id
      AND resource.resource_type = 'responsibility-assignment' AND resource.resource_id = source.resource_id
      AND resource.revision = binding.source_revision))
) OR EXISTS (
  SELECT 1 FROM coverage expected WHERE expected.organization_id = source.organization_id AND expected.resource_id = source.resource_id
    AND expected.kind IN ('public', 'period') AND NOT EXISTS (
      SELECT 1 FROM coverage actual WHERE actual.organization_id = expected.organization_id AND actual.resource_id = expected.resource_id
        AND actual.kind IN ('public', 'period') AND actual.kind != expected.kind AND actual.starts_on <= expected.starts_on
        AND (actual.ends_on IS NULL OR (expected.ends_on IS NOT NULL AND expected.ends_on <= actual.ends_on))
    )
) OR EXISTS (
  SELECT 1 FROM coverage expected WHERE expected.organization_id = source.organization_id AND expected.resource_id = source.resource_id
    AND expected.kind = 'public' AND (
      NOT EXISTS (SELECT 1 FROM coverage definition WHERE definition.organization_id = expected.organization_id
        AND definition.resource_id = expected.resource_id AND definition.kind = 'responsibility'
        AND definition.starts_on <= expected.starts_on
        AND (definition.ends_on IS NULL OR (expected.ends_on IS NOT NULL AND expected.ends_on <= definition.ends_on)))
      OR NOT EXISTS (SELECT 1 FROM coverage scope WHERE scope.organization_id = expected.organization_id
        AND scope.resource_id = expected.resource_id AND scope.kind = 'authority-scope'
        AND scope.starts_on <= expected.starts_on
        AND (scope.ends_on IS NULL OR (expected.ends_on IS NOT NULL AND expected.ends_on <= scope.ends_on)))
    )
);

DROP TRIGGER IF EXISTS company_responsibility_source_completion_guard;
CREATE TRIGGER company_responsibility_source_completion_guard
BEFORE UPDATE OF status ON company_organization_change_operations
WHEN NEW.status = 'COMPLETED'
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility public source is stale')
  WHERE EXISTS (SELECT 1 FROM company_responsibility_source_mismatches);
END;
DROP TRIGGER IF EXISTS company_responsibility_source_revision_guard;
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

DROP TRIGGER IF EXISTS company_responsibility_lifecycle_completion_guard;
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

CREATE VIEW company_responsibility_assignment_overlaps AS
WITH effective_versions AS (
  SELECT resource.* FROM company_resource_revisions resource
  WHERE resource.resource_type = 'responsibility-assignment' AND resource.revision = (
    SELECT max(latest.revision) FROM company_resource_revisions latest
    WHERE latest.organization_id = resource.organization_id AND latest.resource_type = resource.resource_type
      AND latest.resource_id = resource.resource_id AND latest.effective_from = resource.effective_from
  )
), next_versions AS (
  SELECT *, lead(effective_from) OVER (PARTITION BY organization_id, resource_id ORDER BY effective_from) AS next_from
  FROM effective_versions
), intervals AS (
  SELECT organization_id, resource_id, effective_from AS starts_on,
    CASE WHEN next_from IS NULL OR (effective_to IS NOT NULL AND effective_to < next_from)
      THEN effective_to ELSE next_from END AS ends_on,
    json_extract(attributes_json, '$.responsibilityId') AS responsibility_id,
    json_extract(attributes_json, '$.holderType') AS holder_type,
    json_extract(attributes_json, '$.holderId') AS holder_id,
    json_extract(attributes_json, '$.authorityScopeId') AS scope_id
  FROM next_versions WHERE state = 'active'
)
SELECT DISTINCT first.organization_id, first.holder_type, first.holder_id
FROM intervals first JOIN intervals second
  ON first.organization_id = second.organization_id AND first.resource_id < second.resource_id
  AND first.responsibility_id = second.responsibility_id AND first.holder_type = second.holder_type
  AND first.holder_id = second.holder_id AND first.scope_id IS second.scope_id
  AND (first.ends_on IS NULL OR second.starts_on < first.ends_on)
  AND (second.ends_on IS NULL OR first.starts_on < second.ends_on);

SELECT json_extract('{}', 'company_responsibility_assignment_overlap') FROM company_responsibility_assignment_overlaps LIMIT 1;
DROP INDEX company_active_responsibility_assignment_uniq;

DROP TRIGGER IF EXISTS company_responsibility_assignment_revision_guard;
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
DROP TRIGGER IF EXISTS company_responsibility_assignment_operation_guard;
CREATE TRIGGER company_responsibility_assignment_operation_guard
BEFORE UPDATE OF status ON company_organization_change_operations
WHEN NEW.status = 'COMPLETED'
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility assignment periods overlap')
  WHERE EXISTS (SELECT 1 FROM company_responsibility_assignment_overlaps);
END;
DROP TRIGGER IF EXISTS company_responsibility_assignment_lifecycle_guard;
CREATE TRIGGER company_responsibility_assignment_lifecycle_guard
AFTER UPDATE OF lifecycle_revision ON company_workforce_resource_bindings
WHEN NEW.resource_type = 'employee' AND NEW.lifecycle_revision != OLD.lifecycle_revision
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility assignment periods overlap')
  WHERE EXISTS (SELECT 1 FROM company_responsibility_assignment_overlaps
    WHERE organization_id = NEW.organization_id AND holder_type = 'employee' AND holder_id = NEW.employee_id);
END;

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
CREATE TRIGGER company_responsibility_resource_adoptions_identity_update
BEFORE UPDATE OF id ON company_responsibility_resource_adoptions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

DROP TRIGGER IF EXISTS company_responsibility_adoption_insert_guard;
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
        WHERE binding.period_id = period.period_id AND binding.period_revision = period.revision AND binding.source_revision = 1
          AND source.resource_revision = 1 AND source.employee_id = NEW.employee_id
          AND source.responsibility_id = json_extract(mapping.value, '$.responsibilityId')
          AND source.authority_scope_id = json_extract(mapping.value, '$.authorityScopeId')
      )
    )
  );
END;
DROP TRIGGER IF EXISTS company_responsibility_adoption_update_guard;
CREATE TRIGGER company_responsibility_adoption_update_guard
BEFORE UPDATE ON company_responsibility_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'responsibility adoption evidence is immutable');
END;
DROP TRIGGER IF EXISTS company_responsibility_adoption_delete_guard;
CREATE TRIGGER company_responsibility_adoption_delete_guard
BEFORE DELETE ON company_responsibility_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'responsibility adoption evidence is immutable');
END;
DROP TRIGGER IF EXISTS company_responsibility_adoption_completion_guard;
CREATE TRIGGER company_responsibility_adoption_completion_guard
BEFORE UPDATE OF status ON company_organization_change_operations
WHEN NEW.status = 'COMPLETED' AND NEW.operation_key GLOB 'responsibility-adoption:*'
BEGIN
  SELECT RAISE(ABORT, 'responsibility adoption evidence is missing')
  WHERE NOT EXISTS (SELECT 1 FROM company_responsibility_resource_adoptions adoption WHERE adoption.operation_id = NEW.id);
END;

CREATE VIEW company_governance_resource_periods AS
WITH effective_versions AS (
  SELECT resource.* FROM company_resource_revisions resource
  WHERE resource.resource_type IN (
    'job', 'position', 'organizational-office', 'office-assignment', 'responsibility',
    'authority-scope', 'responsibility-assignment', 'collective-body',
    'collective-body-membership', 'organizational-authority', 'legal-entity',
    'site', 'workplace', 'employee', 'employment', 'organization-unit'
  ) AND resource.revision = (
    SELECT max(latest.revision) FROM company_resource_revisions latest
    WHERE latest.organization_id = resource.organization_id AND latest.resource_type = resource.resource_type
      AND latest.resource_id = resource.resource_id
      AND (resource.resource_type = 'organization-unit' OR latest.effective_from = resource.effective_from)
  )
), next_versions AS (
  SELECT *, lead(effective_from) OVER (
    PARTITION BY organization_id, resource_type, resource_id ORDER BY effective_from
  ) AS next_from FROM effective_versions
)
SELECT organization_id, resource_type, resource_id, attributes_json,
  CASE WHEN resource_type = 'organization-unit' THEN json_extract(attributes_json, '$.organizationUnitId')
    ELSE resource_id END AS reference_id,
  effective_from AS starts_on,
  CASE WHEN next_from IS NULL OR (effective_to IS NOT NULL AND effective_to < next_from)
    THEN effective_to ELSE next_from END AS ends_on
FROM next_versions WHERE state = 'active';

CREATE VIEW company_governance_resource_coverage AS
WITH prior AS (
  SELECT *, max(coalesce(ends_on, '9999-12-31')) OVER (
    PARTITION BY organization_id, resource_type, reference_id
    ORDER BY starts_on, ends_on ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
  ) AS covered_until FROM company_governance_resource_periods
), islands AS (
  SELECT *, sum(CASE WHEN covered_until IS NULL OR starts_on > covered_until THEN 1 ELSE 0 END) OVER (
    PARTITION BY organization_id, resource_type, reference_id ORDER BY starts_on, ends_on
    ROWS UNBOUNDED PRECEDING
  ) AS island FROM prior
)
SELECT organization_id, resource_type, reference_id, min(starts_on) AS starts_on,
  CASE WHEN max(ends_on IS NULL) = 1 THEN NULL ELSE max(ends_on) END AS ends_on
FROM islands GROUP BY organization_id, resource_type, reference_id, island;

CREATE VIEW company_governance_resource_references AS
SELECT resource.organization_id, resource.resource_type, resource.resource_id,
  resource.starts_on, resource.ends_on,
  json_extract(reference.value, '$[0]') AS target_type,
  json_extract(reference.value, '$[1]') AS target_id
FROM company_governance_resource_periods resource,
json_each(CASE resource.resource_type
  WHEN 'position' THEN json_array(json_array('job', json_extract(attributes_json, '$.jobId')))
  WHEN 'organizational-office' THEN json_array(
    json_array('position', json_extract(attributes_json, '$.positionId')),
    json_array('organization-unit', json_extract(attributes_json, '$.organizationUnitId')))
  WHEN 'office-assignment' THEN json_array(
    json_array('organizational-office', json_extract(attributes_json, '$.organizationalOfficeId')),
    json_array('employee', json_extract(attributes_json, '$.employeeId')),
    json_array('employment', json_extract(attributes_json, '$.employmentId')))
  WHEN 'authority-scope' THEN CASE
    WHEN json_extract(attributes_json, '$.scopeType') IN ('organization-unit', 'legal-entity', 'site', 'workplace')
    THEN json_array(json_array(json_extract(attributes_json, '$.scopeType'), json_extract(attributes_json, '$.scopeId')))
    ELSE json_array() END
  WHEN 'responsibility-assignment' THEN json_array(
    json_array('responsibility', json_extract(attributes_json, '$.responsibilityId')),
    json_array(json_extract(attributes_json, '$.holderType'), json_extract(attributes_json, '$.holderId')),
    json_array('authority-scope', json_extract(attributes_json, '$.authorityScopeId')))
  WHEN 'collective-body-membership' THEN json_array(
    json_array('collective-body', json_extract(attributes_json, '$.collectiveBodyId')),
    json_array('employee', json_extract(attributes_json, '$.employeeId')))
  WHEN 'organizational-authority' THEN json_array(
    json_array(json_extract(attributes_json, '$.scopeType'), json_extract(attributes_json, '$.scopeId')),
    json_array('employee', json_extract(attributes_json, '$.employeeId')),
    json_array('employment', json_extract(attributes_json, '$.employmentId')))
  ELSE json_array() END) reference
WHERE json_extract(reference.value, '$[1]') IS NOT NULL;

CREATE VIEW company_governance_reference_period_violations AS
SELECT reference.* FROM company_governance_resource_references reference
WHERE NOT EXISTS (
  SELECT 1 FROM company_governance_resource_coverage target
  WHERE target.organization_id = reference.organization_id AND target.resource_type = reference.target_type
    AND target.reference_id = reference.target_id AND target.starts_on <= reference.starts_on
    AND (target.ends_on IS NULL OR (reference.ends_on IS NOT NULL AND reference.ends_on <= target.ends_on))
);

SELECT json_extract('{}', 'company_governance_reference_period_not_covered')
FROM company_governance_reference_period_violations LIMIT 1;

CREATE TRIGGER company_governance_reference_period_commit_guard
BEFORE UPDATE OF revision ON company_organizations
BEGIN
  SELECT RAISE(ABORT, 'company_governance_reference_period_not_covered')
  WHERE EXISTS (SELECT 1 FROM company_governance_reference_period_violations WHERE organization_id = NEW.id);
END;

DROP TRIGGER company_governance_definition_void_guard;

DROP VIEW company_governance_organization_reference_violations;
CREATE VIEW company_governance_organization_reference_violations AS
SELECT DISTINCT organization_id, resource_type, resource_id
FROM company_governance_reference_period_violations
WHERE resource_type = 'organizational-office'
  OR (resource_type = 'authority-scope' AND target_type = 'organization-unit');

DROP TRIGGER company_position_job_guard;
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

DROP TRIGGER company_office_assignment_reference_guard;
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

DROP TRIGGER company_responsibility_assignment_reference_guard;
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

DROP TRIGGER company_collective_body_membership_reference_guard;
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

DROP TRIGGER company_organizational_authority_scope_guard;
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

DROP TRIGGER company_organizational_office_reference_guard;
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

DROP TRIGGER company_authority_scope_reference_guard;
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

CREATE VIEW company_place_reference_period_violations AS
WITH place_references AS (
  SELECT organization_id, resource_type, resource_id, starts_on, ends_on,
    'legal-entity' AS target_type, json_extract(attributes_json, '$.legalEntityId') AS target_id
  FROM company_governance_resource_periods WHERE resource_type = 'site'
  UNION ALL
  SELECT organization_id, resource_type, resource_id, starts_on, ends_on,
    'site', json_extract(attributes_json, '$.siteId')
  FROM company_governance_resource_periods WHERE resource_type = 'workplace'
  UNION ALL
  SELECT organization_id, resource_type, resource_id, starts_on, ends_on,
    'organization-unit', json_extract(attributes_json, '$.organizationUnitId')
  FROM company_governance_resource_periods
  WHERE resource_type = 'workplace' AND json_extract(attributes_json, '$.organizationUnitId') IS NOT NULL
)
SELECT reference.* FROM place_references reference
WHERE NOT EXISTS (
  SELECT 1 FROM company_governance_resource_coverage target
  WHERE target.organization_id = reference.organization_id AND target.resource_type = reference.target_type
    AND target.reference_id = reference.target_id AND target.starts_on <= reference.starts_on
    AND (target.ends_on IS NULL OR (reference.ends_on IS NOT NULL AND reference.ends_on <= target.ends_on))
);

SELECT json_extract('{}', 'company_place_reference_period_not_covered')
FROM company_place_reference_period_violations LIMIT 1;

CREATE TRIGGER company_place_reference_period_commit_guard
BEFORE UPDATE OF revision ON company_organizations
BEGIN
  SELECT RAISE(ABORT, 'company_place_reference_period_not_covered')
  WHERE EXISTS (SELECT 1 FROM company_place_reference_period_violations WHERE organization_id = NEW.id);
END;

DROP TRIGGER company_site_legal_entity_guard;
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

DROP TRIGGER company_workplace_site_guard;
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

DROP TRIGGER company_site_void_guard;
DROP TRIGGER company_legal_entity_void_guard;
CREATE VIEW company_reporting_reference_period_violations AS
WITH effective_versions AS (
  SELECT resource.* FROM company_resource_revisions resource
  WHERE resource.resource_type = 'reporting-relation' AND resource.revision = (
    SELECT max(latest.revision) FROM company_resource_revisions latest
    WHERE latest.organization_id = resource.organization_id AND latest.resource_type = resource.resource_type
      AND latest.resource_id = resource.resource_id AND latest.effective_from = resource.effective_from
  )
), next_versions AS (
  SELECT *, lead(effective_from) OVER (
    PARTITION BY organization_id, resource_id ORDER BY effective_from
  ) AS next_from FROM effective_versions
), relations AS (
  SELECT organization_id, resource_id, attributes_json, effective_from AS starts_on,
    CASE WHEN next_from IS NULL OR (effective_to IS NOT NULL AND effective_to < next_from)
      THEN effective_to ELSE next_from END AS ends_on
  FROM next_versions WHERE state = 'active'
), reporting_references AS (
  SELECT relation.organization_id, relation.resource_id, relation.starts_on, relation.ends_on,
    json_extract(reference.value, '$[0]') AS target_type,
    json_extract(reference.value, '$[1]') AS target_id
  FROM relations relation, json_each(json_array(
    json_array('employee', json_extract(attributes_json, '$.employeeId')),
    json_array('employee', json_extract(attributes_json, '$.managerEmployeeId')),
    json_array('organization-unit', json_extract(attributes_json, '$.organizationUnitId'))
  )) reference
)
SELECT reference.* FROM reporting_references reference
WHERE NOT EXISTS (
  SELECT 1 FROM company_governance_resource_coverage target
  WHERE target.organization_id = reference.organization_id AND target.resource_type = reference.target_type
    AND target.reference_id = reference.target_id AND target.starts_on <= reference.starts_on
    AND (target.ends_on IS NULL OR (reference.ends_on IS NOT NULL AND reference.ends_on <= target.ends_on))
);

SELECT json_extract('{}', 'company_reporting_reference_period_not_covered')
FROM company_reporting_reference_period_violations LIMIT 1;

CREATE TRIGGER company_reporting_reference_period_commit_guard
BEFORE UPDATE OF revision ON company_organizations
WHEN NEW.revision != OLD.revision
BEGIN
  SELECT RAISE(ABORT, 'company_reporting_reference_period_not_covered')
  WHERE EXISTS (SELECT 1 FROM company_reporting_reference_period_violations WHERE organization_id = NEW.id);
END;

CREATE VIEW company_grade_assignment_periods AS
WITH versions AS (
  SELECT resource.* FROM company_resource_revisions resource
  WHERE resource.resource_type IN ('employee', 'employment', 'grade', 'grade-assignment')
    AND resource.revision = (
      SELECT max(latest.revision) FROM company_resource_revisions latest
      WHERE latest.organization_id = resource.organization_id
        AND latest.resource_type = resource.resource_type AND latest.resource_id = resource.resource_id
        AND latest.effective_from = resource.effective_from
    )
), boundaries AS (
  SELECT *, lead(effective_from) OVER (
    PARTITION BY organization_id, resource_type, resource_id ORDER BY effective_from
  ) AS next_from FROM versions
)
SELECT organization_id, resource_type, resource_id, attributes_json,
  effective_from AS starts_on,
  CASE WHEN next_from IS NULL OR (effective_to IS NOT NULL AND effective_to < next_from)
    THEN effective_to ELSE next_from END AS ends_on
FROM boundaries WHERE state = 'active'
  AND (resource_type != 'employment' OR json_extract(attributes_json, '$.status') != 'TERMINATED');

CREATE VIEW company_grade_assignment_coverage AS
WITH prior AS (
  SELECT *, max(coalesce(ends_on, '9999-12-31')) OVER (
    PARTITION BY organization_id, resource_type, resource_id, json_extract(attributes_json, '$.employeeId')
    ORDER BY starts_on, ends_on ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
  ) AS covered_until FROM company_grade_assignment_periods
), islands AS (
  SELECT *, sum(CASE WHEN covered_until IS NULL OR starts_on > covered_until THEN 1 ELSE 0 END) OVER (
    PARTITION BY organization_id, resource_type, resource_id, json_extract(attributes_json, '$.employeeId')
    ORDER BY starts_on, ends_on ROWS UNBOUNDED PRECEDING
  ) AS island FROM prior
)
SELECT organization_id, resource_type, resource_id,
  json_extract(attributes_json, '$.employeeId') AS employee_id, min(starts_on) AS starts_on,
  CASE WHEN max(ends_on IS NULL) = 1 THEN NULL ELSE max(ends_on) END AS ends_on
FROM islands GROUP BY organization_id, resource_type, resource_id, employee_id, island;

CREATE VIEW company_grade_assignment_violations AS
SELECT assignment.organization_id, assignment.resource_id
FROM company_grade_assignment_periods assignment
WHERE assignment.resource_type = 'grade-assignment' AND (
  NOT EXISTS (
    SELECT 1 FROM company_grade_assignment_coverage employee
    WHERE employee.organization_id = assignment.organization_id AND employee.resource_type = 'employee'
      AND employee.resource_id = json_extract(assignment.attributes_json, '$.employeeId')
      AND employee.starts_on <= assignment.starts_on
      AND (employee.ends_on IS NULL OR (assignment.ends_on IS NOT NULL AND assignment.ends_on <= employee.ends_on))
  ) OR NOT EXISTS (
    SELECT 1 FROM company_grade_assignment_coverage employment
    WHERE employment.organization_id = assignment.organization_id AND employment.resource_type = 'employment'
      AND employment.resource_id = json_extract(assignment.attributes_json, '$.employmentId')
      AND employment.employee_id = json_extract(assignment.attributes_json, '$.employeeId')
      AND employment.starts_on <= assignment.starts_on
      AND (employment.ends_on IS NULL OR (assignment.ends_on IS NOT NULL AND assignment.ends_on <= employment.ends_on))
  ) OR NOT EXISTS (
    SELECT 1 FROM company_grade_assignment_coverage grade
    WHERE grade.organization_id = assignment.organization_id AND grade.resource_type = 'grade'
      AND grade.resource_id = json_extract(assignment.attributes_json, '$.gradeId')
      AND grade.starts_on <= assignment.starts_on
      AND (grade.ends_on IS NULL OR (assignment.ends_on IS NOT NULL AND assignment.ends_on <= grade.ends_on))
  ) OR EXISTS (
    SELECT 1 FROM company_grade_assignment_periods other
    WHERE other.organization_id = assignment.organization_id AND other.resource_type = 'grade-assignment'
      AND other.resource_id != assignment.resource_id
      AND json_extract(other.attributes_json, '$.employmentId') = json_extract(assignment.attributes_json, '$.employmentId')
      AND (other.ends_on IS NULL OR assignment.starts_on < other.ends_on)
      AND (assignment.ends_on IS NULL OR other.starts_on < assignment.ends_on)
  )
);

SELECT json_extract('{}', 'company_grade_assignment_invalid')
FROM company_grade_assignment_violations LIMIT 1;

DROP TRIGGER IF EXISTS company_grade_assignment_owner_guard;
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

DROP TRIGGER IF EXISTS company_grade_assignment_commit_guard;
CREATE TRIGGER company_grade_assignment_commit_guard
BEFORE UPDATE OF revision ON company_organizations
WHEN NEW.revision != OLD.revision
BEGIN
  SELECT RAISE(ABORT, 'company_grade_assignment_invalid') WHERE EXISTS (
    SELECT 1 FROM company_grade_assignment_violations WHERE organization_id = NEW.id
  );
END;

DROP INDEX company_resource_revisions_org_revision_idx;
CREATE INDEX company_resource_revisions_org_revision_idx
  ON company_resource_revisions (organization_id, organization_revision, resource_type, resource_id);

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
CREATE TRIGGER company_definition_resource_adoptions_identity_update
BEFORE UPDATE OF id ON company_definition_resource_adoptions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

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
CREATE TRIGGER company_grade_award_archives_identity_update
BEFORE UPDATE OF id ON company_grade_award_archives
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

DROP TRIGGER IF EXISTS company_grade_award_archive_no_update;
CREATE TRIGGER company_grade_award_archive_no_update
BEFORE UPDATE ON company_grade_award_archives
BEGIN
  SELECT RAISE(ABORT, 'company grade award archives are immutable');
END;

DROP TRIGGER IF EXISTS company_grade_award_archive_no_delete;
CREATE TRIGGER company_grade_award_archive_no_delete
BEFORE DELETE ON company_grade_award_archives
BEGIN
  SELECT RAISE(ABORT, 'company grade award archives are immutable');
END;

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
CREATE TRIGGER company_personnel_annotations_legacy_id_insert
BEFORE INSERT ON company_personnel_annotations
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER company_personnel_annotations_identity_update
BEFORE UPDATE OF id, legacy_id ON company_personnel_annotations
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;
CREATE INDEX idx_company_personnel_annotations_employee ON company_personnel_annotations(employee_id);
CREATE INDEX idx_company_personnel_annotations_kind ON company_personnel_annotations(kind);

DROP TRIGGER IF EXISTS company_personnel_annotations_no_update;
CREATE TRIGGER company_personnel_annotations_no_update
BEFORE UPDATE ON company_personnel_annotations
BEGIN
  SELECT RAISE(ABORT, 'company personnel annotations are immutable');
END;

DROP TRIGGER IF EXISTS company_personnel_annotations_no_delete;
CREATE TRIGGER company_personnel_annotations_no_delete
BEFORE DELETE ON company_personnel_annotations
BEGIN
  SELECT RAISE(ABORT, 'company personnel annotations are immutable');
END;

DROP TRIGGER IF EXISTS company_personnel_annotations_no_replace;
CREATE TRIGGER company_personnel_annotations_no_replace
BEFORE INSERT ON company_personnel_annotations
WHEN EXISTS (SELECT 1 FROM company_personnel_annotations WHERE id = NEW.id)
BEGIN
  SELECT RAISE(ABORT, 'company personnel annotations are immutable');
END;

CREATE VIEW company_employment_employer_reference_violations AS
SELECT employment.organization_id, employment.resource_id, employment.starts_on, employment.ends_on,
  json_extract(employment.attributes_json, '$.employerLegalEntityId') AS employer_legal_entity_id
FROM company_governance_resource_periods employment
WHERE employment.resource_type = 'employment'
  AND json_type(employment.attributes_json, '$.employerLegalEntityId') IS NOT NULL
  AND json_type(employment.attributes_json, '$.employerLegalEntityId') <> 'null'
  AND (
    json_type(employment.attributes_json, '$.employerLegalEntityId') <> 'text'
    OR NOT EXISTS (
      SELECT 1 FROM company_resource_revisions identity
      WHERE identity.organization_id = employment.organization_id
        AND identity.resource_type = 'legal-entity' AND identity.state = 'active'
        AND identity.resource_id = json_extract(employment.attributes_json, '$.employerLegalEntityId')
    )
    OR (
      json_extract(employment.attributes_json, '$.status') IN ('ACTIVE', 'ON_LEAVE')
      AND NOT EXISTS (
        SELECT 1 FROM company_governance_resource_coverage employer
        WHERE employer.organization_id = employment.organization_id AND employer.resource_type = 'legal-entity'
          AND employer.reference_id = json_extract(employment.attributes_json, '$.employerLegalEntityId')
          AND employer.starts_on <= employment.starts_on
          AND (employer.ends_on IS NULL OR (employment.ends_on IS NOT NULL AND employment.ends_on <= employer.ends_on))
      )
    )
  );

SELECT json_extract('{}', 'company_employment_employer_reference_invalid')
FROM company_employment_employer_reference_violations LIMIT 1;

CREATE TRIGGER company_employment_employer_commit_guard
BEFORE UPDATE OF revision ON company_organizations
BEGIN
  SELECT RAISE(ABORT, 'company_employment_employer_reference_invalid')
  WHERE EXISTS (
    SELECT 1 FROM company_employment_employer_reference_violations WHERE organization_id = NEW.id
  );
END;

CREATE VIEW company_employment_contract_term_violations AS
SELECT organization_id, resource_id, revision
FROM company_resource_revisions
WHERE resource_type = 'employment'
  AND json_type(attributes_json, '$.contractTerm') IS NOT NULL
  AND json_type(attributes_json, '$.contractTerm') <> 'null'
  AND NOT coalesce(
    json_type(attributes_json, '$.contractTerm') = 'object'
    AND json_type(attributes_json, '$.contractTerm.kind') = 'text'
    AND json_type(attributes_json, '$.contractTerm.startsOn') = 'text'
    AND json_extract(attributes_json, '$.contractTerm.startsOn') GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
    AND date(json_extract(attributes_json, '$.contractTerm.startsOn'), '+0 days') = json_extract(attributes_json, '$.contractTerm.startsOn')
    AND (
      (
        json_extract(attributes_json, '$.contractTerm.kind') = 'INDEFINITE'
        AND (SELECT count(*) FROM json_each(attributes_json, '$.contractTerm')) = 2
        AND NOT EXISTS (SELECT 1 FROM json_each(attributes_json, '$.contractTerm') WHERE key NOT IN ('kind', 'startsOn'))
      )
      OR (
        json_extract(attributes_json, '$.contractTerm.kind') = 'FIXED_TERM'
        AND (SELECT count(*) FROM json_each(attributes_json, '$.contractTerm')) = 3
        AND NOT EXISTS (SELECT 1 FROM json_each(attributes_json, '$.contractTerm') WHERE key NOT IN ('kind', 'startsOn', 'endsBefore'))
        AND json_type(attributes_json, '$.contractTerm.endsBefore') = 'text'
        AND json_extract(attributes_json, '$.contractTerm.endsBefore') GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        AND date(json_extract(attributes_json, '$.contractTerm.endsBefore'), '+0 days') = json_extract(attributes_json, '$.contractTerm.endsBefore')
        AND json_extract(attributes_json, '$.contractTerm.startsOn') < json_extract(attributes_json, '$.contractTerm.endsBefore')
      )
    ), 0
  );

SELECT json_extract('{}', 'company_employment_contract_term_invalid')
FROM company_employment_contract_term_violations LIMIT 1;

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
CREATE TRIGGER company_responsibility_source_adoptions_identity_update
BEFORE UPDATE OF id ON company_responsibility_source_adoptions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

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
CREATE TRIGGER company_responsibility_source_cutovers_identity_update
BEFORE UPDATE OF id ON company_responsibility_source_cutovers
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

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
