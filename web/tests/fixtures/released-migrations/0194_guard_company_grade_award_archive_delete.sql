DROP TRIGGER IF EXISTS company_grade_award_archive_no_delete;
CREATE TRIGGER company_grade_award_archive_no_delete
BEFORE DELETE ON company_grade_award_archives
BEGIN
  SELECT RAISE(ABORT, 'company grade award archives are immutable');
END;
