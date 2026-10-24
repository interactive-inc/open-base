CREATE TRIGGER system_record_retirement_plans_delete BEFORE DELETE ON system_record_retirement_plans
BEGIN
  SELECT RAISE(ABORT,'record_retirement_plan_immutable');
END;
