DROP TRIGGER IF EXISTS company_personnel_annotations_no_replace;
CREATE TRIGGER company_personnel_annotations_no_replace
BEFORE INSERT ON company_personnel_annotations
WHEN EXISTS (SELECT 1 FROM company_personnel_annotations WHERE id = NEW.id)
BEGIN
  SELECT RAISE(ABORT, 'company personnel annotations are immutable');
END;
