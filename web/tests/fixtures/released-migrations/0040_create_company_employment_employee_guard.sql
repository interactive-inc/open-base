CREATE TRIGGER company_employments_employee_immutable
BEFORE UPDATE OF employee_id ON company_employments
WHEN NEW.employee_id IS NOT OLD.employee_id
BEGIN
  SELECT RAISE(ABORT, 'employment employee identity is immutable');
END;
