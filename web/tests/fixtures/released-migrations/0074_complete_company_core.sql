
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

DROP TRIGGER IF EXISTS company_site_legal_entity_guard;

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

DROP TRIGGER IF EXISTS company_workplace_site_guard;

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

DROP TRIGGER IF EXISTS company_site_void_guard;

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

DROP TRIGGER IF EXISTS company_legal_entity_void_guard;

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

DROP TRIGGER IF EXISTS company_position_job_guard;

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

DROP TRIGGER IF EXISTS company_organizational_office_reference_guard;

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

DROP TRIGGER IF EXISTS company_office_assignment_reference_guard;

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

DROP TRIGGER IF EXISTS company_authority_scope_reference_guard;

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

DROP TRIGGER IF EXISTS company_responsibility_assignment_reference_guard;

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

DROP TRIGGER IF EXISTS company_collective_body_membership_reference_guard;

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

DROP TRIGGER IF EXISTS company_organizational_authority_scope_guard;

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

DROP TRIGGER IF EXISTS company_governance_definition_void_guard;

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
