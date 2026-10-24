CREATE TRIGGER company_employment_period_versions_no_update
BEFORE UPDATE ON company_employment_period_versions
BEGIN
  SELECT RAISE(ABORT, 'company employment period versions are append only');
END;
