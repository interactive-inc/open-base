DROP TRIGGER IF EXISTS company_personnel_annotations_no_update;
CREATE TRIGGER company_personnel_annotations_no_update
BEFORE UPDATE ON company_personnel_annotations
BEGIN
  SELECT RAISE(ABORT, 'company personnel annotations are immutable');
END;
