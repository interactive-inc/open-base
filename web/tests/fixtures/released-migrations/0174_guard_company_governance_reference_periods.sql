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
