CREATE TRIGGER company_account_employee_links_delete_guard
BEFORE DELETE ON company_account_employee_links
BEGIN
  SELECT RAISE(ABORT, 'account employee links are append only');
END;
