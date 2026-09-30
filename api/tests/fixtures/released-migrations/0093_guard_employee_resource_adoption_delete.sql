DROP TRIGGER IF EXISTS company_employee_resource_adoptions_no_delete;
CREATE TRIGGER company_employee_resource_adoptions_no_delete
BEFORE DELETE ON company_employee_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'employee resource adoption is immutable');
END;
