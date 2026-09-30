CREATE TRIGGER company_personnel_actions_no_update
BEFORE UPDATE ON company_personnel_actions
BEGIN
  SELECT RAISE(ABORT, 'company personnel actions are append only');
END;
