DROP TRIGGER IF EXISTS company_adopted_grade_insert_guard;
CREATE TRIGGER company_adopted_grade_insert_guard
BEFORE INSERT ON company_grade_definitions
WHEN EXISTS (SELECT 1 FROM company_definition_resource_adoptions
  WHERE resource_type = 'grade' AND definition_id = NEW.id)
BEGIN
  SELECT RAISE(ABORT, 'company_definition_already_adopted');
END;
DROP TRIGGER IF EXISTS company_adopted_grade_update_guard;
CREATE TRIGGER company_adopted_grade_update_guard
BEFORE UPDATE ON company_grade_definitions
WHEN EXISTS (SELECT 1 FROM company_definition_resource_adoptions
  WHERE resource_type = 'grade' AND definition_id IN (OLD.id, NEW.id))
BEGIN
  SELECT RAISE(ABORT, 'company_definition_already_adopted');
END;
DROP TRIGGER IF EXISTS company_adopted_grade_delete_guard;
CREATE TRIGGER company_adopted_grade_delete_guard
BEFORE DELETE ON company_grade_definitions
WHEN EXISTS (SELECT 1 FROM company_definition_resource_adoptions
  WHERE resource_type = 'grade' AND definition_id = OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'company_definition_already_adopted');
END;
DROP TRIGGER IF EXISTS company_adopted_position_insert_guard;
CREATE TRIGGER company_adopted_position_insert_guard
BEFORE INSERT ON company_position_definitions
WHEN EXISTS (SELECT 1 FROM company_definition_resource_adoptions
  WHERE resource_type = 'position' AND definition_id = NEW.id)
BEGIN
  SELECT RAISE(ABORT, 'company_definition_already_adopted');
END;
DROP TRIGGER IF EXISTS company_adopted_position_update_guard;
CREATE TRIGGER company_adopted_position_update_guard
BEFORE UPDATE ON company_position_definitions
WHEN EXISTS (SELECT 1 FROM company_definition_resource_adoptions
  WHERE resource_type = 'position' AND definition_id IN (OLD.id, NEW.id))
BEGIN
  SELECT RAISE(ABORT, 'company_definition_already_adopted');
END;
DROP TRIGGER IF EXISTS company_adopted_position_delete_guard;
CREATE TRIGGER company_adopted_position_delete_guard
BEFORE DELETE ON company_position_definitions
WHEN EXISTS (SELECT 1 FROM company_definition_resource_adoptions
  WHERE resource_type = 'position' AND definition_id = OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'company_definition_already_adopted');
END;
