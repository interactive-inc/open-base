CREATE TRIGGER company_account_employee_links_immutable
BEFORE UPDATE ON company_account_employee_links
BEGIN
  SELECT RAISE(ABORT, 'account employee links are immutable');
END;
