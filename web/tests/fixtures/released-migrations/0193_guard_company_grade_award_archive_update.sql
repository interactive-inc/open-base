DROP TRIGGER IF EXISTS company_grade_award_archive_no_update;
CREATE TRIGGER company_grade_award_archive_no_update
BEFORE UPDATE ON company_grade_award_archives
BEGIN
  SELECT RAISE(ABORT, 'company grade award archives are immutable');
END;
