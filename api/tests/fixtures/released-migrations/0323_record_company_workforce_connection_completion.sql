-- 旧会社台帳の従業員と雇用がすべて公開履歴へ接続したことを、会社ごとに一度だけ明示的に記録する。
-- この記録がある会社では、公開履歴へ未接続の従業員への発令を拒否する。記録は変更も削除もできない。
CREATE TABLE company_workforce_connection_completions (
  organization_id TEXT PRIMARY KEY NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT
    CHECK (organization_id = 'organization:default'),
  command_id TEXT NOT NULL UNIQUE CHECK (length(command_id) BETWEEN 1 AND 255),
  actor_account_id TEXT NOT NULL CHECK (length(actor_account_id) BETWEEN 1 AND 255),
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 2000),
  employee_count INTEGER NOT NULL CHECK (employee_count >= 0),
  employment_count INTEGER NOT NULL CHECK (employment_count >= 0),
  completed_at INTEGER NOT NULL CHECK (completed_at >= 0)
);

CREATE TRIGGER company_workforce_connection_completions_no_update
BEFORE UPDATE ON company_workforce_connection_completions
BEGIN SELECT RAISE(ABORT, 'company_workforce_connection_completion_immutable'); END;

CREATE TRIGGER company_workforce_connection_completions_no_delete
BEFORE DELETE ON company_workforce_connection_completions
BEGIN SELECT RAISE(ABORT, 'company_workforce_connection_completion_immutable'); END;

-- 接続が残っている間は完了を記録できない。記録と同時に全件の接続をDBで再検査する。
CREATE TRIGGER company_workforce_connection_completions_requires_connection
BEFORE INSERT ON company_workforce_connection_completions
WHEN EXISTS (
  SELECT 1 FROM company_employees AS employee
  WHERE NOT EXISTS (
    SELECT 1 FROM company_workforce_resource_bindings AS binding
    WHERE binding.resource_type = 'employee' AND binding.employee_id = employee.id
  )
) OR EXISTS (
  SELECT 1 FROM company_employments AS employment
  WHERE NOT EXISTS (
    SELECT 1 FROM company_workforce_resource_bindings AS binding
    WHERE binding.resource_type = 'employment' AND binding.resource_id = employment.id
  )
)
BEGIN SELECT RAISE(ABORT, 'company_workforce_connection_incomplete'); END;
