DROP TRIGGER IF EXISTS company_assignment_resource_adoptions_delete_guard;
CREATE TRIGGER company_assignment_resource_adoptions_delete_guard
BEFORE DELETE ON company_assignment_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'assignment adoption evidence is immutable');
END;
