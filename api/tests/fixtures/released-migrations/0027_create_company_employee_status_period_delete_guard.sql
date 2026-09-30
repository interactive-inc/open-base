CREATE TRIGGER company_employee_status_period_versions_no_delete
BEFORE DELETE ON company_employee_status_period_versions
BEGIN
  SELECT RAISE(ABORT, 'company employee status period versions are append only');
END;
