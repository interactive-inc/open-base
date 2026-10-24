DROP TRIGGER IF EXISTS company_archived_grade_awards_no_delete;
CREATE TRIGGER company_archived_grade_awards_no_delete
BEFORE DELETE ON company_employee_grades
WHEN EXISTS (SELECT 1 FROM company_grade_award_archives WHERE employee_id = OLD.employee_id)
BEGIN
  SELECT RAISE(ABORT, 'archived company grade awards are immutable');
END;
