DROP TRIGGER IF EXISTS company_grade_assignment_commit_guard;
CREATE TRIGGER company_grade_assignment_commit_guard
BEFORE UPDATE OF revision ON company_organizations
WHEN NEW.revision != OLD.revision
BEGIN
  SELECT RAISE(ABORT, 'company_grade_assignment_invalid') WHERE EXISTS (
    SELECT 1 FROM company_grade_assignment_violations WHERE organization_id = NEW.id
  );
END;
