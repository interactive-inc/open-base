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
