DROP TRIGGER IF EXISTS company_personnel_annotations_no_delete;
CREATE TRIGGER company_personnel_annotations_no_delete
BEFORE DELETE ON company_personnel_annotations
BEGIN
  SELECT RAISE(ABORT, 'company personnel annotations are immutable');
END;
