ALTER TABLE company_personnel_action_requests
ADD COLUMN base_company_revision INTEGER
CHECK (base_company_revision IS NULL OR base_company_revision >= 0);
