-- 識別の table（Account、Principal、本人の束縛と認証、社員、雇用、人事の発令、組織の変更、資源の束縛）を
-- UUID の主キーへ揃える (Issue )。
--
-- UUID でない主キー（整数の Account と社員、'principal:'・'employment:'・'person:'・'link:' などの接頭辞付きの ID、
-- 期間の ID）を新しい UUID へ置き換え、Account・社員・Principal・雇用・人事の発令・組織の変更の旧来の値は
-- 同じ行の legacy_id に残す。同じ文字列で互いを指していた ID（雇用とその期間と資源など）は同じ新しい値へ移す。
--
-- 参照する列（外部キーと、列名で決まる account・employee・principal・employment・action・period の参照、
-- 資源の ID、属性の JSON の accountId・employeeId・personId・employmentId）も同じ対応で書き換える。
-- すべての table を退避してから削除し、参照先から作り直す。外部キーは transaction の終わりに検査する。
--
-- ALTER TABLE RENAME は trigger を含む全 schema を解析し直し、table ごとに数十 ms かかる。
-- 名前を変えずに行を退避し、同じ名前で作り直してから戻す。

PRAGMA defer_foreign_keys = true;

CREATE TABLE _identity_uuid_primary_key_validation (
  resource TEXT PRIMARY KEY NOT NULL,
  source_count INTEGER NOT NULL,
  target_count INTEGER NOT NULL,
  orphan_count INTEGER NOT NULL,
  non_uuid_count INTEGER NOT NULL,
  blocked_count INTEGER NOT NULL,
  CHECK (source_count = target_count AND orphan_count = 0 AND non_uuid_count = 0 AND blocked_count = 0)
);

INSERT INTO _identity_uuid_primary_key_validation VALUES ('record_source_freezes.active', 0, 0, 0, 0, (SELECT count(*) FROM system_record_source_freezes WHERE revision = 1));

CREATE TABLE _f_misc_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
-- 初期化の変更操作と会社全体の初期期間は、コードが同じ入力から求める決まった UUID へ移す。
INSERT INTO _f_misc_id_map (old_id, new_id) VALUES
  ('initialization:organization:default', '7d64591a-4423-8a69-b90a-7ff1d89f9303'),
  ('initialization:company:root', 'e6b86290-198c-8162-9315-751b0c412b89'),
  ('company:root:initial', '82072674-7a3e-81a4-b640-635f0026e236');
INSERT OR IGNORE INTO _f_misc_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) FROM system_principals WHERE NOT (typeof(id) = 'text' AND length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]');
INSERT OR IGNORE INTO _f_misc_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) FROM system_identity_bindings WHERE NOT (typeof(id) = 'text' AND length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]');
INSERT OR IGNORE INTO _f_misc_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) FROM company_employments WHERE NOT (typeof(id) = 'text' AND length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]');
INSERT OR IGNORE INTO _f_misc_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) FROM company_personnel_actions WHERE NOT (typeof(id) = 'text' AND length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]');
INSERT OR IGNORE INTO _f_misc_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) FROM company_organization_change_operations WHERE NOT (typeof(id) = 'text' AND length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]');
INSERT OR IGNORE INTO _f_misc_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) FROM company_personnel_action_requests WHERE NOT (typeof(id) = 'text' AND length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]');
INSERT OR IGNORE INTO _f_misc_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) FROM company_employment_attributes WHERE NOT (typeof(id) = 'text' AND length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]');
INSERT OR IGNORE INTO _f_misc_id_map (old_id, new_id)
SELECT period_id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) FROM company_organization_unit_period_versions WHERE NOT (typeof(period_id) = 'text' AND length(period_id) = 36 AND period_id NOT GLOB '*[^0-9a-f-]*' AND substr(period_id, 15, 1) GLOB '[1-8]' AND substr(period_id, 20, 1) GLOB '[89ab]');
INSERT OR IGNORE INTO _f_misc_id_map (old_id, new_id)
SELECT period_id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) FROM company_organization_assignment_period_versions WHERE NOT (typeof(period_id) = 'text' AND length(period_id) = 36 AND period_id NOT GLOB '*[^0-9a-f-]*' AND substr(period_id, 15, 1) GLOB '[1-8]' AND substr(period_id, 20, 1) GLOB '[89ab]');
INSERT OR IGNORE INTO _f_misc_id_map (old_id, new_id)
SELECT period_id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) FROM company_organization_responsibility_period_versions WHERE NOT (typeof(period_id) = 'text' AND length(period_id) = 36 AND period_id NOT GLOB '*[^0-9a-f-]*' AND substr(period_id, 15, 1) GLOB '[1-8]' AND substr(period_id, 20, 1) GLOB '[89ab]');
INSERT OR IGNORE INTO _f_misc_id_map (old_id, new_id)
SELECT period_id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) FROM company_employment_period_versions WHERE NOT (typeof(period_id) = 'text' AND length(period_id) = 36 AND period_id NOT GLOB '*[^0-9a-f-]*' AND substr(period_id, 15, 1) GLOB '[1-8]' AND substr(period_id, 20, 1) GLOB '[89ab]');
INSERT OR IGNORE INTO _f_misc_id_map (old_id, new_id)
SELECT period_id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) FROM company_employee_status_period_versions WHERE NOT (typeof(period_id) = 'text' AND length(period_id) = 36 AND period_id NOT GLOB '*[^0-9a-f-]*' AND substr(period_id, 15, 1) GLOB '[1-8]' AND substr(period_id, 20, 1) GLOB '[89ab]');
INSERT OR IGNORE INTO _f_misc_id_map (old_id, new_id)
SELECT resource_id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) FROM company_resource_heads WHERE resource_type <> 'employee' AND NOT (typeof(resource_id) = 'text' AND length(resource_id) = 36 AND resource_id NOT GLOB '*[^0-9a-f-]*' AND substr(resource_id, 15, 1) GLOB '[1-8]' AND substr(resource_id, 20, 1) GLOB '[89ab]');

-- company_employees
CREATE TABLE _company_employees_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _company_employees_id_map (old_id, new_id)
SELECT id, CASE WHEN length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]' THEN id ELSE lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) END
FROM company_employees;

-- system_accounts
CREATE TABLE _system_accounts_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _system_accounts_id_map (old_id, new_id)
SELECT id, CASE WHEN length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]' THEN id ELSE lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) END
FROM system_accounts;

-- company_organization_change_operations
CREATE TABLE _company_organization_change_operations_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _company_organization_change_operations_id_map (old_id, new_id)
SELECT id, COALESCE((SELECT via.new_id FROM _f_misc_id_map via WHERE via.old_id = company_organization_change_operations.id), CASE WHEN length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]' THEN id ELSE lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) END )
FROM company_organization_change_operations;

-- company_employments
CREATE TABLE _company_employments_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _company_employments_id_map (old_id, new_id)
SELECT id, COALESCE((SELECT via.new_id FROM _f_misc_id_map via WHERE via.old_id = company_employments.id), CASE WHEN length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]' THEN id ELSE lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) END )
FROM company_employments;

-- company_employment_attributes
CREATE TABLE _company_employment_attributes_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _company_employment_attributes_id_map (old_id, new_id)
SELECT id, COALESCE((SELECT via.new_id FROM _f_misc_id_map via WHERE via.old_id = company_employment_attributes.id), CASE WHEN length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]' THEN id ELSE lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) END )
FROM company_employment_attributes;

-- system_principals
CREATE TABLE _system_principals_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _system_principals_id_map (old_id, new_id)
SELECT id, COALESCE((SELECT via.new_id FROM _f_misc_id_map via WHERE via.old_id = system_principals.id), CASE WHEN length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]' THEN id ELSE lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) END )
FROM system_principals;

-- system_machine_credentials
CREATE TABLE _system_machine_credentials_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _system_machine_credentials_id_map (old_id, new_id)
SELECT id, COALESCE((SELECT via.new_id FROM _f_misc_id_map via WHERE via.old_id = system_machine_credentials.id), CASE WHEN length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]' THEN id ELSE lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) END )
FROM system_machine_credentials;

-- system_identity_bindings
CREATE TABLE _system_identity_bindings_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _system_identity_bindings_id_map (old_id, new_id)
SELECT id, COALESCE((SELECT via.new_id FROM _f_misc_id_map via WHERE via.old_id = system_identity_bindings.id), CASE WHEN length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]' THEN id ELSE lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) END )
FROM system_identity_bindings;

-- company_personnel_action_requests
CREATE TABLE _company_personnel_action_requests_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _company_personnel_action_requests_id_map (old_id, new_id)
SELECT id, COALESCE((SELECT via.new_id FROM _f_misc_id_map via WHERE via.old_id = company_personnel_action_requests.id), CASE WHEN length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]' THEN id ELSE lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) END )
FROM company_personnel_action_requests;

-- company_personnel_actions
CREATE TABLE _company_personnel_actions_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _company_personnel_actions_id_map (old_id, new_id)
SELECT id, COALESCE((SELECT via.new_id FROM _f_misc_id_map via WHERE via.old_id = company_personnel_actions.id), CASE WHEN length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]' THEN id ELSE lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) END )
FROM company_personnel_actions;

-- system_account_invitations
CREATE TABLE _system_account_invitations_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _system_account_invitations_id_map (old_id, new_id)
SELECT id, COALESCE((SELECT via.new_id FROM _f_misc_id_map via WHERE via.old_id = system_account_invitations.id), CASE WHEN length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]' THEN id ELSE lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) END )
FROM system_account_invitations;

-- system_authentication_attempts
CREATE TABLE _system_authentication_attempts_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _system_authentication_attempts_id_map (old_id, new_id)
SELECT id, COALESCE((SELECT via.new_id FROM _f_misc_id_map via WHERE via.old_id = system_authentication_attempts.id), CASE WHEN length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]' THEN id ELSE lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) END )
FROM system_authentication_attempts;

-- system_password_reset_challenges
CREATE TABLE _system_password_reset_challenges_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _system_password_reset_challenges_id_map (old_id, new_id)
SELECT id, COALESCE((SELECT via.new_id FROM _f_misc_id_map via WHERE via.old_id = system_password_reset_challenges.id), CASE WHEN length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]' THEN id ELSE lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) END )
FROM system_password_reset_challenges;

-- system_sessions
CREATE TABLE _system_sessions_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _system_sessions_id_map (old_id, new_id)
SELECT id, COALESCE((SELECT via.new_id FROM _f_misc_id_map via WHERE via.old_id = system_sessions.id), CASE WHEN length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]' THEN id ELSE lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) END )
FROM system_sessions;

-- system_step_up_grants
CREATE TABLE _system_step_up_grants_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _system_step_up_grants_id_map (old_id, new_id)
SELECT id, COALESCE((SELECT via.new_id FROM _f_misc_id_map via WHERE via.old_id = system_step_up_grants.id), CASE WHEN length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]' THEN id ELSE lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) END )
FROM system_step_up_grants;

DROP TRIGGER company_organization_resource_operation_commit_guard;
-- 参照元から順に行を退避して table を削除する。
CREATE TABLE "_stage_work_accidents" AS SELECT * FROM work_accidents;
CREATE TABLE "_stage_training_enrollments" AS SELECT * FROM training_enrollments;
CREATE TABLE "_stage_thanks_redemptions" AS SELECT * FROM thanks_redemptions;
CREATE TABLE "_stage_thanks_point_budgets" AS SELECT * FROM thanks_point_budgets;
CREATE TABLE "_stage_thanks_messages" AS SELECT * FROM thanks_messages;
CREATE TABLE "_stage_system_work_evidence" AS SELECT * FROM system_work_evidence;
CREATE TABLE "_stage_system_work_item_revisions" AS SELECT * FROM system_work_item_revisions;
CREATE TABLE "_stage_system_work_items" AS SELECT * FROM system_work_items;
CREATE TABLE "_stage_system_step_up_grants" AS SELECT * FROM system_step_up_grants;
CREATE TABLE "_stage_system_sessions" AS SELECT * FROM system_sessions;
CREATE TABLE "_stage_system_record_source_retirements" AS SELECT * FROM system_record_source_retirements;
CREATE TABLE "_stage_system_record_retirement_attachment_pins" AS SELECT * FROM system_record_retirement_attachment_pins;
CREATE TABLE "_stage_system_record_retirement_receipts" AS SELECT * FROM system_record_retirement_receipts;
CREATE TABLE "_stage_system_record_retirement_plans" AS SELECT * FROM system_record_retirement_plans;
CREATE TABLE "_stage_system_record_coverage_entries" AS SELECT * FROM system_record_coverage_entries;
CREATE TABLE "_stage_system_record_coverage_pages" AS SELECT * FROM system_record_coverage_pages;
CREATE TABLE "_stage_system_proposal_cases" AS SELECT * FROM system_proposal_cases;
CREATE TABLE "_stage_system_proposals" AS SELECT * FROM system_proposals;
CREATE TABLE "_stage_system_procedure_definition_revisions" AS SELECT * FROM system_procedure_definition_revisions;
CREATE TABLE "_stage_system_preserved_records" AS SELECT * FROM system_preserved_records;
CREATE TABLE "_stage_system_record_disclosure_policies" AS SELECT * FROM system_record_disclosure_policies;
CREATE TABLE "_stage_system_password_reset_challenges" AS SELECT * FROM system_password_reset_challenges;
CREATE TABLE "_stage_system_password_credentials" AS SELECT * FROM system_password_credentials;
CREATE TABLE "_stage_system_outbox_messages" AS SELECT * FROM system_outbox_messages;
CREATE TABLE "_stage_system_operation_receipts" AS SELECT * FROM system_operation_receipts;
CREATE TABLE "_stage_system_oidc_authorization_codes" AS SELECT * FROM system_oidc_authorization_codes;
CREATE TABLE "_stage_system_oidc_access_tokens" AS SELECT * FROM system_oidc_access_tokens;
CREATE TABLE "_stage_system_notification_resource_scopes" AS SELECT * FROM system_notification_resource_scopes;
CREATE TABLE "_stage_system_notification_deliveries" AS SELECT * FROM system_notification_deliveries;
CREATE TABLE "_stage_system_notification_messages" AS SELECT * FROM system_notification_messages;
CREATE TABLE "_stage_system_identity_profiles" AS SELECT * FROM system_identity_profiles;
CREATE TABLE "_stage_system_human_attestations" AS SELECT * FROM system_human_attestations;
CREATE TABLE "_stage_system_execution_authorizations" AS SELECT * FROM system_execution_authorizations;
CREATE TABLE "_stage_system_delegation_procedure_scopes" AS SELECT * FROM system_delegation_procedure_scopes;
CREATE TABLE "_stage_system_delegation_numbers" AS SELECT * FROM system_delegation_numbers;
CREATE TABLE "_stage_system_delegations" AS SELECT * FROM system_delegations;
CREATE TABLE "_stage_system_decision_task_exclusions" AS SELECT * FROM system_decision_task_exclusions;
CREATE TABLE "_stage_system_decision_task_candidates" AS SELECT * FROM system_decision_task_candidates;
CREATE TABLE "_stage_system_decision_tasks" AS SELECT * FROM system_decision_tasks;
CREATE TABLE "_stage_system_dead_letters" AS SELECT * FROM system_dead_letters;
CREATE TABLE "_stage_system_cli_login_codes" AS SELECT * FROM system_cli_login_codes;
CREATE TABLE "_stage_system_browser_login_codes" AS SELECT * FROM system_browser_login_codes;
CREATE TABLE "_stage_system_bootstrap_state" AS SELECT * FROM system_bootstrap_state;
CREATE TABLE "_stage_system_role_bindings" AS SELECT * FROM system_role_bindings;
CREATE TABLE "_stage_system_authentication_attempts" AS SELECT * FROM system_authentication_attempts;
CREATE TABLE "_stage_system_audit_disclosure_policy_revisions" AS SELECT * FROM system_audit_disclosure_policy_revisions;
CREATE TABLE "_stage_system_attachments" AS SELECT * FROM system_attachments;
CREATE TABLE "_stage_system_attachment_preservations" AS SELECT * FROM system_attachment_preservations;
CREATE TABLE "_stage_system_account_invitations" AS SELECT * FROM system_account_invitations;
CREATE TABLE "_stage_survey_responses" AS SELECT * FROM survey_responses;
CREATE TABLE "_stage_stocktake_items" AS SELECT * FROM stocktake_items;
CREATE TABLE "_stage_software_license_changes" AS SELECT * FROM software_license_changes;
CREATE TABLE "_stage_software_license_assignments" AS SELECT * FROM software_license_assignments;
CREATE TABLE "_stage_software_licenses" AS SELECT * FROM software_licenses;
CREATE TABLE "_stage_shift_swap_requests" AS SELECT * FROM shift_swap_requests;
CREATE TABLE "_stage_shift_assignments" AS SELECT * FROM shift_assignments;
CREATE TABLE "_stage_salary_revisions" AS SELECT * FROM salary_revisions;
CREATE TABLE "_stage_room_reservations" AS SELECT * FROM room_reservations;
CREATE TABLE "_stage_ringi_procedure_bindings" AS SELECT * FROM ringi_procedure_bindings;
CREATE TABLE "_stage_ringi_requests" AS SELECT * FROM ringi_requests;
CREATE TABLE "_stage_review_forms" AS SELECT * FROM review_forms;
CREATE TABLE "_stage_resignations" AS SELECT * FROM resignations;
CREATE TABLE "_stage_rental_reservations" AS SELECT * FROM rental_reservations;
CREATE TABLE "_stage_performance_goals" AS SELECT * FROM performance_goals;
CREATE TABLE "_stage_one_on_ones" AS SELECT * FROM one_on_ones;
CREATE TABLE "_stage_onboarding_lifecycle_template_bindings" AS SELECT * FROM onboarding_lifecycle_template_bindings;
CREATE TABLE "_stage_onboarding_lifecycle_deliveries" AS SELECT * FROM onboarding_lifecycle_deliveries;
CREATE TABLE "_stage_onboarding_assignments" AS SELECT * FROM onboarding_assignments;
CREATE TABLE "_stage_meeting_minutes_records" AS SELECT * FROM meeting_minutes_records;
CREATE TABLE "_stage_life_events" AS SELECT * FROM life_events;
CREATE TABLE "_stage_leave_procedure_bindings" AS SELECT * FROM leave_procedure_bindings;
CREATE TABLE "_stage_leave_decision_notifications" AS SELECT * FROM leave_decision_notifications;
CREATE TABLE "_stage_system_jobs" AS SELECT * FROM system_jobs;
CREATE TABLE "_stage_leave_requests" AS SELECT * FROM leave_requests;
CREATE TABLE "_stage_leave_balances" AS SELECT * FROM leave_balances;
CREATE TABLE "_stage_knowledge_article_revisions" AS SELECT * FROM knowledge_article_revisions;
CREATE TABLE "_stage_knowledge_articles" AS SELECT * FROM knowledge_articles;
CREATE TABLE "_stage_health_checkups" AS SELECT * FROM health_checkups;
CREATE TABLE "_stage_governance_publication_approvals" AS SELECT * FROM governance_publication_approvals;
CREATE TABLE "_stage_governance_org_role_assignments" AS SELECT * FROM governance_org_role_assignments;
CREATE TABLE "_stage_governance_documents" AS SELECT * FROM governance_documents;
CREATE TABLE "_stage_governance_document_versions" AS SELECT * FROM governance_document_versions;
CREATE TABLE "_stage_governance_acknowledgements" AS SELECT * FROM governance_acknowledgements;
CREATE TABLE "_stage_goal_evaluations" AS SELECT * FROM goal_evaluations;
CREATE TABLE "_stage_family_care_leaves" AS SELECT * FROM family_care_leaves;
CREATE TABLE "_stage_expense_procedure_bindings" AS SELECT * FROM expense_procedure_bindings;
CREATE TABLE "_stage_expenses" AS SELECT * FROM expenses;
CREATE TABLE "_stage_system_proposal_numbers" AS SELECT * FROM system_proposal_numbers;
CREATE TABLE "_stage_system_proposal_series" AS SELECT * FROM system_proposal_series;
CREATE TABLE "_stage_system_cases" AS SELECT * FROM system_cases;
CREATE TABLE "_stage_expense_approvals" AS SELECT * FROM expense_approvals;
CREATE TABLE "_stage_evaluation_templates" AS SELECT * FROM evaluation_templates;
CREATE TABLE "_stage_evaluation_sheets" AS SELECT * FROM evaluation_sheets;
CREATE TABLE "_stage_evaluation_sheet_audit_logs" AS SELECT * FROM evaluation_sheet_audit_logs;
CREATE TABLE "_stage_employee_work_styles" AS SELECT * FROM employee_work_styles;
CREATE TABLE "_stage_employee_skills" AS SELECT * FROM employee_skills;
CREATE TABLE "_stage_employee_certifications" AS SELECT * FROM employee_certifications;
CREATE TABLE "_stage_disciplinary_actions" AS SELECT * FROM disciplinary_actions;
CREATE TABLE "_stage_company_workforce_resource_bindings" AS SELECT * FROM company_workforce_resource_bindings;
CREATE TABLE "_stage_company_workforce_connection_completions" AS SELECT * FROM company_workforce_connection_completions;
CREATE TABLE "_stage_company_responsibility_source_cutovers" AS SELECT * FROM company_responsibility_source_cutovers;
CREATE TABLE "_stage_company_responsibility_source_adoptions" AS SELECT * FROM company_responsibility_source_adoptions;
CREATE TABLE "_stage_system_record_source_freezes" AS SELECT * FROM system_record_source_freezes;
CREATE TABLE "_stage_system_audit_events" AS SELECT * FROM system_audit_events;
CREATE TABLE "_stage_company_responsibility_resource_adoptions" AS SELECT * FROM company_responsibility_resource_adoptions;
CREATE TABLE "_stage_company_responsibility_period_bindings" AS SELECT * FROM company_responsibility_period_bindings;
CREATE TABLE "_stage_company_responsibility_resource_bindings" AS SELECT * FROM company_responsibility_resource_bindings;
CREATE TABLE "_stage_company_resource_revisions" AS SELECT * FROM company_resource_revisions;
CREATE TABLE "_stage_company_profile_change_receipts" AS SELECT * FROM company_profile_change_receipts;
CREATE TABLE "_stage_company_personnel_reporting_bindings" AS SELECT * FROM company_personnel_reporting_bindings;
CREATE TABLE "_stage_company_personnel_annotations" AS SELECT * FROM company_personnel_annotations;
CREATE TABLE "_stage_company_personnel_actions" AS SELECT * FROM company_personnel_actions;
CREATE TABLE "_stage_company_personnel_action_requests" AS SELECT * FROM company_personnel_action_requests;
CREATE TABLE "_stage_company_organization_unit_period_versions" AS SELECT * FROM company_organization_unit_period_versions;
CREATE TABLE "_stage_company_organization_responsibility_period_versions" AS SELECT * FROM company_organization_responsibility_period_versions;
CREATE TABLE "_stage_company_organization_resource_bindings" AS SELECT * FROM company_organization_resource_bindings;
CREATE TABLE "_stage_company_organization_resource_adoptions" AS SELECT * FROM company_organization_resource_adoptions;
CREATE TABLE "_stage_company_lifecycle_outbox_entries" AS SELECT * FROM company_lifecycle_outbox_entries;
CREATE TABLE "_stage_company_grade_award_archives" AS SELECT * FROM company_grade_award_archives;
CREATE TABLE "_stage_company_external_identity_sources" AS SELECT * FROM company_external_identity_sources;
CREATE TABLE "_stage_system_identity_bindings" AS SELECT * FROM system_identity_bindings;
CREATE TABLE "_stage_company_external_identity_imports" AS SELECT * FROM company_external_identity_imports;
CREATE TABLE "_stage_system_machine_credentials" AS SELECT * FROM system_machine_credentials;
CREATE TABLE "_stage_system_principals" AS SELECT * FROM system_principals;
CREATE TABLE "_stage_company_employment_period_versions" AS SELECT * FROM company_employment_period_versions;
CREATE TABLE "_stage_company_employment_attributes" AS SELECT * FROM company_employment_attributes;
CREATE TABLE "_stage_company_employments" AS SELECT * FROM company_employments;
CREATE TABLE "_stage_company_employee_status_period_versions" AS SELECT * FROM company_employee_status_period_versions;
CREATE TABLE "_stage_company_employee_resource_adoptions" AS SELECT * FROM company_employee_resource_adoptions;
CREATE TABLE "_stage_company_employee_lifecycle_revisions" AS SELECT * FROM company_employee_lifecycle_revisions;
CREATE TABLE "_stage_company_definition_resource_adoptions" AS SELECT * FROM company_definition_resource_adoptions;
CREATE TABLE "_stage_company_bootstrap_receipts" AS SELECT * FROM company_bootstrap_receipts;
CREATE TABLE "_stage_company_audit_events" AS SELECT * FROM company_audit_events;
CREATE TABLE "_stage_company_audit_event_employee_contexts" AS SELECT * FROM company_audit_event_employee_contexts;
CREATE TABLE "_stage_company_audit_event_appends" AS SELECT * FROM company_audit_event_appends;
CREATE TABLE "_stage_company_assignment_resource_adoptions" AS SELECT * FROM company_assignment_resource_adoptions;
CREATE TABLE "_stage_company_assignment_period_bindings" AS SELECT * FROM company_assignment_period_bindings;
CREATE TABLE "_stage_company_assignment_resource_bindings" AS SELECT * FROM company_assignment_resource_bindings;
CREATE TABLE "_stage_company_organization_assignment_period_versions" AS SELECT * FROM company_organization_assignment_period_versions;
CREATE TABLE "_stage_company_organization_change_operations" AS SELECT * FROM company_organization_change_operations;
CREATE TABLE "_stage_company_account_profiles" AS SELECT * FROM company_account_profiles;
CREATE TABLE "_stage_company_account_employee_resource_bindings" AS SELECT * FROM company_account_employee_resource_bindings;
CREATE TABLE "_stage_company_resource_heads" AS SELECT * FROM company_resource_heads;
CREATE TABLE "_stage_company_account_employee_links" AS SELECT * FROM company_account_employee_links;
CREATE TABLE "_stage_system_accounts" AS SELECT * FROM system_accounts;
CREATE TABLE "_stage_commendations" AS SELECT * FROM commendations;
CREATE TABLE "_stage_certificate_requests" AS SELECT * FROM certificate_requests;
CREATE TABLE "_stage_career_sheets" AS SELECT * FROM career_sheets;
CREATE TABLE "_stage_career_applications" AS SELECT * FROM career_applications;
CREATE TABLE "_stage_business_trips" AS SELECT * FROM business_trips;
CREATE TABLE "_stage_attendance_records" AS SELECT * FROM attendance_records;
CREATE TABLE "_stage_assets" AS SELECT * FROM assets;
CREATE TABLE "_stage_asset_lendings" AS SELECT * FROM asset_lendings;
CREATE TABLE "_stage_antisocial_checks" AS SELECT * FROM antisocial_checks;
CREATE TABLE "_stage_announcements" AS SELECT * FROM announcements;
CREATE TABLE "_stage_company_employees" AS SELECT * FROM company_employees;
DROP TABLE work_accidents;
DROP TABLE training_enrollments;
DROP TABLE thanks_redemptions;
DROP TABLE thanks_point_budgets;
DROP TABLE thanks_messages;
DROP TABLE system_work_evidence;
DROP TABLE system_work_item_revisions;
DROP TABLE system_work_items;
DROP TABLE system_step_up_grants;
DROP TABLE system_sessions;
DROP TABLE system_record_source_retirements;
DROP TABLE system_record_retirement_attachment_pins;
DROP TABLE system_record_retirement_receipts;
DROP TABLE system_record_retirement_plans;
DROP TABLE system_record_coverage_entries;
DROP TABLE system_record_coverage_pages;
DROP TABLE system_proposal_cases;
DROP TABLE system_proposals;
DROP TABLE system_procedure_definition_revisions;
DROP TABLE system_preserved_records;
DROP TABLE system_record_disclosure_policies;
DROP TABLE system_password_reset_challenges;
DROP TABLE system_password_credentials;
DROP TABLE system_outbox_messages;
DROP TABLE system_operation_receipts;
DROP TABLE system_oidc_authorization_codes;
DROP TABLE system_oidc_access_tokens;
DROP TABLE system_notification_resource_scopes;
DROP TABLE system_notification_deliveries;
DROP TABLE system_notification_messages;
DROP TABLE system_identity_profiles;
DROP TABLE system_human_attestations;
DROP TABLE system_execution_authorizations;
DROP TABLE system_delegation_procedure_scopes;
DROP TABLE system_delegation_numbers;
DROP TABLE system_delegations;
DROP TABLE system_decision_task_exclusions;
DROP TABLE system_decision_task_candidates;
DROP TABLE system_decision_tasks;
DROP TABLE system_dead_letters;
DROP TABLE system_cli_login_codes;
DROP TABLE system_browser_login_codes;
DROP TABLE system_bootstrap_state;
DROP TABLE system_role_bindings;
DROP TABLE system_authentication_attempts;
DROP TABLE system_audit_disclosure_policy_revisions;
DROP TABLE system_attachments;
DROP TABLE system_attachment_preservations;
DROP TABLE system_account_invitations;
DROP TABLE survey_responses;
DROP TABLE stocktake_items;
DROP TABLE software_license_changes;
DROP TABLE software_license_assignments;
DROP TABLE software_licenses;
DROP TABLE shift_swap_requests;
DROP TABLE shift_assignments;
DROP TABLE salary_revisions;
DROP TABLE room_reservations;
DROP TABLE ringi_procedure_bindings;
DROP TABLE ringi_requests;
DROP TABLE review_forms;
DROP TABLE resignations;
DROP TABLE rental_reservations;
DROP TABLE performance_goals;
DROP TABLE one_on_ones;
DROP TABLE onboarding_lifecycle_template_bindings;
DROP TABLE onboarding_lifecycle_deliveries;
DROP TABLE onboarding_assignments;
DROP TABLE meeting_minutes_records;
DROP TABLE life_events;
DROP TABLE leave_procedure_bindings;
DROP TABLE leave_decision_notifications;
DROP TABLE system_jobs;
DROP TABLE leave_requests;
DROP TABLE leave_balances;
DROP TABLE knowledge_article_revisions;
DROP TABLE knowledge_articles;
DROP TABLE health_checkups;
DROP TABLE governance_publication_approvals;
DROP TABLE governance_org_role_assignments;
DROP TABLE governance_documents;
DROP TABLE governance_document_versions;
DROP TABLE governance_acknowledgements;
DROP TABLE goal_evaluations;
DROP TABLE family_care_leaves;
DROP TABLE expense_procedure_bindings;
DROP TABLE expenses;
DROP TABLE system_proposal_numbers;
DROP TABLE system_proposal_series;
DROP TABLE system_cases;
DROP TABLE expense_approvals;
DROP TABLE evaluation_templates;
DROP TABLE evaluation_sheets;
DROP TABLE evaluation_sheet_audit_logs;
DROP TABLE employee_work_styles;
DROP TABLE employee_skills;
DROP TABLE employee_certifications;
DROP TABLE disciplinary_actions;
DROP TABLE company_workforce_resource_bindings;
DROP TABLE company_workforce_connection_completions;
DROP TABLE company_responsibility_source_cutovers;
DROP TABLE company_responsibility_source_adoptions;
DROP TABLE system_record_source_freezes;
DROP TABLE system_audit_events;
DROP TABLE company_responsibility_resource_adoptions;
DROP TABLE company_responsibility_period_bindings;
DROP TABLE company_responsibility_resource_bindings;
DROP TABLE company_resource_revisions;
DROP TABLE company_profile_change_receipts;
DROP TABLE company_personnel_reporting_bindings;
DROP TABLE company_personnel_annotations;
DROP TABLE company_personnel_actions;
DROP TABLE company_personnel_action_requests;
DROP TABLE company_organization_unit_period_versions;
DROP TABLE company_organization_responsibility_period_versions;
DROP TABLE company_organization_resource_bindings;
DROP TABLE company_organization_resource_adoptions;
DROP TABLE company_lifecycle_outbox_entries;
DROP TABLE company_grade_award_archives;
DROP TABLE company_external_identity_sources;
DROP TABLE system_identity_bindings;
DROP TABLE company_external_identity_imports;
DROP TABLE system_machine_credentials;
DROP TABLE system_principals;
DROP TABLE company_employment_period_versions;
DROP TABLE company_employment_attributes;
DROP TABLE company_employments;
DROP TABLE company_employee_status_period_versions;
DROP TABLE company_employee_resource_adoptions;
DROP TABLE company_employee_lifecycle_revisions;
DROP TABLE company_definition_resource_adoptions;
DROP TABLE company_bootstrap_receipts;
DROP TABLE company_audit_events;
DROP TABLE company_audit_event_employee_contexts;
DROP TABLE company_audit_event_appends;
DROP TABLE company_assignment_resource_adoptions;
DROP TABLE company_assignment_period_bindings;
DROP TABLE company_assignment_resource_bindings;
DROP TABLE company_organization_assignment_period_versions;
DROP TABLE company_organization_change_operations;
DROP TABLE company_account_profiles;
DROP TABLE company_account_employee_resource_bindings;
DROP TABLE company_resource_heads;
DROP TABLE company_account_employee_links;
DROP TABLE system_accounts;
DROP TABLE commendations;
DROP TABLE certificate_requests;
DROP TABLE career_sheets;
DROP TABLE career_applications;
DROP TABLE business_trips;
DROP TABLE attendance_records;
DROP TABLE assets;
DROP TABLE asset_lendings;
DROP TABLE antisocial_checks;
DROP TABLE announcements;
DROP TABLE company_employees;

CREATE TABLE company_employees (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  official_name TEXT NOT NULL
    CHECK (length(official_name) BETWEEN 1 AND 200 AND trim(official_name) = official_name),
  employee_code TEXT
    CHECK (
      employee_code IS NULL OR (
        length(employee_code) BETWEEN 1 AND 64 AND trim(employee_code) = employee_code
      )
    ),
  email TEXT
    CHECK (email IS NULL OR (length(email) BETWEEN 1 AND 320 AND trim(email) = email)),
  phone TEXT
    CHECK (phone IS NULL OR (length(phone) BETWEEN 1 AND 64 AND trim(phone) = phone)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
    CHECK (updated_at >= created_at),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE announcements (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  title TEXT NOT NULL,
  body_md TEXT NOT NULL,
  published_on TEXT,
  author_employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE antisocial_checks (
  id TEXT PRIMARY KEY NOT NULL,
  requester_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  partner_name TEXT NOT NULL,
  partner_address TEXT,
  representative_name TEXT,
  result TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE asset_lendings (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  asset_code TEXT NOT NULL,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  lent_at TEXT NOT NULL,
  returned_at TEXT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE assets (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  serial TEXT,
  purchased_on TEXT,
  status TEXT NOT NULL,
  holder_employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT
, disposed_on TEXT, disposal_reason TEXT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE attendance_records (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  work_date TEXT NOT NULL,
  clock_in_at TEXT,
  clock_out_at TEXT,
  work_minutes INTEGER,
  note TEXT,
  status TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE business_trips (
  id TEXT PRIMARY KEY NOT NULL,
  traveler_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  destination TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  purpose TEXT NOT NULL,
  estimated_cost INTEGER,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE career_applications (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  legacy_id TEXT UNIQUE,
  posting_id TEXT NOT NULL,
  applicant_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  message TEXT,
  status TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE career_sheets (
  employee_id TEXT PRIMARY KEY NOT NULL REFERENCES company_employees(id) ON DELETE RESTRICT,
  goals_text TEXT,
  strengths_text TEXT,
  updated_at TEXT NOT NULL,
  CHECK (length(employee_id) = 36 AND employee_id NOT GLOB '*[^0-9a-f-]*' AND substr(employee_id, 9, 1) = '-' AND substr(employee_id, 14, 1) = '-' AND substr(employee_id, 19, 1) = '-' AND substr(employee_id, 24, 1) = '-' AND length(replace(employee_id, '-', '')) = 32 AND substr(employee_id, 15, 1) GLOB '[1-8]' AND substr(employee_id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE certificate_requests (
  id TEXT PRIMARY KEY NOT NULL,
  requester_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  certificate_type TEXT NOT NULL,
  submit_to TEXT,
  needed_by TEXT,
  note TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE commendations (
  id TEXT PRIMARY KEY NOT NULL,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  title TEXT NOT NULL,
  reason TEXT NOT NULL,
  awarded_on TEXT NOT NULL,
  created_at TEXT NOT NULL,
  legacy_id TEXT UNIQUE,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_accounts (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  status TEXT NOT NULL
    CHECK (status IN ('active', 'suspended', 'locked')),
  token_version INTEGER NOT NULL DEFAULT 0
    CHECK (token_version >= 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
    CHECK (updated_at >= created_at)
, closed_at INTEGER
  CHECK (closed_at IS NULL OR closed_at >= created_at),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE company_account_employee_links (
  account_id TEXT PRIMARY KEY NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  employee_id TEXT NOT NULL
    REFERENCES company_employees(id) ON DELETE RESTRICT,
  CHECK (length(account_id) = 36 AND account_id NOT GLOB '*[^0-9a-f-]*' AND substr(account_id, 9, 1) = '-' AND substr(account_id, 14, 1) = '-' AND substr(account_id, 19, 1) = '-' AND substr(account_id, 24, 1) = '-' AND length(replace(account_id, '-', '')) = 32 AND substr(account_id, 15, 1) GLOB '[1-8]' AND substr(account_id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE company_resource_heads (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  organization_revision INTEGER NOT NULL CHECK (organization_revision >= 1),
  state TEXT NOT NULL CHECK (state IN ('active', 'void')),
  effective_from TEXT NOT NULL,
  effective_to TEXT CHECK (effective_to IS NULL OR effective_to > effective_from),
  attributes_json TEXT NOT NULL CHECK (json_valid(attributes_json)),
  updated_at INTEGER NOT NULL CHECK (updated_at >= 0),
  UNIQUE (organization_id, resource_type, resource_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE company_account_employee_resource_bindings (
  resource_id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL DEFAULT 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d' CHECK (organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'),
  resource_type TEXT NOT NULL DEFAULT 'account-employee-link' CHECK (resource_type = 'account-employee-link'),
  account_id TEXT NOT NULL UNIQUE REFERENCES system_accounts(id) ON DELETE RESTRICT,
  employee_id TEXT NOT NULL UNIQUE REFERENCES company_employees(id) ON DELETE RESTRICT,
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  FOREIGN KEY (organization_id, resource_type, resource_id)
    REFERENCES company_resource_heads(organization_id, resource_type, resource_id) ON DELETE RESTRICT,
  CHECK (length(resource_id) = 36 AND resource_id NOT GLOB '*[^0-9a-f-]*' AND substr(resource_id, 9, 1) = '-' AND substr(resource_id, 14, 1) = '-' AND substr(resource_id, 19, 1) = '-' AND substr(resource_id, 24, 1) = '-' AND length(replace(resource_id, '-', '')) = 32 AND substr(resource_id, 15, 1) GLOB '[1-8]' AND substr(resource_id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE company_account_profiles (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE CASCADE ON UPDATE CASCADE,
  account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (
    length(display_name) BETWEEN 1 AND 200
    AND trim(display_name) = display_name
    AND instr(display_name, char(0)) = 0
  ),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  UNIQUE (organization_id, account_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE company_organization_change_operations (
  id TEXT PRIMARY KEY NOT NULL,
  operation_key TEXT UNIQUE CHECK (operation_key IS NULL OR length(operation_key) BETWEEN 1 AND 256),
  legacy_id TEXT UNIQUE,
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  change_count INTEGER NOT NULL CHECK (change_count >= 1),
  applied_count INTEGER NOT NULL DEFAULT 0 CHECK (applied_count BETWEEN 0 AND change_count),
  resulting_revision INTEGER NOT NULL
    CHECK (resulting_revision = expected_revision + change_count),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED')),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0)
, request_fingerprint TEXT NOT NULL
DEFAULT '0000000000000000000000000000000000000000000000000000000000000000'
CHECK (
  length(request_fingerprint) = 64
  AND request_fingerprint NOT GLOB '*[^0-9a-f]*'
), actor_account_id TEXT NOT NULL DEFAULT 'system:initialization'
CHECK (length(actor_account_id) BETWEEN 1 AND 255 AND trim(actor_account_id) = actor_account_id), reason TEXT NOT NULL DEFAULT 'Initialize organization change'
CHECK (length(reason) BETWEEN 1 AND 1000 AND trim(reason) = reason), evidence_references_json TEXT NOT NULL DEFAULT '[]'
CHECK (json_valid(evidence_references_json) AND json_type(evidence_references_json) = 'array'),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE company_organization_assignment_period_versions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  period_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  employment_id TEXT NOT NULL CHECK (length(employment_id) BETWEEN 1 AND 200),
  employee_id TEXT NOT NULL CHECK (length(employee_id) BETWEEN 1 AND 128),
  organization_unit_id TEXT NOT NULL
    REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('PRIMARY', 'CONCURRENT')),
  position_title TEXT CHECK (
    position_title IS NULL OR (
      length(position_title) BETWEEN 1 AND 200 AND trim(position_title) = position_title
    )
  ),
  manager_employee_id TEXT CHECK (
    manager_employee_id IS NULL OR manager_employee_id != employee_id
  ),
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  is_void INTEGER NOT NULL DEFAULT 0 CHECK (is_void IN (0, 1)),
  recorded_by_action_id TEXT NOT NULL
    REFERENCES company_organization_change_operations(id) ON DELETE RESTRICT,
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  UNIQUE (period_id, revision),
  CHECK (
    length(starts_on) = 10 AND date(starts_on) IS starts_on
    AND (ends_on IS NULL OR (length(ends_on) = 10 AND date(ends_on) IS ends_on))
    AND (ends_on IS NULL OR starts_on < ends_on)
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
) WITHOUT ROWID;
CREATE TABLE company_assignment_resource_bindings (
  resource_id TEXT PRIMARY KEY NOT NULL CHECK (length(resource_id) BETWEEN 1 AND 255),
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT CHECK (organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'),
  employee_id TEXT NOT NULL REFERENCES company_employees(id) ON DELETE RESTRICT,
  resource_revision INTEGER NOT NULL CHECK (resource_revision >= 1),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  CHECK (length(resource_id) = 36 AND resource_id NOT GLOB '*[^0-9a-f-]*' AND substr(resource_id, 9, 1) = '-' AND substr(resource_id, 14, 1) = '-' AND substr(resource_id, 19, 1) = '-' AND substr(resource_id, 24, 1) = '-' AND length(replace(resource_id, '-', '')) = 32 AND substr(resource_id, 15, 1) GLOB '[1-8]' AND substr(resource_id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE company_assignment_period_bindings (
  period_id TEXT PRIMARY KEY NOT NULL,
  resource_id TEXT NOT NULL REFERENCES company_assignment_resource_bindings(resource_id) ON DELETE RESTRICT,
  period_revision INTEGER NOT NULL CHECK (period_revision >= 1),
  source_revision INTEGER NOT NULL CHECK (source_revision >= 1),
  FOREIGN KEY (period_id, period_revision) REFERENCES company_organization_assignment_period_versions(period_id, revision) ON DELETE RESTRICT,
  CHECK (length(period_id) = 36 AND period_id NOT GLOB '*[^0-9a-f-]*' AND substr(period_id, 9, 1) = '-' AND substr(period_id, 14, 1) = '-' AND substr(period_id, 19, 1) = '-' AND substr(period_id, 24, 1) = '-' AND length(replace(period_id, '-', '')) = 32 AND substr(period_id, 15, 1) GLOB '[1-8]' AND substr(period_id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE company_assignment_resource_adoptions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  command_id TEXT NOT NULL UNIQUE CHECK (length(command_id) BETWEEN 1 AND 200),
  employee_id TEXT NOT NULL REFERENCES company_employees(id) ON DELETE RESTRICT,
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64),
  actor_account_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 1000),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  organization_revision INTEGER NOT NULL CHECK (organization_revision > expected_revision),
  observed_on TEXT NOT NULL,
  adopted_periods INTEGER NOT NULL CHECK (adopted_periods BETWEEN 1 AND 1000),
  snapshot_digest TEXT NOT NULL CHECK (length(snapshot_digest) = 64),
  source_json TEXT NOT NULL CHECK (json_valid(source_json)),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0), mappings_json TEXT CHECK (mappings_json IS NULL OR (json_valid(mappings_json) AND json_type(mappings_json) = 'array')),
  UNIQUE (employee_id, snapshot_digest),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE company_audit_event_appends (
  staging_id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  event_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  actor_account_id TEXT,
  actor_employee_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  outcome TEXT NOT NULL,
  reason_code TEXT,
  authorization_json TEXT,
  before_json TEXT,
  after_json TEXT,
  metadata_json TEXT,
  client_ip TEXT,
  client_name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  CHECK (actor_account_id IS NULL OR length(actor_account_id) BETWEEN 1 AND 255),
  CHECK (length(staging_id) = 36 AND staging_id NOT GLOB '*[^0-9a-f-]*' AND substr(staging_id, 9, 1) = '-' AND substr(staging_id, 14, 1) = '-' AND substr(staging_id, 19, 1) = '-' AND substr(staging_id, 24, 1) = '-' AND length(replace(staging_id, '-', '')) = 32 AND substr(staging_id, 15, 1) GLOB '[1-8]' AND substr(staging_id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE company_audit_event_employee_contexts (
  audit_event_id TEXT PRIMARY KEY NOT NULL,
  employee_id TEXT NOT NULL,
  CHECK (length(audit_event_id) = 36 AND audit_event_id NOT GLOB '*[^0-9a-f-]*' AND substr(audit_event_id, 9, 1) = '-' AND substr(audit_event_id, 14, 1) = '-' AND substr(audit_event_id, 19, 1) = '-' AND substr(audit_event_id, 24, 1) = '-' AND length(replace(audit_event_id, '-', '')) = 32 AND substr(audit_event_id, 15, 1) GLOB '[1-8]' AND substr(audit_event_id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE company_audit_events (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  event_id TEXT NOT NULL UNIQUE,
  request_id TEXT NOT NULL,
  actor_account_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('succeeded', 'denied', 'failed')),
  reason_code TEXT,
  authorization_json TEXT,
  before_json TEXT,
  after_json TEXT,
  metadata_json TEXT,
  client_ip TEXT,
  client_name TEXT NOT NULL CHECK (client_name IN ('web', 'cli', 'api', 'system')),
  created_at INTEGER NOT NULL,
  CHECK (actor_account_id IS NULL OR length(actor_account_id) BETWEEN 1 AND 255),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]'),
  CHECK (length(event_id) = 36 AND event_id NOT GLOB '*[^0-9a-f-]*' AND substr(event_id, 9, 1) = '-' AND substr(event_id, 14, 1) = '-' AND substr(event_id, 19, 1) = '-' AND substr(event_id, 24, 1) = '-' AND length(replace(event_id, '-', '')) = 32 AND substr(event_id, 15, 1) GLOB '[1-8]' AND substr(event_id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE company_bootstrap_receipts (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  command_id TEXT NOT NULL UNIQUE CHECK (length(command_id) BETWEEN 1 AND 200),
  organization_id TEXT NOT NULL UNIQUE REFERENCES company_organizations(id) CHECK (organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id),
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64 AND fingerprint NOT GLOB '*[^0-9a-f]*'),
  employee_id TEXT NOT NULL REFERENCES company_employees(id),
  organization_revision INTEGER NOT NULL CHECK (organization_revision > 0),
  declaration_json TEXT NOT NULL CHECK (json_valid(declaration_json)),
  source_json TEXT NOT NULL CHECK (json_valid(source_json) AND length(CAST(source_json AS BLOB)) <= 750000),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE company_definition_resource_adoptions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  organization_id TEXT NOT NULL DEFAULT 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d' CHECK (organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'),
  command_id TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('grade', 'position')),
  definition_id INTEGER NOT NULL CHECK (definition_id > 0),
  resource_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 1000),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  organization_revision INTEGER NOT NULL CHECK (organization_revision = expected_revision + 1),
  observed_on TEXT NOT NULL CHECK (length(observed_on) = 10),
  snapshot_digest TEXT NOT NULL CHECK (length(snapshot_digest) = 64),
  source_json TEXT NOT NULL CHECK (json_valid(source_json) AND length(CAST(source_json AS BLOB)) <= 20000
    AND json_extract(source_json, '$.definition.type') IS resource_type
    AND json_extract(source_json, '$.definition.id') IS definition_id
    AND json_extract(source_json, '$.organizationRevision') IS expected_revision),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  UNIQUE (organization_id, command_id),
  UNIQUE (resource_type, definition_id),
  UNIQUE (organization_id, resource_type, resource_id),
  FOREIGN KEY (organization_id, resource_type, resource_id)
    REFERENCES company_resource_heads(organization_id, resource_type, resource_id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, command_id)
    REFERENCES company_command_receipts(organization_id, command_id) ON DELETE RESTRICT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE company_employee_lifecycle_revisions (
  employee_id TEXT PRIMARY KEY NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at INTEGER NOT NULL,
  CHECK (length(employee_id) = 36 AND employee_id NOT GLOB '*[^0-9a-f-]*' AND substr(employee_id, 9, 1) = '-' AND substr(employee_id, 14, 1) = '-' AND substr(employee_id, 19, 1) = '-' AND substr(employee_id, 24, 1) = '-' AND length(replace(employee_id, '-', '')) = 32 AND substr(employee_id, 15, 1) GLOB '[1-8]' AND substr(employee_id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE company_employee_resource_adoptions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  command_id TEXT NOT NULL UNIQUE CHECK (length(command_id) BETWEEN 1 AND 200),
  employee_id TEXT NOT NULL UNIQUE REFERENCES company_employees(id) ON DELETE RESTRICT,
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64 AND fingerprint NOT GLOB '*[^0-9a-f]*'),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 1500),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  organization_revision INTEGER NOT NULL CHECK (organization_revision > expected_revision AND organization_revision <= expected_revision + 100),
  observed_on TEXT NOT NULL CHECK (length(observed_on) = 10),
  snapshot_digest TEXT NOT NULL CHECK (length(snapshot_digest) = 64 AND snapshot_digest NOT GLOB '*[^0-9a-f]*'),
  source_json TEXT NOT NULL CHECK (json_valid(source_json) AND length(CAST(source_json AS BLOB)) <= 750000),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE company_employee_status_period_versions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  period_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  employment_period_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'leave')),
  starts_on TEXT NOT NULL CHECK (
    length(starts_on) = 10 AND substr(starts_on, 5, 1) = '-' AND substr(starts_on, 8, 1) = '-'
  ),
  ends_on TEXT CHECK (
    ends_on IS NULL OR (
      length(ends_on) = 10 AND substr(ends_on, 5, 1) = '-' AND substr(ends_on, 8, 1) = '-'
    )
  ),
  is_void INTEGER NOT NULL DEFAULT 0 CHECK (is_void IN (0, 1)),
  recorded_by_action_id TEXT NOT NULL,
  recorded_at INTEGER NOT NULL,
  UNIQUE (period_id, revision),
  CHECK (ends_on IS NULL OR starts_on < ends_on),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
) WITHOUT ROWID;
CREATE TABLE company_employments (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  employee_id TEXT NOT NULL
    REFERENCES company_employees(id) ON DELETE RESTRICT,
  contract_name TEXT NOT NULL
    CHECK (length(contract_name) BETWEEN 1 AND 200 AND trim(contract_name) = contract_name),
  employment_type TEXT NOT NULL
    CHECK (employment_type IN ('FULL_TIME', 'PART_TIME')),
  hire_date TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('ACTIVE', 'ON_LEAVE', 'TERMINATED')),
  termination_date TEXT,
  created_at INTEGER NOT NULL
    CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL
    CHECK (updated_at >= created_at),
  CHECK (termination_date IS NULL OR hire_date <= termination_date),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE company_employment_attributes (
  id TEXT PRIMARY KEY NOT NULL,
  employment_id TEXT NOT NULL
    REFERENCES company_employments(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  position INTEGER NOT NULL
    CHECK (position >= 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
    CHECK (updated_at >= created_at),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE company_employment_period_versions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  period_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  employee_id TEXT NOT NULL,
  starts_on TEXT NOT NULL CHECK (
    length(starts_on) = 10 AND substr(starts_on, 5, 1) = '-' AND substr(starts_on, 8, 1) = '-'
  ),
  ends_on TEXT CHECK (
    ends_on IS NULL OR (
      length(ends_on) = 10 AND substr(ends_on, 5, 1) = '-' AND substr(ends_on, 8, 1) = '-'
    )
  ),
  is_void INTEGER NOT NULL DEFAULT 0 CHECK (is_void IN (0, 1)),
  recorded_by_action_id TEXT NOT NULL,
  recorded_at INTEGER NOT NULL,
  UNIQUE (period_id, revision),
  CHECK (ends_on IS NULL OR starts_on < ends_on),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
) WITHOUT ROWID;
CREATE TABLE system_principals (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  account_id TEXT NOT NULL UNIQUE REFERENCES system_accounts(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK (kind IN ('human', 'agent', 'service', 'connector')),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 200 AND trim(name) = name),
  connector_id TEXT REFERENCES system_connectors(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  CHECK ((kind = 'connector') = (connector_id IS NOT NULL)),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_machine_credentials (
  id TEXT PRIMARY KEY NOT NULL,
  principal_id TEXT NOT NULL REFERENCES system_principals(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 200 AND trim(name) = name),
  secret_hash TEXT NOT NULL UNIQUE CHECK (
    length(secret_hash) = 64 AND secret_hash NOT GLOB '*[^0-9a-f]*'
  ),
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  expires_at INTEGER CHECK (expires_at IS NULL OR expires_at > created_at),
  last_used_at INTEGER CHECK (
    last_used_at IS NULL OR (last_used_at >= created_at AND last_used_at <= updated_at)
  ),
  revoked_at INTEGER CHECK (revoked_at IS NULL OR revoked_at = updated_at),
  CHECK ((status = 'revoked') = (revoked_at IS NOT NULL)),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE company_external_identity_imports (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT,
  command_id TEXT NOT NULL CHECK (length(command_id) BETWEEN 1 AND 200),
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64 AND fingerprint NOT GLOB '*[^0-9a-f]*'),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  machine_credential_id TEXT NOT NULL REFERENCES system_machine_credentials(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 2000),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  organization_revision INTEGER NOT NULL CHECK (organization_revision = expected_revision + 1),
  result_json TEXT NOT NULL CHECK (json_valid(result_json)),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  UNIQUE (organization_id, command_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_identity_bindings (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL
    CHECK (provider IN ('password', 'google', 'github', 'oidc')),
  subject TEXT NOT NULL
    CHECK (length(subject) BETWEEN 1 AND 2048),
  created_at INTEGER NOT NULL,
  activated_at INTEGER
    CHECK (activated_at IS NULL OR activated_at >= created_at),
  revoked_at INTEGER
    CHECK (
      revoked_at IS NULL OR (
        revoked_at >= created_at
        AND (activated_at IS NULL OR revoked_at >= activated_at)
      )
    ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE company_external_identity_sources (
  identity_id TEXT PRIMARY KEY NOT NULL REFERENCES system_identity_bindings(id) ON DELETE RESTRICT,
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT,
  source_revision INTEGER NOT NULL CHECK (source_revision > 0),
  source_digest TEXT NOT NULL CHECK (length(source_digest) = 64 AND source_digest NOT GLOB '*[^0-9a-f]*'),
  updated_at INTEGER NOT NULL CHECK (updated_at >= 0),
  CHECK (length(identity_id) = 36 AND identity_id NOT GLOB '*[^0-9a-f-]*' AND substr(identity_id, 9, 1) = '-' AND substr(identity_id, 14, 1) = '-' AND substr(identity_id, 19, 1) = '-' AND substr(identity_id, 24, 1) = '-' AND length(replace(identity_id, '-', '')) = 32 AND substr(identity_id, 15, 1) GLOB '[1-8]' AND substr(identity_id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE company_grade_award_archives (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) CHECK (organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'),
  command_id TEXT NOT NULL,
  employee_id TEXT NOT NULL REFERENCES company_employees(id),
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 2000),
  observed_on TEXT NOT NULL CHECK (length(observed_on) = 10),
  observed_company_revision INTEGER NOT NULL CHECK (observed_company_revision >= 0),
  snapshot_digest TEXT NOT NULL CHECK (length(snapshot_digest) = 64),
  source_json TEXT NOT NULL CHECK (json_valid(source_json)),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  UNIQUE (organization_id, command_id),
  UNIQUE (organization_id, employee_id),
  CHECK (json_extract(source_json, '$.employeeId') IS employee_id),
  CHECK (json_extract(source_json, '$.organizationRevision') IS observed_company_revision),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE company_lifecycle_outbox_entries (
  -- 人事の発令と同じ batch で行を足すため、主キーは列の既定値で採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  legacy_id TEXT UNIQUE,
  personnel_action_id TEXT NOT NULL,
  effect_type TEXT NOT NULL CHECK (effect_type IN ('hire', 'retired')),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at INTEGER NOT NULL,
  processed_at INTEGER,
  last_error_code TEXT,
  created_at INTEGER NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE company_organization_resource_adoptions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  command_id TEXT NOT NULL UNIQUE CHECK (length(command_id) BETWEEN 1 AND 200),
  organization_unit_id TEXT NOT NULL UNIQUE REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64 AND fingerprint NOT GLOB '*[^0-9a-f]*'),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 1000),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  organization_revision INTEGER NOT NULL CHECK (organization_revision > expected_revision AND organization_revision <= expected_revision + 100),
  observed_on TEXT NOT NULL CHECK (length(observed_on) = 10),
  snapshot_digest TEXT NOT NULL CHECK (length(snapshot_digest) = 64 AND snapshot_digest NOT GLOB '*[^0-9a-f]*'),
  source_json TEXT NOT NULL CHECK (json_valid(source_json) AND length(CAST(source_json AS BLOB)) <= 750000),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE company_organization_resource_bindings (
  organization_unit_id TEXT PRIMARY KEY NOT NULL REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT CHECK (organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  CHECK (length(organization_unit_id) = 36 AND organization_unit_id NOT GLOB '*[^0-9a-f-]*' AND substr(organization_unit_id, 9, 1) = '-' AND substr(organization_unit_id, 14, 1) = '-' AND substr(organization_unit_id, 19, 1) = '-' AND substr(organization_unit_id, 24, 1) = '-' AND length(replace(organization_unit_id, '-', '')) = 32 AND substr(organization_unit_id, 15, 1) GLOB '[1-8]' AND substr(organization_unit_id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE company_organization_responsibility_period_versions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  period_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  employment_id TEXT NOT NULL CHECK (length(employment_id) BETWEEN 1 AND 200),
  employee_id TEXT NOT NULL CHECK (length(employee_id) BETWEEN 1 AND 128),
  organization_unit_id TEXT NOT NULL
    REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  responsibility_type TEXT NOT NULL CHECK (
    length(responsibility_type) BETWEEN 1 AND 64
    AND responsibility_type GLOB '[A-Z]*'
    AND responsibility_type NOT GLOB '*[^A-Z0-9_]*'
  ),
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  is_void INTEGER NOT NULL DEFAULT 0 CHECK (is_void IN (0, 1)),
  recorded_by_action_id TEXT NOT NULL
    REFERENCES company_organization_change_operations(id) ON DELETE RESTRICT,
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  UNIQUE (period_id, revision),
  CHECK (
    length(starts_on) = 10 AND date(starts_on) IS starts_on
    AND (ends_on IS NULL OR (length(ends_on) = 10 AND date(ends_on) IS ends_on))
    AND (ends_on IS NULL OR starts_on < ends_on)
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
) WITHOUT ROWID;
CREATE TABLE company_organization_unit_period_versions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  period_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  organization_unit_id TEXT NOT NULL
    REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  code TEXT NOT NULL
    CHECK (length(code) BETWEEN 1 AND 64 AND trim(code) = code),
  official_name TEXT NOT NULL
    CHECK (length(official_name) BETWEEN 1 AND 200 AND trim(official_name) = official_name),
  kind TEXT NOT NULL
    CHECK (kind IN ('COMPANY', 'DIVISION', 'DEPARTMENT', 'TEAM', 'OTHER')),
  parent_organization_unit_id TEXT
    REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  is_void INTEGER NOT NULL DEFAULT 0 CHECK (is_void IN (0, 1)),
  recorded_by_action_id TEXT NOT NULL
    REFERENCES company_organization_change_operations(id) ON DELETE RESTRICT,
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  UNIQUE (period_id, revision),
  CHECK (
    length(starts_on) = 10 AND date(starts_on) IS starts_on
    AND (ends_on IS NULL OR (length(ends_on) = 10 AND date(ends_on) IS ends_on))
    AND (ends_on IS NULL OR starts_on < ends_on)
  ),
  CHECK (
    parent_organization_unit_id IS NULL
    OR parent_organization_unit_id != organization_unit_id
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
) WITHOUT ROWID;
CREATE TABLE company_personnel_action_requests (
  id TEXT PRIMARY KEY NOT NULL,
  application_id INTEGER NOT NULL UNIQUE,
  target_employee_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN (
    'hire', 'rehire', 'primary_assignment_started', 'transferred',
    'concurrent_assignment_started', 'assignment_ended', 'position_changed',
    'manager_changed', 'department_responsibility_started',
    'department_responsibility_ended', 'leave_started', 'returned', 'retired', 'corrected'
  )),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  requested_by_employee_id TEXT NOT NULL,
  base_employee_revision INTEGER CHECK (
    base_employee_revision IS NULL OR base_employee_revision >= 0
  ),
  base_organization_revision INTEGER CHECK (
    base_organization_revision IS NULL OR base_organization_revision >= 0
  ),
  created_at INTEGER NOT NULL,
  applied_action_id TEXT,
  withdrawn_at INTEGER,
  withdrawn_by_employee_id TEXT,
  system_proposal_series_id TEXT UNIQUE,
  subject_snapshot_json TEXT CHECK (
    subject_snapshot_json IS NULL OR json_valid(subject_snapshot_json)
  ),
  target_department_code TEXT,
  payload_fingerprint TEXT CHECK (
    payload_fingerprint IS NULL OR length(payload_fingerprint) = 64
  )
, base_company_revision INTEGER
CHECK (base_company_revision IS NULL OR base_company_revision >= 0),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE company_personnel_actions (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  employee_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN (
    'hire', 'rehire', 'primary_assignment_started', 'transferred',
    'concurrent_assignment_started', 'assignment_ended', 'position_changed',
    'manager_changed', 'department_responsibility_started',
    'department_responsibility_ended', 'leave_started', 'returned', 'retired',
    'corrected', 'initial_state', 'employment_revised'
  )),
  event_on TEXT NOT NULL CHECK (
    length(event_on) = 10 AND substr(event_on, 5, 1) = '-' AND substr(event_on, 8, 1) = '-'
  ),
  recorded_at INTEGER NOT NULL,
  recorded_by_account_id TEXT,
  requested_by_employee_id TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('application', 'direct', 'system')),
  source_application_id INTEGER,
  corrects_action_id TEXT,
  operation_id TEXT NOT NULL UNIQUE CHECK (length(operation_id) BETWEEN 1 AND 200),
  payload_fingerprint TEXT NOT NULL CHECK (length(payload_fingerprint) = 64),
  summary_json TEXT NOT NULL CHECK (json_valid(summary_json)),
  CHECK (
    (source_type = 'application' AND source_application_id IS NOT NULL)
    OR (source_type != 'application' AND source_application_id IS NULL)
  ),
  CHECK (corrects_action_id IS NULL OR corrects_action_id != id),
  CHECK (recorded_by_account_id IS NULL OR length(recorded_by_account_id) BETWEEN 1 AND 255),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE company_personnel_annotations (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  employee_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  effective_date TEXT NOT NULL,
  from_department_code TEXT,
  to_department_code TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE company_personnel_reporting_bindings (
  resource_id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL DEFAULT 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d' CHECK (organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'),
  resource_type TEXT NOT NULL DEFAULT 'reporting-relation' CHECK (resource_type = 'reporting-relation'),
  employee_id TEXT NOT NULL REFERENCES company_employees(id) ON DELETE RESTRICT,
  employment_id TEXT NOT NULL REFERENCES company_employments(id) ON DELETE RESTRICT,
  organization_unit_id TEXT NOT NULL REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('PRIMARY', 'CONCURRENT')),
  recorded_by_action_id TEXT REFERENCES company_personnel_actions(id) ON DELETE RESTRICT,
  recorded_by_adoption_id TEXT REFERENCES company_assignment_resource_adoptions(command_id) ON DELETE RESTRICT,
  CHECK ((recorded_by_action_id IS NULL) != (recorded_by_adoption_id IS NULL)),
  UNIQUE (employee_id, employment_id, organization_unit_id, assignment_type),
  FOREIGN KEY (organization_id, resource_type, resource_id)
    REFERENCES company_resource_heads(organization_id, resource_type, resource_id) ON DELETE RESTRICT,
  CHECK (length(resource_id) = 36 AND resource_id NOT GLOB '*[^0-9a-f-]*' AND substr(resource_id, 9, 1) = '-' AND substr(resource_id, 14, 1) = '-' AND substr(resource_id, 19, 1) = '-' AND substr(resource_id, 24, 1) = '-' AND length(replace(resource_id, '-', '')) = 32 AND substr(resource_id, 15, 1) GLOB '[1-8]' AND substr(resource_id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE company_profile_change_receipts (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  organization_id TEXT NOT NULL REFERENCES company_organizations(id),
  command_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64 AND fingerprint NOT GLOB '*[^0-9a-f]*'),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id),
  organization_revision INTEGER NOT NULL CHECK (organization_revision > 0),
  declaration_json TEXT NOT NULL CHECK (json_valid(declaration_json)),
  source_json TEXT NOT NULL CHECK (json_valid(source_json)),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  UNIQUE (organization_id, command_id),
  FOREIGN KEY (organization_id, command_id) REFERENCES company_command_receipts(organization_id, command_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE company_resource_revisions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  organization_revision INTEGER NOT NULL CHECK (organization_revision >= 1),
  state TEXT NOT NULL CHECK (state IN ('active', 'void')),
  effective_from TEXT NOT NULL,
  effective_to TEXT CHECK (effective_to IS NULL OR effective_to > effective_from),
  attributes_json TEXT NOT NULL CHECK (json_valid(attributes_json)),
  command_id TEXT NOT NULL,
  actor_account_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 2000),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0), evidence_references_json TEXT NOT NULL DEFAULT '[]'
  CHECK (json_valid(evidence_references_json) AND json_type(evidence_references_json) = 'array'), corrects_revision INTEGER
  CHECK (corrects_revision IS NULL OR (corrects_revision >= 1 AND corrects_revision < revision)),
  UNIQUE (organization_id, resource_type, resource_id, revision),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE company_responsibility_resource_bindings (
  resource_id TEXT PRIMARY KEY NOT NULL CHECK (length(resource_id) BETWEEN 1 AND 255),
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT CHECK (organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'),
  employee_id TEXT NOT NULL REFERENCES company_employees(id) ON DELETE RESTRICT,
  employment_id TEXT NOT NULL REFERENCES company_employments(id) ON DELETE RESTRICT,
  organization_unit_id TEXT NOT NULL REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  responsibility_type TEXT NOT NULL CHECK (length(responsibility_type) BETWEEN 1 AND 100),
  responsibility_id TEXT NOT NULL,
  authority_scope_id TEXT NOT NULL,
  resource_revision INTEGER NOT NULL CHECK (resource_revision >= 1),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  CHECK (length(resource_id) = 36 AND resource_id NOT GLOB '*[^0-9a-f-]*' AND substr(resource_id, 9, 1) = '-' AND substr(resource_id, 14, 1) = '-' AND substr(resource_id, 19, 1) = '-' AND substr(resource_id, 24, 1) = '-' AND length(replace(resource_id, '-', '')) = 32 AND substr(resource_id, 15, 1) GLOB '[1-8]' AND substr(resource_id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE company_responsibility_period_bindings (
  period_id TEXT PRIMARY KEY NOT NULL,
  resource_id TEXT NOT NULL REFERENCES company_responsibility_resource_bindings(resource_id) ON DELETE RESTRICT,
  period_revision INTEGER NOT NULL CHECK (period_revision >= 1),
  source_revision INTEGER NOT NULL CHECK (source_revision >= 1),
  FOREIGN KEY (period_id, period_revision) REFERENCES company_organization_responsibility_period_versions(period_id, revision) ON DELETE RESTRICT,
  CHECK (length(period_id) = 36 AND period_id NOT GLOB '*[^0-9a-f-]*' AND substr(period_id, 9, 1) = '-' AND substr(period_id, 14, 1) = '-' AND substr(period_id, 19, 1) = '-' AND substr(period_id, 24, 1) = '-' AND length(replace(period_id, '-', '')) = 32 AND substr(period_id, 15, 1) GLOB '[1-8]' AND substr(period_id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE company_responsibility_resource_adoptions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  command_id TEXT NOT NULL UNIQUE CHECK (length(command_id) BETWEEN 1 AND 200),
  operation_id TEXT NOT NULL UNIQUE REFERENCES company_organization_change_operations(id) ON DELETE RESTRICT,
  employee_id TEXT NOT NULL REFERENCES company_employees(id) ON DELETE RESTRICT,
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 1000),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  organization_revision INTEGER NOT NULL CHECK (organization_revision > expected_revision AND organization_revision <= expected_revision + 10),
  observed_on TEXT NOT NULL CHECK (length(observed_on) = 10),
  adopted_periods INTEGER NOT NULL CHECK (adopted_periods BETWEEN 1 AND 1000),
  snapshot_digest TEXT NOT NULL CHECK (length(snapshot_digest) = 64),
  source_json TEXT NOT NULL CHECK (json_valid(source_json) AND length(CAST(source_json AS BLOB)) <= 750000),
  mappings_json TEXT NOT NULL CHECK (json_valid(mappings_json) AND json_type(mappings_json) = 'array' AND json_array_length(mappings_json) = adopted_periods AND length(CAST(mappings_json AS BLOB)) <= 750000),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  UNIQUE (employee_id, snapshot_digest),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_audit_events (
  event_id TEXT PRIMARY KEY NOT NULL,
  actor_account_id TEXT,
  action TEXT NOT NULL
    CHECK (length(action) BETWEEN 3 AND 200),
  target_type TEXT NOT NULL
    CHECK (length(target_type) BETWEEN 1 AND 200),
  target_id TEXT,
  outcome TEXT NOT NULL
    CHECK (outcome IN ('succeeded', 'denied', 'failed')),
  reason_code TEXT,
  authorization_json TEXT,
  before_json TEXT,
  after_json TEXT,
  metadata_json TEXT,
  occurred_at INTEGER NOT NULL,
  CHECK (authorization_json IS NULL OR json_valid(authorization_json)),
  CHECK (before_json IS NULL OR json_valid(before_json)),
  CHECK (after_json IS NULL OR json_valid(after_json)),
  CHECK (metadata_json IS NULL OR json_valid(metadata_json)),
  CHECK (length(event_id) = 36 AND event_id NOT GLOB '*[^0-9a-f-]*' AND substr(event_id, 9, 1) = '-' AND substr(event_id, 14, 1) = '-' AND substr(event_id, 19, 1) = '-' AND substr(event_id, 24, 1) = '-' AND length(replace(event_id, '-', '')) = 32 AND substr(event_id, 15, 1) GLOB '[1-8]' AND substr(event_id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_record_source_freezes (
  id TEXT PRIMARY KEY NOT NULL,
  source_namespace TEXT NOT NULL CHECK (length(source_namespace) BETWEEN 1 AND 255),
  owner_context TEXT NOT NULL CHECK (length(owner_context) BETWEEN 1 AND 100),
  revision INTEGER NOT NULL CHECK (revision IN (1, 2)),
  created_audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id),
  release_audit_event_id TEXT UNIQUE REFERENCES system_audit_events(event_id),
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  CHECK (json_extract(snapshot_json, '$.id') IS id),
  CHECK (json_extract(snapshot_json, '$.sourceNamespace') IS source_namespace),
  CHECK (json_extract(snapshot_json, '$.ownerContext') IS owner_context),
  CHECK (json_extract(snapshot_json, '$.revision') IS revision),
  CHECK (json_extract(snapshot_json, '$.auditEventId') IS created_audit_event_id),
  CHECK (json_type(snapshot_json, '$.actorAccountId') IS 'text'
    AND length(trim(json_extract(snapshot_json, '$.actorAccountId'))) BETWEEN 1 AND 255),
  CHECK (json_type(snapshot_json, '$.reason') IS 'text'
    AND length(trim(json_extract(snapshot_json, '$.reason'))) BETWEEN 1 AND 2000),
  CHECK (julianday(json_extract(snapshot_json, '$.createdAt')) IS NOT NULL
    AND julianday(json_extract(snapshot_json, '$.createdAt')) >= julianday('1970-01-01T00:00:00Z')),
  CHECK ((revision = 1 AND release_audit_event_id IS NULL AND json_type(snapshot_json, '$.release') IS 'null')
    OR (revision = 2 AND release_audit_event_id IS NOT NULL AND release_audit_event_id <> created_audit_event_id
      AND json_type(snapshot_json, '$.release') IS 'object'
      AND json_extract(snapshot_json, '$.release.auditEventId') IS release_audit_event_id
      AND json_type(snapshot_json, '$.release.actorAccountId') IS 'text'
      AND length(trim(json_extract(snapshot_json, '$.release.actorAccountId'))) BETWEEN 1 AND 255
      AND json_type(snapshot_json, '$.release.reason') IS 'text'
      AND length(trim(json_extract(snapshot_json, '$.release.reason'))) BETWEEN 1 AND 2000
      AND julianday(json_extract(snapshot_json, '$.release.at')) IS NOT NULL
      AND julianday(json_extract(snapshot_json, '$.release.at')) >= julianday(json_extract(snapshot_json, '$.createdAt')))),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE company_responsibility_source_adoptions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  organization_id TEXT NOT NULL DEFAULT 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'
    CHECK (organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'),
  source_context TEXT NOT NULL CHECK (length(trim(source_context)) BETWEEN 1 AND 100),
  source_kind TEXT NOT NULL CHECK (length(trim(source_kind)) BETWEEN 1 AND 100),
  source_namespace TEXT NOT NULL CHECK (length(trim(source_namespace)) BETWEEN 1 AND 255),
  freeze_id TEXT NOT NULL,
  source_id TEXT NOT NULL CHECK (length(trim(source_id)) BETWEEN 1 AND 255),
  source_version TEXT NOT NULL CHECK (length(trim(source_version)) BETWEEN 1 AND 255),
  command_id TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT 'responsibility-assignment'
    CHECK (resource_type = 'responsibility-assignment'),
  resource_id TEXT NOT NULL,
  resource_revision INTEGER NOT NULL CHECK (resource_revision > 0),
  snapshot_digest TEXT NOT NULL
    CHECK (length(snapshot_digest) = 64 AND snapshot_digest NOT GLOB '*[^0-9a-f]*'),
  source_json TEXT NOT NULL
    CHECK (json_valid(source_json) AND json_type(source_json) = 'object'
      AND length(CAST(source_json AS BLOB)) <= 750000),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 2000),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  organization_revision INTEGER NOT NULL
    CHECK (organization_revision = expected_revision + 1),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  UNIQUE (organization_id, source_context, source_kind, source_id, source_version),
  UNIQUE (organization_id, command_id),
  FOREIGN KEY (organization_id, command_id)
    REFERENCES company_command_receipts(organization_id, command_id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, resource_type, resource_id)
    REFERENCES company_resource_heads(organization_id, resource_type, resource_id) ON DELETE RESTRICT,
  FOREIGN KEY (freeze_id) REFERENCES system_record_source_freezes(id) ON DELETE RESTRICT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE company_responsibility_source_cutovers (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  organization_id TEXT NOT NULL DEFAULT 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'
    CHECK (organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'),
  source_context TEXT NOT NULL CHECK (length(trim(source_context)) BETWEEN 1 AND 100),
  source_kind TEXT NOT NULL CHECK (length(trim(source_kind)) BETWEEN 1 AND 100),
  source_namespace TEXT NOT NULL CHECK (length(trim(source_namespace)) BETWEEN 1 AND 255),
  freeze_id TEXT NOT NULL,
  source_count INTEGER NOT NULL CHECK (source_count >= 0),
  adopted_count INTEGER NOT NULL CHECK (adopted_count = source_count),
  source_manifest_digest TEXT NOT NULL
    CHECK (length(source_manifest_digest) = 64
      AND source_manifest_digest NOT GLOB '*[^0-9a-f]*'),
  source_manifest_json TEXT NOT NULL
    CHECK (json_valid(source_manifest_json) AND json_type(source_manifest_json) = 'array'
      AND json_array_length(source_manifest_json) = source_count
      AND length(CAST(source_manifest_json AS BLOB)) <= 750000),
  audit_event_id TEXT NOT NULL REFERENCES company_audit_events(event_id) ON DELETE RESTRICT,
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  completed_at INTEGER NOT NULL CHECK (completed_at >= 0),
  UNIQUE (organization_id, source_context, source_kind),
  UNIQUE (freeze_id),
  FOREIGN KEY (freeze_id) REFERENCES system_record_source_freezes(id) ON DELETE RESTRICT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE company_workforce_connection_completions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  organization_id TEXT NOT NULL UNIQUE REFERENCES company_organizations(id) ON DELETE RESTRICT
    CHECK (organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'),
  command_id TEXT NOT NULL UNIQUE CHECK (length(command_id) BETWEEN 1 AND 255),
  actor_account_id TEXT NOT NULL CHECK (length(actor_account_id) BETWEEN 1 AND 255),
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 2000),
  employee_count INTEGER NOT NULL CHECK (employee_count >= 0),
  employment_count INTEGER NOT NULL CHECK (employment_count >= 0),
  completed_at INTEGER NOT NULL CHECK (completed_at >= 0),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE company_workforce_resource_bindings (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  resource_type TEXT NOT NULL CHECK (resource_type IN ('employee', 'employment')),
  resource_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  employee_id TEXT NOT NULL REFERENCES company_employees(id) ON DELETE RESTRICT,
  resource_revision INTEGER NOT NULL CHECK (resource_revision > 0),
  lifecycle_revision INTEGER NOT NULL CHECK (lifecycle_revision >= 0),
  last_action_id TEXT,
  UNIQUE (resource_type, resource_id),
  FOREIGN KEY (organization_id, resource_type, resource_id)
    REFERENCES company_resource_heads(organization_id, resource_type, resource_id)
    ON DELETE RESTRICT,
  CHECK (resource_type != 'employee' OR resource_id = employee_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE disciplinary_actions (
  id TEXT PRIMARY KEY NOT NULL,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  kind TEXT NOT NULL,
  summary TEXT NOT NULL,
  decided_on TEXT NOT NULL,
  created_at TEXT NOT NULL,
  legacy_id TEXT UNIQUE,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE employee_certifications (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  certification_id TEXT NOT NULL,
  acquired_on TEXT NOT NULL,
  expires_on TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE employee_skills (
  id TEXT PRIMARY KEY NOT NULL,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  skill_code TEXT NOT NULL,
  level INTEGER NOT NULL,
  years INTEGER,
  note TEXT,
  UNIQUE (employee_id, skill_code),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE employee_work_styles (
  id TEXT PRIMARY KEY NOT NULL,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  style TEXT NOT NULL,
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  legacy_id TEXT UNIQUE,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE evaluation_sheet_audit_logs (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  sheet_id TEXT NOT NULL,
  actor_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  action TEXT NOT NULL,
  from_value TEXT,
  to_value TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE evaluation_sheets (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  template_id TEXT,
  period TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  primary_evaluator_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  secondary_evaluator_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT,
  submitted_at TEXT,
  approved_at TEXT,
  finalized_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
, revision INTEGER NOT NULL DEFAULT 1,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE evaluation_templates (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  title TEXT NOT NULL,
  period TEXT NOT NULL,
  items TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE expense_approvals (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  expense_id TEXT NOT NULL,
  approver_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  action TEXT NOT NULL,
  comment TEXT,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_cases (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) BETWEEN 1 AND 255),
  subject_context TEXT NOT NULL
    CHECK (length(subject_context) BETWEEN 1 AND 100),
  subject_kind TEXT NOT NULL
    CHECK (length(subject_kind) BETWEEN 1 AND 100),
  subject_id TEXT NOT NULL
    CHECK (length(subject_id) BETWEEN 1 AND 512),
  subject_version TEXT NOT NULL
    CHECK (length(subject_version) BETWEEN 1 AND 255),
  proposal_digest TEXT NOT NULL
    CHECK (
      length(proposal_digest) = 64
      AND proposal_digest NOT GLOB '*[^0-9a-f]*'
    ),
  created_by_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  status TEXT NOT NULL
    CHECK (status IN ('pending', 'approved', 'rejected', 'returned', 'cancelled', 'executed')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
    CHECK (updated_at >= created_at),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_proposal_series (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 255),
  procedure_key TEXT NOT NULL
    REFERENCES system_procedure_definitions(key) ON DELETE RESTRICT,
  created_by_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_proposal_numbers (
  number INTEGER PRIMARY KEY AUTOINCREMENT,
  series_id TEXT NOT NULL
    REFERENCES system_proposal_series(id) ON DELETE RESTRICT
);
CREATE TABLE expenses (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  organization_unit_id TEXT REFERENCES company_organization_units(id) ON DELETE RESTRICT NOT NULL,
  category TEXT NOT NULL,
  amount INTEGER NOT NULL,
  spent_at TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE expense_procedure_bindings (
  id TEXT PRIMARY KEY NOT NULL,
  previous_expense_id TEXT REFERENCES expenses(id) ON DELETE RESTRICT,
  request_key TEXT NOT NULL UNIQUE CHECK (length(request_key) BETWEEN 1 AND 255),
  expense_id TEXT NOT NULL UNIQUE REFERENCES expenses(id) ON DELETE RESTRICT,
  application_id INTEGER NOT NULL UNIQUE REFERENCES system_proposal_numbers(number) ON DELETE RESTRICT,
  series_id TEXT NOT NULL UNIQUE REFERENCES system_proposal_series(id) ON DELETE RESTRICT,
  case_id TEXT NOT NULL UNIQUE REFERENCES system_cases(id) ON DELETE RESTRICT,
  proposal_digest TEXT NOT NULL CHECK (length(proposal_digest) = 64),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  attachment_evidence_json TEXT NOT NULL CHECK (json_valid(attachment_evidence_json) AND json_type(attachment_evidence_json) = 'array' AND json_array_length(attachment_evidence_json) <= 10),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE family_care_leaves (
  id TEXT PRIMARY KEY NOT NULL,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  leave_kind TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE goal_evaluations (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  goal_id TEXT NOT NULL,
  evaluator_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  kind TEXT NOT NULL,
  score INTEGER,
  comment TEXT,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE governance_acknowledgements (
  id TEXT PRIMARY KEY NOT NULL,
  version_id TEXT NOT NULL,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  content_hash TEXT NOT NULL,
  acknowledged_at TEXT NOT NULL,
  UNIQUE (version_id, employee_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE governance_document_versions (
  id TEXT PRIMARY KEY NOT NULL,
  document_id TEXT NOT NULL,
  version TEXT NOT NULL,
  body_md TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  procedure_json TEXT,
  content_hash TEXT NOT NULL,
  effective_from TEXT,
  effective_to TEXT,
  review_due_on TEXT,
  state TEXT NOT NULL DEFAULT 'draft'
    CHECK (state IN ('draft', 'in_review', 'published', 'superseded', 'rejected')),
  created_by_account_id TEXT NOT NULL CHECK (length(created_by_account_id) BETWEEN 1 AND 255),
  created_at TEXT NOT NULL,
  published_by_account_id TEXT,
  published_at TEXT,
  UNIQUE (document_id, version),
  CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_from < effective_to),
  CHECK (published_by_account_id IS NULL OR length(published_by_account_id) BETWEEN 1 AND 255),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE governance_documents (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('policy', 'procedure', 'guideline', 'control')),
  classification TEXT NOT NULL
    CHECK (classification IN ('public', 'internal', 'confidential', 'restricted')),
  owner_capability_code TEXT NOT NULL,
  steward_org_role_code TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'retired')),
  current_version_id TEXT,
  source_path TEXT NOT NULL UNIQUE,
  created_by_account_id TEXT NOT NULL CHECK (length(created_by_account_id) BETWEEN 1 AND 255),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE governance_org_role_assignments (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  org_role_code TEXT NOT NULL,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  department_code TEXT,
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  source_document_code TEXT,
  created_by_account_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_by_account_id TEXT,
  revoked_at TEXT,
  CHECK (ends_on IS NULL OR starts_on < ends_on),
  CHECK (length(created_by_account_id) BETWEEN 1 AND 255),
  CHECK (revoked_by_account_id IS NULL OR length(revoked_by_account_id) BETWEEN 1 AND 255),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE governance_publication_approvals (
  id TEXT PRIMARY KEY NOT NULL,
  version_id TEXT NOT NULL,
  org_role_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by_employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT,
  decided_at TEXT,
  comment TEXT,
  UNIQUE (version_id, org_role_code),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE health_checkups (
  id TEXT PRIMARY KEY NOT NULL,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  fiscal_year INTEGER NOT NULL,
  checkup_kind TEXT NOT NULL,
  conducted_on TEXT,
  status TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  legacy_id TEXT UNIQUE,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE knowledge_articles (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT,
  body_md TEXT NOT NULL,
  author_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  created_at TEXT NOT NULL
, revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1), status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'withdrawn')),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE knowledge_article_revisions (
  id TEXT PRIMARY KEY NOT NULL,
  article_id TEXT NOT NULL REFERENCES knowledge_articles(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  status TEXT NOT NULL CHECK (status IN ('active', 'withdrawn')),
  source TEXT NOT NULL CHECK (source IN ('existing_record', 'actor')),
  actor_account_id TEXT REFERENCES system_accounts(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 2000),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  command_id TEXT,
  request_json TEXT CHECK (request_json IS NULL OR json_valid(request_json)),
  UNIQUE (article_id, revision),
  UNIQUE (actor_account_id, command_id),
  CHECK (
    (source = 'existing_record' AND actor_account_id IS NULL AND command_id IS NULL AND request_json IS NULL)
    OR (source = 'actor' AND actor_account_id IS NOT NULL AND command_id IS NOT NULL AND request_json IS NOT NULL)
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE leave_balances (
  id TEXT PRIMARY KEY NOT NULL,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  fiscal_year TEXT NOT NULL,
  leave_type TEXT NOT NULL,
  granted_days REAL NOT NULL,
  used_days REAL NOT NULL,
  remaining_days REAL NOT NULL,
  UNIQUE (employee_id, fiscal_year, leave_type),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE leave_requests (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  leave_type TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  days INTEGER NOT NULL,
  reason TEXT,
  status TEXT NOT NULL,
  approver_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT,
  decided_comment TEXT,
  created_at TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'full_day',
  hours REAL,
  consumed_days REAL
, previous_leave_request_id TEXT
  REFERENCES leave_requests(id) ON DELETE RESTRICT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_jobs (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 255),
  operation_key TEXT NOT NULL CHECK (operation_key GLOB '[a-z]*' AND length(operation_key) <= 200),
  payload_digest TEXT NOT NULL CHECK (length(payload_digest) = 64 AND payload_digest NOT GLOB '*[^0-9a-f]*'),
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 255),
  created_by_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'leased', 'succeeded', 'dead_letter')),
  attempt INTEGER NOT NULL CHECK (attempt BETWEEN 0 AND max_attempts),
  max_attempts INTEGER NOT NULL CHECK (max_attempts BETWEEN 1 AND 100),
  available_at INTEGER NOT NULL CHECK (available_at >= created_at),
  lease_account_id TEXT REFERENCES system_accounts(id) ON DELETE RESTRICT,
  lease_token_hash TEXT CHECK (lease_token_hash IS NULL OR (length(lease_token_hash) = 64 AND lease_token_hash NOT GLOB '*[^0-9a-f]*')),
  lease_expires_at INTEGER,
  last_error_code TEXT CHECK (last_error_code IS NULL OR length(last_error_code) BETWEEN 1 AND 200),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  completed_at INTEGER, handler_key TEXT CHECK (handler_key IS NULL OR length(handler_key) BETWEEN 1 AND 200),
  CHECK (
    (status = 'leased' AND lease_account_id IS NOT NULL AND lease_token_hash IS NOT NULL
      AND lease_expires_at > updated_at AND completed_at IS NULL)
    OR (status = 'queued' AND lease_account_id IS NULL AND lease_token_hash IS NULL
      AND lease_expires_at IS NULL AND completed_at IS NULL)
    OR (status = 'succeeded' AND lease_account_id IS NULL AND lease_token_hash IS NULL
      AND lease_expires_at IS NULL AND completed_at = updated_at AND last_error_code IS NULL)
    OR (status = 'dead_letter' AND attempt = max_attempts
      AND lease_account_id IS NULL AND lease_token_hash IS NULL
      AND lease_expires_at IS NULL AND completed_at = updated_at AND last_error_code IS NOT NULL)
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE leave_decision_notifications (
  id TEXT PRIMARY KEY NOT NULL,
  job_id TEXT NOT NULL UNIQUE REFERENCES system_jobs(id) ON DELETE RESTRICT,
  leave_request_id TEXT NOT NULL UNIQUE REFERENCES leave_requests(id) ON DELETE RESTRICT,
  decision_audit_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id) ON DELETE RESTRICT,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  CHECK (json_extract(payload_json, '$.decisionAuditId') IS decision_audit_id),
  CHECK (json_extract(payload_json, '$.leaveRequestId') IS leave_request_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE leave_procedure_bindings (
  id TEXT PRIMARY KEY NOT NULL,
  request_key TEXT NOT NULL UNIQUE CHECK (length(request_key) BETWEEN 1 AND 255),
  leave_request_id TEXT NOT NULL UNIQUE REFERENCES leave_requests(id) ON DELETE RESTRICT,
  previous_leave_request_id TEXT REFERENCES leave_requests(id) ON DELETE RESTRICT,
  application_id INTEGER NOT NULL UNIQUE REFERENCES system_proposal_numbers(number) ON DELETE RESTRICT,
  series_id TEXT NOT NULL UNIQUE REFERENCES system_proposal_series(id) ON DELETE RESTRICT,
  case_id TEXT NOT NULL UNIQUE REFERENCES system_cases(id) ON DELETE RESTRICT,
  proposal_digest TEXT NOT NULL CHECK (length(proposal_digest) = 64 AND proposal_digest NOT GLOB '*[^0-9a-f]*'),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE life_events (
  id TEXT PRIMARY KEY NOT NULL,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  event_type TEXT NOT NULL,
  event_date TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE meeting_minutes_records (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  meeting_id TEXT NOT NULL,
  held_on TEXT NOT NULL,
  title TEXT NOT NULL,
  attendees TEXT,
  body_md TEXT NOT NULL,
  author_employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE onboarding_assignments (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  template_code TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  assigned_at TEXT NOT NULL
, lifecycle_action_id TEXT REFERENCES company_personnel_actions(id) ON DELETE RESTRICT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE onboarding_lifecycle_deliveries (
  job_id TEXT PRIMARY KEY NOT NULL REFERENCES system_jobs(id) ON DELETE RESTRICT,
  action_id TEXT NOT NULL REFERENCES company_personnel_actions(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  outcome TEXT CHECK (outcome IN ('assigned', 'superseded', 'obsolete')),
  assignment_id TEXT REFERENCES onboarding_assignments(id) ON DELETE RESTRICT,
  processed_at INTEGER CHECK (processed_at IS NULL OR processed_at >= created_at),
  CHECK ((outcome IS NULL AND processed_at IS NULL AND assignment_id IS NULL)
    OR (outcome IS NOT NULL AND outcome = 'assigned' AND processed_at IS NOT NULL AND assignment_id IS NOT NULL)
    OR (outcome IS NOT NULL AND outcome IN ('superseded', 'obsolete') AND processed_at IS NOT NULL AND assignment_id IS NULL)),
  CHECK (length(job_id) = 36 AND job_id NOT GLOB '*[^0-9a-f-]*' AND substr(job_id, 9, 1) = '-' AND substr(job_id, 14, 1) = '-' AND substr(job_id, 19, 1) = '-' AND substr(job_id, 24, 1) = '-' AND length(replace(job_id, '-', '')) = 32 AND substr(job_id, 15, 1) GLOB '[1-8]' AND substr(job_id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE onboarding_lifecycle_template_bindings (
  id TEXT PRIMARY KEY NOT NULL,
  effect_type TEXT NOT NULL UNIQUE CHECK (effect_type IN ('hire', 'retired')),
  template_code TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by_account_id TEXT
  CHECK (
    updated_by_account_id IS NULL
    OR length(updated_by_account_id) BETWEEN 1 AND 255
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
) WITHOUT ROWID;
CREATE TABLE one_on_ones (
  id TEXT PRIMARY KEY NOT NULL,
  member_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  manager_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  held_at TEXT NOT NULL,
  topics TEXT,
  manager_note TEXT,
  next_action TEXT,
  external_reference INTEGER,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE performance_goals (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  legacy_id TEXT UNIQUE,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  period TEXT NOT NULL,
  title TEXT NOT NULL,
  kpi TEXT,
  weight INTEGER NOT NULL,
  status TEXT NOT NULL
, owner_type TEXT NOT NULL DEFAULT 'individual', parent_goal_id TEXT, department_code TEXT, evaluation_sheet_id TEXT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE rental_reservations (
  id TEXT PRIMARY KEY NOT NULL,
  requester_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  item_name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  purpose TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE resignations (
  id TEXT PRIMARY KEY NOT NULL,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  resignation_date TEXT NOT NULL,
  last_working_date TEXT,
  reason TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE review_forms (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  legacy_id TEXT UNIQUE,
  cycle_id TEXT NOT NULL,
  subject_employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  reviewer_employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  reviewer_type TEXT NOT NULL,
  answers TEXT NOT NULL,
  score INTEGER,
  status TEXT NOT NULL,
  submitted_at TEXT
, comment TEXT, visibility TEXT NOT NULL DEFAULT 'disclosed',
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE ringi_requests (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  applicant_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  approver_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  title TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL,
  decided_at TEXT,
  decision_comment TEXT,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE ringi_procedure_bindings (
  id TEXT PRIMARY KEY NOT NULL,
  request_key TEXT NOT NULL UNIQUE CHECK (length(request_key) BETWEEN 1 AND 255),
  ringi_id TEXT NOT NULL UNIQUE REFERENCES ringi_requests(id) ON DELETE RESTRICT,
  application_id INTEGER NOT NULL UNIQUE REFERENCES system_proposal_numbers(number) ON DELETE RESTRICT,
  series_id TEXT NOT NULL UNIQUE REFERENCES system_proposal_series(id) ON DELETE RESTRICT,
  case_id TEXT NOT NULL UNIQUE REFERENCES system_cases(id) ON DELETE RESTRICT,
  proposal_digest TEXT NOT NULL CHECK (length(proposal_digest) = 64),
  created_at INTEGER NOT NULL CHECK (created_at >= 0)
, previous_ringi_id TEXT REFERENCES ringi_requests(id) ON DELETE RESTRICT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE room_reservations (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL,
  reserver_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  purpose TEXT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]'),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE salary_revisions (
  id TEXT PRIMARY KEY NOT NULL,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  effective_date TEXT NOT NULL,
  previous_base_salary INTEGER NOT NULL,
  new_base_salary INTEGER NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL,
  legacy_id TEXT UNIQUE,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE shift_assignments (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  legacy_id TEXT UNIQUE,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  pattern_id TEXT,
  date TEXT NOT NULL,
  note TEXT,
  published_at TEXT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE shift_swap_requests (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  legacy_id TEXT UNIQUE,
  requester_employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  target_employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  date TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL,
  approved_at TEXT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE software_licenses (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  name TEXT NOT NULL,
  vendor TEXT,
  category TEXT,
  seats INTEGER,
  renewal_deadline TEXT,
  owner_employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT,
  note TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
, plan_name TEXT, revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE software_license_assignments (
  id TEXT PRIMARY KEY NOT NULL,
  license_id TEXT NOT NULL REFERENCES software_licenses(id) ON DELETE RESTRICT,
  employee_id TEXT NOT NULL REFERENCES company_employees(id) ON DELETE RESTRICT,
  service_name TEXT NOT NULL CHECK (length(trim(service_name)) > 0),
  plan_name TEXT,
  account_reference TEXT,
  assigned_at INTEGER NOT NULL CHECK (assigned_at >= 0),
  assigned_by TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  assigned_reason TEXT NOT NULL CHECK (length(trim(assigned_reason)) > 0),
  released_at INTEGER,
  released_by TEXT REFERENCES system_accounts(id) ON DELETE RESTRICT,
  release_reason TEXT,
  CHECK ((released_at IS NULL AND released_by IS NULL AND release_reason IS NULL)
    OR (released_at IS NOT NULL AND released_at >= assigned_at AND released_by IS NOT NULL
      AND release_reason IS NOT NULL AND length(trim(release_reason)) > 0)),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE software_license_changes (
  id TEXT PRIMARY KEY NOT NULL,
  license_id TEXT NOT NULL REFERENCES software_licenses(id) ON DELETE RESTRICT,
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  command_id TEXT,
  request_json TEXT CHECK (request_json IS NULL OR json_valid(request_json)),
  before_json TEXT CHECK (before_json IS NULL OR json_valid(before_json)),
  after_json TEXT NOT NULL CHECK (json_valid(after_json)),
  UNIQUE (actor_account_id, command_id),
  CHECK ((command_id IS NULL AND request_json IS NULL) OR (command_id IS NOT NULL AND request_json IS NOT NULL)),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE stocktake_items (
  id TEXT PRIMARY KEY NOT NULL,
  stocktake_id TEXT NOT NULL,
  asset_code TEXT NOT NULL,
  checked_at TEXT,
  checker_employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT,
  location_note TEXT,
  UNIQUE (stocktake_id, asset_code),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE survey_responses (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  survey_id TEXT NOT NULL,
  respondent_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  answers_json TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_account_invitations (
  id TEXT PRIMARY KEY NOT NULL,
  token TEXT NOT NULL,
  subject TEXT,
  role_id TEXT NOT NULL
    REFERENCES system_iam_roles(id) ON DELETE RESTRICT,
  accepted_by_account_id TEXT
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL, resource_type TEXT, resource_id TEXT
  CHECK ((resource_type IS NULL AND resource_id IS NULL) OR (
    resource_type IS NOT NULL AND resource_id IS NOT NULL
    AND length(resource_type) BETWEEN 3 AND 100
    AND length(resource_id) BETWEEN 1 AND 255
  )), related_resource_id TEXT
  CHECK (related_resource_id IS NULL OR (
    resource_type IS NOT NULL AND resource_id IS NOT NULL
    AND length(related_resource_id) BETWEEN 1 AND 255
  )),
  CHECK (
    updated_at >= created_at
    AND expires_at >= created_at
    AND (revoked_at IS NULL OR revoked_at >= created_at)
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_attachment_preservations (
  id TEXT PRIMARY KEY NOT NULL,
  attachment_id TEXT NOT NULL,
  plaintext_sha256 TEXT NOT NULL CHECK (length(plaintext_sha256) = 64),
  kind TEXT NOT NULL CHECK (kind IN ('hold', 'retention')),
  retain_until INTEGER,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 1000),
  created_by_account_id TEXT NOT NULL,
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  created_audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id),
  revision INTEGER NOT NULL CHECK (revision IN (1, 2)),
  release_operation_id TEXT UNIQUE,
  released_by_account_id TEXT,
  released_at INTEGER,
  release_reason TEXT,
  release_audit_event_id TEXT UNIQUE REFERENCES system_audit_events(event_id),
  CHECK ((kind = 'hold' AND retain_until IS NULL) OR (kind = 'retention' AND retain_until IS NOT NULL AND retain_until > created_at)),
  CHECK ((revision = 1 AND release_operation_id IS NULL AND released_by_account_id IS NULL AND released_at IS NULL AND release_reason IS NULL AND release_audit_event_id IS NULL)
    OR (revision = 2 AND kind = 'hold' AND release_operation_id IS NOT NULL AND released_by_account_id IS NOT NULL AND released_at IS NOT NULL AND released_at >= created_at AND release_reason IS NOT NULL AND length(trim(release_reason)) BETWEEN 1 AND 1000 AND release_audit_event_id IS NOT NULL)),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_attachments (
  id TEXT PRIMARY KEY NOT NULL,
  owner_account_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  plaintext_sha256 TEXT NOT NULL,
  wrapped_dek TEXT,
  wrapped_dek_iv TEXT,
  content_iv TEXT NOT NULL,
  kek_version INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  linked_at INTEGER,
  erased_at INTEGER,
  CHECK (status IN ('uploading', 'pending', 'linked', 'erased')),
  CHECK (byte_size > 0),
  CHECK (kek_version > 0),
  CHECK (object_key LIKE 'att/%' AND length(object_key) <= 255),
  CHECK ((status = 'erased') = (wrapped_dek IS NULL)),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_audit_disclosure_policy_revisions (
  id TEXT PRIMARY KEY NOT NULL,
  scope TEXT NOT NULL CHECK (length(scope) BETWEEN 1 AND 255),
  revision INTEGER NOT NULL CHECK (revision > 0),
  command_id TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  allowed_fields_json TEXT NOT NULL CHECK (json_valid(allowed_fields_json) AND json_type(allowed_fields_json) = 'array'),
  allowed_target_types_json TEXT CHECK (allowed_target_types_json IS NULL OR (json_valid(allowed_target_types_json) AND json_type(allowed_target_types_json) = 'array')),
  allowed_purposes_json TEXT CHECK (allowed_purposes_json IS NULL OR (json_valid(allowed_purposes_json) AND json_type(allowed_purposes_json) = 'array')),
  expires_at INTEGER,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 1000),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id) ON DELETE RESTRICT,
  CHECK (expires_at IS NULL OR expires_at > recorded_at),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_authentication_attempts (
  id TEXT PRIMARY KEY NOT NULL,
  identifier TEXT NOT NULL
    CHECK (length(identifier) BETWEEN 1 AND 2048),
  ip TEXT
    CHECK (ip IS NULL OR length(ip) BETWEEN 1 AND 255),
  attempted_at INTEGER NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_role_bindings (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  role_id TEXT NOT NULL
    REFERENCES system_iam_roles(id) ON DELETE RESTRICT,
  resource_type TEXT,
  resource_id TEXT,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER
    CHECK (revoked_at IS NULL OR revoked_at >= created_at),
  CHECK (
    (resource_type IS NULL AND resource_id IS NULL) OR (
      resource_type IS NOT NULL AND resource_id IS NOT NULL
      AND length(resource_type) BETWEEN 3 AND 100
      AND length(resource_id) BETWEEN 1 AND 255
    )
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_bootstrap_state (
  singleton INTEGER PRIMARY KEY NOT NULL
    CHECK (singleton = 1),
  completed_by_account_id TEXT NOT NULL UNIQUE
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  root_binding_id TEXT NOT NULL UNIQUE
    REFERENCES system_role_bindings(id) ON DELETE RESTRICT,
  completed_at INTEGER NOT NULL
);
CREATE TABLE system_browser_login_codes (
  code_hash TEXT PRIMARY KEY NOT NULL
    CHECK (length(code_hash) BETWEEN 32 AND 512),
  account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  CHECK (expires_at > created_at)
);
CREATE TABLE system_cli_login_codes (
  code_hash TEXT PRIMARY KEY NOT NULL
    CHECK (length(code_hash) BETWEEN 32 AND 512),
  account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  CHECK (expires_at > created_at)
);
CREATE TABLE system_dead_letters (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 255),
  source_type TEXT NOT NULL CHECK (source_type IN ('job', 'outbox', 'inbox')),
  source_id TEXT NOT NULL CHECK (length(source_id) BETWEEN 1 AND 255),
  payload_digest TEXT NOT NULL CHECK (length(payload_digest) = 64 AND payload_digest NOT GLOB '*[^0-9a-f]*'),
  reason_code TEXT NOT NULL CHECK (length(reason_code) BETWEEN 1 AND 200),
  attempt INTEGER NOT NULL CHECK (attempt BETWEEN 0 AND 100),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  requeued_job_id TEXT REFERENCES system_jobs(id) ON DELETE RESTRICT,
  requeued_at INTEGER,
  CHECK ((requeued_job_id IS NULL) = (requeued_at IS NULL)),
  CHECK (requeued_at IS NULL OR requeued_at >= recorded_at),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_decision_tasks (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  case_id TEXT NOT NULL
    REFERENCES system_cases(id) ON DELETE RESTRICT,
  task_key TEXT NOT NULL
    CHECK (length(task_key) BETWEEN 1 AND 100),
  round INTEGER NOT NULL
    CHECK (round > 0),
  required_approvals INTEGER NOT NULL
    CHECK (required_approvals BETWEEN 1 AND 100),
  proposal_digest TEXT NOT NULL
    CHECK (
      length(proposal_digest) = 64
      AND proposal_digest NOT GLOB '*[^0-9a-f]*'
    ),
  opened_at INTEGER NOT NULL,
  due_at INTEGER
    CHECK (due_at IS NULL OR due_at >= opened_at),
  outcome TEXT
    CHECK (outcome IS NULL OR outcome IN ('approved', 'rejected', 'returned', 'cancelled')),
  closed_at INTEGER
    CHECK (closed_at IS NULL OR closed_at >= opened_at), required_participants INTEGER NOT NULL DEFAULT 1
  CHECK (required_participants BETWEEN 1 AND 100), negative_decision_rule TEXT NOT NULL DEFAULT 'any-reject'
  CHECK (negative_decision_rule IN ('any-reject', 'approval-impossible')), delegation_policy TEXT NOT NULL DEFAULT 'allowed'
  CHECK (delegation_policy IN ('allowed', 'forbidden')), return_policy TEXT NOT NULL DEFAULT 'allowed'
  CHECK (return_policy IN ('allowed', 'forbidden')),
  CHECK (
    (outcome IS NULL AND closed_at IS NULL)
    OR (outcome IS NOT NULL AND closed_at IS NOT NULL)
  ),
  UNIQUE (case_id, task_key, round),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_decision_task_candidates (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  case_id TEXT NOT NULL,
  task_key TEXT NOT NULL,
  round INTEGER NOT NULL,
  candidate_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  source TEXT NOT NULL
    CHECK (source IN ('primary', 'escalation')),
  evidence_context TEXT NOT NULL
    CHECK (length(evidence_context) BETWEEN 1 AND 100),
  evidence_kind TEXT NOT NULL
    CHECK (length(evidence_kind) BETWEEN 1 AND 100),
  evidence_id TEXT NOT NULL
    CHECK (length(evidence_id) BETWEEN 1 AND 512),
  evidence_version TEXT NOT NULL
    CHECK (length(evidence_version) BETWEEN 1 AND 255),
  eligibility_digest TEXT NOT NULL
    CHECK (
      length(eligibility_digest) = 64
      AND eligibility_digest NOT GLOB '*[^0-9a-f]*'
    ),
  eligible_from INTEGER,
  resolved_at INTEGER NOT NULL,
  CHECK (eligible_from IS NULL OR eligible_from >= resolved_at),
  CHECK (
    (source = 'primary' AND eligible_from IS NULL)
    OR (source = 'escalation' AND eligible_from IS NOT NULL)
  ),
  UNIQUE (case_id, task_key, round, candidate_account_id, source),
  FOREIGN KEY (case_id, task_key, round)
    REFERENCES system_decision_tasks(case_id, task_key, round) ON DELETE RESTRICT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_decision_task_exclusions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  case_id TEXT NOT NULL,
  task_key TEXT NOT NULL,
  round INTEGER NOT NULL,
  excluded_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL
    CHECK (reason IN ('creator', 'subject', 'policy')),
  UNIQUE (case_id, task_key, round, excluded_account_id),
  FOREIGN KEY (case_id, task_key, round)
    REFERENCES system_decision_tasks(case_id, task_key, round) ON DELETE RESTRICT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_delegations (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) BETWEEN 1 AND 255),
  delegator_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  delegate_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  scope_context TEXT,
  scope_kind TEXT,
  scope_id TEXT,
  scope_version TEXT,
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER,
  CHECK (delegator_account_id <> delegate_account_id),
  CHECK (
    (
      scope_context IS NULL
      AND scope_kind IS NULL
      AND scope_id IS NULL
      AND scope_version IS NULL
    )
    OR (
      length(scope_context) BETWEEN 1 AND 100
      AND length(scope_kind) BETWEEN 1 AND 100
      AND length(scope_id) BETWEEN 1 AND 512
      AND length(scope_version) BETWEEN 1 AND 255
    )
  ),
  CHECK (
    ends_at > starts_at
    AND created_at <= starts_at
    AND (
      revoked_at IS NULL
      OR (revoked_at >= created_at AND revoked_at <= ends_at)
    )
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_delegation_numbers (
  number INTEGER PRIMARY KEY AUTOINCREMENT,
  delegation_id TEXT NOT NULL
    REFERENCES system_delegations(id) ON DELETE RESTRICT
);
CREATE TABLE system_delegation_procedure_scopes (
  delegation_id TEXT PRIMARY KEY NOT NULL
    REFERENCES system_delegations(id) ON DELETE RESTRICT,
  procedure_key TEXT NOT NULL
    REFERENCES system_procedure_definitions(key) ON DELETE RESTRICT,
  CHECK (length(delegation_id) = 36 AND delegation_id NOT GLOB '*[^0-9a-f-]*' AND substr(delegation_id, 9, 1) = '-' AND substr(delegation_id, 14, 1) = '-' AND substr(delegation_id, 19, 1) = '-' AND substr(delegation_id, 24, 1) = '-' AND length(replace(delegation_id, '-', '')) = 32 AND substr(delegation_id, 15, 1) GLOB '[1-8]' AND substr(delegation_id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_execution_authorizations (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) BETWEEN 1 AND 255),
  case_id TEXT NOT NULL
    REFERENCES system_cases(id) ON DELETE RESTRICT,
  operation_key TEXT NOT NULL
    CHECK (length(operation_key) BETWEEN 1 AND 100),
  proposal_digest TEXT NOT NULL
    CHECK (
      length(proposal_digest) = 64
      AND proposal_digest NOT GLOB '*[^0-9a-f]*'
    ),
  granted_to_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  granted_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  CHECK (
    expires_at > granted_at
    AND (
      used_at IS NULL
      OR (used_at >= granted_at AND used_at < expires_at)
    )
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_human_attestations (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) BETWEEN 1 AND 255),
  case_id TEXT NOT NULL,
  task_key TEXT NOT NULL,
  round INTEGER NOT NULL,
  actor_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  represented_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  delegation_id TEXT
    REFERENCES system_delegations(id) ON DELETE RESTRICT,
  action TEXT NOT NULL
    CHECK (action IN ('approve', 'reject', 'return')),
  proposal_digest TEXT NOT NULL
    CHECK (
      length(proposal_digest) = 64
      AND proposal_digest NOT GLOB '*[^0-9a-f]*'
    ),
  comment TEXT
    CHECK (comment IS NULL OR length(comment) <= 4000),
  decided_at INTEGER NOT NULL,
  CHECK (
    (actor_account_id = represented_account_id AND delegation_id IS NULL)
    OR (actor_account_id <> represented_account_id AND delegation_id IS NOT NULL)
  ),
  FOREIGN KEY (case_id, task_key, round)
    REFERENCES system_decision_tasks(case_id, task_key, round) ON DELETE RESTRICT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_identity_profiles (
  identity_id TEXT PRIMARY KEY NOT NULL
    REFERENCES system_identity_bindings(id) ON DELETE CASCADE,
  email TEXT
    CHECK (email IS NULL OR length(email) BETWEEN 3 AND 320),
  email_verified INTEGER NOT NULL DEFAULT 0
    CHECK (email_verified IN (0, 1)),
  last_used_at INTEGER,
  updated_at INTEGER NOT NULL
, can_receive_email INTEGER NOT NULL DEFAULT 1
  CHECK (can_receive_email IN (0, 1)),
  CHECK (length(identity_id) = 36 AND identity_id NOT GLOB '*[^0-9a-f-]*' AND substr(identity_id, 9, 1) = '-' AND substr(identity_id, 14, 1) = '-' AND substr(identity_id, 19, 1) = '-' AND substr(identity_id, 24, 1) = '-' AND length(replace(identity_id, '-', '')) = 32 AND substr(identity_id, 15, 1) GLOB '[1-8]' AND substr(identity_id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_notification_messages (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) BETWEEN 1 AND 255),
  kind TEXT NOT NULL
    CHECK (length(kind) BETWEEN 3 AND 100),
  title TEXT NOT NULL
    CHECK (length(title) BETWEEN 1 AND 200),
  body TEXT
    CHECK (body IS NULL OR length(body) BETWEEN 1 AND 10000),
  source_type TEXT,
  source_id TEXT,
  created_at INTEGER NOT NULL, action_url TEXT
  CHECK (action_url IS NULL OR length(action_url) BETWEEN 1 AND 2048), priority TEXT NOT NULL DEFAULT 'normal'
  CHECK (priority IN ('low', 'normal', 'high', 'critical')), dedupe_key TEXT, action_type TEXT
  CHECK (action_type IS NULL OR length(action_type) BETWEEN 3 AND 100), action_id TEXT
  CHECK (action_id IS NULL OR length(action_id) BETWEEN 1 AND 512),
  CHECK (
    (source_type IS NULL AND source_id IS NULL) OR (
      source_type IS NOT NULL AND source_id IS NOT NULL
      AND length(source_type) BETWEEN 3 AND 100
      AND length(source_id) BETWEEN 1 AND 512
    )
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_notification_deliveries (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) BETWEEN 1 AND 255),
  message_id TEXT NOT NULL
    REFERENCES system_notification_messages(id) ON DELETE RESTRICT,
  recipient_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  delivered_at INTEGER NOT NULL,
  read_at INTEGER
    CHECK (read_at IS NULL OR read_at >= delivered_at)
, dismissed_at INTEGER
  CHECK (dismissed_at IS NULL OR dismissed_at >= delivered_at),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_notification_resource_scopes (
  message_id TEXT PRIMARY KEY NOT NULL
    REFERENCES system_notification_messages(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL
    CHECK (length(resource_type) BETWEEN 3 AND 100),
  resource_id TEXT NOT NULL
    CHECK (length(resource_id) BETWEEN 1 AND 512),
  CHECK (length(message_id) = 36 AND message_id NOT GLOB '*[^0-9a-f-]*' AND substr(message_id, 9, 1) = '-' AND substr(message_id, 14, 1) = '-' AND substr(message_id, 19, 1) = '-' AND substr(message_id, 24, 1) = '-' AND length(replace(message_id, '-', '')) = 32 AND substr(message_id, 15, 1) GLOB '[1-8]' AND substr(message_id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_oidc_access_tokens (
  token_hash TEXT PRIMARY KEY NOT NULL
    CHECK (length(token_hash) = 64 AND token_hash NOT GLOB '*[^0-9a-f]*'),
  issuer TEXT NOT NULL,
  client_id TEXT NOT NULL,
  account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  CHECK (expires_at > created_at)
);
CREATE TABLE system_oidc_authorization_codes (
  code_hash TEXT PRIMARY KEY NOT NULL
    CHECK (length(code_hash) = 64 AND code_hash NOT GLOB '*[^0-9a-f]*'),
  issuer TEXT NOT NULL,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE CASCADE,
  code_challenge TEXT NOT NULL,
  nonce TEXT NOT NULL,
  scope TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  CHECK (expires_at > created_at)
);
CREATE TABLE system_operation_receipts (
  id TEXT PRIMARY KEY NOT NULL,
  operation_key TEXT NOT NULL CHECK (length(operation_key) BETWEEN 1 AND 255),
  scope_key TEXT NOT NULL CHECK (length(scope_key) BETWEEN 1 AND 255),
  command_id TEXT NOT NULL CHECK (length(command_id) BETWEEN 1 AND 255),
  actor_account_id TEXT NOT NULL CHECK (length(actor_account_id) BETWEEN 1 AND 255),
  actor_principal_id TEXT NOT NULL CHECK (length(actor_principal_id) BETWEEN 1 AND 255),
  request_digest TEXT NOT NULL CHECK (length(request_digest) = 64 AND request_digest NOT GLOB '*[^0-9a-f]*'),
  result_json TEXT NOT NULL CHECK (json_valid(result_json) AND length(CAST(result_json AS BLOB)) <= 1000000),
  result_digest TEXT NOT NULL CHECK (length(result_digest) = 64 AND result_digest NOT GLOB '*[^0-9a-f]*'),
  recorded_at INTEGER NOT NULL CHECK (typeof(recorded_at) = 'integer' AND recorded_at >= 0 AND recorded_at <= 9007199254740991),
  UNIQUE (operation_key, scope_key, command_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_outbox_messages (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 255),
  topic TEXT NOT NULL CHECK (length(topic) BETWEEN 1 AND 200),
  source_context TEXT NOT NULL CHECK (length(source_context) BETWEEN 1 AND 100),
  source_kind TEXT NOT NULL CHECK (length(source_kind) BETWEEN 1 AND 100),
  source_id TEXT NOT NULL CHECK (length(source_id) BETWEEN 1 AND 255),
  source_version TEXT NOT NULL CHECK (length(source_version) BETWEEN 1 AND 255),
  payload_digest TEXT NOT NULL CHECK (length(payload_digest) = 64 AND payload_digest NOT GLOB '*[^0-9a-f]*'),
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 255),
  created_by_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'leased', 'succeeded', 'dead_letter')),
  attempt INTEGER NOT NULL CHECK (attempt BETWEEN 0 AND max_attempts),
  max_attempts INTEGER NOT NULL CHECK (max_attempts BETWEEN 1 AND 100),
  available_at INTEGER NOT NULL CHECK (available_at >= created_at),
  lease_account_id TEXT REFERENCES system_accounts(id) ON DELETE RESTRICT,
  lease_token_hash TEXT CHECK (lease_token_hash IS NULL OR (length(lease_token_hash) = 64 AND lease_token_hash NOT GLOB '*[^0-9a-f]*')),
  lease_expires_at INTEGER,
  last_error_code TEXT CHECK (last_error_code IS NULL OR length(last_error_code) BETWEEN 1 AND 200),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  completed_at INTEGER, handler_key TEXT CHECK (handler_key IS NULL OR length(handler_key) BETWEEN 1 AND 200),
  CHECK (
    (status = 'leased' AND lease_account_id IS NOT NULL AND lease_token_hash IS NOT NULL
      AND lease_expires_at > updated_at AND completed_at IS NULL)
    OR (status = 'queued' AND lease_account_id IS NULL AND lease_token_hash IS NULL
      AND lease_expires_at IS NULL AND completed_at IS NULL)
    OR (status = 'succeeded' AND lease_account_id IS NULL AND lease_token_hash IS NULL
      AND lease_expires_at IS NULL AND completed_at = updated_at AND last_error_code IS NULL)
    OR (status = 'dead_letter' AND attempt = max_attempts
      AND lease_account_id IS NULL AND lease_token_hash IS NULL
      AND lease_expires_at IS NULL AND completed_at = updated_at AND last_error_code IS NOT NULL)
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_password_credentials (
  identity_id TEXT PRIMARY KEY NOT NULL
    REFERENCES system_identity_bindings(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL
    CHECK (length(password_hash) BETWEEN 20 AND 4096),
  changed_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
    CHECK (changed_at >= created_at AND updated_at >= changed_at),
  CHECK (length(identity_id) = 36 AND identity_id NOT GLOB '*[^0-9a-f-]*' AND substr(identity_id, 9, 1) = '-' AND substr(identity_id, 14, 1) = '-' AND substr(identity_id, 19, 1) = '-' AND substr(identity_id, 24, 1) = '-' AND length(replace(identity_id, '-', '')) = 32 AND substr(identity_id, 15, 1) GLOB '[1-8]' AND substr(identity_id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_password_reset_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  token_hash TEXT NOT NULL
    CHECK (length(token_hash) = 64 AND token_hash NOT GLOB '*[^0-9a-f]*'),
  account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  identity_id TEXT NOT NULL
    REFERENCES system_identity_bindings(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
    CHECK (expires_at > created_at),
  used_at INTEGER
    CHECK (used_at IS NULL OR used_at >= created_at),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_record_disclosure_policies (
  revision_id TEXT PRIMARY KEY NOT NULL,
  id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  record_id TEXT NOT NULL,
  audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id),
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  UNIQUE (id, revision),
  CHECK (json_extract(snapshot_json, '$.id') IS id),
  CHECK (json_extract(snapshot_json, '$.revision') IS revision),
  CHECK (json_extract(snapshot_json, '$.recordId') IS record_id),
  CHECK (json_extract(snapshot_json, '$.auditEventId') IS audit_event_id),
  CHECK (json_type(snapshot_json, '$.grants') IS 'array'),
  CHECK (json_extract(snapshot_json, '$.status') IS 'active' OR json_extract(snapshot_json, '$.status') IS 'revoked'),
  CHECK (julianday(json_extract(snapshot_json, '$.publishedAt')) IS NOT NULL),
  CHECK (length(revision_id) = 36 AND revision_id NOT GLOB '*[^0-9a-f-]*' AND substr(revision_id, 9, 1) = '-' AND substr(revision_id, 14, 1) = '-' AND substr(revision_id, 19, 1) = '-' AND substr(revision_id, 24, 1) = '-' AND length(replace(revision_id, '-', '')) = 32 AND substr(revision_id, 15, 1) GLOB '[1-8]' AND substr(revision_id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_preserved_records (
  id TEXT PRIMARY KEY NOT NULL,
  attachment_id TEXT NOT NULL UNIQUE REFERENCES system_attachments(id),
  preservation_id TEXT NOT NULL UNIQUE REFERENCES system_attachment_preservations(id),
  disclosure_policy_id TEXT NOT NULL,
  disclosure_policy_revision INTEGER NOT NULL,
  audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id),
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  FOREIGN KEY (disclosure_policy_id, disclosure_policy_revision) REFERENCES system_record_disclosure_policies(id, revision),
  CHECK (json_extract(snapshot_json, '$.id') IS id),
  CHECK (json_extract(snapshot_json, '$.attachmentId') IS attachment_id),
  CHECK (json_extract(snapshot_json, '$.preservationId') IS preservation_id),
  CHECK (json_extract(snapshot_json, '$.disclosurePolicyId') IS disclosure_policy_id),
  CHECK (json_extract(snapshot_json, '$.disclosurePolicyRevision') IS disclosure_policy_revision),
  CHECK (json_extract(snapshot_json, '$.auditEventId') IS audit_event_id),
  CHECK (json_type(snapshot_json, '$.source') IS 'object'),
  CHECK (json_type(snapshot_json, '$.sourceAuthorizationRef') IS 'object'),
  CHECK (julianday(json_extract(snapshot_json, '$.source.capturedAt')) IS NOT NULL),
  CHECK (julianday(json_extract(snapshot_json, '$.finalizedAt')) IS NOT NULL),
  CHECK (julianday(json_extract(snapshot_json, '$.source.capturedAt')) <= julianday(json_extract(snapshot_json, '$.finalizedAt'))),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_procedure_definition_revisions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  procedure_key TEXT NOT NULL
    REFERENCES system_procedure_definitions(key) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision > 0),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 500),
  category TEXT NOT NULL CHECK (length(category) BETWEEN 1 AND 200),
  description TEXT CHECK (description IS NULL OR length(description) <= 3000),
  input_schema_json TEXT NOT NULL
    CHECK (json_valid(input_schema_json) AND length(input_schema_json) BETWEEN 1 AND 1000000),
  decision_policy_json TEXT NOT NULL
    CHECK (json_valid(decision_policy_json) AND length(decision_policy_json) BETWEEN 1 AND 1000000),
  completion_operation_key TEXT
    CHECK (completion_operation_key IS NULL OR length(completion_operation_key) BETWEEN 1 AND 100),
  created_by_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  UNIQUE (procedure_key, revision),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_proposals (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 255),
  series_id TEXT NOT NULL
    REFERENCES system_proposal_series(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version > 0),
  procedure_key TEXT NOT NULL,
  procedure_revision INTEGER NOT NULL,
  body_json TEXT NOT NULL
    CHECK (json_valid(body_json) AND length(body_json) BETWEEN 1 AND 1000000),
  digest TEXT NOT NULL
    CHECK (length(digest) = 64 AND digest NOT GLOB '*[^0-9a-f]*'),
  created_by_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  supersedes_proposal_id TEXT
    REFERENCES system_proposals(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  CHECK (
    (version = 1 AND supersedes_proposal_id IS NULL)
    OR (version > 1 AND supersedes_proposal_id IS NOT NULL)
  ),
  FOREIGN KEY (procedure_key, procedure_revision)
    REFERENCES system_procedure_definition_revisions(procedure_key, revision) ON DELETE RESTRICT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_proposal_cases (
  proposal_id TEXT PRIMARY KEY NOT NULL
    REFERENCES system_proposals(id) ON DELETE RESTRICT,
  case_id TEXT NOT NULL
    REFERENCES system_cases(id) ON DELETE RESTRICT,
  linked_at INTEGER NOT NULL,
  CHECK (length(proposal_id) = 36 AND proposal_id NOT GLOB '*[^0-9a-f-]*' AND substr(proposal_id, 9, 1) = '-' AND substr(proposal_id, 14, 1) = '-' AND substr(proposal_id, 19, 1) = '-' AND substr(proposal_id, 24, 1) = '-' AND length(replace(proposal_id, '-', '')) = 32 AND substr(proposal_id, 15, 1) GLOB '[1-8]' AND substr(proposal_id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_record_coverage_pages (
  id TEXT PRIMARY KEY NOT NULL,
  freeze_id TEXT NOT NULL REFERENCES system_record_source_freezes(id),
  record_kind TEXT NOT NULL,
  sequence INTEGER NOT NULL CHECK(sequence > 0),
  digest TEXT NOT NULL CHECK(length(digest)=64 AND digest NOT GLOB '*[^0-9a-f]*'),
  previous_digest TEXT,
  after_cursor TEXT,
  next_cursor TEXT,
  audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id),
  snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
  UNIQUE(freeze_id,record_kind,sequence),
  UNIQUE(freeze_id,record_kind,digest),
  CHECK(json_extract(snapshot_json,'$.id') IS id),
  CHECK(json_extract(snapshot_json,'$.freezeId') IS freeze_id),
  CHECK(json_extract(snapshot_json,'$.recordKind') IS record_kind),
  CHECK(json_extract(snapshot_json,'$.sequence') IS sequence),
  CHECK(json_extract(snapshot_json,'$.previousDigest') IS previous_digest),
  CHECK(json_extract(snapshot_json,'$.afterCursor') IS after_cursor),
  CHECK(json_extract(snapshot_json,'$.nextCursor') IS next_cursor),
  CHECK(json_type(snapshot_json,'$.records') IS 'array' AND json_array_length(snapshot_json,'$.records') <= 100),
  CHECK(next_cursor IS NULL OR (length(next_cursor)>0 AND next_cursor IS NOT after_cursor AND json_array_length(snapshot_json,'$.records')>0)),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_record_coverage_entries (
  -- 照合の trigger が行を足すため、主キーは列の既定値で採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  page_id TEXT NOT NULL REFERENCES system_record_coverage_pages(id),
  freeze_id TEXT NOT NULL REFERENCES system_record_source_freezes(id),
  record_kind TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  preserved_record_id TEXT NOT NULL REFERENCES system_preserved_records(id),
  UNIQUE(freeze_id,record_kind,source_record_id),
  UNIQUE(freeze_id,preserved_record_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_record_retirement_plans (
  id TEXT PRIMARY KEY NOT NULL,
  freeze_id TEXT NOT NULL REFERENCES system_record_source_freezes(id),
  digest TEXT NOT NULL CHECK(length(digest)=64 AND digest NOT GLOB '*[^0-9a-f]*'),
  audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id),
  snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
  CHECK(json_extract(snapshot_json,'$.id') IS id),
  CHECK(json_extract(snapshot_json,'$.freezeId') IS freeze_id),
  CHECK(json_extract(snapshot_json,'$.auditEventId') IS audit_event_id),
  CHECK(json_type(snapshot_json,'$.capability.recordKinds') IS 'array'),
  CHECK(json_array_length(snapshot_json,'$.capability.recordKinds') BETWEEN 1 AND 256),
  CHECK(json_type(snapshot_json,'$.coverage') IS 'array'),
  CHECK(json_array_length(snapshot_json,'$.coverage') IS json_array_length(snapshot_json,'$.capability.recordKinds')),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_record_retirement_receipts (
  id TEXT PRIMARY KEY NOT NULL,
  plan_id TEXT NOT NULL REFERENCES system_record_retirement_plans(id),
  ordinal INTEGER NOT NULL CHECK(ordinal > 0),
  digest TEXT NOT NULL CHECK(length(digest)=64 AND digest NOT GLOB '*[^0-9a-f]*'),
  coverage_page_id TEXT NOT NULL REFERENCES system_record_coverage_pages(id),
  audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id),
  snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
  UNIQUE(plan_id,ordinal),
  UNIQUE(plan_id,coverage_page_id),
  CHECK(json_extract(snapshot_json,'$.id') IS id),
  CHECK(json_extract(snapshot_json,'$.planId') IS plan_id),
  CHECK(json_extract(snapshot_json,'$.ordinal') IS ordinal),
  CHECK(json_extract(snapshot_json,'$.coveragePageId') IS coverage_page_id),
  CHECK(json_extract(snapshot_json,'$.auditEventId') IS audit_event_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_record_retirement_attachment_pins (
  -- 撤去の trigger が行を足すため、主キーは列の既定値で採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  receipt_id TEXT NOT NULL REFERENCES system_record_retirement_receipts(id),
  attachment_id TEXT NOT NULL,
  UNIQUE(receipt_id,attachment_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_record_source_retirements (
  id TEXT PRIMARY KEY NOT NULL,
  freeze_id TEXT NOT NULL UNIQUE REFERENCES system_record_source_freezes(id),
  plan_id TEXT NOT NULL UNIQUE REFERENCES system_record_retirement_plans(id),
  terminal_receipt_id TEXT NOT NULL REFERENCES system_record_retirement_receipts(id),
  proposal_id TEXT NOT NULL UNIQUE REFERENCES system_proposals(id),
  case_id TEXT NOT NULL UNIQUE REFERENCES system_cases(id),
  execution_authorization_id TEXT NOT NULL UNIQUE REFERENCES system_execution_authorizations(id),
  audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id),
  snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
  CHECK(json_extract(snapshot_json,'$.id') IS id),
  CHECK(json_extract(snapshot_json,'$.freezeId') IS freeze_id),
  CHECK(json_extract(snapshot_json,'$.planId') IS plan_id),
  CHECK(json_extract(snapshot_json,'$.terminalReceiptId') IS terminal_receipt_id),
  CHECK(json_extract(snapshot_json,'$.proposalId') IS proposal_id),
  CHECK(json_extract(snapshot_json,'$.caseId') IS case_id),
  CHECK(json_extract(snapshot_json,'$.executionAuthorizationId') IS execution_authorization_id),
  CHECK(json_extract(snapshot_json,'$.auditEventId') IS audit_event_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  family_id TEXT NOT NULL
    CHECK (length(family_id) BETWEEN 1 AND 255),
  token_hash TEXT NOT NULL
    CHECK (length(token_hash) BETWEEN 32 AND 512),
  token_version INTEGER NOT NULL
    CHECK (token_version >= 0),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
    CHECK (expires_at > created_at),
  rotated_at INTEGER
    CHECK (
      rotated_at IS NULL OR (
        rotated_at >= created_at AND rotated_at < expires_at
      )
    ),
  revoked_at INTEGER
    CHECK (
      revoked_at IS NULL OR (
        revoked_at >= created_at
        AND (rotated_at IS NULL OR revoked_at >= rotated_at)
      )
    )
, authenticated_at INTEGER
  CHECK (authenticated_at IS NULL OR authenticated_at <= created_at),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_step_up_grants (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  token_hash TEXT NOT NULL UNIQUE CHECK (
    length(token_hash) = 64 AND token_hash NOT GLOB '*[^0-9a-f]*'
  ),
  method TEXT NOT NULL CHECK (method IN ('password', 'external_identity')),
  issued_at INTEGER NOT NULL CHECK (issued_at >= 0),
  expires_at INTEGER NOT NULL CHECK (expires_at > issued_at),
  last_used_at INTEGER CHECK (
    last_used_at IS NULL OR (last_used_at >= issued_at AND last_used_at < expires_at)
  ),
  revoked_at INTEGER CHECK (
    revoked_at IS NULL OR (revoked_at >= issued_at AND revoked_at < expires_at)
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_work_items (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 300),
  instructions TEXT NOT NULL CHECK (length(trim(instructions)) BETWEEN 1 AND 10000),
  acceptance_criteria TEXT NOT NULL CHECK (length(trim(acceptance_criteria)) BETWEEN 1 AND 10000),
  created_by_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  created_by_principal_id TEXT NOT NULL REFERENCES system_principals(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  due_at INTEGER CHECK (due_at IS NULL OR due_at >= created_at),
  previous_revision_id TEXT REFERENCES system_work_item_revisions(command_id) ON DELETE RESTRICT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_work_item_revisions (
  id TEXT PRIMARY KEY NOT NULL,
  work_item_id TEXT NOT NULL REFERENCES system_work_items(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision BETWEEN 1 AND 9007199254740991),
  command_id TEXT NOT NULL UNIQUE,
  action TEXT NOT NULL CHECK (action IN ('create', 'accept', 'submit', 'approve', 'return', 'request_handover', 'accept_handover', 'decline_handover', 'cancel')),
  state TEXT NOT NULL CHECK (state IN ('offered', 'active', 'review_pending', 'completed', 'cancelled')),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  actor_principal_id TEXT NOT NULL REFERENCES system_principals(id) ON DELETE RESTRICT,
  accountable_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  accountable_principal_id TEXT NOT NULL REFERENCES system_principals(id) ON DELETE RESTRICT,
  assignee_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  assignee_principal_id TEXT NOT NULL REFERENCES system_principals(id) ON DELETE RESTRICT,
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json) AND json_type(snapshot_json) = 'object' AND length(snapshot_json) <= 100000),
  audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id) ON DELETE RESTRICT,
  UNIQUE (work_item_id, revision),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE system_work_evidence (
  attachment_id TEXT PRIMARY KEY NOT NULL REFERENCES system_attachments(id) ON DELETE RESTRICT,
  work_item_id TEXT NOT NULL REFERENCES system_work_items(id) ON DELETE RESTRICT,
  plaintext_sha256 TEXT NOT NULL CHECK (length(plaintext_sha256) = 64 AND plaintext_sha256 NOT GLOB '*[^0-9a-f]*'),
  submitted_by_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  command_id TEXT NOT NULL REFERENCES system_work_item_revisions(command_id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  CHECK (length(attachment_id) = 36 AND attachment_id NOT GLOB '*[^0-9a-f-]*' AND substr(attachment_id, 9, 1) = '-' AND substr(attachment_id, 14, 1) = '-' AND substr(attachment_id, 19, 1) = '-' AND substr(attachment_id, 24, 1) = '-' AND length(replace(attachment_id, '-', '')) = 32 AND substr(attachment_id, 15, 1) GLOB '[1-8]' AND substr(attachment_id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE thanks_messages (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  sender_employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  recipient_employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  message TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE thanks_point_budgets (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  period TEXT NOT NULL,
  granted_points INTEGER NOT NULL,
  consumed_points INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE thanks_redemptions (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  reward_id TEXT NOT NULL,
  point_cost INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  decided_at TEXT,
  decider_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE training_enrollments (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  legacy_id TEXT UNIQUE,
  course_id TEXT NOT NULL,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  status TEXT NOT NULL,
  completed_at TEXT,
  score INTEGER,
  due_date TEXT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TABLE work_accidents (
  id TEXT PRIMARY KEY NOT NULL,
  occurred_on TEXT NOT NULL,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT,
  location TEXT,
  summary TEXT NOT NULL,
  severity TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  legacy_id TEXT UNIQUE,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

-- company_employees
INSERT INTO company_employees (id, official_name, employee_code, email, phone, created_at, updated_at, legacy_id)
SELECT map.new_id,
       source.official_name,
       source.employee_code,
       source.email,
       source.phone,
       source.created_at,
       source.updated_at,
       CASE WHEN map.old_id IS NOT map.new_id THEN source.id END
FROM "_stage_company_employees" source
INNER JOIN _company_employees_id_map map ON map.old_id = source.id;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_employees',
       (SELECT count(*) FROM "_stage_company_employees"),
       (SELECT count(*) FROM company_employees),
       0,
       (SELECT count(*) FROM company_employees WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_company_employees";
CREATE UNIQUE INDEX company_employees_employee_code_uniq
  ON company_employees(employee_code);
CREATE TRIGGER company_employees_legacy_id_insert
BEFORE INSERT ON company_employees
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER company_employees_identity_update
BEFORE UPDATE OF id, legacy_id ON company_employees
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- announcements
INSERT INTO announcements (id, legacy_id, title, body_md, published_on, author_employee_id, status, created_at)
SELECT source.id,
       source.legacy_id,
       source.title,
       source.body_md,
       source.published_on,
       CASE WHEN source.author_employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.author_employee_id), source.author_employee_id) END ,
       source.status,
       source.created_at
FROM "_stage_announcements" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'announcements',
       (SELECT count(*) FROM "_stage_announcements"),
       (SELECT count(*) FROM announcements),
       0,
       0,
       0;
DROP TABLE "_stage_announcements";
CREATE INDEX idx_announcements_status ON announcements (status);
CREATE TRIGGER announcements_source_freeze_delete
BEFORE DELETE ON announcements
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'announcement' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'announcement_record_source_frozen'); END;
CREATE TRIGGER announcements_source_freeze_insert
BEFORE INSERT ON announcements
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'announcement' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'announcement_record_source_frozen'); END;
CREATE TRIGGER announcements_source_freeze_update
BEFORE UPDATE ON announcements
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'announcement' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'announcement_record_source_frozen'); END;
CREATE TRIGGER announcements_legacy_id_insert
BEFORE INSERT ON announcements
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER announcements_identity_update
BEFORE UPDATE OF id, legacy_id ON announcements
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- antisocial_checks
INSERT INTO antisocial_checks (id, requester_id, partner_name, partner_address, representative_name, result, status, created_at)
SELECT source.id,
       CASE WHEN source.requester_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.requester_id), source.requester_id) END ,
       source.partner_name,
       source.partner_address,
       source.representative_name,
       source.result,
       source.status,
       source.created_at
FROM "_stage_antisocial_checks" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'antisocial_checks',
       (SELECT count(*) FROM "_stage_antisocial_checks"),
       (SELECT count(*) FROM antisocial_checks),
       0,
       0,
       0;
DROP TABLE "_stage_antisocial_checks";
CREATE INDEX idx_antisocial_checks_requester ON antisocial_checks (requester_id);
CREATE TRIGGER antisocial_checks_source_freeze_delete
BEFORE DELETE ON antisocial_checks
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'antisocial-check' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'antisocial_check_record_source_frozen'); END;
CREATE TRIGGER antisocial_checks_source_freeze_insert
BEFORE INSERT ON antisocial_checks
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'antisocial-check' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'antisocial_check_record_source_frozen'); END;
CREATE TRIGGER antisocial_checks_source_freeze_update
BEFORE UPDATE ON antisocial_checks
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'antisocial-check' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'antisocial_check_record_source_frozen'); END;

-- asset_lendings
INSERT INTO asset_lendings (id, legacy_id, asset_code, employee_id, lent_at, returned_at)
SELECT source.id,
       source.legacy_id,
       source.asset_code,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.lent_at,
       source.returned_at
FROM "_stage_asset_lendings" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'asset_lendings',
       (SELECT count(*) FROM "_stage_asset_lendings"),
       (SELECT count(*) FROM asset_lendings),
       0,
       0,
       0;
DROP TABLE "_stage_asset_lendings";
CREATE INDEX idx_asset_lendings_asset ON asset_lendings (asset_code);
CREATE INDEX idx_asset_lendings_employee ON asset_lendings (employee_id);
CREATE TRIGGER asset_lendings_source_freeze_delete BEFORE DELETE ON asset_lendings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='asset' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'asset_record_source_frozen'); END;
CREATE TRIGGER asset_lendings_source_freeze_insert BEFORE INSERT ON asset_lendings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='asset' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'asset_record_source_frozen'); END;
CREATE TRIGGER asset_lendings_source_freeze_update BEFORE UPDATE ON asset_lendings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='asset' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'asset_record_source_frozen'); END;
CREATE TRIGGER asset_lendings_legacy_id_insert
BEFORE INSERT ON asset_lendings
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER asset_lendings_identity_update
BEFORE UPDATE OF id, legacy_id ON asset_lendings
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- assets
INSERT INTO assets (id, code, name, kind, serial, purchased_on, status, holder_employee_id, disposed_on, disposal_reason)
SELECT source.id,
       source.code,
       source.name,
       source.kind,
       source.serial,
       source.purchased_on,
       source.status,
       CASE WHEN source.holder_employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.holder_employee_id), source.holder_employee_id) END ,
       source.disposed_on,
       source.disposal_reason
FROM "_stage_assets" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'assets',
       (SELECT count(*) FROM "_stage_assets"),
       (SELECT count(*) FROM assets),
       0,
       0,
       0;
DROP TABLE "_stage_assets";
CREATE INDEX idx_assets_holder ON assets (holder_employee_id);
CREATE INDEX idx_assets_kind ON assets (kind);
CREATE INDEX idx_assets_status ON assets (status);
CREATE TRIGGER assets_source_freeze_delete BEFORE DELETE ON assets
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='asset' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'asset_record_source_frozen'); END;
CREATE TRIGGER assets_source_freeze_insert BEFORE INSERT ON assets
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='asset' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'asset_record_source_frozen'); END;
CREATE TRIGGER assets_source_freeze_update BEFORE UPDATE ON assets
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='asset' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'asset_record_source_frozen'); END;
CREATE TRIGGER assets_identity_update
BEFORE UPDATE OF id ON assets
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- attendance_records
INSERT INTO attendance_records (id, legacy_id, employee_id, work_date, clock_in_at, clock_out_at, work_minutes, note, status)
SELECT source.id,
       source.legacy_id,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.work_date,
       source.clock_in_at,
       source.clock_out_at,
       source.work_minutes,
       source.note,
       source.status
FROM "_stage_attendance_records" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'attendance_records',
       (SELECT count(*) FROM "_stage_attendance_records"),
       (SELECT count(*) FROM attendance_records),
       0,
       0,
       0;
DROP TABLE "_stage_attendance_records";
CREATE INDEX idx_attendance_records_employee ON attendance_records (employee_id);
CREATE INDEX idx_attendance_records_employee_open ON attendance_records (employee_id, status);
CREATE UNIQUE INDEX idx_attendance_records_employee_open_unique
  ON attendance_records (employee_id) WHERE status = 'open';
CREATE INDEX idx_attendance_records_work_date ON attendance_records (work_date);
CREATE TRIGGER attendance_records_source_freeze_delete
BEFORE DELETE ON attendance_records
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'attendance' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'attendance_record_source_frozen');
END;
CREATE TRIGGER attendance_records_source_freeze_insert
BEFORE INSERT ON attendance_records
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'attendance' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'attendance_record_source_frozen');
END;
CREATE TRIGGER attendance_records_source_freeze_update
BEFORE UPDATE ON attendance_records
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'attendance' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'attendance_record_source_frozen');
END;
CREATE TRIGGER attendance_records_legacy_id_insert
BEFORE INSERT ON attendance_records
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER attendance_records_identity_update
BEFORE UPDATE OF id, legacy_id ON attendance_records
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- business_trips
INSERT INTO business_trips (id, traveler_id, destination, start_date, end_date, purpose, estimated_cost, status, created_at)
SELECT source.id,
       CASE WHEN source.traveler_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.traveler_id), source.traveler_id) END ,
       source.destination,
       source.start_date,
       source.end_date,
       source.purpose,
       source.estimated_cost,
       source.status,
       source.created_at
FROM "_stage_business_trips" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'business_trips',
       (SELECT count(*) FROM "_stage_business_trips"),
       (SELECT count(*) FROM business_trips),
       0,
       0,
       0;
DROP TABLE "_stage_business_trips";
CREATE INDEX idx_business_trips_traveler ON business_trips (traveler_id);
CREATE TRIGGER business_trips_source_freeze_delete
BEFORE DELETE ON business_trips
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'business-trip' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'business_trip_record_source_frozen'); END;
CREATE TRIGGER business_trips_source_freeze_insert
BEFORE INSERT ON business_trips
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'business-trip' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'business_trip_record_source_frozen'); END;
CREATE TRIGGER business_trips_source_freeze_update
BEFORE UPDATE ON business_trips
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'business-trip' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'business_trip_record_source_frozen'); END;

-- career_applications
INSERT INTO career_applications (id, created_at, legacy_id, posting_id, applicant_id, message, status)
SELECT source.id,
       source.created_at,
       source.legacy_id,
       source.posting_id,
       CASE WHEN source.applicant_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.applicant_id), source.applicant_id) END ,
       source.message,
       source.status
FROM "_stage_career_applications" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'career_applications',
       (SELECT count(*) FROM "_stage_career_applications"),
       (SELECT count(*) FROM career_applications),
       0,
       0,
       0;
DROP TABLE "_stage_career_applications";
CREATE INDEX idx_career_applications_applicant ON career_applications (applicant_id);
CREATE INDEX idx_career_applications_posting ON career_applications (posting_id);
CREATE UNIQUE INDEX idx_career_applications_posting_applicant
  ON career_applications (posting_id, applicant_id);
CREATE TRIGGER career_applications_source_freeze_delete BEFORE DELETE ON career_applications
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='career' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'career_record_source_frozen'); END;
CREATE TRIGGER career_applications_source_freeze_insert BEFORE INSERT ON career_applications
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='career' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'career_record_source_frozen'); END;
CREATE TRIGGER career_applications_source_freeze_update BEFORE UPDATE ON career_applications
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='career' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'career_record_source_frozen'); END;
CREATE TRIGGER career_applications_legacy_id_insert
BEFORE INSERT ON career_applications
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER career_applications_identity_update
BEFORE UPDATE OF id, legacy_id ON career_applications
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- career_sheets
INSERT INTO career_sheets (employee_id, goals_text, strengths_text, updated_at)
SELECT CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _company_employees_id_map ref WHERE ref.old_id = source.employee_id), CAST(source.employee_id AS TEXT)) END ,
       source.goals_text,
       source.strengths_text,
       source.updated_at
FROM "_stage_career_sheets" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'career_sheets',
       (SELECT count(*) FROM "_stage_career_sheets"),
       (SELECT count(*) FROM career_sheets),
       0,
       (SELECT count(*) FROM career_sheets WHERE NOT (length(employee_id) = 36 AND employee_id NOT GLOB '*[^0-9a-f-]*' AND substr(employee_id, 9, 1) = '-' AND substr(employee_id, 14, 1) = '-' AND substr(employee_id, 19, 1) = '-' AND substr(employee_id, 24, 1) = '-' AND length(replace(employee_id, '-', '')) = 32 AND substr(employee_id, 15, 1) GLOB '[1-8]' AND substr(employee_id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_career_sheets";
CREATE TRIGGER career_sheets_source_freeze_insert BEFORE INSERT ON career_sheets
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='career' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'career_record_source_frozen'); END;
CREATE TRIGGER career_sheets_source_freeze_update BEFORE UPDATE ON career_sheets
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='career' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'career_record_source_frozen'); END;
CREATE TRIGGER career_sheets_source_freeze_delete BEFORE DELETE ON career_sheets
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='career' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'career_record_source_frozen'); END;

-- certificate_requests
INSERT INTO certificate_requests (id, requester_id, certificate_type, submit_to, needed_by, note, status, created_at)
SELECT source.id,
       CASE WHEN source.requester_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.requester_id), source.requester_id) END ,
       source.certificate_type,
       source.submit_to,
       source.needed_by,
       source.note,
       source.status,
       source.created_at
FROM "_stage_certificate_requests" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'certificate_requests',
       (SELECT count(*) FROM "_stage_certificate_requests"),
       (SELECT count(*) FROM certificate_requests),
       0,
       0,
       0;
DROP TABLE "_stage_certificate_requests";
CREATE INDEX idx_certificate_requests_requester ON certificate_requests (requester_id);
CREATE TRIGGER certificate_requests_source_freeze_delete
BEFORE DELETE ON certificate_requests
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'certificate-request' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'certificate_request_record_source_frozen'); END;
CREATE TRIGGER certificate_requests_source_freeze_insert
BEFORE INSERT ON certificate_requests
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'certificate-request' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'certificate_request_record_source_frozen'); END;
CREATE TRIGGER certificate_requests_source_freeze_update
BEFORE UPDATE ON certificate_requests
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'certificate-request' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'certificate_request_record_source_frozen'); END;

-- commendations
INSERT INTO commendations (id, employee_id, title, reason, awarded_on, created_at, legacy_id)
SELECT source.id,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.title,
       source.reason,
       source.awarded_on,
       source.created_at,
       source.legacy_id
FROM "_stage_commendations" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'commendations',
       (SELECT count(*) FROM "_stage_commendations"),
       (SELECT count(*) FROM commendations),
       0,
       0,
       0;
DROP TABLE "_stage_commendations";
CREATE INDEX idx_commendations_employee ON commendations (employee_id);
CREATE TRIGGER commendations_source_freeze_delete
BEFORE DELETE ON commendations
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'commendation' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'commendation_record_source_frozen'); END;
CREATE TRIGGER commendations_source_freeze_insert
BEFORE INSERT ON commendations
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'commendation' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'commendation_record_source_frozen'); END;
CREATE TRIGGER commendations_source_freeze_update
BEFORE UPDATE ON commendations
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'commendation' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'commendation_record_source_frozen'); END;
CREATE TRIGGER commendations_legacy_id_insert
BEFORE INSERT ON commendations
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER commendations_identity_update
BEFORE UPDATE OF id, legacy_id ON commendations
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- system_accounts
INSERT INTO system_accounts (id, status, token_version, created_at, updated_at, closed_at, legacy_id)
SELECT map.new_id,
       source.status,
       source.token_version,
       source.created_at,
       source.updated_at,
       source.closed_at,
       CASE WHEN map.old_id IS NOT map.new_id THEN source.id END
FROM "_stage_system_accounts" source
INNER JOIN _system_accounts_id_map map ON map.old_id = source.id;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_accounts',
       (SELECT count(*) FROM "_stage_system_accounts"),
       (SELECT count(*) FROM system_accounts),
       0,
       (SELECT count(*) FROM system_accounts WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_accounts";
CREATE TRIGGER system_accounts_monotonic_security_state
BEFORE UPDATE ON system_accounts
WHEN
  NEW.id IS NOT OLD.id
  OR NEW.created_at IS NOT OLD.created_at
  OR NEW.token_version < OLD.token_version
  OR NEW.updated_at < OLD.updated_at
  OR (
    NEW.status IS NOT OLD.status
    AND NEW.token_version IS NOT OLD.token_version + 1
  )
  OR (
    OLD.closed_at IS NULL
    AND NEW.closed_at IS NOT NULL
    AND (
      NEW.status IS NOT 'suspended'
      OR NEW.token_version IS NOT OLD.token_version + 1
      OR NEW.updated_at IS NOT NEW.closed_at
      OR NEW.closed_at < OLD.updated_at
    )
  )
  OR (
    OLD.closed_at IS NOT NULL
    AND (
      NEW.status IS NOT OLD.status
      OR NEW.token_version IS NOT OLD.token_version
      OR NEW.updated_at IS NOT OLD.updated_at
      OR NEW.closed_at IS NOT OLD.closed_at
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'account security state is not monotonic');
END;
CREATE TRIGGER system_accounts_legacy_id_insert
BEFORE INSERT ON system_accounts
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER system_accounts_identity_update
BEFORE UPDATE OF id, legacy_id ON system_accounts
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_account_employee_links
INSERT INTO company_account_employee_links (account_id, employee_id)
SELECT CASE WHEN source.account_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _system_accounts_id_map ref WHERE ref.old_id = source.account_id), CAST(source.account_id AS TEXT)) END ,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END
FROM "_stage_company_account_employee_links" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_account_employee_links',
       (SELECT count(*) FROM "_stage_company_account_employee_links"),
       (SELECT count(*) FROM company_account_employee_links),
       0,
       (SELECT count(*) FROM company_account_employee_links WHERE NOT (length(account_id) = 36 AND account_id NOT GLOB '*[^0-9a-f-]*' AND substr(account_id, 9, 1) = '-' AND substr(account_id, 14, 1) = '-' AND substr(account_id, 19, 1) = '-' AND substr(account_id, 24, 1) = '-' AND length(replace(account_id, '-', '')) = 32 AND substr(account_id, 15, 1) GLOB '[1-8]' AND substr(account_id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_company_account_employee_links";
CREATE UNIQUE INDEX company_account_employee_links_employee_uniq
  ON company_account_employee_links(employee_id);
CREATE INDEX company_account_employee_links_employee_idx
  ON company_account_employee_links(employee_id);
CREATE TRIGGER company_account_employee_links_delete_guard
BEFORE DELETE ON company_account_employee_links
BEGIN
  SELECT RAISE(ABORT, 'account employee links are append only');
END;
CREATE TRIGGER company_account_employee_links_immutable
BEFORE UPDATE ON company_account_employee_links
BEGIN
  SELECT RAISE(ABORT, 'account employee links are immutable');
END;

-- company_resource_heads
INSERT INTO company_resource_heads (id, organization_id, resource_type, resource_id, revision, organization_revision, state, effective_from, effective_to, attributes_json, updated_at)
SELECT source.id,
       source.organization_id,
       source.resource_type,
       CASE WHEN source.resource_type = 'employee' THEN CASE WHEN source.resource_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.resource_id), source.resource_id) END ELSE CASE WHEN source.resource_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.resource_id), source.resource_id) END END ,
       source.revision,
       source.organization_revision,
       source.state,
       source.effective_from,
       source.effective_to,
       CASE WHEN json_valid(source.attributes_json) AND json_type(source.attributes_json) = 'object' THEN json_replace(source.attributes_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.accountId')), json_extract(source.attributes_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.actorAccountId')), json_extract(source.attributes_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.release.actorAccountId')), json_extract(source.attributes_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.employeeId')), json_extract(source.attributes_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.managerEmployeeId')), json_extract(source.attributes_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.targetEmployeeId')), json_extract(source.attributes_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.requestedByEmployeeId')), json_extract(source.attributes_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.requestedApproverId')), json_extract(source.attributes_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.applicantId')), json_extract(source.attributes_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.holderId')), json_extract(source.attributes_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.personId')), json_extract(source.attributes_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.employmentId')), json_extract(source.attributes_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.periodId')), json_extract(source.attributes_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.resourceId')), json_extract(source.attributes_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.existingResourceId')), json_extract(source.attributes_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.scopeId')), json_extract(source.attributes_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.authorityScopeId')), json_extract(source.attributes_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.responsibilityId')), json_extract(source.attributes_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.collectiveBodyId')), json_extract(source.attributes_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.organizationalOfficeId')), json_extract(source.attributes_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.positionId')), json_extract(source.attributes_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.jobId')), json_extract(source.attributes_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.siteId')), json_extract(source.attributes_json, '$.siteId'))) ELSE source.attributes_json END ,
       source.updated_at
FROM "_stage_company_resource_heads" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_resource_heads',
       (SELECT count(*) FROM "_stage_company_resource_heads"),
       (SELECT count(*) FROM company_resource_heads),
       0,
       0,
       0;
DROP TABLE "_stage_company_resource_heads";
CREATE UNIQUE INDEX company_resource_heads_org_revision_idx
  ON company_resource_heads (organization_id, organization_revision, resource_type, resource_id);
CREATE INDEX company_resource_heads_type_effective_idx
  ON company_resource_heads (organization_id, resource_type, effective_from, effective_to);
CREATE UNIQUE INDEX company_active_site_code_uniq
  ON company_resource_heads (organization_id, json_extract(attributes_json, '$.code'))
  WHERE resource_type = 'site' AND state = 'active';
CREATE UNIQUE INDEX company_active_workplace_code_uniq
  ON company_resource_heads (
    organization_id,
    json_extract(attributes_json, '$.siteId'),
    json_extract(attributes_json, '$.code')
  )
  WHERE resource_type = 'workplace' AND state = 'active';
CREATE UNIQUE INDEX company_active_job_code_uniq
  ON company_resource_heads (organization_id, json_extract(attributes_json, '$.code'))
  WHERE resource_type = 'job' AND state = 'active';
CREATE UNIQUE INDEX company_single_active_profile_uniq
  ON company_resource_heads (organization_id)
  WHERE resource_type = 'company-profile' AND state = 'active';
CREATE UNIQUE INDEX company_active_legal_entity_registration_uniq
  ON company_resource_heads (
    organization_id,
    json_extract(attributes_json, '$.jurisdictionCountryCode'),
    json_extract(attributes_json, '$.registrationNumber')
  )
  WHERE resource_type = 'legal-entity'
    AND state = 'active'
    AND json_extract(attributes_json, '$.registrationNumber') IS NOT NULL;
CREATE UNIQUE INDEX company_active_organizational_office_code_uniq
  ON company_resource_heads (organization_id, json_extract(attributes_json, '$.code'))
  WHERE resource_type = 'organizational-office' AND state = 'active';
CREATE UNIQUE INDEX company_active_collective_body_code_uniq
  ON company_resource_heads (organization_id, json_extract(attributes_json, '$.code'))
  WHERE resource_type = 'collective-body' AND state = 'active';
CREATE UNIQUE INDEX company_active_office_holder_uniq
  ON company_resource_heads (
    organization_id,
    json_extract(attributes_json, '$.organizationalOfficeId')
  )
  WHERE resource_type = 'office-assignment' AND state = 'active';
CREATE UNIQUE INDEX company_active_collective_body_member_uniq
  ON company_resource_heads (
    organization_id,
    json_extract(attributes_json, '$.collectiveBodyId'),
    json_extract(attributes_json, '$.employeeId')
  )
  WHERE resource_type = 'collective-body-membership' AND state = 'active';
CREATE UNIQUE INDEX company_profile_organization_identity ON company_resource_heads (organization_id) WHERE resource_type = 'company-profile';
CREATE INDEX company_account_link_head_account_idx ON company_resource_heads
  (CAST(json_extract(attributes_json, '$.accountId') AS TEXT)) WHERE resource_type = 'account-employee-link';
CREATE INDEX company_account_link_head_employee_idx ON company_resource_heads
  (CAST(json_extract(attributes_json, '$.employeeId') AS TEXT)) WHERE resource_type = 'account-employee-link';
CREATE TRIGGER company_personnel_reporting_owner_guard
BEFORE UPDATE ON company_resource_heads
WHEN OLD.resource_type = 'reporting-relation'
  AND EXISTS (SELECT 1 FROM company_personnel_reporting_bindings binding
    WHERE binding.resource_id = OLD.resource_id AND binding.organization_id = OLD.organization_id)
BEGIN
  SELECT RAISE(ABORT, 'company personnel reporting owner is immutable')
  WHERE NEW.organization_id IS NOT OLD.organization_id OR NEW.resource_type IS NOT OLD.resource_type
    OR NEW.resource_id IS NOT OLD.resource_id
    OR json_extract(NEW.attributes_json, '$.employeeId') IS NOT json_extract(OLD.attributes_json, '$.employeeId')
    OR json_extract(NEW.attributes_json, '$.organizationUnitId') IS NOT json_extract(OLD.attributes_json, '$.organizationUnitId');
END;
CREATE TRIGGER company_resource_heads_identity_update
BEFORE UPDATE OF id ON company_resource_heads
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_account_employee_resource_bindings
INSERT INTO company_account_employee_resource_bindings (resource_id, organization_id, resource_type, account_id, employee_id, recorded_at)
SELECT CASE WHEN source.resource_type = 'employee' THEN CASE WHEN source.resource_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.resource_id), source.resource_id) END ELSE CASE WHEN source.resource_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.resource_id), source.resource_id) END END ,
       source.organization_id,
       source.resource_type,
       CASE WHEN source.account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.account_id), source.account_id) END ,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.recorded_at
FROM "_stage_company_account_employee_resource_bindings" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_account_employee_resource_bindings',
       (SELECT count(*) FROM "_stage_company_account_employee_resource_bindings"),
       (SELECT count(*) FROM company_account_employee_resource_bindings),
       0,
       (SELECT count(*) FROM company_account_employee_resource_bindings WHERE NOT (length(resource_id) = 36 AND resource_id NOT GLOB '*[^0-9a-f-]*' AND substr(resource_id, 9, 1) = '-' AND substr(resource_id, 14, 1) = '-' AND substr(resource_id, 19, 1) = '-' AND substr(resource_id, 24, 1) = '-' AND length(replace(resource_id, '-', '')) = 32 AND substr(resource_id, 15, 1) GLOB '[1-8]' AND substr(resource_id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_company_account_employee_resource_bindings";
CREATE TRIGGER company_account_employee_resource_bindings_update_guard
BEFORE UPDATE ON company_account_employee_resource_bindings
BEGIN
  SELECT RAISE(ABORT, 'company account link bindings are immutable');
END;
CREATE TRIGGER company_account_employee_resource_bindings_delete_guard
BEFORE DELETE ON company_account_employee_resource_bindings
BEGIN
  SELECT RAISE(ABORT, 'company account link bindings are immutable');
END;

-- company_account_profiles
INSERT INTO company_account_profiles (id, organization_id, account_id, display_name, created_at, updated_at)
SELECT source.id,
       source.organization_id,
       CASE WHEN source.account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.account_id), source.account_id) END ,
       source.display_name,
       source.created_at,
       source.updated_at
FROM "_stage_company_account_profiles" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_account_profiles',
       (SELECT count(*) FROM "_stage_company_account_profiles"),
       (SELECT count(*) FROM company_account_profiles),
       0,
       0,
       0;
DROP TABLE "_stage_company_account_profiles";
CREATE INDEX company_account_profiles_account_idx
  ON company_account_profiles (account_id);
CREATE TRIGGER company_account_profiles_identity_update
BEFORE UPDATE OF id ON company_account_profiles
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_organization_change_operations
INSERT INTO company_organization_change_operations (id, expected_revision, change_count, applied_count, resulting_revision, status, recorded_at, request_fingerprint, actor_account_id, reason, evidence_references_json, legacy_id, operation_key)
SELECT map.new_id,
       source.expected_revision,
       source.change_count,
       source.applied_count,
       source.resulting_revision,
       source.status,
       source.recorded_at,
       source.request_fingerprint,
       CASE WHEN source.actor_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.actor_account_id), source.actor_account_id) END ,
       source.reason,
       CASE WHEN json_valid(source.evidence_references_json) AND json_type(source.evidence_references_json) = 'object' THEN json_replace(source.evidence_references_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.accountId')), json_extract(source.evidence_references_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.actorAccountId')), json_extract(source.evidence_references_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.release.actorAccountId')), json_extract(source.evidence_references_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.employeeId')), json_extract(source.evidence_references_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.managerEmployeeId')), json_extract(source.evidence_references_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.targetEmployeeId')), json_extract(source.evidence_references_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.requestedByEmployeeId')), json_extract(source.evidence_references_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.requestedApproverId')), json_extract(source.evidence_references_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.applicantId')), json_extract(source.evidence_references_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.holderId')), json_extract(source.evidence_references_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.personId')), json_extract(source.evidence_references_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.employmentId')), json_extract(source.evidence_references_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.periodId')), json_extract(source.evidence_references_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.resourceId')), json_extract(source.evidence_references_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.existingResourceId')), json_extract(source.evidence_references_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.scopeId')), json_extract(source.evidence_references_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.authorityScopeId')), json_extract(source.evidence_references_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.responsibilityId')), json_extract(source.evidence_references_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.collectiveBodyId')), json_extract(source.evidence_references_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.organizationalOfficeId')), json_extract(source.evidence_references_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.positionId')), json_extract(source.evidence_references_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.jobId')), json_extract(source.evidence_references_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.siteId')), json_extract(source.evidence_references_json, '$.siteId'))) ELSE source.evidence_references_json END ,
       CASE WHEN map.old_id IS NOT map.new_id THEN source.id END ,
       CASE WHEN source.id GLOB '*:*' THEN source.id END
FROM "_stage_company_organization_change_operations" source
INNER JOIN _company_organization_change_operations_id_map map ON map.old_id = source.id;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_organization_change_operations',
       (SELECT count(*) FROM "_stage_company_organization_change_operations"),
       (SELECT count(*) FROM company_organization_change_operations),
       0,
       (SELECT count(*) FROM company_organization_change_operations WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_company_organization_change_operations";
CREATE TRIGGER company_organization_change_operations_command_immutable
BEFORE UPDATE OF request_fingerprint, actor_account_id, reason, evidence_references_json
ON company_organization_change_operations
BEGIN
  SELECT RAISE(ABORT, 'organization change command is immutable');
END;
CREATE TRIGGER company_organization_change_operations_completed_count_immutable
BEFORE UPDATE OF applied_count ON company_organization_change_operations
WHEN OLD.status = 'COMPLETED'
BEGIN
  SELECT RAISE(ABORT, 'completed organization change operation is immutable');
END;
CREATE TRIGGER company_organization_change_operations_immutable
BEFORE UPDATE OF id, expected_revision, change_count, resulting_revision, recorded_at
ON company_organization_change_operations
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is immutable');
END;
CREATE TRIGGER company_organization_change_operations_immutable_delete
BEFORE DELETE ON company_organization_change_operations
BEGIN
  SELECT RAISE(ABORT, 'organization change operations are append only');
END;
CREATE TRIGGER company_organization_change_operations_insert_guard
BEFORE INSERT ON company_organization_change_operations
BEGIN
  SELECT RAISE(ABORT, 'organization revision conflict')
  WHERE NEW.applied_count != 0
    OR NEW.status != 'PENDING'
    OR NOT EXISTS (
      SELECT 1 FROM company_organization_lifecycle_states state
      WHERE state.id = 1 AND state.revision = NEW.expected_revision
    );
END;
CREATE TRIGGER company_organization_resource_operation_guard
BEFORE UPDATE OF status ON company_organization_change_operations
WHEN NEW.status = 'COMPLETED'
BEGIN
  SELECT RAISE(ABORT, 'organization resource history mismatch')
  WHERE EXISTS (SELECT 1 FROM company_organization_resource_mismatches);
END;
CREATE TRIGGER company_organization_change_operations_completion_guard
BEFORE UPDATE OF status ON company_organization_change_operations
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is incomplete')
  WHERE OLD.status != 'PENDING'
    OR NEW.status != 'COMPLETED'
    OR NEW.applied_count != NEW.change_count
    OR NOT EXISTS (
      SELECT 1 FROM company_organization_lifecycle_states state
      WHERE state.id = 1 AND state.revision = NEW.resulting_revision
    );

  SELECT RAISE(ABORT, 'organization change leaves an orphan organization unit')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_unit_period_versions child
    WHERE child.is_void = 0
      AND child.parent_organization_unit_id IS NOT NULL
      AND child.revision = (
        SELECT max(latest.revision)
        FROM company_organization_unit_period_versions latest
        WHERE latest.period_id = child.period_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM company_organization_unit_coverage parent
        WHERE parent.organization_unit_id = child.parent_organization_unit_id
          AND parent.starts_on <= child.starts_on
          AND (
            parent.ends_on IS NULL
            OR (child.ends_on IS NOT NULL AND child.ends_on <= parent.ends_on)
          )
      )
  );

  SELECT RAISE(ABORT, 'organization change leaves an orphan assignment')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_assignment_period_versions assignment
    WHERE assignment.is_void = 0
      AND assignment.revision = (
        SELECT max(latest.revision)
        FROM company_organization_assignment_period_versions latest
        WHERE latest.period_id = assignment.period_id
      )
      AND (
        NOT EXISTS (
          SELECT 1 FROM company_employments employment
          WHERE employment.id = assignment.employment_id
            AND employment.employee_id = assignment.employee_id
            AND employment.hire_date <= assignment.starts_on
            AND (
              employment.termination_date IS NULL
              OR (
                assignment.ends_on IS NOT NULL
                AND assignment.ends_on <= date(employment.termination_date, '+1 day')
              )
            )
        )
        OR NOT EXISTS (
          SELECT 1 FROM company_organization_unit_coverage unit
          WHERE unit.organization_unit_id = assignment.organization_unit_id
            AND unit.starts_on <= assignment.starts_on
            AND (
              unit.ends_on IS NULL
              OR (assignment.ends_on IS NOT NULL AND assignment.ends_on <= unit.ends_on)
            )
        )
      )
  );

  SELECT RAISE(ABORT, 'organization change leaves an orphan responsibility')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_responsibility_period_versions responsibility
    WHERE responsibility.is_void = 0
      AND responsibility.revision = (
        SELECT max(latest.revision)
        FROM company_organization_responsibility_period_versions latest
        WHERE latest.period_id = responsibility.period_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM company_organization_assignment_coverage assignment
        WHERE assignment.employment_id = responsibility.employment_id
          AND assignment.employee_id = responsibility.employee_id
          AND assignment.organization_unit_id = responsibility.organization_unit_id
          AND assignment.starts_on <= responsibility.starts_on
          AND (
            assignment.ends_on IS NULL
            OR (
              responsibility.ends_on IS NOT NULL
              AND responsibility.ends_on <= assignment.ends_on
            )
          )
      )
  );
END;
CREATE TRIGGER company_organization_assignment_source_completion_guard
BEFORE UPDATE OF status ON company_organization_change_operations
WHEN NEW.status = 'COMPLETED'
BEGIN
  SELECT RAISE(ABORT, 'organization assignment source is stale')
  WHERE EXISTS (
    SELECT 1 FROM company_assignment_period_bindings binding
    JOIN company_assignment_resource_bindings resource ON resource.resource_id = binding.resource_id
    JOIN company_organization_assignment_period_versions period ON period.period_id = binding.period_id
    WHERE period.revision = (SELECT max(latest.revision) FROM company_organization_assignment_period_versions latest WHERE latest.period_id = period.period_id)
      AND (period.revision != binding.period_revision OR period.employee_id != resource.employee_id
        OR period.manager_employee_id IS NOT NULL)
  );
  SELECT RAISE(ABORT, 'organization assignment public source is stale')
  WHERE EXISTS (
    SELECT 1 FROM company_assignment_resource_bindings binding
    WHERE NOT EXISTS (
      SELECT 1 FROM company_resource_heads head WHERE head.organization_id = binding.organization_id
        AND head.resource_type = 'assignment' AND head.resource_id = binding.resource_id
        AND head.revision = binding.resource_revision
    )
  );
END;
CREATE TRIGGER company_personnel_reporting_completion_guard
BEFORE UPDATE OF status ON company_organization_change_operations
WHEN NEW.status = 'COMPLETED'
BEGIN
  SELECT RAISE(ABORT, 'company personnel reporting assignment period is not covered')
  WHERE EXISTS (
    SELECT 1 FROM company_personnel_reporting_periods reporting
    WHERE NOT EXISTS (
      SELECT 1 FROM company_personnel_reporting_assignment_coverage assignment
      WHERE assignment.employee_id = reporting.employee_id AND assignment.employment_id = reporting.employment_id
        AND assignment.organization_unit_id = reporting.organization_unit_id
        AND assignment.assignment_type = reporting.assignment_type
        AND assignment.starts_on <= reporting.starts_on
        AND (assignment.ends_on IS NULL OR
          (reporting.ends_on IS NOT NULL AND reporting.ends_on <= assignment.ends_on))
    )
  );
END;
CREATE TRIGGER company_employment_authority_organization_guard
AFTER UPDATE OF status ON company_organization_change_operations
WHEN NEW.status = 'COMPLETED' AND NOT EXISTS (
  SELECT 1 FROM company_resource_revisions resource
  JOIN company_organizations organization ON organization.id = resource.organization_id
  WHERE resource.organization_revision > organization.revision
)
BEGIN
  SELECT RAISE(ABORT, 'company_employment_authority_period_not_covered')
  WHERE EXISTS (SELECT 1 FROM company_employment_authority_violations);
END;
CREATE TRIGGER company_responsibility_source_completion_guard
BEFORE UPDATE OF status ON company_organization_change_operations
WHEN NEW.status = 'COMPLETED'
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility public source is stale')
  WHERE EXISTS (SELECT 1 FROM company_responsibility_source_mismatches);
END;
CREATE TRIGGER company_responsibility_assignment_operation_guard
BEFORE UPDATE OF status ON company_organization_change_operations
WHEN NEW.status = 'COMPLETED'
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility assignment periods overlap')
  WHERE EXISTS (SELECT 1 FROM company_responsibility_assignment_overlaps);
END;
CREATE TRIGGER company_responsibility_adoption_completion_guard
BEFORE UPDATE OF status ON company_organization_change_operations
WHEN NEW.status = 'COMPLETED' AND NEW.operation_key GLOB 'responsibility-adoption:*'
BEGIN
  SELECT RAISE(ABORT, 'responsibility adoption evidence is missing')
  WHERE NOT EXISTS (SELECT 1 FROM company_responsibility_resource_adoptions adoption WHERE adoption.operation_id = NEW.id);
END;
CREATE TRIGGER company_organization_change_operations_legacy_id_insert
BEFORE INSERT ON company_organization_change_operations
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER company_organization_change_operations_identity_update
BEFORE UPDATE OF id, legacy_id ON company_organization_change_operations
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_organization_assignment_period_versions
INSERT INTO company_organization_assignment_period_versions (id, period_id, revision, employment_id, employee_id, organization_unit_id, assignment_type, position_title, manager_employee_id, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
SELECT source.id,
       CASE WHEN source.period_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.period_id), source.period_id) END ,
       source.revision,
       CASE WHEN source.employment_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.employment_id), source.employment_id) END ,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.organization_unit_id,
       source.assignment_type,
       source.position_title,
       CASE WHEN source.manager_employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.manager_employee_id), source.manager_employee_id) END ,
       source.starts_on,
       source.ends_on,
       source.is_void,
       CASE WHEN source.recorded_by_action_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.recorded_by_action_id), source.recorded_by_action_id) END ,
       source.recorded_at
FROM "_stage_company_organization_assignment_period_versions" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_organization_assignment_period_versions',
       (SELECT count(*) FROM "_stage_company_organization_assignment_period_versions"),
       (SELECT count(*) FROM company_organization_assignment_period_versions),
       0,
       0,
       0;
DROP TABLE "_stage_company_organization_assignment_period_versions";
CREATE INDEX company_organization_assignment_period_versions_employee_idx
  ON company_organization_assignment_period_versions(
    employee_id, starts_on, ends_on, assignment_type, period_id, revision
  );
CREATE INDEX company_organization_assignment_period_versions_unit_idx
  ON company_organization_assignment_period_versions(
    organization_unit_id, starts_on, ends_on, period_id, revision
  );
CREATE TRIGGER company_organization_assignment_period_versions_immutable_delete
BEFORE DELETE ON company_organization_assignment_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization assignments are append only');
END;
CREATE TRIGGER company_organization_assignment_period_versions_immutable_update
BEFORE UPDATE ON company_organization_assignment_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization assignments are append only');
END;
CREATE TRIGGER company_organization_assignment_period_versions_revision_state
AFTER INSERT ON company_organization_assignment_period_versions
BEGIN
  UPDATE company_organization_change_operations
  SET applied_count = applied_count + 1
  WHERE id = NEW.recorded_by_action_id;

  UPDATE company_organization_lifecycle_states
  SET revision = revision + 1, updated_at = max(updated_at, NEW.recorded_at)
  WHERE id = 1;
END;
CREATE TRIGGER company_organization_assignment_period_versions_guard
BEFORE INSERT ON company_organization_assignment_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is missing or stale')
  WHERE NOT EXISTS (
    SELECT 1
    FROM company_organization_change_operations operation
    JOIN company_organization_lifecycle_states state ON state.id = 1
    WHERE operation.id = NEW.recorded_by_action_id
      AND operation.status = 'PENDING'
      AND operation.applied_count < operation.change_count
      AND state.revision = operation.expected_revision + operation.applied_count
  );

  SELECT RAISE(ABORT, 'organization assignment revision is not sequential')
  WHERE NEW.revision != coalesce(
    (
      SELECT max(revision)
      FROM company_organization_assignment_period_versions
      WHERE period_id = NEW.period_id
    ),
    0
  ) + 1;

  SELECT RAISE(ABORT, 'organization assignment owner is immutable')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_assignment_period_versions previous
    WHERE previous.period_id = NEW.period_id
      AND (
        previous.employment_id != NEW.employment_id
        OR previous.employee_id != NEW.employee_id
        OR previous.organization_unit_id != NEW.organization_unit_id
        OR previous.assignment_type != NEW.assignment_type
      )
  );

  SELECT RAISE(ABORT, 'organization assignment employment mismatch')
  WHERE NOT EXISTS (
    SELECT 1 FROM company_employments employment
    WHERE employment.id = NEW.employment_id
      AND employment.employee_id = NEW.employee_id
      AND employment.hire_date <= NEW.starts_on
      AND (
        employment.termination_date IS NULL
        OR (
          NEW.ends_on IS NOT NULL
          AND NEW.ends_on <= date(employment.termination_date, '+1 day')
        )
      )
  );

  SELECT RAISE(ABORT, 'organization assignment unit is not active')
  WHERE NEW.is_void = 0 AND NOT EXISTS (
    SELECT 1 FROM company_organization_unit_coverage unit
    WHERE unit.organization_unit_id = NEW.organization_unit_id
      AND unit.starts_on <= NEW.starts_on
      AND (
        unit.ends_on IS NULL
        OR (NEW.ends_on IS NOT NULL AND NEW.ends_on <= unit.ends_on)
      )
  );

  SELECT RAISE(ABORT, 'organization assignment overlaps')
  WHERE NEW.is_void = 0 AND EXISTS (
    SELECT 1 FROM company_organization_assignment_period_versions current
    WHERE current.period_id != NEW.period_id
      AND current.employee_id = NEW.employee_id
      AND current.is_void = 0
      AND current.revision = (
        SELECT max(latest.revision)
        FROM company_organization_assignment_period_versions latest
        WHERE latest.period_id = current.period_id
      )
      AND (
        (current.assignment_type = 'PRIMARY' AND NEW.assignment_type = 'PRIMARY')
        OR (
          current.organization_unit_id = NEW.organization_unit_id
          AND current.assignment_type = NEW.assignment_type
        )
      )
      AND (current.ends_on IS NULL OR NEW.starts_on < current.ends_on)
      AND (NEW.ends_on IS NULL OR current.starts_on < NEW.ends_on)
  );

  SELECT RAISE(ABORT, 'organization assignment manager is not employed')
  WHERE NEW.is_void = 0
    AND NEW.manager_employee_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM company_employments manager_employment
      WHERE manager_employment.employee_id = NEW.manager_employee_id
        AND manager_employment.hire_date <= NEW.starts_on
        AND (
          manager_employment.termination_date IS NULL
          OR (
            NEW.ends_on IS NOT NULL
            AND NEW.ends_on <= date(manager_employment.termination_date, '+1 day')
          )
        )
    );
END;
CREATE TRIGGER company_organization_assignment_period_versions_identity_update
BEFORE UPDATE OF id ON company_organization_assignment_period_versions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_assignment_resource_bindings
INSERT INTO company_assignment_resource_bindings (resource_id, organization_id, employee_id, resource_revision, recorded_at)
SELECT CASE WHEN source.resource_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.resource_id), source.resource_id) END ,
       source.organization_id,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.resource_revision,
       source.recorded_at
FROM "_stage_company_assignment_resource_bindings" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_assignment_resource_bindings',
       (SELECT count(*) FROM "_stage_company_assignment_resource_bindings"),
       (SELECT count(*) FROM company_assignment_resource_bindings),
       0,
       (SELECT count(*) FROM company_assignment_resource_bindings WHERE NOT (length(resource_id) = 36 AND resource_id NOT GLOB '*[^0-9a-f-]*' AND substr(resource_id, 9, 1) = '-' AND substr(resource_id, 14, 1) = '-' AND substr(resource_id, 19, 1) = '-' AND substr(resource_id, 24, 1) = '-' AND length(replace(resource_id, '-', '')) = 32 AND substr(resource_id, 15, 1) GLOB '[1-8]' AND substr(resource_id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_company_assignment_resource_bindings";
CREATE INDEX company_assignment_resource_bindings_employee_idx ON company_assignment_resource_bindings(employee_id);
CREATE TRIGGER company_assignment_resource_bindings_update_guard
BEFORE UPDATE ON company_assignment_resource_bindings
WHEN NEW.resource_id != OLD.resource_id OR NEW.organization_id != OLD.organization_id
  OR NEW.employee_id != OLD.employee_id OR NEW.resource_revision < OLD.resource_revision
BEGIN
  SELECT RAISE(ABORT, 'organization assignment source identity is immutable');
END;
CREATE TRIGGER company_assignment_resource_bindings_delete_guard
BEFORE DELETE ON company_assignment_resource_bindings
BEGIN
  SELECT RAISE(ABORT, 'organization assignment source identity is immutable');
END;

-- company_assignment_period_bindings
INSERT INTO company_assignment_period_bindings (period_id, resource_id, period_revision, source_revision)
SELECT CASE WHEN source.period_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.period_id), source.period_id) END ,
       CASE WHEN source.resource_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.resource_id), source.resource_id) END ,
       source.period_revision,
       source.source_revision
FROM "_stage_company_assignment_period_bindings" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_assignment_period_bindings',
       (SELECT count(*) FROM "_stage_company_assignment_period_bindings"),
       (SELECT count(*) FROM company_assignment_period_bindings),
       0,
       (SELECT count(*) FROM company_assignment_period_bindings WHERE NOT (length(period_id) = 36 AND period_id NOT GLOB '*[^0-9a-f-]*' AND substr(period_id, 9, 1) = '-' AND substr(period_id, 14, 1) = '-' AND substr(period_id, 19, 1) = '-' AND substr(period_id, 24, 1) = '-' AND length(replace(period_id, '-', '')) = 32 AND substr(period_id, 15, 1) GLOB '[1-8]' AND substr(period_id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_company_assignment_period_bindings";
CREATE INDEX company_assignment_period_bindings_resource_idx ON company_assignment_period_bindings(resource_id);
CREATE TRIGGER company_assignment_period_bindings_update_guard
BEFORE UPDATE ON company_assignment_period_bindings
WHEN NEW.period_id != OLD.period_id OR NEW.resource_id != OLD.resource_id OR NEW.period_revision < OLD.period_revision
BEGIN
  SELECT RAISE(ABORT, 'organization assignment period source is immutable');
END;
CREATE TRIGGER company_assignment_period_bindings_delete_guard
BEFORE DELETE ON company_assignment_period_bindings
BEGIN
  SELECT RAISE(ABORT, 'organization assignment period source is immutable');
END;

-- company_assignment_resource_adoptions
INSERT INTO company_assignment_resource_adoptions (id, command_id, employee_id, fingerprint, actor_account_id, reason, expected_revision, organization_revision, observed_on, adopted_periods, snapshot_digest, source_json, recorded_at, mappings_json)
SELECT source.id,
       source.command_id,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.fingerprint,
       CASE WHEN source.actor_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.actor_account_id), source.actor_account_id) END ,
       source.reason,
       source.expected_revision,
       source.organization_revision,
       source.observed_on,
       source.adopted_periods,
       source.snapshot_digest,
       source.source_json,
       source.recorded_at,
       CASE WHEN json_valid(source.mappings_json) AND json_type(source.mappings_json) = 'object' THEN json_replace(source.mappings_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.accountId')), json_extract(source.mappings_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.actorAccountId')), json_extract(source.mappings_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.release.actorAccountId')), json_extract(source.mappings_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.employeeId')), json_extract(source.mappings_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.managerEmployeeId')), json_extract(source.mappings_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.targetEmployeeId')), json_extract(source.mappings_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.requestedByEmployeeId')), json_extract(source.mappings_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.requestedApproverId')), json_extract(source.mappings_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.applicantId')), json_extract(source.mappings_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.holderId')), json_extract(source.mappings_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.personId')), json_extract(source.mappings_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.employmentId')), json_extract(source.mappings_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.periodId')), json_extract(source.mappings_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.resourceId')), json_extract(source.mappings_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.existingResourceId')), json_extract(source.mappings_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.scopeId')), json_extract(source.mappings_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.authorityScopeId')), json_extract(source.mappings_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.responsibilityId')), json_extract(source.mappings_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.collectiveBodyId')), json_extract(source.mappings_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.organizationalOfficeId')), json_extract(source.mappings_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.positionId')), json_extract(source.mappings_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.jobId')), json_extract(source.mappings_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.siteId')), json_extract(source.mappings_json, '$.siteId'))) ELSE source.mappings_json END
FROM "_stage_company_assignment_resource_adoptions" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_assignment_resource_adoptions',
       (SELECT count(*) FROM "_stage_company_assignment_resource_adoptions"),
       (SELECT count(*) FROM company_assignment_resource_adoptions),
       0,
       0,
       0;
DROP TABLE "_stage_company_assignment_resource_adoptions";
CREATE TRIGGER company_assignment_resource_adoptions_update_guard
BEFORE UPDATE ON company_assignment_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'assignment adoption evidence is immutable');
END;
CREATE TRIGGER company_assignment_resource_adoptions_delete_guard
BEFORE DELETE ON company_assignment_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'assignment adoption evidence is immutable');
END;
CREATE TRIGGER company_assignment_resource_adoptions_identity_update
BEFORE UPDATE OF id ON company_assignment_resource_adoptions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;
CREATE TRIGGER company_assignment_adoption_insert_guard
BEFORE INSERT ON company_assignment_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'assignment adoption evidence is incomplete')
  WHERE json_type(NEW.mappings_json) IS NOT 'array'
    OR (SELECT count(*) FROM json_each(NEW.mappings_json)) !=
      (SELECT count(DISTINCT json_extract(mapping.value, '$.periodId')) FROM json_each(NEW.mappings_json) mapping)
    OR EXISTS (
      SELECT 1 FROM json_each(NEW.mappings_json) mapping
      WHERE json_type(mapping.value, '$.periodId') IS NOT 'text'
        OR json_type(mapping.value, '$.existingResourceId') IS NOT 'text'
        OR NOT EXISTS (
          SELECT 1 FROM company_organization_assignment_period_versions period
          WHERE period.period_id = json_extract(mapping.value, '$.periodId')
            AND period.recorded_by_action_id = (SELECT key_operation.id FROM company_organization_change_operations key_operation WHERE key_operation.operation_key = 'assignment-adoption:' || NEW.snapshot_digest)
        )
    )
    OR NEW.organization_revision != (SELECT revision FROM company_organizations WHERE id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d')
    OR NOT EXISTS (
      SELECT 1 FROM company_organization_change_operations operation
      WHERE operation.id = (SELECT key_operation.id FROM company_organization_change_operations key_operation WHERE key_operation.operation_key = 'assignment-adoption:' || NEW.snapshot_digest)
        AND operation.status = 'PENDING'
        AND operation.change_count = NEW.adopted_periods
        AND operation.applied_count = NEW.adopted_periods
        AND operation.actor_account_id = NEW.actor_account_id AND operation.reason = NEW.reason
    )
    OR NEW.adopted_periods != (SELECT count(*) FROM company_organization_assignment_period_versions period
      WHERE period.recorded_by_action_id = (SELECT key_operation.id FROM company_organization_change_operations key_operation WHERE key_operation.operation_key = 'assignment-adoption:' || NEW.snapshot_digest))
    OR EXISTS (
      SELECT 1 FROM company_organization_assignment_period_versions period
      WHERE period.recorded_by_action_id = (SELECT key_operation.id FROM company_organization_change_operations key_operation WHERE key_operation.operation_key = 'assignment-adoption:' || NEW.snapshot_digest)
        AND (period.employee_id != NEW.employee_id OR NOT EXISTS (
          SELECT 1 FROM company_assignment_period_bindings binding
          JOIN company_assignment_resource_bindings source ON source.resource_id = binding.resource_id
          JOIN company_resource_revisions applied ON applied.organization_id = source.organization_id
            AND applied.resource_type = 'assignment' AND applied.resource_id = source.resource_id
            AND applied.revision = source.resource_revision
          WHERE binding.period_id = period.period_id AND binding.period_revision = period.revision
            AND binding.source_revision = source.resource_revision AND source.employee_id = NEW.employee_id
            AND applied.organization_revision > NEW.expected_revision
            AND applied.organization_revision <= NEW.organization_revision
            AND applied.actor_account_id = NEW.actor_account_id AND applied.reason = NEW.reason
            AND (
              (source.resource_revision = 1 AND NOT EXISTS (
                SELECT 1 FROM json_each(NEW.mappings_json) mapping
                WHERE json_extract(mapping.value, '$.periodId') = period.period_id
              ))
              OR (source.resource_revision > 1 AND EXISTS (
                SELECT 1 FROM json_each(NEW.mappings_json) mapping
                WHERE json_extract(mapping.value, '$.periodId') = period.period_id
                  AND json_extract(mapping.value, '$.existingResourceId') = source.resource_id
                  AND source.resource_revision = 1 + (
                    SELECT max(json_extract(confirmed.value, '$.revision'))
                    FROM json_each(NEW.source_json, '$.publicAssignments') confirmed
                    WHERE json_extract(confirmed.value, '$.resourceId') = source.resource_id
                      AND json_type(confirmed.value, '$.bindingEmployeeId') = 'null'
                  )
              ))
            )
        ))
    );
END;

-- company_audit_event_appends
INSERT INTO company_audit_event_appends (staging_id, event_id, request_id, actor_account_id, actor_employee_id, action, target_type, target_id, outcome, reason_code, authorization_json, before_json, after_json, metadata_json, client_ip, client_name, created_at)
SELECT source.staging_id,
       source.event_id,
       source.request_id,
       CASE WHEN source.actor_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.actor_account_id), source.actor_account_id) END ,
       CASE WHEN source.actor_employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.actor_employee_id), source.actor_employee_id) END ,
       source.action,
       source.target_type,
       source.target_id,
       source.outcome,
       source.reason_code,
       CASE WHEN json_valid(source.authorization_json) AND json_type(source.authorization_json) = 'object' THEN json_replace(source.authorization_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.accountId')), json_extract(source.authorization_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.actorAccountId')), json_extract(source.authorization_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.release.actorAccountId')), json_extract(source.authorization_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.employeeId')), json_extract(source.authorization_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.managerEmployeeId')), json_extract(source.authorization_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.targetEmployeeId')), json_extract(source.authorization_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.requestedByEmployeeId')), json_extract(source.authorization_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.requestedApproverId')), json_extract(source.authorization_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.applicantId')), json_extract(source.authorization_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.holderId')), json_extract(source.authorization_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.personId')), json_extract(source.authorization_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.employmentId')), json_extract(source.authorization_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.periodId')), json_extract(source.authorization_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.resourceId')), json_extract(source.authorization_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.existingResourceId')), json_extract(source.authorization_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.scopeId')), json_extract(source.authorization_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.authorityScopeId')), json_extract(source.authorization_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.responsibilityId')), json_extract(source.authorization_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.collectiveBodyId')), json_extract(source.authorization_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.organizationalOfficeId')), json_extract(source.authorization_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.positionId')), json_extract(source.authorization_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.jobId')), json_extract(source.authorization_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.siteId')), json_extract(source.authorization_json, '$.siteId'))) ELSE source.authorization_json END ,
       CASE WHEN json_valid(source.before_json) AND json_type(source.before_json) = 'object' THEN json_replace(source.before_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.before_json, '$.accountId')), json_extract(source.before_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.before_json, '$.actorAccountId')), json_extract(source.before_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.before_json, '$.release.actorAccountId')), json_extract(source.before_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.before_json, '$.employeeId')), json_extract(source.before_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.before_json, '$.managerEmployeeId')), json_extract(source.before_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.before_json, '$.targetEmployeeId')), json_extract(source.before_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.before_json, '$.requestedByEmployeeId')), json_extract(source.before_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.before_json, '$.requestedApproverId')), json_extract(source.before_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.before_json, '$.applicantId')), json_extract(source.before_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.before_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.holderId')), json_extract(source.before_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.personId')), json_extract(source.before_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.employmentId')), json_extract(source.before_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.periodId')), json_extract(source.before_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.resourceId')), json_extract(source.before_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.existingResourceId')), json_extract(source.before_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.scopeId')), json_extract(source.before_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.authorityScopeId')), json_extract(source.before_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.responsibilityId')), json_extract(source.before_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.collectiveBodyId')), json_extract(source.before_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.organizationalOfficeId')), json_extract(source.before_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.positionId')), json_extract(source.before_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.jobId')), json_extract(source.before_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.siteId')), json_extract(source.before_json, '$.siteId'))) ELSE source.before_json END ,
       CASE WHEN json_valid(source.after_json) AND json_type(source.after_json) = 'object' THEN json_replace(source.after_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.after_json, '$.accountId')), json_extract(source.after_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.after_json, '$.actorAccountId')), json_extract(source.after_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.after_json, '$.release.actorAccountId')), json_extract(source.after_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.after_json, '$.employeeId')), json_extract(source.after_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.after_json, '$.managerEmployeeId')), json_extract(source.after_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.after_json, '$.targetEmployeeId')), json_extract(source.after_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.after_json, '$.requestedByEmployeeId')), json_extract(source.after_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.after_json, '$.requestedApproverId')), json_extract(source.after_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.after_json, '$.applicantId')), json_extract(source.after_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.after_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.holderId')), json_extract(source.after_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.personId')), json_extract(source.after_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.employmentId')), json_extract(source.after_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.periodId')), json_extract(source.after_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.resourceId')), json_extract(source.after_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.existingResourceId')), json_extract(source.after_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.scopeId')), json_extract(source.after_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.authorityScopeId')), json_extract(source.after_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.responsibilityId')), json_extract(source.after_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.collectiveBodyId')), json_extract(source.after_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.organizationalOfficeId')), json_extract(source.after_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.positionId')), json_extract(source.after_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.jobId')), json_extract(source.after_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.siteId')), json_extract(source.after_json, '$.siteId'))) ELSE source.after_json END ,
       CASE WHEN json_valid(source.metadata_json) AND json_type(source.metadata_json) = 'object' THEN json_replace(source.metadata_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.accountId')), json_extract(source.metadata_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.actorAccountId')), json_extract(source.metadata_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.release.actorAccountId')), json_extract(source.metadata_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.employeeId')), json_extract(source.metadata_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.managerEmployeeId')), json_extract(source.metadata_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.targetEmployeeId')), json_extract(source.metadata_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.requestedByEmployeeId')), json_extract(source.metadata_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.requestedApproverId')), json_extract(source.metadata_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.applicantId')), json_extract(source.metadata_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.holderId')), json_extract(source.metadata_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.personId')), json_extract(source.metadata_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.employmentId')), json_extract(source.metadata_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.periodId')), json_extract(source.metadata_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.resourceId')), json_extract(source.metadata_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.existingResourceId')), json_extract(source.metadata_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.scopeId')), json_extract(source.metadata_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.authorityScopeId')), json_extract(source.metadata_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.responsibilityId')), json_extract(source.metadata_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.collectiveBodyId')), json_extract(source.metadata_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.organizationalOfficeId')), json_extract(source.metadata_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.positionId')), json_extract(source.metadata_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.jobId')), json_extract(source.metadata_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.siteId')), json_extract(source.metadata_json, '$.siteId'))) ELSE source.metadata_json END ,
       source.client_ip,
       source.client_name,
       source.created_at
FROM "_stage_company_audit_event_appends" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_audit_event_appends',
       (SELECT count(*) FROM "_stage_company_audit_event_appends"),
       (SELECT count(*) FROM company_audit_event_appends),
       0,
       0,
       0;
DROP TABLE "_stage_company_audit_event_appends";
CREATE TRIGGER company_audit_event_appends_dispatch
AFTER INSERT ON company_audit_event_appends
BEGIN
  INSERT INTO company_audit_events (
    event_id, request_id, actor_account_id, action, target_type, target_id, outcome,
    reason_code, authorization_json, before_json, after_json, metadata_json,
    client_ip, client_name, created_at
  ) VALUES (
    NEW.event_id, NEW.request_id, NEW.actor_account_id, NEW.action, NEW.target_type,
    NEW.target_id, NEW.outcome, NEW.reason_code, NEW.authorization_json, NEW.before_json,
    NEW.after_json, NEW.metadata_json, NEW.client_ip, NEW.client_name, NEW.created_at
  );

  INSERT INTO company_audit_event_employee_contexts (audit_event_id, employee_id)
  SELECT event.id, NEW.actor_employee_id
  FROM company_audit_events event
  WHERE event.event_id = NEW.event_id
    AND NEW.actor_employee_id IS NOT NULL;

  DELETE FROM company_audit_event_appends WHERE staging_id = NEW.staging_id;
END;

-- company_audit_event_employee_contexts
INSERT INTO company_audit_event_employee_contexts (audit_event_id, employee_id)
SELECT source.audit_event_id,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END
FROM "_stage_company_audit_event_employee_contexts" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_audit_event_employee_contexts',
       (SELECT count(*) FROM "_stage_company_audit_event_employee_contexts"),
       (SELECT count(*) FROM company_audit_event_employee_contexts),
       0,
       0,
       0;
DROP TABLE "_stage_company_audit_event_employee_contexts";
CREATE INDEX idx_company_audit_event_employee_contexts_employee
  ON company_audit_event_employee_contexts(employee_id, audit_event_id);
CREATE TRIGGER company_audit_event_employee_contexts_prevent_delete
BEFORE DELETE ON company_audit_event_employee_contexts
BEGIN
  SELECT RAISE(ABORT, 'company audit employee context is append only');
END;
CREATE TRIGGER company_audit_event_employee_contexts_prevent_update
BEFORE UPDATE ON company_audit_event_employee_contexts
BEGIN
  SELECT RAISE(ABORT, 'company audit employee context is append only');
END;
CREATE TRIGGER company_audit_event_employee_contexts_validate_insert
BEFORE INSERT ON company_audit_event_employee_contexts
WHEN NOT EXISTS (
  SELECT 1 FROM company_audit_events WHERE id = NEW.audit_event_id
)
BEGIN
  SELECT RAISE(ABORT, 'company audit employee context requires an audit event');
END;

-- company_audit_events
INSERT INTO company_audit_events (id, event_id, request_id, actor_account_id, action, target_type, target_id, outcome, reason_code, authorization_json, before_json, after_json, metadata_json, client_ip, client_name, created_at)
SELECT source.id,
       source.event_id,
       source.request_id,
       CASE WHEN source.actor_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.actor_account_id), source.actor_account_id) END ,
       source.action,
       source.target_type,
       source.target_id,
       source.outcome,
       source.reason_code,
       CASE WHEN json_valid(source.authorization_json) AND json_type(source.authorization_json) = 'object' THEN json_replace(source.authorization_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.accountId')), json_extract(source.authorization_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.actorAccountId')), json_extract(source.authorization_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.release.actorAccountId')), json_extract(source.authorization_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.employeeId')), json_extract(source.authorization_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.managerEmployeeId')), json_extract(source.authorization_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.targetEmployeeId')), json_extract(source.authorization_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.requestedByEmployeeId')), json_extract(source.authorization_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.requestedApproverId')), json_extract(source.authorization_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.applicantId')), json_extract(source.authorization_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.holderId')), json_extract(source.authorization_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.personId')), json_extract(source.authorization_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.employmentId')), json_extract(source.authorization_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.periodId')), json_extract(source.authorization_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.resourceId')), json_extract(source.authorization_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.existingResourceId')), json_extract(source.authorization_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.scopeId')), json_extract(source.authorization_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.authorityScopeId')), json_extract(source.authorization_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.responsibilityId')), json_extract(source.authorization_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.collectiveBodyId')), json_extract(source.authorization_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.organizationalOfficeId')), json_extract(source.authorization_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.positionId')), json_extract(source.authorization_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.jobId')), json_extract(source.authorization_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.siteId')), json_extract(source.authorization_json, '$.siteId'))) ELSE source.authorization_json END ,
       CASE WHEN json_valid(source.before_json) AND json_type(source.before_json) = 'object' THEN json_replace(source.before_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.before_json, '$.accountId')), json_extract(source.before_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.before_json, '$.actorAccountId')), json_extract(source.before_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.before_json, '$.release.actorAccountId')), json_extract(source.before_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.before_json, '$.employeeId')), json_extract(source.before_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.before_json, '$.managerEmployeeId')), json_extract(source.before_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.before_json, '$.targetEmployeeId')), json_extract(source.before_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.before_json, '$.requestedByEmployeeId')), json_extract(source.before_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.before_json, '$.requestedApproverId')), json_extract(source.before_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.before_json, '$.applicantId')), json_extract(source.before_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.before_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.holderId')), json_extract(source.before_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.personId')), json_extract(source.before_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.employmentId')), json_extract(source.before_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.periodId')), json_extract(source.before_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.resourceId')), json_extract(source.before_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.existingResourceId')), json_extract(source.before_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.scopeId')), json_extract(source.before_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.authorityScopeId')), json_extract(source.before_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.responsibilityId')), json_extract(source.before_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.collectiveBodyId')), json_extract(source.before_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.organizationalOfficeId')), json_extract(source.before_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.positionId')), json_extract(source.before_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.jobId')), json_extract(source.before_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.siteId')), json_extract(source.before_json, '$.siteId'))) ELSE source.before_json END ,
       CASE WHEN json_valid(source.after_json) AND json_type(source.after_json) = 'object' THEN json_replace(source.after_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.after_json, '$.accountId')), json_extract(source.after_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.after_json, '$.actorAccountId')), json_extract(source.after_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.after_json, '$.release.actorAccountId')), json_extract(source.after_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.after_json, '$.employeeId')), json_extract(source.after_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.after_json, '$.managerEmployeeId')), json_extract(source.after_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.after_json, '$.targetEmployeeId')), json_extract(source.after_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.after_json, '$.requestedByEmployeeId')), json_extract(source.after_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.after_json, '$.requestedApproverId')), json_extract(source.after_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.after_json, '$.applicantId')), json_extract(source.after_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.after_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.holderId')), json_extract(source.after_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.personId')), json_extract(source.after_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.employmentId')), json_extract(source.after_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.periodId')), json_extract(source.after_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.resourceId')), json_extract(source.after_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.existingResourceId')), json_extract(source.after_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.scopeId')), json_extract(source.after_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.authorityScopeId')), json_extract(source.after_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.responsibilityId')), json_extract(source.after_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.collectiveBodyId')), json_extract(source.after_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.organizationalOfficeId')), json_extract(source.after_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.positionId')), json_extract(source.after_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.jobId')), json_extract(source.after_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.siteId')), json_extract(source.after_json, '$.siteId'))) ELSE source.after_json END ,
       CASE WHEN json_valid(source.metadata_json) AND json_type(source.metadata_json) = 'object' THEN json_replace(source.metadata_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.accountId')), json_extract(source.metadata_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.actorAccountId')), json_extract(source.metadata_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.release.actorAccountId')), json_extract(source.metadata_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.employeeId')), json_extract(source.metadata_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.managerEmployeeId')), json_extract(source.metadata_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.targetEmployeeId')), json_extract(source.metadata_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.requestedByEmployeeId')), json_extract(source.metadata_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.requestedApproverId')), json_extract(source.metadata_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.applicantId')), json_extract(source.metadata_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.holderId')), json_extract(source.metadata_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.personId')), json_extract(source.metadata_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.employmentId')), json_extract(source.metadata_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.periodId')), json_extract(source.metadata_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.resourceId')), json_extract(source.metadata_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.existingResourceId')), json_extract(source.metadata_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.scopeId')), json_extract(source.metadata_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.authorityScopeId')), json_extract(source.metadata_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.responsibilityId')), json_extract(source.metadata_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.collectiveBodyId')), json_extract(source.metadata_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.organizationalOfficeId')), json_extract(source.metadata_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.positionId')), json_extract(source.metadata_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.jobId')), json_extract(source.metadata_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.siteId')), json_extract(source.metadata_json, '$.siteId'))) ELSE source.metadata_json END ,
       source.client_ip,
       source.client_name,
       source.created_at
FROM "_stage_company_audit_events" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_audit_events',
       (SELECT count(*) FROM "_stage_company_audit_events"),
       (SELECT count(*) FROM company_audit_events),
       0,
       0,
       0;
DROP TABLE "_stage_company_audit_events";
CREATE INDEX idx_company_audit_events_action
  ON company_audit_events(action, created_at, id);
CREATE INDEX idx_company_audit_events_actor
  ON company_audit_events(actor_account_id, created_at, id);
CREATE INDEX idx_company_audit_events_created
  ON company_audit_events(created_at, id);
CREATE INDEX idx_company_audit_events_outcome
  ON company_audit_events(outcome, created_at, id);
CREATE INDEX idx_company_audit_events_request
  ON company_audit_events(request_id);
CREATE INDEX idx_company_audit_events_target
  ON company_audit_events(target_type, target_id, created_at, id);
CREATE TRIGGER company_audit_events_prevent_delete
BEFORE DELETE ON company_audit_events
BEGIN
  SELECT RAISE(ABORT, 'company audit events are append only');
END;
CREATE TRIGGER company_audit_events_prevent_update
BEFORE UPDATE ON company_audit_events
BEGIN
  SELECT RAISE(ABORT, 'company audit events are append only');
END;
CREATE TRIGGER company_audit_events_register_insert
AFTER INSERT ON company_audit_events
BEGIN
  SELECT RAISE(ABORT, 'company audit events are append only')
  WHERE EXISTS (
    SELECT 1 FROM company_audit_append_guard
    WHERE audit_id = NEW.id OR event_id = NEW.event_id
  );

  INSERT INTO company_audit_append_guard (audit_id, event_id)
  VALUES (NEW.id, NEW.event_id);
END;

-- company_bootstrap_receipts
INSERT INTO company_bootstrap_receipts (id, command_id, organization_id, actor_account_id, fingerprint, employee_id, organization_revision, declaration_json, source_json, recorded_at)
SELECT source.id,
       source.command_id,
       source.organization_id,
       CASE WHEN source.actor_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.actor_account_id), source.actor_account_id) END ,
       source.fingerprint,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.organization_revision,
       CASE WHEN json_valid(source.declaration_json) AND json_type(source.declaration_json) = 'object' THEN json_replace(source.declaration_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.accountId')), json_extract(source.declaration_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.actorAccountId')), json_extract(source.declaration_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.release.actorAccountId')), json_extract(source.declaration_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.employeeId')), json_extract(source.declaration_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.managerEmployeeId')), json_extract(source.declaration_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.targetEmployeeId')), json_extract(source.declaration_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.requestedByEmployeeId')), json_extract(source.declaration_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.requestedApproverId')), json_extract(source.declaration_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.applicantId')), json_extract(source.declaration_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.holderId')), json_extract(source.declaration_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.personId')), json_extract(source.declaration_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.employmentId')), json_extract(source.declaration_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.periodId')), json_extract(source.declaration_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.resourceId')), json_extract(source.declaration_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.existingResourceId')), json_extract(source.declaration_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.scopeId')), json_extract(source.declaration_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.authorityScopeId')), json_extract(source.declaration_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.responsibilityId')), json_extract(source.declaration_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.collectiveBodyId')), json_extract(source.declaration_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.organizationalOfficeId')), json_extract(source.declaration_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.positionId')), json_extract(source.declaration_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.jobId')), json_extract(source.declaration_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.siteId')), json_extract(source.declaration_json, '$.siteId'))) ELSE source.declaration_json END ,
       source.source_json,
       source.recorded_at
FROM "_stage_company_bootstrap_receipts" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_bootstrap_receipts',
       (SELECT count(*) FROM "_stage_company_bootstrap_receipts"),
       (SELECT count(*) FROM company_bootstrap_receipts),
       0,
       0,
       0;
DROP TABLE "_stage_company_bootstrap_receipts";
CREATE TRIGGER company_bootstrap_receipts_immutable_update
BEFORE UPDATE ON company_bootstrap_receipts
BEGIN
  SELECT RAISE(ABORT, 'company bootstrap receipt immutable');
END;
CREATE TRIGGER company_bootstrap_receipts_immutable_delete
BEFORE DELETE ON company_bootstrap_receipts
BEGIN
  SELECT RAISE(ABORT, 'company bootstrap receipt immutable');
END;
CREATE TRIGGER company_bootstrap_receipts_identity_update
BEFORE UPDATE OF id ON company_bootstrap_receipts
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_definition_resource_adoptions
INSERT INTO company_definition_resource_adoptions (id, organization_id, command_id, resource_type, definition_id, resource_id, fingerprint, actor_account_id, reason, expected_revision, organization_revision, observed_on, snapshot_digest, source_json, recorded_at)
SELECT source.id,
       source.organization_id,
       source.command_id,
       source.resource_type,
       source.definition_id,
       CASE WHEN source.resource_type = 'employee' THEN CASE WHEN source.resource_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.resource_id), source.resource_id) END ELSE CASE WHEN source.resource_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.resource_id), source.resource_id) END END ,
       source.fingerprint,
       CASE WHEN source.actor_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.actor_account_id), source.actor_account_id) END ,
       source.reason,
       source.expected_revision,
       source.organization_revision,
       source.observed_on,
       source.snapshot_digest,
       source.source_json,
       source.recorded_at
FROM "_stage_company_definition_resource_adoptions" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_definition_resource_adoptions',
       (SELECT count(*) FROM "_stage_company_definition_resource_adoptions"),
       (SELECT count(*) FROM company_definition_resource_adoptions),
       0,
       0,
       0;
DROP TABLE "_stage_company_definition_resource_adoptions";
CREATE TRIGGER company_definition_adoptions_update_guard
BEFORE UPDATE ON company_definition_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'company_definition_adoption_immutable');
END;
CREATE TRIGGER company_definition_adoptions_delete_guard
BEFORE DELETE ON company_definition_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'company_definition_adoption_immutable');
END;
CREATE TRIGGER company_definition_adoptions_insert_guard
BEFORE INSERT ON company_definition_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'company_definition_adoption_resource_invalid')
  WHERE NOT EXISTS (
    SELECT 1 FROM company_resource_revisions resource
    JOIN company_command_receipts receipt
      ON receipt.organization_id = resource.organization_id AND receipt.command_id = resource.command_id
    WHERE resource.organization_id = NEW.organization_id AND resource.resource_type = NEW.resource_type
      AND resource.resource_id = NEW.resource_id AND resource.revision = 1
      AND resource.command_id = NEW.command_id AND resource.organization_revision = NEW.organization_revision
      AND resource.effective_from = NEW.observed_on AND resource.effective_to IS NULL AND resource.state = 'active'
      AND resource.actor_account_id = NEW.actor_account_id AND resource.recorded_at = NEW.recorded_at
      AND resource.reason = NEW.reason AND receipt.expected_revision = NEW.expected_revision
      AND json_extract(resource.attributes_json, '$.code') = json_extract(NEW.source_json, '$.definition.code')
      AND json_extract(resource.attributes_json, '$.officialName') = json_extract(NEW.source_json, '$.definition.name')
      AND json_extract(resource.attributes_json, '$.rank') = json_extract(NEW.source_json, '$.definition.rank')
      AND json_extract(resource.attributes_json, '$.description') IS json_extract(NEW.source_json, '$.definition.description')
  );
END;
CREATE TRIGGER company_definition_resource_adoptions_identity_update
BEFORE UPDATE OF id ON company_definition_resource_adoptions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_employee_lifecycle_revisions
INSERT INTO company_employee_lifecycle_revisions (employee_id, revision, updated_at)
SELECT CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _company_employees_id_map ref WHERE ref.old_id = source.employee_id), CAST(source.employee_id AS TEXT)) END ,
       source.revision,
       source.updated_at
FROM "_stage_company_employee_lifecycle_revisions" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_employee_lifecycle_revisions',
       (SELECT count(*) FROM "_stage_company_employee_lifecycle_revisions"),
       (SELECT count(*) FROM company_employee_lifecycle_revisions),
       0,
       (SELECT count(*) FROM company_employee_lifecycle_revisions WHERE NOT (length(employee_id) = 36 AND employee_id NOT GLOB '*[^0-9a-f-]*' AND substr(employee_id, 9, 1) = '-' AND substr(employee_id, 14, 1) = '-' AND substr(employee_id, 19, 1) = '-' AND substr(employee_id, 24, 1) = '-' AND length(replace(employee_id, '-', '')) = 32 AND substr(employee_id, 15, 1) GLOB '[1-8]' AND substr(employee_id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_company_employee_lifecycle_revisions";

-- company_employee_resource_adoptions
INSERT INTO company_employee_resource_adoptions (id, command_id, employee_id, fingerprint, actor_account_id, reason, expected_revision, organization_revision, observed_on, snapshot_digest, source_json, recorded_at)
SELECT source.id,
       source.command_id,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.fingerprint,
       CASE WHEN source.actor_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.actor_account_id), source.actor_account_id) END ,
       source.reason,
       source.expected_revision,
       source.organization_revision,
       source.observed_on,
       source.snapshot_digest,
       source.source_json,
       source.recorded_at
FROM "_stage_company_employee_resource_adoptions" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_employee_resource_adoptions',
       (SELECT count(*) FROM "_stage_company_employee_resource_adoptions"),
       (SELECT count(*) FROM company_employee_resource_adoptions),
       0,
       0,
       0;
DROP TABLE "_stage_company_employee_resource_adoptions";
CREATE TRIGGER company_employee_resource_adoptions_no_update
BEFORE UPDATE ON company_employee_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'employee resource adoption is immutable');
END;
CREATE TRIGGER company_employee_resource_adoptions_no_delete
BEFORE DELETE ON company_employee_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'employee resource adoption is immutable');
END;
CREATE TRIGGER company_employee_resource_adoptions_identity_update
BEFORE UPDATE OF id ON company_employee_resource_adoptions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_employee_status_period_versions
INSERT INTO company_employee_status_period_versions (id, period_id, revision, employment_period_id, employee_id, status, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
SELECT source.id,
       CASE WHEN source.period_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.period_id), source.period_id) END ,
       source.revision,
       CASE WHEN source.employment_period_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.employment_period_id), source.employment_period_id) END ,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.status,
       source.starts_on,
       source.ends_on,
       source.is_void,
       CASE WHEN source.recorded_by_action_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.recorded_by_action_id), source.recorded_by_action_id) END ,
       source.recorded_at
FROM "_stage_company_employee_status_period_versions" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_employee_status_period_versions',
       (SELECT count(*) FROM "_stage_company_employee_status_period_versions"),
       (SELECT count(*) FROM company_employee_status_period_versions),
       0,
       0,
       0;
DROP TABLE "_stage_company_employee_status_period_versions";
CREATE INDEX idx_company_employee_status_period_versions_employee
  ON company_employee_status_period_versions(
    employee_id, starts_on, ends_on, period_id, revision DESC
  );
CREATE INDEX idx_company_employee_status_period_versions_employment
  ON company_employee_status_period_versions(employment_period_id, period_id, revision DESC);
CREATE TRIGGER company_employee_status_period_versions_no_delete
BEFORE DELETE ON company_employee_status_period_versions
BEGIN
  SELECT RAISE(ABORT, 'company employee status period versions are append only');
END;
CREATE TRIGGER company_employee_status_period_versions_no_update
BEFORE UPDATE ON company_employee_status_period_versions
BEGIN
  SELECT RAISE(ABORT, 'company employee status period versions are append only');
END;
CREATE TRIGGER company_employee_status_period_versions_identity_update
BEFORE UPDATE OF id ON company_employee_status_period_versions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_employments
INSERT INTO company_employments (id, employee_id, contract_name, employment_type, hire_date, status, termination_date, created_at, updated_at, legacy_id)
SELECT map.new_id,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.contract_name,
       source.employment_type,
       source.hire_date,
       source.status,
       source.termination_date,
       source.created_at,
       source.updated_at,
       CASE WHEN map.old_id IS NOT map.new_id THEN source.id END
FROM "_stage_company_employments" source
INNER JOIN _company_employments_id_map map ON map.old_id = source.id;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_employments',
       (SELECT count(*) FROM "_stage_company_employments"),
       (SELECT count(*) FROM company_employments),
       0,
       (SELECT count(*) FROM company_employments WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_company_employments";
CREATE INDEX company_employments_employee_idx
  ON company_employments(employee_id);
CREATE INDEX company_employments_status_idx
  ON company_employments(status);
CREATE UNIQUE INDEX company_employments_employee_active_unique
  ON company_employments(employee_id)
  WHERE termination_date IS NULL AND status IN ('ACTIVE', 'ON_LEAVE');
CREATE TRIGGER company_employments_employee_immutable
BEFORE UPDATE OF employee_id ON company_employments
WHEN NEW.employee_id IS NOT OLD.employee_id
BEGIN
  SELECT RAISE(ABORT, 'employment employee identity is immutable');
END;
CREATE TRIGGER company_employments_organization_period_guard
BEFORE UPDATE OF hire_date, termination_date ON company_employments
BEGIN
  SELECT RAISE(ABORT, 'employment change would orphan an organization assignment')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_assignment_period_versions assignment
    WHERE assignment.employment_id = NEW.id
      AND assignment.is_void = 0
      AND assignment.revision = (
        SELECT max(latest.revision)
        FROM company_organization_assignment_period_versions latest
        WHERE latest.period_id = assignment.period_id
      )
      AND (
        NEW.hire_date > assignment.starts_on
        OR (
          NEW.termination_date IS NOT NULL
          AND (
            assignment.ends_on IS NULL
            OR assignment.ends_on > date(NEW.termination_date, '+1 day')
          )
        )
      )
  );

  SELECT RAISE(ABORT, 'employment change would orphan an organization responsibility')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_responsibility_period_versions responsibility
    WHERE responsibility.employment_id = NEW.id
      AND responsibility.is_void = 0
      AND responsibility.revision = (
        SELECT max(latest.revision)
        FROM company_organization_responsibility_period_versions latest
        WHERE latest.period_id = responsibility.period_id
      )
      AND (
        NEW.hire_date > responsibility.starts_on
        OR (
          NEW.termination_date IS NOT NULL
          AND (
            responsibility.ends_on IS NULL
            OR responsibility.ends_on > date(NEW.termination_date, '+1 day')
          )
        )
      )
  );

  SELECT RAISE(ABORT, 'employment change would leave an assigned employee without manager')
  WHERE NEW.termination_date IS NOT NULL AND EXISTS (
    SELECT 1 FROM company_organization_assignment_period_versions assignment
    WHERE assignment.manager_employee_id = NEW.employee_id
      AND assignment.is_void = 0
      AND assignment.revision = (
        SELECT max(latest.revision)
        FROM company_organization_assignment_period_versions latest
        WHERE latest.period_id = assignment.period_id
      )
      AND (
        assignment.ends_on IS NULL
        OR assignment.ends_on > date(NEW.termination_date, '+1 day')
      )
  );
END;
CREATE TRIGGER company_employments_legacy_id_insert
BEFORE INSERT ON company_employments
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER company_employments_identity_update
BEFORE UPDATE OF id, legacy_id ON company_employments
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_employment_attributes
INSERT INTO company_employment_attributes (id, employment_id, key, value, position, created_at, updated_at)
SELECT map.new_id,
       CASE WHEN source.employment_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.employment_id), source.employment_id) END ,
       source.key,
       source.value,
       source.position,
       source.created_at,
       source.updated_at
FROM "_stage_company_employment_attributes" source
INNER JOIN _company_employment_attributes_id_map map ON map.old_id = source.id;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_employment_attributes',
       (SELECT count(*) FROM "_stage_company_employment_attributes"),
       (SELECT count(*) FROM company_employment_attributes),
       0,
       (SELECT count(*) FROM company_employment_attributes WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_company_employment_attributes";
CREATE INDEX company_employment_attributes_employment_idx
  ON company_employment_attributes(employment_id);

-- company_employment_period_versions
INSERT INTO company_employment_period_versions (id, period_id, revision, employee_id, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
SELECT source.id,
       CASE WHEN source.period_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.period_id), source.period_id) END ,
       source.revision,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.starts_on,
       source.ends_on,
       source.is_void,
       CASE WHEN source.recorded_by_action_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.recorded_by_action_id), source.recorded_by_action_id) END ,
       source.recorded_at
FROM "_stage_company_employment_period_versions" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_employment_period_versions',
       (SELECT count(*) FROM "_stage_company_employment_period_versions"),
       (SELECT count(*) FROM company_employment_period_versions),
       0,
       0,
       0;
DROP TABLE "_stage_company_employment_period_versions";
CREATE INDEX idx_company_employment_period_versions_employee
  ON company_employment_period_versions(
    employee_id, starts_on, ends_on, period_id, revision DESC
  );
CREATE TRIGGER company_employment_period_versions_no_delete
BEFORE DELETE ON company_employment_period_versions
BEGIN
  SELECT RAISE(ABORT, 'company employment period versions are append only');
END;
CREATE TRIGGER company_employment_period_versions_no_update
BEFORE UPDATE ON company_employment_period_versions
BEGIN
  SELECT RAISE(ABORT, 'company employment period versions are append only');
END;
CREATE TRIGGER company_employment_period_versions_identity_update
BEFORE UPDATE OF id ON company_employment_period_versions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- system_principals
INSERT INTO system_principals (id, account_id, kind, name, connector_id, revision, created_at, updated_at, legacy_id)
SELECT map.new_id,
       CASE WHEN source.account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.account_id), source.account_id) END ,
       source.kind,
       source.name,
       source.connector_id,
       source.revision,
       source.created_at,
       source.updated_at,
       CASE WHEN map.old_id IS NOT map.new_id THEN source.id END
FROM "_stage_system_principals" source
INNER JOIN _system_principals_id_map map ON map.old_id = source.id;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_principals',
       (SELECT count(*) FROM "_stage_system_principals"),
       (SELECT count(*) FROM system_principals),
       0,
       (SELECT count(*) FROM system_principals WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_principals";
CREATE UNIQUE INDEX system_principals_connector_uniq ON system_principals (connector_id);
CREATE INDEX system_principals_kind_idx ON system_principals (kind, id);
CREATE TRIGGER system_principals_revision_step
BEFORE UPDATE ON system_principals
WHEN NEW.revision <> OLD.revision + 1 OR NEW.updated_at < OLD.updated_at
BEGIN
  SELECT RAISE(ABORT, 'system_principal_revision_conflict');
END;
CREATE TRIGGER system_principals_legacy_id_insert
BEFORE INSERT ON system_principals
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER system_principals_identity_update
BEFORE UPDATE OF id, legacy_id ON system_principals
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- system_machine_credentials
INSERT INTO system_machine_credentials (id, principal_id, name, secret_hash, status, created_at, updated_at, expires_at, last_used_at, revoked_at)
SELECT map.new_id,
       CASE WHEN source.principal_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.principal_id), source.principal_id) END ,
       source.name,
       source.secret_hash,
       source.status,
       source.created_at,
       source.updated_at,
       source.expires_at,
       source.last_used_at,
       source.revoked_at
FROM "_stage_system_machine_credentials" source
INNER JOIN _system_machine_credentials_id_map map ON map.old_id = source.id;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_machine_credentials',
       (SELECT count(*) FROM "_stage_system_machine_credentials"),
       (SELECT count(*) FROM system_machine_credentials),
       0,
       (SELECT count(*) FROM system_machine_credentials WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_machine_credentials";
CREATE INDEX system_machine_credentials_principal_idx
  ON system_machine_credentials (principal_id, status);
CREATE INDEX system_machine_credentials_expiration_idx
  ON system_machine_credentials (expires_at);
CREATE TRIGGER system_machine_credentials_principal_guard
BEFORE INSERT ON system_machine_credentials
WHEN NOT EXISTS (
  SELECT 1 FROM system_principals AS principal
  INNER JOIN system_accounts AS account ON account.id = principal.account_id
  WHERE principal.id = NEW.principal_id
    AND principal.kind IN ('agent', 'service', 'connector')
    AND account.status = 'active'
)
BEGIN
  SELECT RAISE(ABORT, 'system_machine_credential_principal_invalid');
END;
CREATE TRIGGER system_machine_credentials_monotonic_update
BEFORE UPDATE ON system_machine_credentials
WHEN NEW.principal_id <> OLD.principal_id
  OR NEW.secret_hash <> OLD.secret_hash
  OR NEW.created_at <> OLD.created_at
  OR NEW.updated_at < OLD.updated_at
  OR (OLD.status = 'revoked' AND NEW.status <> 'revoked')
  OR (OLD.last_used_at IS NOT NULL AND (NEW.last_used_at IS NULL OR NEW.last_used_at < OLD.last_used_at))
BEGIN
  SELECT RAISE(ABORT, 'system_machine_credential_update_invalid');
END;
CREATE TRIGGER system_machine_credentials_no_delete
BEFORE DELETE ON system_machine_credentials
BEGIN
  SELECT RAISE(ABORT, 'system_machine_credentials_are_retained');
END;

-- company_external_identity_imports
INSERT INTO company_external_identity_imports (id, organization_id, command_id, fingerprint, actor_account_id, machine_credential_id, reason, expected_revision, organization_revision, result_json, recorded_at)
SELECT source.id,
       source.organization_id,
       source.command_id,
       source.fingerprint,
       CASE WHEN source.actor_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.actor_account_id), source.actor_account_id) END ,
       source.machine_credential_id,
       source.reason,
       source.expected_revision,
       source.organization_revision,
       CASE WHEN json_valid(source.result_json) AND json_type(source.result_json) = 'object' THEN json_replace(source.result_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.result_json, '$.accountId')), json_extract(source.result_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.result_json, '$.actorAccountId')), json_extract(source.result_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.result_json, '$.release.actorAccountId')), json_extract(source.result_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.result_json, '$.employeeId')), json_extract(source.result_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.result_json, '$.managerEmployeeId')), json_extract(source.result_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.result_json, '$.targetEmployeeId')), json_extract(source.result_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.result_json, '$.requestedByEmployeeId')), json_extract(source.result_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.result_json, '$.requestedApproverId')), json_extract(source.result_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.result_json, '$.applicantId')), json_extract(source.result_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.result_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.result_json, '$.holderId')), json_extract(source.result_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.result_json, '$.personId')), json_extract(source.result_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.result_json, '$.employmentId')), json_extract(source.result_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.result_json, '$.periodId')), json_extract(source.result_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.result_json, '$.resourceId')), json_extract(source.result_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.result_json, '$.existingResourceId')), json_extract(source.result_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.result_json, '$.scopeId')), json_extract(source.result_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.result_json, '$.authorityScopeId')), json_extract(source.result_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.result_json, '$.responsibilityId')), json_extract(source.result_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.result_json, '$.collectiveBodyId')), json_extract(source.result_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.result_json, '$.organizationalOfficeId')), json_extract(source.result_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.result_json, '$.positionId')), json_extract(source.result_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.result_json, '$.jobId')), json_extract(source.result_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.result_json, '$.siteId')), json_extract(source.result_json, '$.siteId'))) ELSE source.result_json END ,
       source.recorded_at
FROM "_stage_company_external_identity_imports" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_external_identity_imports',
       (SELECT count(*) FROM "_stage_company_external_identity_imports"),
       (SELECT count(*) FROM company_external_identity_imports),
       0,
       0,
       0;
DROP TABLE "_stage_company_external_identity_imports";
CREATE TRIGGER company_external_identity_imports_no_update
BEFORE UPDATE ON company_external_identity_imports
BEGIN
  SELECT RAISE(ABORT, 'external identity import is immutable');
END;
CREATE TRIGGER company_external_identity_imports_no_delete
BEFORE DELETE ON company_external_identity_imports
BEGIN
  SELECT RAISE(ABORT, 'external identity import is immutable');
END;
CREATE TRIGGER company_external_identity_imports_identity_update
BEFORE UPDATE OF id ON company_external_identity_imports
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- system_identity_bindings
INSERT INTO system_identity_bindings (id, account_id, provider, subject, created_at, activated_at, revoked_at)
SELECT map.new_id,
       CASE WHEN source.account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.account_id), source.account_id) END ,
       source.provider,
       source.subject,
       source.created_at,
       source.activated_at,
       source.revoked_at
FROM "_stage_system_identity_bindings" source
INNER JOIN _system_identity_bindings_id_map map ON map.old_id = source.id;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_identity_bindings',
       (SELECT count(*) FROM "_stage_system_identity_bindings"),
       (SELECT count(*) FROM system_identity_bindings),
       0,
       (SELECT count(*) FROM system_identity_bindings WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_identity_bindings";
CREATE UNIQUE INDEX system_identity_bindings_provider_subject_uniq
  ON system_identity_bindings (provider, subject);
CREATE INDEX system_identity_bindings_account_idx
  ON system_identity_bindings (account_id);
CREATE TRIGGER system_identity_bindings_immutable_identity
BEFORE UPDATE OF account_id, provider, subject, created_at ON system_identity_bindings
BEGIN
  SELECT RAISE(ABORT, 'identity binding identity is immutable');
END;
CREATE TRIGGER system_identity_bindings_monotonic_lifecycle
BEFORE UPDATE ON system_identity_bindings
WHEN
  (OLD.activated_at IS NOT NULL AND NEW.activated_at IS NOT OLD.activated_at)
  OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NOT OLD.revoked_at)
BEGIN
  SELECT RAISE(ABORT, 'identity lifecycle is not monotonic');
END;
CREATE TRIGGER system_identity_bindings_closed_account_guard
BEFORE INSERT ON system_identity_bindings
WHEN EXISTS (
  SELECT 1 FROM system_accounts
  WHERE id = NEW.account_id AND closed_at IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'closed account cannot receive an identity');
END;

-- company_external_identity_sources
INSERT INTO company_external_identity_sources (identity_id, organization_id, source_revision, source_digest, updated_at)
SELECT CASE WHEN source.identity_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _system_identity_bindings_id_map ref WHERE ref.old_id = source.identity_id), CAST(source.identity_id AS TEXT)) END ,
       source.organization_id,
       source.source_revision,
       source.source_digest,
       source.updated_at
FROM "_stage_company_external_identity_sources" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_external_identity_sources',
       (SELECT count(*) FROM "_stage_company_external_identity_sources"),
       (SELECT count(*) FROM company_external_identity_sources),
       0,
       (SELECT count(*) FROM company_external_identity_sources WHERE NOT (length(identity_id) = 36 AND identity_id NOT GLOB '*[^0-9a-f-]*' AND substr(identity_id, 9, 1) = '-' AND substr(identity_id, 14, 1) = '-' AND substr(identity_id, 19, 1) = '-' AND substr(identity_id, 24, 1) = '-' AND length(replace(identity_id, '-', '')) = 32 AND substr(identity_id, 15, 1) GLOB '[1-8]' AND substr(identity_id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_company_external_identity_sources";
CREATE TRIGGER company_external_identity_sources_revision
BEFORE UPDATE ON company_external_identity_sources
WHEN NEW.identity_id IS NOT OLD.identity_id
  OR NEW.organization_id IS NOT OLD.organization_id
  OR NEW.source_revision <= OLD.source_revision
  OR NEW.updated_at < OLD.updated_at
BEGIN
  SELECT RAISE(ABORT, 'external identity source revision conflict');
END;
CREATE TRIGGER company_external_identity_sources_no_delete
BEFORE DELETE ON company_external_identity_sources
BEGIN
  SELECT RAISE(ABORT, 'external identity source is immutable');
END;

-- company_grade_award_archives
INSERT INTO company_grade_award_archives (id, organization_id, command_id, employee_id, fingerprint, actor_account_id, reason, observed_on, observed_company_revision, snapshot_digest, source_json, recorded_at)
SELECT source.id,
       source.organization_id,
       source.command_id,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.fingerprint,
       CASE WHEN source.actor_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.actor_account_id), source.actor_account_id) END ,
       source.reason,
       source.observed_on,
       source.observed_company_revision,
       source.snapshot_digest,
       source.source_json,
       source.recorded_at
FROM "_stage_company_grade_award_archives" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_grade_award_archives',
       (SELECT count(*) FROM "_stage_company_grade_award_archives"),
       (SELECT count(*) FROM company_grade_award_archives),
       0,
       0,
       0;
DROP TABLE "_stage_company_grade_award_archives";
CREATE TRIGGER company_grade_award_archive_no_update
BEFORE UPDATE ON company_grade_award_archives
BEGIN
  SELECT RAISE(ABORT, 'company grade award archives are immutable');
END;
CREATE TRIGGER company_grade_award_archive_no_delete
BEFORE DELETE ON company_grade_award_archives
BEGIN
  SELECT RAISE(ABORT, 'company grade award archives are immutable');
END;
CREATE TRIGGER company_grade_award_archives_identity_update
BEFORE UPDATE OF id ON company_grade_award_archives
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_lifecycle_outbox_entries
INSERT INTO company_lifecycle_outbox_entries (id, legacy_id, personnel_action_id, effect_type, payload_json, attempt_count, next_attempt_at, processed_at, last_error_code, created_at)
SELECT source.id,
       source.legacy_id,
       CASE WHEN source.personnel_action_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.personnel_action_id), source.personnel_action_id) END ,
       source.effect_type,
       CASE WHEN json_valid(source.payload_json) AND json_type(source.payload_json) = 'object' THEN json_replace(source.payload_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.accountId')), json_extract(source.payload_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.actorAccountId')), json_extract(source.payload_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.release.actorAccountId')), json_extract(source.payload_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.employeeId')), json_extract(source.payload_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.managerEmployeeId')), json_extract(source.payload_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.targetEmployeeId')), json_extract(source.payload_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.requestedByEmployeeId')), json_extract(source.payload_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.requestedApproverId')), json_extract(source.payload_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.applicantId')), json_extract(source.payload_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.holderId')), json_extract(source.payload_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.personId')), json_extract(source.payload_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.employmentId')), json_extract(source.payload_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.periodId')), json_extract(source.payload_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.resourceId')), json_extract(source.payload_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.existingResourceId')), json_extract(source.payload_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.scopeId')), json_extract(source.payload_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.authorityScopeId')), json_extract(source.payload_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.responsibilityId')), json_extract(source.payload_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.collectiveBodyId')), json_extract(source.payload_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.organizationalOfficeId')), json_extract(source.payload_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.positionId')), json_extract(source.payload_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.jobId')), json_extract(source.payload_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.siteId')), json_extract(source.payload_json, '$.siteId'))) ELSE source.payload_json END ,
       source.attempt_count,
       source.next_attempt_at,
       source.processed_at,
       source.last_error_code,
       source.created_at
FROM "_stage_company_lifecycle_outbox_entries" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_lifecycle_outbox_entries',
       (SELECT count(*) FROM "_stage_company_lifecycle_outbox_entries"),
       (SELECT count(*) FROM company_lifecycle_outbox_entries),
       0,
       0,
       0;
DROP TABLE "_stage_company_lifecycle_outbox_entries";
CREATE INDEX idx_company_lifecycle_outbox_pending
  ON company_lifecycle_outbox_entries(processed_at, next_attempt_at, id);
CREATE UNIQUE INDEX uq_company_lifecycle_outbox_action_effect
  ON company_lifecycle_outbox_entries(personnel_action_id, effect_type);
CREATE TRIGGER company_lifecycle_outbox_entries_legacy_id_insert
BEFORE INSERT ON company_lifecycle_outbox_entries
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER company_lifecycle_outbox_entries_identity_update
BEFORE UPDATE OF id, legacy_id ON company_lifecycle_outbox_entries
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_organization_resource_adoptions
INSERT INTO company_organization_resource_adoptions (id, command_id, organization_unit_id, fingerprint, actor_account_id, reason, expected_revision, organization_revision, observed_on, snapshot_digest, source_json, recorded_at)
SELECT source.id,
       source.command_id,
       source.organization_unit_id,
       source.fingerprint,
       CASE WHEN source.actor_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.actor_account_id), source.actor_account_id) END ,
       source.reason,
       source.expected_revision,
       source.organization_revision,
       source.observed_on,
       source.snapshot_digest,
       source.source_json,
       source.recorded_at
FROM "_stage_company_organization_resource_adoptions" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_organization_resource_adoptions',
       (SELECT count(*) FROM "_stage_company_organization_resource_adoptions"),
       (SELECT count(*) FROM company_organization_resource_adoptions),
       0,
       0,
       0;
DROP TABLE "_stage_company_organization_resource_adoptions";
CREATE TRIGGER company_organization_resource_adoptions_no_update
BEFORE UPDATE ON company_organization_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'organization resource connection is immutable');
END;
CREATE TRIGGER company_organization_resource_adoptions_no_delete
BEFORE DELETE ON company_organization_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'organization resource connection is immutable');
END;
CREATE TRIGGER company_organization_resource_adoptions_identity_update
BEFORE UPDATE OF id ON company_organization_resource_adoptions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_organization_resource_bindings
INSERT INTO company_organization_resource_bindings (organization_unit_id, organization_id, recorded_at)
SELECT source.organization_unit_id,
       source.organization_id,
       source.recorded_at
FROM "_stage_company_organization_resource_bindings" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_organization_resource_bindings',
       (SELECT count(*) FROM "_stage_company_organization_resource_bindings"),
       (SELECT count(*) FROM company_organization_resource_bindings),
       0,
       (SELECT count(*) FROM company_organization_resource_bindings WHERE NOT (length(organization_unit_id) = 36 AND organization_unit_id NOT GLOB '*[^0-9a-f-]*' AND substr(organization_unit_id, 9, 1) = '-' AND substr(organization_unit_id, 14, 1) = '-' AND substr(organization_unit_id, 19, 1) = '-' AND substr(organization_unit_id, 24, 1) = '-' AND length(replace(organization_unit_id, '-', '')) = 32 AND substr(organization_unit_id, 15, 1) GLOB '[1-8]' AND substr(organization_unit_id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_company_organization_resource_bindings";
CREATE TRIGGER company_organization_resource_bindings_no_update
BEFORE UPDATE ON company_organization_resource_bindings
BEGIN
  SELECT RAISE(ABORT, 'organization resource connection is immutable');
END;
CREATE TRIGGER company_organization_resource_bindings_no_delete
BEFORE DELETE ON company_organization_resource_bindings
BEGIN
  SELECT RAISE(ABORT, 'organization resource connection is immutable');
END;
CREATE TRIGGER company_organization_resource_binding_guard
AFTER INSERT ON company_organization_resource_bindings
WHEN 1
BEGIN
  SELECT RAISE(ABORT, 'organization resource history mismatch')
  WHERE EXISTS (SELECT 1 FROM company_organization_resource_mismatches WHERE organization_unit_id = NEW.organization_unit_id) OR NOT EXISTS (SELECT 1 FROM company_organization_unit_period_versions WHERE organization_unit_id = NEW.organization_unit_id);
END;

-- company_organization_responsibility_period_versions
INSERT INTO company_organization_responsibility_period_versions (id, period_id, revision, employment_id, employee_id, organization_unit_id, responsibility_type, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
SELECT source.id,
       CASE WHEN source.period_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.period_id), source.period_id) END ,
       source.revision,
       CASE WHEN source.employment_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.employment_id), source.employment_id) END ,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.organization_unit_id,
       source.responsibility_type,
       source.starts_on,
       source.ends_on,
       source.is_void,
       CASE WHEN source.recorded_by_action_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.recorded_by_action_id), source.recorded_by_action_id) END ,
       source.recorded_at
FROM "_stage_company_organization_responsibility_period_versions" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_organization_responsibility_period_versions',
       (SELECT count(*) FROM "_stage_company_organization_responsibility_period_versions"),
       (SELECT count(*) FROM company_organization_responsibility_period_versions),
       0,
       0,
       0;
DROP TABLE "_stage_company_organization_responsibility_period_versions";
CREATE INDEX company_organization_responsibility_period_versions_employee_idx
  ON company_organization_responsibility_period_versions(
    employee_id, starts_on, ends_on, period_id, revision
  );
CREATE INDEX company_organization_responsibility_period_versions_unit_idx
  ON company_organization_responsibility_period_versions(
    organization_unit_id, responsibility_type, starts_on, ends_on, period_id, revision
  );
CREATE TRIGGER company_organization_responsibility_period_versions_immutable_delete
BEFORE DELETE ON company_organization_responsibility_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization responsibilities are append only');
END;
CREATE TRIGGER company_organization_responsibility_period_versions_immutable_update
BEFORE UPDATE ON company_organization_responsibility_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization responsibilities are append only');
END;
CREATE TRIGGER company_organization_responsibility_period_versions_revision_state
AFTER INSERT ON company_organization_responsibility_period_versions
BEGIN
  UPDATE company_organization_change_operations
  SET applied_count = applied_count + 1
  WHERE id = NEW.recorded_by_action_id;

  UPDATE company_organization_lifecycle_states
  SET revision = revision + 1, updated_at = max(updated_at, NEW.recorded_at)
  WHERE id = 1;
END;
CREATE TRIGGER company_organization_responsibility_period_versions_guard
BEFORE INSERT ON company_organization_responsibility_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is missing or stale')
  WHERE NOT EXISTS (
    SELECT 1
    FROM company_organization_change_operations operation
    JOIN company_organization_lifecycle_states state ON state.id = 1
    WHERE operation.id = NEW.recorded_by_action_id
      AND operation.status = 'PENDING'
      AND operation.applied_count < operation.change_count
      AND state.revision = operation.expected_revision + operation.applied_count
  );

  SELECT RAISE(ABORT, 'organization responsibility revision is not sequential')
  WHERE NEW.revision != coalesce(
    (
      SELECT max(revision)
      FROM company_organization_responsibility_period_versions
      WHERE period_id = NEW.period_id
    ),
    0
  ) + 1;

  SELECT RAISE(ABORT, 'organization responsibility owner is immutable')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_responsibility_period_versions previous
    WHERE previous.period_id = NEW.period_id
      AND (
        previous.employment_id != NEW.employment_id
        OR previous.employee_id != NEW.employee_id
        OR previous.organization_unit_id != NEW.organization_unit_id
        OR previous.responsibility_type != NEW.responsibility_type
      )
  );

  SELECT RAISE(ABORT, 'organization responsibility employment mismatch')
  WHERE NOT EXISTS (
    SELECT 1 FROM company_employments employment
    WHERE employment.id = NEW.employment_id
      AND employment.employee_id = NEW.employee_id
      AND employment.hire_date <= NEW.starts_on
      AND (
        employment.termination_date IS NULL
        OR (
          NEW.ends_on IS NOT NULL
          AND NEW.ends_on <= date(employment.termination_date, '+1 day')
        )
      )
  );

  SELECT RAISE(ABORT, 'organization responsibility unit is not active')
  WHERE NEW.is_void = 0 AND NOT EXISTS (
    SELECT 1 FROM company_organization_unit_coverage unit
    WHERE unit.organization_unit_id = NEW.organization_unit_id
      AND unit.starts_on <= NEW.starts_on
      AND (
        unit.ends_on IS NULL
        OR (NEW.ends_on IS NOT NULL AND NEW.ends_on <= unit.ends_on)
      )
  );

  SELECT RAISE(ABORT, 'organization responsibility requires matching assignment')
  WHERE NEW.is_void = 0 AND NOT EXISTS (
    SELECT 1 FROM company_organization_assignment_coverage assignment
    WHERE assignment.employment_id = NEW.employment_id
      AND assignment.employee_id = NEW.employee_id
      AND assignment.organization_unit_id = NEW.organization_unit_id
      AND assignment.starts_on <= NEW.starts_on
      AND (
        assignment.ends_on IS NULL
        OR (NEW.ends_on IS NOT NULL AND NEW.ends_on <= assignment.ends_on)
      )
  );

  SELECT RAISE(ABORT, 'organization responsibility overlaps')
  WHERE NEW.is_void = 0 AND EXISTS (
    SELECT 1 FROM company_organization_responsibility_period_versions current
    WHERE current.period_id != NEW.period_id
      AND current.employee_id = NEW.employee_id
      AND current.organization_unit_id = NEW.organization_unit_id
      AND current.responsibility_type = NEW.responsibility_type
      AND current.is_void = 0
      AND current.revision = (
        SELECT max(latest.revision)
        FROM company_organization_responsibility_period_versions latest
        WHERE latest.period_id = current.period_id
      )
      AND (current.ends_on IS NULL OR NEW.starts_on < current.ends_on)
      AND (NEW.ends_on IS NULL OR current.starts_on < NEW.ends_on)
  );
END;
CREATE TRIGGER company_organization_responsibility_period_versions_identity_update
BEFORE UPDATE OF id ON company_organization_responsibility_period_versions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_organization_unit_period_versions
INSERT INTO company_organization_unit_period_versions (id, period_id, revision, organization_unit_id, code, official_name, kind, parent_organization_unit_id, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
SELECT source.id,
       CASE WHEN source.period_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.period_id), source.period_id) END ,
       source.revision,
       source.organization_unit_id,
       source.code,
       source.official_name,
       source.kind,
       source.parent_organization_unit_id,
       source.starts_on,
       source.ends_on,
       source.is_void,
       CASE WHEN source.recorded_by_action_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.recorded_by_action_id), source.recorded_by_action_id) END ,
       source.recorded_at
FROM "_stage_company_organization_unit_period_versions" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_organization_unit_period_versions',
       (SELECT count(*) FROM "_stage_company_organization_unit_period_versions"),
       (SELECT count(*) FROM company_organization_unit_period_versions),
       0,
       0,
       0;
DROP TABLE "_stage_company_organization_unit_period_versions";
CREATE INDEX company_organization_unit_period_versions_unit_idx
  ON company_organization_unit_period_versions(
    organization_unit_id, starts_on, ends_on, period_id, revision
  );
CREATE INDEX company_organization_unit_period_versions_code_idx
  ON company_organization_unit_period_versions(code, starts_on, ends_on, period_id, revision);
CREATE INDEX company_organization_unit_period_versions_parent_idx
  ON company_organization_unit_period_versions(parent_organization_unit_id, starts_on, ends_on);
CREATE TRIGGER company_organization_unit_period_versions_revision_guard
BEFORE INSERT ON company_organization_unit_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is missing or stale')
  WHERE NOT EXISTS (
    SELECT 1
    FROM company_organization_change_operations operation
    JOIN company_organization_lifecycle_states state ON state.id = 1
    WHERE operation.id = NEW.recorded_by_action_id
      AND operation.status = 'PENDING'
      AND operation.applied_count < operation.change_count
      AND state.revision = operation.expected_revision + operation.applied_count
  );

  SELECT RAISE(ABORT, 'organization unit revision is not sequential')
  WHERE NEW.revision != coalesce(
    (
      SELECT max(revision)
      FROM company_organization_unit_period_versions
      WHERE period_id = NEW.period_id
    ),
    0
  ) + 1;

  SELECT RAISE(ABORT, 'organization unit period owner is immutable')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_unit_period_versions previous
    WHERE previous.period_id = NEW.period_id
      AND previous.organization_unit_id != NEW.organization_unit_id
  );

  SELECT RAISE(ABORT, 'organization root requires canonical parent')
  WHERE (NEW.kind = 'COMPANY' AND NEW.parent_organization_unit_id IS NOT NULL)
     OR (NEW.kind != 'COMPANY' AND NEW.parent_organization_unit_id IS NULL);

  SELECT RAISE(ABORT, 'organization unit period overlaps')
  WHERE NEW.is_void = 0 AND EXISTS (
    SELECT 1 FROM company_organization_unit_period_versions current
    WHERE current.period_id != NEW.period_id
      AND current.organization_unit_id = NEW.organization_unit_id
      AND current.is_void = 0
      AND current.revision = (
        SELECT max(latest.revision)
        FROM company_organization_unit_period_versions latest
        WHERE latest.period_id = current.period_id
      )
      AND (current.ends_on IS NULL OR NEW.starts_on < current.ends_on)
      AND (NEW.ends_on IS NULL OR current.starts_on < NEW.ends_on)
  );

  SELECT RAISE(ABORT, 'organization unit code overlaps')
  WHERE NEW.is_void = 0 AND EXISTS (
    SELECT 1 FROM company_organization_unit_period_versions current
    WHERE current.period_id != NEW.period_id
      AND current.organization_unit_id != NEW.organization_unit_id
      AND current.code = NEW.code
      AND current.is_void = 0
      AND current.revision = (
        SELECT max(latest.revision)
        FROM company_organization_unit_period_versions latest
        WHERE latest.period_id = current.period_id
      )
      AND (current.ends_on IS NULL OR NEW.starts_on < current.ends_on)
      AND (NEW.ends_on IS NULL OR current.starts_on < NEW.ends_on)
  );

  SELECT RAISE(ABORT, 'company root period overlaps')
  WHERE NEW.is_void = 0 AND NEW.kind = 'COMPANY' AND EXISTS (
    SELECT 1 FROM company_organization_unit_period_versions current
    WHERE current.period_id != NEW.period_id
      AND current.kind = 'COMPANY'
      AND current.is_void = 0
      AND current.revision = (
        SELECT max(latest.revision)
        FROM company_organization_unit_period_versions latest
        WHERE latest.period_id = current.period_id
      )
      AND (current.ends_on IS NULL OR NEW.starts_on < current.ends_on)
      AND (NEW.ends_on IS NULL OR current.starts_on < NEW.ends_on)
  );
END;
CREATE TRIGGER company_organization_unit_period_versions_immutable_delete
BEFORE DELETE ON company_organization_unit_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization unit periods are append only');
END;
CREATE TRIGGER company_organization_unit_period_versions_immutable_update
BEFORE UPDATE ON company_organization_unit_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization unit periods are append only');
END;
CREATE TRIGGER company_organization_unit_period_versions_revision_state
AFTER INSERT ON company_organization_unit_period_versions
BEGIN
  UPDATE company_organization_change_operations
  SET applied_count = applied_count + 1
  WHERE id = NEW.recorded_by_action_id;

  UPDATE company_organization_lifecycle_states
  SET revision = revision + 1, updated_at = max(updated_at, NEW.recorded_at)
  WHERE id = 1;
END;
CREATE TRIGGER company_organization_unit_period_versions_identity_update
BEFORE UPDATE OF id ON company_organization_unit_period_versions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_personnel_action_requests
INSERT INTO company_personnel_action_requests (id, application_id, target_employee_id, kind, payload_json, requested_by_employee_id, base_employee_revision, base_organization_revision, created_at, applied_action_id, withdrawn_at, withdrawn_by_employee_id, system_proposal_series_id, subject_snapshot_json, target_department_code, payload_fingerprint, base_company_revision)
SELECT map.new_id,
       source.application_id,
       CASE WHEN source.target_employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.target_employee_id), source.target_employee_id) END ,
       source.kind,
       CASE WHEN json_valid(source.payload_json) AND json_type(source.payload_json) = 'object' THEN json_replace(source.payload_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.accountId')), json_extract(source.payload_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.actorAccountId')), json_extract(source.payload_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.release.actorAccountId')), json_extract(source.payload_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.employeeId')), json_extract(source.payload_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.managerEmployeeId')), json_extract(source.payload_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.targetEmployeeId')), json_extract(source.payload_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.requestedByEmployeeId')), json_extract(source.payload_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.requestedApproverId')), json_extract(source.payload_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.applicantId')), json_extract(source.payload_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.holderId')), json_extract(source.payload_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.personId')), json_extract(source.payload_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.employmentId')), json_extract(source.payload_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.periodId')), json_extract(source.payload_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.resourceId')), json_extract(source.payload_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.existingResourceId')), json_extract(source.payload_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.scopeId')), json_extract(source.payload_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.authorityScopeId')), json_extract(source.payload_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.responsibilityId')), json_extract(source.payload_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.collectiveBodyId')), json_extract(source.payload_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.organizationalOfficeId')), json_extract(source.payload_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.positionId')), json_extract(source.payload_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.jobId')), json_extract(source.payload_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.payload_json, '$.siteId')), json_extract(source.payload_json, '$.siteId'))) ELSE source.payload_json END ,
       CASE WHEN source.requested_by_employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.requested_by_employee_id), source.requested_by_employee_id) END ,
       source.base_employee_revision,
       source.base_organization_revision,
       source.created_at,
       CASE WHEN source.applied_action_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.applied_action_id), source.applied_action_id) END ,
       source.withdrawn_at,
       CASE WHEN source.withdrawn_by_employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.withdrawn_by_employee_id), source.withdrawn_by_employee_id) END ,
       source.system_proposal_series_id,
       CASE WHEN json_valid(source.subject_snapshot_json) AND json_type(source.subject_snapshot_json) = 'object' THEN json_replace(source.subject_snapshot_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.subject_snapshot_json, '$.accountId')), json_extract(source.subject_snapshot_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.subject_snapshot_json, '$.actorAccountId')), json_extract(source.subject_snapshot_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.subject_snapshot_json, '$.release.actorAccountId')), json_extract(source.subject_snapshot_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.subject_snapshot_json, '$.employeeId')), json_extract(source.subject_snapshot_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.subject_snapshot_json, '$.managerEmployeeId')), json_extract(source.subject_snapshot_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.subject_snapshot_json, '$.targetEmployeeId')), json_extract(source.subject_snapshot_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.subject_snapshot_json, '$.requestedByEmployeeId')), json_extract(source.subject_snapshot_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.subject_snapshot_json, '$.requestedApproverId')), json_extract(source.subject_snapshot_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.subject_snapshot_json, '$.applicantId')), json_extract(source.subject_snapshot_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.subject_snapshot_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.subject_snapshot_json, '$.holderId')), json_extract(source.subject_snapshot_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.subject_snapshot_json, '$.personId')), json_extract(source.subject_snapshot_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.subject_snapshot_json, '$.employmentId')), json_extract(source.subject_snapshot_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.subject_snapshot_json, '$.periodId')), json_extract(source.subject_snapshot_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.subject_snapshot_json, '$.resourceId')), json_extract(source.subject_snapshot_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.subject_snapshot_json, '$.existingResourceId')), json_extract(source.subject_snapshot_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.subject_snapshot_json, '$.scopeId')), json_extract(source.subject_snapshot_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.subject_snapshot_json, '$.authorityScopeId')), json_extract(source.subject_snapshot_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.subject_snapshot_json, '$.responsibilityId')), json_extract(source.subject_snapshot_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.subject_snapshot_json, '$.collectiveBodyId')), json_extract(source.subject_snapshot_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.subject_snapshot_json, '$.organizationalOfficeId')), json_extract(source.subject_snapshot_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.subject_snapshot_json, '$.positionId')), json_extract(source.subject_snapshot_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.subject_snapshot_json, '$.jobId')), json_extract(source.subject_snapshot_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.subject_snapshot_json, '$.siteId')), json_extract(source.subject_snapshot_json, '$.siteId'))) ELSE source.subject_snapshot_json END ,
       source.target_department_code,
       source.payload_fingerprint,
       source.base_company_revision
FROM "_stage_company_personnel_action_requests" source
INNER JOIN _company_personnel_action_requests_id_map map ON map.old_id = source.id;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_personnel_action_requests',
       (SELECT count(*) FROM "_stage_company_personnel_action_requests"),
       (SELECT count(*) FROM company_personnel_action_requests),
       0,
       (SELECT count(*) FROM company_personnel_action_requests WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_company_personnel_action_requests";
CREATE INDEX idx_company_personnel_action_requests_target
  ON company_personnel_action_requests(target_employee_id, created_at, id);
CREATE UNIQUE INDEX uq_company_personnel_action_requests_applied_action
  ON company_personnel_action_requests(applied_action_id)
  WHERE applied_action_id IS NOT NULL;
CREATE UNIQUE INDEX uq_company_personnel_action_requests_system_series
  ON company_personnel_action_requests(system_proposal_series_id)
  WHERE system_proposal_series_id IS NOT NULL;
CREATE TRIGGER company_personnel_action_requests_immutable_proposal
BEFORE UPDATE ON company_personnel_action_requests
WHEN
  NEW.id IS NOT OLD.id
  OR NEW.application_id IS NOT OLD.application_id
  OR NEW.system_proposal_series_id IS NOT OLD.system_proposal_series_id
  OR NEW.kind IS NOT OLD.kind
  OR NEW.payload_json IS NOT OLD.payload_json
  OR NEW.payload_fingerprint IS NOT OLD.payload_fingerprint
  OR NEW.requested_by_employee_id IS NOT OLD.requested_by_employee_id
  OR NEW.base_employee_revision IS NOT OLD.base_employee_revision
  OR NEW.base_organization_revision IS NOT OLD.base_organization_revision
  OR NEW.created_at IS NOT OLD.created_at
  OR NEW.subject_snapshot_json IS NOT OLD.subject_snapshot_json
  OR NEW.target_department_code IS NOT OLD.target_department_code
  OR OLD.withdrawn_at IS NOT NULL
  OR OLD.applied_action_id IS NOT NULL
  OR (NEW.withdrawn_at IS NOT NULL AND NEW.applied_action_id IS NOT NULL)
BEGIN
  SELECT RAISE(ABORT, 'personnel action request proposal is immutable');
END;
CREATE TRIGGER company_personnel_action_requests_system_proposal_insert
BEFORE INSERT ON company_personnel_action_requests
WHEN
  NEW.system_proposal_series_id IS NULL
  OR NEW.payload_fingerprint IS NULL
  OR NOT EXISTS (
    SELECT 1
    FROM system_proposal_numbers number
    JOIN system_proposal_series series ON series.id = number.series_id
    WHERE number.number = NEW.application_id
      AND number.series_id = NEW.system_proposal_series_id
      AND series.procedure_key = 'personnel_action_request'
  )
  OR NOT EXISTS (
    SELECT 1
    FROM system_proposals proposal
    WHERE proposal.series_id = NEW.system_proposal_series_id
      AND proposal.body_json = NEW.payload_json
  )
BEGIN
  SELECT RAISE(ABORT, 'personnel action requires matching System proposal');
END;

-- company_personnel_actions
INSERT INTO company_personnel_actions (id, employee_id, kind, event_on, recorded_at, recorded_by_account_id, requested_by_employee_id, source_type, source_application_id, corrects_action_id, operation_id, payload_fingerprint, summary_json, legacy_id)
SELECT map.new_id,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.kind,
       source.event_on,
       source.recorded_at,
       CASE WHEN source.recorded_by_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.recorded_by_account_id), source.recorded_by_account_id) END ,
       CASE WHEN source.requested_by_employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.requested_by_employee_id), source.requested_by_employee_id) END ,
       source.source_type,
       source.source_application_id,
       CASE WHEN source.corrects_action_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.corrects_action_id), source.corrects_action_id) END ,
       CASE WHEN source.operation_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.operation_id), source.operation_id) END ,
       source.payload_fingerprint,
       CASE WHEN json_valid(source.summary_json) AND json_type(source.summary_json) = 'object' THEN json_replace(source.summary_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.summary_json, '$.accountId')), json_extract(source.summary_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.summary_json, '$.actorAccountId')), json_extract(source.summary_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.summary_json, '$.release.actorAccountId')), json_extract(source.summary_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.summary_json, '$.employeeId')), json_extract(source.summary_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.summary_json, '$.managerEmployeeId')), json_extract(source.summary_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.summary_json, '$.targetEmployeeId')), json_extract(source.summary_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.summary_json, '$.requestedByEmployeeId')), json_extract(source.summary_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.summary_json, '$.requestedApproverId')), json_extract(source.summary_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.summary_json, '$.applicantId')), json_extract(source.summary_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.summary_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.summary_json, '$.holderId')), json_extract(source.summary_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.summary_json, '$.personId')), json_extract(source.summary_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.summary_json, '$.employmentId')), json_extract(source.summary_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.summary_json, '$.periodId')), json_extract(source.summary_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.summary_json, '$.resourceId')), json_extract(source.summary_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.summary_json, '$.existingResourceId')), json_extract(source.summary_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.summary_json, '$.scopeId')), json_extract(source.summary_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.summary_json, '$.authorityScopeId')), json_extract(source.summary_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.summary_json, '$.responsibilityId')), json_extract(source.summary_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.summary_json, '$.collectiveBodyId')), json_extract(source.summary_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.summary_json, '$.organizationalOfficeId')), json_extract(source.summary_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.summary_json, '$.positionId')), json_extract(source.summary_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.summary_json, '$.jobId')), json_extract(source.summary_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.summary_json, '$.siteId')), json_extract(source.summary_json, '$.siteId'))) ELSE source.summary_json END ,
       CASE WHEN map.old_id IS NOT map.new_id THEN source.id END
FROM "_stage_company_personnel_actions" source
INNER JOIN _company_personnel_actions_id_map map ON map.old_id = source.id;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_personnel_actions',
       (SELECT count(*) FROM "_stage_company_personnel_actions"),
       (SELECT count(*) FROM company_personnel_actions),
       0,
       (SELECT count(*) FROM company_personnel_actions WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_company_personnel_actions";
CREATE INDEX idx_company_personnel_actions_employee_timeline
  ON company_personnel_actions(employee_id, event_on, recorded_at, id);
CREATE UNIQUE INDEX uq_company_personnel_actions_correction
  ON company_personnel_actions(corrects_action_id)
  WHERE corrects_action_id IS NOT NULL;
CREATE UNIQUE INDEX uq_company_personnel_actions_source_application
  ON company_personnel_actions(source_application_id)
  WHERE source_application_id IS NOT NULL;
CREATE TRIGGER company_personnel_actions_no_delete
BEFORE DELETE ON company_personnel_actions
BEGIN
  SELECT RAISE(ABORT, 'company personnel actions are append only');
END;
CREATE TRIGGER company_personnel_actions_no_update
BEFORE UPDATE ON company_personnel_actions
BEGIN
  SELECT RAISE(ABORT, 'company personnel actions are append only');
END;
CREATE TRIGGER company_personnel_actions_legacy_id_insert
BEFORE INSERT ON company_personnel_actions
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER company_personnel_actions_identity_update
BEFORE UPDATE OF id, legacy_id ON company_personnel_actions
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_personnel_annotations
INSERT INTO company_personnel_annotations (id, legacy_id, employee_id, kind, effective_date, from_department_code, to_department_code, note, created_at)
SELECT source.id,
       source.legacy_id,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.kind,
       source.effective_date,
       source.from_department_code,
       source.to_department_code,
       source.note,
       source.created_at
FROM "_stage_company_personnel_annotations" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_personnel_annotations',
       (SELECT count(*) FROM "_stage_company_personnel_annotations"),
       (SELECT count(*) FROM company_personnel_annotations),
       0,
       0,
       0;
DROP TABLE "_stage_company_personnel_annotations";
CREATE INDEX idx_company_personnel_annotations_employee ON company_personnel_annotations(employee_id);
CREATE INDEX idx_company_personnel_annotations_kind ON company_personnel_annotations(kind);
CREATE TRIGGER company_personnel_annotations_no_update
BEFORE UPDATE ON company_personnel_annotations
BEGIN
  SELECT RAISE(ABORT, 'company personnel annotations are immutable');
END;
CREATE TRIGGER company_personnel_annotations_no_delete
BEFORE DELETE ON company_personnel_annotations
BEGIN
  SELECT RAISE(ABORT, 'company personnel annotations are immutable');
END;
CREATE TRIGGER company_personnel_annotations_no_replace
BEFORE INSERT ON company_personnel_annotations
WHEN EXISTS (SELECT 1 FROM company_personnel_annotations WHERE id = NEW.id)
BEGIN
  SELECT RAISE(ABORT, 'company personnel annotations are immutable');
END;
CREATE TRIGGER company_personnel_annotations_legacy_id_insert
BEFORE INSERT ON company_personnel_annotations
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER company_personnel_annotations_identity_update
BEFORE UPDATE OF id, legacy_id ON company_personnel_annotations
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_personnel_reporting_bindings
INSERT INTO company_personnel_reporting_bindings (resource_id, organization_id, resource_type, employee_id, employment_id, organization_unit_id, assignment_type, recorded_by_action_id, recorded_by_adoption_id)
SELECT CASE WHEN source.resource_type = 'employee' THEN CASE WHEN source.resource_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.resource_id), source.resource_id) END ELSE CASE WHEN source.resource_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.resource_id), source.resource_id) END END ,
       source.organization_id,
       source.resource_type,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       CASE WHEN source.employment_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.employment_id), source.employment_id) END ,
       source.organization_unit_id,
       source.assignment_type,
       CASE WHEN source.recorded_by_action_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.recorded_by_action_id), source.recorded_by_action_id) END ,
       source.recorded_by_adoption_id
FROM "_stage_company_personnel_reporting_bindings" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_personnel_reporting_bindings',
       (SELECT count(*) FROM "_stage_company_personnel_reporting_bindings"),
       (SELECT count(*) FROM company_personnel_reporting_bindings),
       0,
       (SELECT count(*) FROM company_personnel_reporting_bindings WHERE NOT (length(resource_id) = 36 AND resource_id NOT GLOB '*[^0-9a-f-]*' AND substr(resource_id, 9, 1) = '-' AND substr(resource_id, 14, 1) = '-' AND substr(resource_id, 19, 1) = '-' AND substr(resource_id, 24, 1) = '-' AND length(replace(resource_id, '-', '')) = 32 AND substr(resource_id, 15, 1) GLOB '[1-8]' AND substr(resource_id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_company_personnel_reporting_bindings";
CREATE TRIGGER company_personnel_reporting_binding_update_guard
BEFORE UPDATE ON company_personnel_reporting_bindings
BEGIN
  SELECT RAISE(ABORT, 'company personnel reporting binding is immutable');
END;
CREATE TRIGGER company_personnel_reporting_binding_delete_guard
BEFORE DELETE ON company_personnel_reporting_bindings
BEGIN
  SELECT RAISE(ABORT, 'company personnel reporting binding is immutable');
END;
CREATE TRIGGER company_personnel_reporting_binding_insert_guard
BEFORE INSERT ON company_personnel_reporting_bindings
BEGIN
  SELECT RAISE(ABORT, 'company personnel reporting owner does not match')
  WHERE NOT EXISTS (
    SELECT 1 FROM company_resource_heads resource
    JOIN company_employments employment ON employment.id = NEW.employment_id
    WHERE resource.organization_id = NEW.organization_id AND resource.resource_type = 'reporting-relation'
      AND resource.resource_id = NEW.resource_id AND employment.employee_id = NEW.employee_id
      AND json_extract(resource.attributes_json, '$.employeeId') = NEW.employee_id
      AND json_extract(resource.attributes_json, '$.organizationUnitId') = NEW.organization_unit_id
  );
END;
CREATE TRIGGER company_personnel_reporting_coverage_insert_guard
AFTER INSERT ON company_personnel_reporting_bindings
BEGIN
  SELECT RAISE(ABORT, 'company personnel reporting assignment period is not covered')
  WHERE EXISTS (
    SELECT 1 FROM company_personnel_reporting_periods reporting
    WHERE NOT EXISTS (
      SELECT 1 FROM company_personnel_reporting_assignment_coverage assignment
      WHERE assignment.employee_id = reporting.employee_id AND assignment.employment_id = reporting.employment_id
        AND assignment.organization_unit_id = reporting.organization_unit_id
        AND assignment.assignment_type = reporting.assignment_type
        AND assignment.starts_on <= reporting.starts_on
        AND (assignment.ends_on IS NULL OR
          (reporting.ends_on IS NOT NULL AND reporting.ends_on <= assignment.ends_on))
    )
  );
END;

-- company_profile_change_receipts
INSERT INTO company_profile_change_receipts (id, organization_id, command_id, fingerprint, actor_account_id, organization_revision, declaration_json, source_json, recorded_at)
SELECT source.id,
       source.organization_id,
       source.command_id,
       source.fingerprint,
       CASE WHEN source.actor_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.actor_account_id), source.actor_account_id) END ,
       source.organization_revision,
       CASE WHEN json_valid(source.declaration_json) AND json_type(source.declaration_json) = 'object' THEN json_replace(source.declaration_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.accountId')), json_extract(source.declaration_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.actorAccountId')), json_extract(source.declaration_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.release.actorAccountId')), json_extract(source.declaration_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.employeeId')), json_extract(source.declaration_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.managerEmployeeId')), json_extract(source.declaration_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.targetEmployeeId')), json_extract(source.declaration_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.requestedByEmployeeId')), json_extract(source.declaration_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.requestedApproverId')), json_extract(source.declaration_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.applicantId')), json_extract(source.declaration_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.holderId')), json_extract(source.declaration_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.personId')), json_extract(source.declaration_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.employmentId')), json_extract(source.declaration_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.periodId')), json_extract(source.declaration_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.resourceId')), json_extract(source.declaration_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.existingResourceId')), json_extract(source.declaration_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.scopeId')), json_extract(source.declaration_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.authorityScopeId')), json_extract(source.declaration_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.responsibilityId')), json_extract(source.declaration_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.collectiveBodyId')), json_extract(source.declaration_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.organizationalOfficeId')), json_extract(source.declaration_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.positionId')), json_extract(source.declaration_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.jobId')), json_extract(source.declaration_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.declaration_json, '$.siteId')), json_extract(source.declaration_json, '$.siteId'))) ELSE source.declaration_json END ,
       source.source_json,
       source.recorded_at
FROM "_stage_company_profile_change_receipts" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_profile_change_receipts',
       (SELECT count(*) FROM "_stage_company_profile_change_receipts"),
       (SELECT count(*) FROM company_profile_change_receipts),
       0,
       0,
       0;
DROP TABLE "_stage_company_profile_change_receipts";
CREATE TRIGGER company_profile_change_receipts_immutable_update
BEFORE UPDATE ON company_profile_change_receipts
BEGIN
  SELECT RAISE(ABORT, 'company profile change receipt is immutable');
END;
CREATE TRIGGER company_profile_change_receipts_immutable_delete
BEFORE DELETE ON company_profile_change_receipts
BEGIN
  SELECT RAISE(ABORT, 'company profile change receipt is immutable');
END;
CREATE TRIGGER company_profile_change_receipts_identity_update
BEFORE UPDATE OF id ON company_profile_change_receipts
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_resource_revisions
INSERT INTO company_resource_revisions (id, organization_id, resource_type, resource_id, revision, organization_revision, state, effective_from, effective_to, attributes_json, command_id, actor_account_id, reason, recorded_at, evidence_references_json, corrects_revision)
SELECT source.id,
       source.organization_id,
       source.resource_type,
       CASE WHEN source.resource_type = 'employee' THEN CASE WHEN source.resource_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.resource_id), source.resource_id) END ELSE CASE WHEN source.resource_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.resource_id), source.resource_id) END END ,
       source.revision,
       source.organization_revision,
       source.state,
       source.effective_from,
       source.effective_to,
       CASE WHEN json_valid(source.attributes_json) AND json_type(source.attributes_json) = 'object' THEN json_replace(source.attributes_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.accountId')), json_extract(source.attributes_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.actorAccountId')), json_extract(source.attributes_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.release.actorAccountId')), json_extract(source.attributes_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.employeeId')), json_extract(source.attributes_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.managerEmployeeId')), json_extract(source.attributes_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.targetEmployeeId')), json_extract(source.attributes_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.requestedByEmployeeId')), json_extract(source.attributes_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.requestedApproverId')), json_extract(source.attributes_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.applicantId')), json_extract(source.attributes_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.holderId')), json_extract(source.attributes_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.personId')), json_extract(source.attributes_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.employmentId')), json_extract(source.attributes_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.periodId')), json_extract(source.attributes_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.resourceId')), json_extract(source.attributes_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.existingResourceId')), json_extract(source.attributes_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.scopeId')), json_extract(source.attributes_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.authorityScopeId')), json_extract(source.attributes_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.responsibilityId')), json_extract(source.attributes_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.collectiveBodyId')), json_extract(source.attributes_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.organizationalOfficeId')), json_extract(source.attributes_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.positionId')), json_extract(source.attributes_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.jobId')), json_extract(source.attributes_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.attributes_json, '$.siteId')), json_extract(source.attributes_json, '$.siteId'))) ELSE source.attributes_json END ,
       source.command_id,
       CASE WHEN source.actor_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.actor_account_id), source.actor_account_id) END ,
       source.reason,
       source.recorded_at,
       CASE WHEN json_valid(source.evidence_references_json) AND json_type(source.evidence_references_json) = 'object' THEN json_replace(source.evidence_references_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.accountId')), json_extract(source.evidence_references_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.actorAccountId')), json_extract(source.evidence_references_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.release.actorAccountId')), json_extract(source.evidence_references_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.employeeId')), json_extract(source.evidence_references_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.managerEmployeeId')), json_extract(source.evidence_references_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.targetEmployeeId')), json_extract(source.evidence_references_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.requestedByEmployeeId')), json_extract(source.evidence_references_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.requestedApproverId')), json_extract(source.evidence_references_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.applicantId')), json_extract(source.evidence_references_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.holderId')), json_extract(source.evidence_references_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.personId')), json_extract(source.evidence_references_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.employmentId')), json_extract(source.evidence_references_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.periodId')), json_extract(source.evidence_references_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.resourceId')), json_extract(source.evidence_references_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.existingResourceId')), json_extract(source.evidence_references_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.scopeId')), json_extract(source.evidence_references_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.authorityScopeId')), json_extract(source.evidence_references_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.responsibilityId')), json_extract(source.evidence_references_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.collectiveBodyId')), json_extract(source.evidence_references_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.organizationalOfficeId')), json_extract(source.evidence_references_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.positionId')), json_extract(source.evidence_references_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.jobId')), json_extract(source.evidence_references_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.evidence_references_json, '$.siteId')), json_extract(source.evidence_references_json, '$.siteId'))) ELSE source.evidence_references_json END ,
       source.corrects_revision
FROM "_stage_company_resource_revisions" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_resource_revisions',
       (SELECT count(*) FROM "_stage_company_resource_revisions"),
       (SELECT count(*) FROM company_resource_revisions),
       0,
       0,
       0;
DROP TABLE "_stage_company_resource_revisions";
CREATE INDEX company_resource_revisions_command_idx
  ON company_resource_revisions (organization_id, command_id);
CREATE INDEX company_resource_revisions_org_revision_idx
  ON company_resource_revisions (organization_id, organization_revision, resource_type, resource_id);
CREATE INDEX `company_resource_revisions_account_link_idx`
  ON `company_resource_revisions` (`organization_id`, `resource_id`)
  WHERE `resource_type` = 'account-employee-link';
CREATE TRIGGER company_resource_revisions_expected_revision
BEFORE INSERT ON company_resource_revisions
WHEN NEW.revision <> COALESCE(
  (
    SELECT revision
    FROM company_resource_heads
    WHERE organization_id = NEW.organization_id
      AND resource_type = NEW.resource_type
      AND resource_id = NEW.resource_id
  ),
  0
) + 1
BEGIN
  SELECT RAISE(ABORT, 'company_resource_revision_conflict');
END;
CREATE TRIGGER company_resource_revisions_no_delete
BEFORE DELETE ON company_resource_revisions
BEGIN
  SELECT RAISE(ABORT, 'company_resource_revisions_are_append_only');
END;
CREATE TRIGGER company_resource_revisions_no_update
BEFORE UPDATE ON company_resource_revisions
BEGIN
  SELECT RAISE(ABORT, 'company_resource_revisions_are_append_only');
END;
CREATE TRIGGER company_workforce_resource_reference_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.state = 'active' AND (
  (NEW.resource_type = 'employee' AND NOT EXISTS (
    SELECT 1 FROM company_resource_heads AS person
    WHERE person.organization_id = NEW.organization_id
      AND person.resource_type = 'person'
      AND person.resource_id = json_extract(NEW.attributes_json, '$.personId')
      AND person.state = 'active'
  ))
  OR (NEW.resource_type IN (
    'employment', 'assignment', 'reporting-relation', 'office-assignment',
    'organizational-authority', 'account-employee-link'
  ) AND NOT EXISTS (
    SELECT 1 FROM company_resource_heads AS employee
    WHERE employee.organization_id = NEW.organization_id
      AND employee.resource_type = 'employee'
      AND employee.resource_id = json_extract(NEW.attributes_json, '$.employeeId')
      AND employee.state = 'active'
  ))
  OR (NEW.resource_type = 'reporting-relation' AND NOT EXISTS (
    SELECT 1 FROM company_resource_heads AS manager
    WHERE manager.organization_id = NEW.organization_id
      AND manager.resource_type = 'employee'
      AND manager.resource_id = json_extract(NEW.attributes_json, '$.managerEmployeeId')
      AND manager.state = 'active'
  ))
  OR (NEW.resource_type IN (
    'assignment', 'office-assignment', 'organizational-authority'
  ) AND NOT EXISTS (
    SELECT 1 FROM company_resource_heads AS employment
    WHERE employment.organization_id = NEW.organization_id
      AND employment.resource_type = 'employment'
      AND employment.resource_id = json_extract(NEW.attributes_json, '$.employmentId')
      AND json_extract(employment.attributes_json, '$.employeeId') =
          json_extract(NEW.attributes_json, '$.employeeId')
      AND employment.state = 'active'
  ))
)
BEGIN
  SELECT RAISE(ABORT, 'company_workforce_reference_not_found');
END;
CREATE TRIGGER company_workforce_resource_owner_guard
BEFORE INSERT ON company_resource_revisions
WHEN EXISTS (
  SELECT 1 FROM company_resource_heads AS previous
  WHERE previous.organization_id = NEW.organization_id
    AND previous.resource_type = NEW.resource_type
    AND previous.resource_id = NEW.resource_id
    AND (
      (NEW.resource_type = 'employee' AND
       json_extract(previous.attributes_json, '$.personId') IS NOT
       json_extract(NEW.attributes_json, '$.personId'))
      OR (NEW.resource_type = 'employment' AND
          json_extract(previous.attributes_json, '$.employeeId') IS NOT
          json_extract(NEW.attributes_json, '$.employeeId'))
    )
)
BEGIN
  SELECT RAISE(ABORT, 'company_workforce_owner_immutable');
END;
CREATE TRIGGER company_workforce_resource_void_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.state = 'void'
  AND NEW.resource_type IN ('person', 'employee', 'employment')
  AND EXISTS (
    SELECT 1 FROM company_resource_heads AS dependent
    WHERE dependent.organization_id = NEW.organization_id
      AND dependent.state = 'active'
      AND (
        (NEW.resource_type = 'person' AND dependent.resource_type = 'employee'
         AND json_extract(dependent.attributes_json, '$.personId') = NEW.resource_id)
        OR (NEW.resource_type = 'employee' AND (
          (dependent.resource_type IN (
            'employment', 'assignment', 'reporting-relation', 'office-assignment',
            'collective-body-membership', 'organizational-authority', 'account-employee-link'
          ) AND json_extract(dependent.attributes_json, '$.employeeId') = NEW.resource_id)
          OR (dependent.resource_type = 'reporting-relation'
              AND json_extract(dependent.attributes_json, '$.managerEmployeeId') = NEW.resource_id)
          OR (dependent.resource_type = 'responsibility-assignment'
              AND json_extract(dependent.attributes_json, '$.holderType') = 'employee'
              AND json_extract(dependent.attributes_json, '$.holderId') = NEW.resource_id)
        ))
        OR (NEW.resource_type = 'employment' AND dependent.resource_type IN (
          'assignment', 'office-assignment', 'organizational-authority'
        ) AND json_extract(dependent.attributes_json, '$.employmentId') = NEW.resource_id)
      )
  )
BEGIN
  SELECT RAISE(ABORT, 'company_workforce_resource_is_in_use');
END;
CREATE TRIGGER company_account_employee_resource_owner_guard
BEFORE INSERT ON company_resource_revisions WHEN NEW.resource_type = 'account-employee-link'
BEGIN
  SELECT RAISE(ABORT, 'company account link owner is immutable') WHERE
    NEW.organization_id != 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'
    OR EXISTS (SELECT 1 FROM company_resource_heads previous
      WHERE previous.organization_id = NEW.organization_id AND previous.resource_type = NEW.resource_type
        AND (previous.resource_id = NEW.resource_id AND (
          json_extract(previous.attributes_json, '$.accountId') IS NOT json_extract(NEW.attributes_json, '$.accountId')
          OR json_extract(previous.attributes_json, '$.employeeId') IS NOT json_extract(NEW.attributes_json, '$.employeeId'))
        OR previous.resource_id != NEW.resource_id AND (
          json_extract(previous.attributes_json, '$.accountId') = json_extract(NEW.attributes_json, '$.accountId')
          OR json_extract(previous.attributes_json, '$.employeeId') = json_extract(NEW.attributes_json, '$.employeeId'))))
    OR EXISTS (SELECT 1 FROM company_account_employee_links original WHERE
      original.account_id = json_extract(NEW.attributes_json, '$.accountId') AND original.employee_id IS NOT json_extract(NEW.attributes_json, '$.employeeId')
      OR original.employee_id = json_extract(NEW.attributes_json, '$.employeeId') AND original.account_id IS NOT json_extract(NEW.attributes_json, '$.accountId'));
  SELECT RAISE(ABORT, 'company account link account is missing') WHERE NOT EXISTS (
    SELECT 1 FROM system_accounts WHERE id = json_extract(NEW.attributes_json, '$.accountId')
  );
END;
CREATE TRIGGER company_position_job_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'position'
  AND NEW.state = 'active'
  AND json_extract(NEW.attributes_json, '$.jobId') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM company_resource_revisions AS job
    WHERE job.organization_id = NEW.organization_id
      AND job.resource_type = 'job'
      AND job.resource_id = json_extract(NEW.attributes_json, '$.jobId')
      AND job.state = 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'company_position_job_not_found');
END;
CREATE TRIGGER company_office_assignment_reference_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'office-assignment'
  AND NEW.state = 'active'
  AND (
    NOT EXISTS (
      SELECT 1 FROM company_resource_revisions AS employee
      WHERE employee.organization_id = NEW.organization_id
        AND employee.resource_type = 'employee'
        AND employee.resource_id = json_extract(NEW.attributes_json, '$.employeeId')
        AND employee.state = 'active'
    )
    OR NOT EXISTS (
      SELECT 1 FROM company_resource_revisions AS employment
      WHERE employment.organization_id = NEW.organization_id
        AND employment.resource_type = 'employment'
        AND employment.resource_id = json_extract(NEW.attributes_json, '$.employmentId')
        AND employment.state = 'active'
    )
    OR NOT EXISTS (
      SELECT 1 FROM company_resource_revisions AS office
      WHERE office.organization_id = NEW.organization_id
        AND office.resource_type = 'organizational-office'
        AND office.resource_id = json_extract(NEW.attributes_json, '$.organizationalOfficeId')
        AND office.state = 'active'
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'company_office_assignment_reference_not_found');
END;
CREATE TRIGGER company_responsibility_assignment_reference_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'responsibility-assignment'
  AND NEW.state = 'active'
  AND (
    NOT EXISTS (
      SELECT 1 FROM company_resource_revisions AS responsibility
      WHERE responsibility.organization_id = NEW.organization_id
        AND responsibility.resource_type = 'responsibility'
        AND responsibility.resource_id = json_extract(NEW.attributes_json, '$.responsibilityId')
        AND responsibility.state = 'active'
    )
    OR (
      json_extract(NEW.attributes_json, '$.authorityScopeId') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM company_resource_revisions AS scope
        WHERE scope.organization_id = NEW.organization_id
          AND scope.resource_type = 'authority-scope'
          AND scope.resource_id = json_extract(NEW.attributes_json, '$.authorityScopeId')
          AND scope.state = 'active'
      )
    )
    OR NOT EXISTS (
      SELECT 1 FROM company_resource_revisions AS holder
      WHERE holder.organization_id = NEW.organization_id
        AND holder.resource_type = json_extract(NEW.attributes_json, '$.holderType')
        AND holder.resource_id = json_extract(NEW.attributes_json, '$.holderId')
        AND holder.state = 'active'
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'company_responsibility_assignment_reference_not_found');
END;
CREATE TRIGGER company_collective_body_membership_reference_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'collective-body-membership'
  AND NEW.state = 'active'
  AND (
    NOT EXISTS (
      SELECT 1 FROM company_resource_revisions AS body
      WHERE body.organization_id = NEW.organization_id
        AND body.resource_type = 'collective-body'
        AND body.resource_id = json_extract(NEW.attributes_json, '$.collectiveBodyId')
        AND body.state = 'active'
    )
    OR NOT EXISTS (
      SELECT 1 FROM company_resource_revisions AS employee
      WHERE employee.organization_id = NEW.organization_id
        AND employee.resource_type = 'employee'
        AND employee.resource_id = json_extract(NEW.attributes_json, '$.employeeId')
        AND employee.state = 'active'
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'company_collective_body_membership_reference_not_found');
END;
CREATE TRIGGER company_organizational_authority_scope_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'organizational-authority'
  AND NEW.state = 'active'
  AND json_extract(NEW.attributes_json, '$.scopeType') = 'authority-scope'
  AND NOT EXISTS (
    SELECT 1 FROM company_resource_revisions AS scope
    WHERE scope.organization_id = NEW.organization_id
      AND scope.resource_type = 'authority-scope'
      AND scope.resource_id = json_extract(NEW.attributes_json, '$.scopeId')
      AND scope.state = 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'company_organizational_authority_scope_not_found');
END;
CREATE TRIGGER company_organizational_office_reference_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'organizational-office'
  AND NEW.state = 'active'
  AND (
    NOT EXISTS (
      SELECT 1
      FROM company_resource_revisions AS unit
      WHERE unit.organization_id = NEW.organization_id
        AND unit.resource_type = 'organization-unit'
        AND json_extract(unit.attributes_json, '$.organizationUnitId') = json_extract(NEW.attributes_json, '$.organizationUnitId')
        AND unit.state = 'active'
    )
    OR NOT EXISTS (
      SELECT 1
      FROM company_resource_revisions AS position
      WHERE position.organization_id = NEW.organization_id
        AND position.resource_type = 'position'
        AND position.resource_id = json_extract(NEW.attributes_json, '$.positionId')
        AND position.state = 'active'
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'company_governance_organization_reference_invalid');
END;
CREATE TRIGGER company_authority_scope_reference_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'authority-scope'
  AND NEW.state = 'active'
  AND json_extract(NEW.attributes_json, '$.scopeType') IN (
    'organization-unit', 'legal-entity', 'site', 'workplace'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM company_resource_revisions AS scoped
    WHERE scoped.organization_id = NEW.organization_id
      AND scoped.resource_type = json_extract(NEW.attributes_json, '$.scopeType')
      AND (CASE WHEN scoped.resource_type = 'organization-unit' THEN json_extract(scoped.attributes_json, '$.organizationUnitId') ELSE scoped.resource_id END) = json_extract(NEW.attributes_json, '$.scopeId')
      AND scoped.state = 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'company_governance_organization_reference_invalid');
END;
CREATE TRIGGER company_site_legal_entity_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'site' AND NEW.state = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM company_resource_revisions legal_entity
    WHERE legal_entity.organization_id = NEW.organization_id AND legal_entity.resource_type = 'legal-entity'
      AND legal_entity.resource_id = json_extract(NEW.attributes_json, '$.legalEntityId')
      AND legal_entity.state = 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'company_site_legal_entity_not_found');
END;
CREATE TRIGGER company_workplace_site_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'workplace' AND NEW.state = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM company_resource_revisions site
    WHERE site.organization_id = NEW.organization_id AND site.resource_type = 'site'
      AND site.resource_id = json_extract(NEW.attributes_json, '$.siteId') AND site.state = 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'company_workplace_site_not_found');
END;
CREATE TRIGGER company_legacy_personnel_action_write_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'personnel-action'
BEGIN
  SELECT RAISE(ABORT, 'company_legacy_personnel_action_write_retired');
END;
CREATE TRIGGER company_grade_assignment_owner_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'grade-assignment'
BEGIN
  SELECT RAISE(ABORT, 'company_grade_assignment_owner_changed') WHERE EXISTS (
    SELECT 1 FROM company_resource_revisions original
    WHERE original.organization_id = NEW.organization_id AND original.resource_type = NEW.resource_type
      AND original.resource_id = NEW.resource_id AND original.revision = 1
      AND (json_extract(original.attributes_json, '$.employeeId') IS NOT json_extract(NEW.attributes_json, '$.employeeId')
        OR json_extract(original.attributes_json, '$.employmentId') IS NOT json_extract(NEW.attributes_json, '$.employmentId'))
  );
END;
CREATE TRIGGER company_employment_contract_term_insert_guard
AFTER INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'employment'
BEGIN
  SELECT RAISE(ABORT, 'company_employment_contract_term_invalid')
  WHERE EXISTS (
    SELECT 1 FROM company_employment_contract_term_violations
    WHERE organization_id = NEW.organization_id AND resource_id = NEW.resource_id AND revision = NEW.revision
  );
END;
CREATE TRIGGER company_resource_revisions_identity_update
BEFORE UPDATE OF id ON company_resource_revisions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_responsibility_resource_bindings
INSERT INTO company_responsibility_resource_bindings (resource_id, organization_id, employee_id, employment_id, organization_unit_id, responsibility_type, responsibility_id, authority_scope_id, resource_revision, recorded_at)
SELECT CASE WHEN source.resource_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.resource_id), source.resource_id) END ,
       source.organization_id,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       CASE WHEN source.employment_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.employment_id), source.employment_id) END ,
       source.organization_unit_id,
       source.responsibility_type,
       source.responsibility_id,
       source.authority_scope_id,
       source.resource_revision,
       source.recorded_at
FROM "_stage_company_responsibility_resource_bindings" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_responsibility_resource_bindings',
       (SELECT count(*) FROM "_stage_company_responsibility_resource_bindings"),
       (SELECT count(*) FROM company_responsibility_resource_bindings),
       0,
       (SELECT count(*) FROM company_responsibility_resource_bindings WHERE NOT (length(resource_id) = 36 AND resource_id NOT GLOB '*[^0-9a-f-]*' AND substr(resource_id, 9, 1) = '-' AND substr(resource_id, 14, 1) = '-' AND substr(resource_id, 19, 1) = '-' AND substr(resource_id, 24, 1) = '-' AND length(replace(resource_id, '-', '')) = 32 AND substr(resource_id, 15, 1) GLOB '[1-8]' AND substr(resource_id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_company_responsibility_resource_bindings";
CREATE INDEX company_responsibility_resource_bindings_employee_idx ON company_responsibility_resource_bindings(employee_id);
CREATE TRIGGER company_responsibility_resource_binding_update_guard
BEFORE UPDATE ON company_responsibility_resource_bindings
WHEN NEW.resource_id != OLD.resource_id OR NEW.organization_id != OLD.organization_id
  OR NEW.employee_id != OLD.employee_id OR NEW.employment_id != OLD.employment_id
  OR NEW.organization_unit_id != OLD.organization_unit_id OR NEW.responsibility_type != OLD.responsibility_type
  OR NEW.responsibility_id != OLD.responsibility_id OR NEW.authority_scope_id != OLD.authority_scope_id
  OR NEW.resource_revision < OLD.resource_revision
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility source identity is immutable');
END;
CREATE TRIGGER company_responsibility_resource_binding_delete_guard
BEFORE DELETE ON company_responsibility_resource_bindings
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility source identity is immutable');
END;

-- company_responsibility_period_bindings
INSERT INTO company_responsibility_period_bindings (period_id, resource_id, period_revision, source_revision)
SELECT CASE WHEN source.period_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.period_id), source.period_id) END ,
       CASE WHEN source.resource_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.resource_id), source.resource_id) END ,
       source.period_revision,
       source.source_revision
FROM "_stage_company_responsibility_period_bindings" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_responsibility_period_bindings',
       (SELECT count(*) FROM "_stage_company_responsibility_period_bindings"),
       (SELECT count(*) FROM company_responsibility_period_bindings),
       0,
       (SELECT count(*) FROM company_responsibility_period_bindings WHERE NOT (length(period_id) = 36 AND period_id NOT GLOB '*[^0-9a-f-]*' AND substr(period_id, 9, 1) = '-' AND substr(period_id, 14, 1) = '-' AND substr(period_id, 19, 1) = '-' AND substr(period_id, 24, 1) = '-' AND length(replace(period_id, '-', '')) = 32 AND substr(period_id, 15, 1) GLOB '[1-8]' AND substr(period_id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_company_responsibility_period_bindings";
CREATE INDEX company_responsibility_period_bindings_resource_idx ON company_responsibility_period_bindings(resource_id);
CREATE TRIGGER company_responsibility_period_binding_update_guard
BEFORE UPDATE ON company_responsibility_period_bindings
WHEN NEW.period_id != OLD.period_id OR NEW.resource_id != OLD.resource_id OR NEW.period_revision < OLD.period_revision
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility period source is immutable');
END;
CREATE TRIGGER company_responsibility_period_binding_delete_guard
BEFORE DELETE ON company_responsibility_period_bindings
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility period source is immutable');
END;

-- company_responsibility_resource_adoptions
INSERT INTO company_responsibility_resource_adoptions (id, command_id, operation_id, employee_id, fingerprint, actor_account_id, reason, expected_revision, organization_revision, observed_on, adopted_periods, snapshot_digest, source_json, mappings_json, recorded_at)
SELECT source.id,
       source.command_id,
       CASE WHEN source.operation_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.operation_id), source.operation_id) END ,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.fingerprint,
       CASE WHEN source.actor_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.actor_account_id), source.actor_account_id) END ,
       source.reason,
       source.expected_revision,
       source.organization_revision,
       source.observed_on,
       source.adopted_periods,
       source.snapshot_digest,
       source.source_json,
       CASE WHEN json_valid(source.mappings_json) AND json_type(source.mappings_json) = 'object' THEN json_replace(source.mappings_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.accountId')), json_extract(source.mappings_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.actorAccountId')), json_extract(source.mappings_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.release.actorAccountId')), json_extract(source.mappings_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.employeeId')), json_extract(source.mappings_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.managerEmployeeId')), json_extract(source.mappings_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.targetEmployeeId')), json_extract(source.mappings_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.requestedByEmployeeId')), json_extract(source.mappings_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.requestedApproverId')), json_extract(source.mappings_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.applicantId')), json_extract(source.mappings_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.holderId')), json_extract(source.mappings_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.personId')), json_extract(source.mappings_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.employmentId')), json_extract(source.mappings_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.periodId')), json_extract(source.mappings_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.resourceId')), json_extract(source.mappings_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.existingResourceId')), json_extract(source.mappings_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.scopeId')), json_extract(source.mappings_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.authorityScopeId')), json_extract(source.mappings_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.responsibilityId')), json_extract(source.mappings_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.collectiveBodyId')), json_extract(source.mappings_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.organizationalOfficeId')), json_extract(source.mappings_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.positionId')), json_extract(source.mappings_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.jobId')), json_extract(source.mappings_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.mappings_json, '$.siteId')), json_extract(source.mappings_json, '$.siteId'))) ELSE source.mappings_json END ,
       source.recorded_at
FROM "_stage_company_responsibility_resource_adoptions" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_responsibility_resource_adoptions',
       (SELECT count(*) FROM "_stage_company_responsibility_resource_adoptions"),
       (SELECT count(*) FROM company_responsibility_resource_adoptions),
       0,
       0,
       0;
DROP TABLE "_stage_company_responsibility_resource_adoptions";
CREATE TRIGGER company_responsibility_adoption_update_guard
BEFORE UPDATE ON company_responsibility_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'responsibility adoption evidence is immutable');
END;
CREATE TRIGGER company_responsibility_adoption_delete_guard
BEFORE DELETE ON company_responsibility_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'responsibility adoption evidence is immutable');
END;
CREATE TRIGGER company_responsibility_resource_adoptions_identity_update
BEFORE UPDATE OF id ON company_responsibility_resource_adoptions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;
CREATE TRIGGER company_responsibility_adoption_insert_guard
BEFORE INSERT ON company_responsibility_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'responsibility adoption evidence is incomplete') WHERE NOT EXISTS (
    SELECT 1 FROM company_organization_change_operations operation
    WHERE operation.id = NEW.operation_id AND operation.status = 'PENDING'
      AND operation.change_count = NEW.adopted_periods AND operation.applied_count = NEW.adopted_periods
      AND operation.actor_account_id = NEW.actor_account_id AND operation.reason = NEW.reason
  ) OR NEW.organization_revision != (SELECT revision FROM company_organizations WHERE id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d')
  OR NEW.adopted_periods != (SELECT count(*) FROM company_organization_responsibility_period_versions period WHERE period.recorded_by_action_id = NEW.operation_id)
  OR EXISTS (
    SELECT 1 FROM company_organization_responsibility_period_versions period
    WHERE period.recorded_by_action_id = NEW.operation_id AND (
      period.employee_id != NEW.employee_id OR NOT EXISTS (
        SELECT 1 FROM company_responsibility_period_bindings binding
        JOIN company_responsibility_resource_bindings source ON source.resource_id = binding.resource_id
        JOIN json_each(NEW.mappings_json) mapping ON json_extract(mapping.value, '$.periodId') = period.period_id
        WHERE binding.period_id = period.period_id AND binding.period_revision = period.revision AND binding.source_revision = source.resource_revision
          AND source.resource_revision >= 1 AND source.employee_id = NEW.employee_id
          AND source.responsibility_id = json_extract(mapping.value, '$.responsibilityId')
          AND source.authority_scope_id = json_extract(mapping.value, '$.authorityScopeId')
          AND EXISTS (SELECT 1 FROM company_resource_revisions applied
            WHERE applied.organization_id = source.organization_id
              AND applied.resource_type = 'responsibility-assignment'
              AND applied.resource_id = source.resource_id AND applied.revision = source.resource_revision
              AND applied.organization_revision > NEW.expected_revision
              AND applied.organization_revision <= NEW.organization_revision
              AND applied.actor_account_id = NEW.actor_account_id AND applied.reason = NEW.reason)
          AND (
            (json_type(mapping.value, '$.existingResourceId') IS NULL AND source.resource_revision = 1)
            OR (json_extract(mapping.value, '$.existingResourceId') = source.resource_id
              AND source.resource_revision > 1
              AND source.resource_revision = 1 + (
                SELECT max(json_extract(confirmed.value, '$.revision'))
                FROM json_each(NEW.source_json, '$.publicResponsibilities') confirmed
                WHERE json_extract(confirmed.value, '$.resourceId') = source.resource_id
                  AND json_type(confirmed.value, '$.bindingEmployeeId') = 'null'
              ))
          )
      )
    )
  );
END;

-- system_audit_events
INSERT INTO system_audit_events (event_id, actor_account_id, action, target_type, target_id, outcome, reason_code, authorization_json, before_json, after_json, metadata_json, occurred_at)
SELECT source.event_id,
       CASE WHEN source.actor_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.actor_account_id), source.actor_account_id) END ,
       source.action,
       source.target_type,
       source.target_id,
       source.outcome,
       source.reason_code,
       CASE WHEN json_valid(source.authorization_json) AND json_type(source.authorization_json) = 'object' THEN json_replace(source.authorization_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.accountId')), json_extract(source.authorization_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.actorAccountId')), json_extract(source.authorization_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.release.actorAccountId')), json_extract(source.authorization_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.employeeId')), json_extract(source.authorization_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.managerEmployeeId')), json_extract(source.authorization_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.targetEmployeeId')), json_extract(source.authorization_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.requestedByEmployeeId')), json_extract(source.authorization_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.requestedApproverId')), json_extract(source.authorization_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.applicantId')), json_extract(source.authorization_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.holderId')), json_extract(source.authorization_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.personId')), json_extract(source.authorization_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.employmentId')), json_extract(source.authorization_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.periodId')), json_extract(source.authorization_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.resourceId')), json_extract(source.authorization_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.existingResourceId')), json_extract(source.authorization_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.scopeId')), json_extract(source.authorization_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.authorityScopeId')), json_extract(source.authorization_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.responsibilityId')), json_extract(source.authorization_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.collectiveBodyId')), json_extract(source.authorization_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.organizationalOfficeId')), json_extract(source.authorization_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.positionId')), json_extract(source.authorization_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.jobId')), json_extract(source.authorization_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.authorization_json, '$.siteId')), json_extract(source.authorization_json, '$.siteId'))) ELSE source.authorization_json END ,
       CASE WHEN json_valid(source.before_json) AND json_type(source.before_json) = 'object' THEN json_replace(source.before_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.before_json, '$.accountId')), json_extract(source.before_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.before_json, '$.actorAccountId')), json_extract(source.before_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.before_json, '$.release.actorAccountId')), json_extract(source.before_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.before_json, '$.employeeId')), json_extract(source.before_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.before_json, '$.managerEmployeeId')), json_extract(source.before_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.before_json, '$.targetEmployeeId')), json_extract(source.before_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.before_json, '$.requestedByEmployeeId')), json_extract(source.before_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.before_json, '$.requestedApproverId')), json_extract(source.before_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.before_json, '$.applicantId')), json_extract(source.before_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.before_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.holderId')), json_extract(source.before_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.personId')), json_extract(source.before_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.employmentId')), json_extract(source.before_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.periodId')), json_extract(source.before_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.resourceId')), json_extract(source.before_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.existingResourceId')), json_extract(source.before_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.scopeId')), json_extract(source.before_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.authorityScopeId')), json_extract(source.before_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.responsibilityId')), json_extract(source.before_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.collectiveBodyId')), json_extract(source.before_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.organizationalOfficeId')), json_extract(source.before_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.positionId')), json_extract(source.before_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.jobId')), json_extract(source.before_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.siteId')), json_extract(source.before_json, '$.siteId'))) ELSE source.before_json END ,
       CASE WHEN json_valid(source.after_json) AND json_type(source.after_json) = 'object' THEN json_replace(source.after_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.after_json, '$.accountId')), json_extract(source.after_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.after_json, '$.actorAccountId')), json_extract(source.after_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.after_json, '$.release.actorAccountId')), json_extract(source.after_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.after_json, '$.employeeId')), json_extract(source.after_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.after_json, '$.managerEmployeeId')), json_extract(source.after_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.after_json, '$.targetEmployeeId')), json_extract(source.after_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.after_json, '$.requestedByEmployeeId')), json_extract(source.after_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.after_json, '$.requestedApproverId')), json_extract(source.after_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.after_json, '$.applicantId')), json_extract(source.after_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.after_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.holderId')), json_extract(source.after_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.personId')), json_extract(source.after_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.employmentId')), json_extract(source.after_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.periodId')), json_extract(source.after_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.resourceId')), json_extract(source.after_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.existingResourceId')), json_extract(source.after_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.scopeId')), json_extract(source.after_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.authorityScopeId')), json_extract(source.after_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.responsibilityId')), json_extract(source.after_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.collectiveBodyId')), json_extract(source.after_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.organizationalOfficeId')), json_extract(source.after_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.positionId')), json_extract(source.after_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.jobId')), json_extract(source.after_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.siteId')), json_extract(source.after_json, '$.siteId'))) ELSE source.after_json END ,
       CASE WHEN json_valid(source.metadata_json) AND json_type(source.metadata_json) = 'object' THEN json_replace(source.metadata_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.accountId')), json_extract(source.metadata_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.actorAccountId')), json_extract(source.metadata_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.release.actorAccountId')), json_extract(source.metadata_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.employeeId')), json_extract(source.metadata_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.managerEmployeeId')), json_extract(source.metadata_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.targetEmployeeId')), json_extract(source.metadata_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.requestedByEmployeeId')), json_extract(source.metadata_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.requestedApproverId')), json_extract(source.metadata_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.applicantId')), json_extract(source.metadata_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.holderId')), json_extract(source.metadata_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.personId')), json_extract(source.metadata_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.employmentId')), json_extract(source.metadata_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.periodId')), json_extract(source.metadata_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.resourceId')), json_extract(source.metadata_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.existingResourceId')), json_extract(source.metadata_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.scopeId')), json_extract(source.metadata_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.authorityScopeId')), json_extract(source.metadata_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.responsibilityId')), json_extract(source.metadata_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.collectiveBodyId')), json_extract(source.metadata_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.organizationalOfficeId')), json_extract(source.metadata_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.positionId')), json_extract(source.metadata_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.jobId')), json_extract(source.metadata_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.siteId')), json_extract(source.metadata_json, '$.siteId'))) ELSE source.metadata_json END ,
       source.occurred_at
FROM "_stage_system_audit_events" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_audit_events',
       (SELECT count(*) FROM "_stage_system_audit_events"),
       (SELECT count(*) FROM system_audit_events),
       0,
       0,
       0;
DROP TABLE "_stage_system_audit_events";
CREATE INDEX system_audit_events_action_idx
  ON system_audit_events (action, occurred_at);
CREATE INDEX system_audit_events_actor_idx
  ON system_audit_events (actor_account_id, occurred_at);
CREATE INDEX system_audit_events_outcome_idx
  ON system_audit_events (outcome, occurred_at);
CREATE INDEX system_audit_events_target_idx
  ON system_audit_events (target_type, target_id, occurred_at);
CREATE TRIGGER system_audit_events_prevent_delete
BEFORE DELETE ON system_audit_events
BEGIN
  SELECT RAISE(ABORT, 'system audit event is append-only');
END;
CREATE TRIGGER system_audit_events_prevent_update
BEFORE UPDATE ON system_audit_events
BEGIN
  SELECT RAISE(ABORT, 'system audit event is append-only');
END;

-- system_record_source_freezes
INSERT INTO system_record_source_freezes (id, source_namespace, owner_context, revision, created_audit_event_id, release_audit_event_id, snapshot_json)
SELECT source.id,
       source.source_namespace,
       source.owner_context,
       source.revision,
       source.created_audit_event_id,
       source.release_audit_event_id,
       source.snapshot_json
FROM "_stage_system_record_source_freezes" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_record_source_freezes',
       (SELECT count(*) FROM "_stage_system_record_source_freezes"),
       (SELECT count(*) FROM system_record_source_freezes),
       0,
       0,
       0;
DROP TABLE "_stage_system_record_source_freezes";
CREATE UNIQUE INDEX system_record_source_freezes_active_owner_idx
  ON system_record_source_freezes(owner_context) WHERE revision = 1;
CREATE TRIGGER system_record_source_freezes_insert
BEFORE INSERT ON system_record_source_freezes
BEGIN
  SELECT RAISE(ABORT, 'record_source_freeze_creation_invalid') WHERE NEW.revision <> 1
    OR EXISTS (SELECT 1 FROM system_record_source_freezes
      WHERE id = NEW.id OR (owner_context = NEW.owner_context AND revision = 1));
  SELECT RAISE(ABORT, 'record_source_freeze_audit_missing') WHERE NOT EXISTS (
    SELECT 1 FROM system_audit_events WHERE event_id = NEW.created_audit_event_id
      AND actor_account_id = json_extract(NEW.snapshot_json, '$.actorAccountId')
      AND action = 'system.record.source.freeze.created' AND target_type = 'system:record-source-freeze'
      AND target_id = NEW.id AND outcome = 'succeeded' AND before_json IS NULL
      AND after_json IS NEW.snapshot_json
      AND strftime('%Y-%m-%dT%H:%M:%fZ', occurred_at / 1000.0, 'unixepoch') IS json_extract(NEW.snapshot_json, '$.createdAt')
  );
END;
CREATE TRIGGER system_record_source_freezes_update
BEFORE UPDATE ON system_record_source_freezes
BEGIN
  SELECT RAISE(ABORT, 'record_source_freeze_immutable')
  WHERE OLD.revision <> 1 OR NEW.revision <> 2 OR NEW.id IS NOT OLD.id
    OR NEW.source_namespace IS NOT OLD.source_namespace OR NEW.owner_context IS NOT OLD.owner_context
    OR NEW.created_audit_event_id IS NOT OLD.created_audit_event_id
    OR json_remove(NEW.snapshot_json, '$.release', '$.revision') IS NOT json_remove(OLD.snapshot_json, '$.release', '$.revision');
  SELECT RAISE(ABORT, 'record_source_freeze_audit_missing') WHERE NOT EXISTS (
    SELECT 1 FROM system_audit_events WHERE event_id = NEW.release_audit_event_id
      AND actor_account_id = json_extract(NEW.snapshot_json, '$.release.actorAccountId')
      AND action = 'system.record.source.freeze.released' AND target_type = 'system:record-source-freeze'
      AND target_id = NEW.id AND outcome = 'succeeded'
      AND before_json IS OLD.snapshot_json AND after_json IS NEW.snapshot_json
      AND strftime('%Y-%m-%dT%H:%M:%fZ', occurred_at / 1000.0, 'unixepoch') IS json_extract(NEW.snapshot_json, '$.release.at')
  );
END;
CREATE TRIGGER system_record_source_freezes_delete
BEFORE DELETE ON system_record_source_freezes
BEGIN
  SELECT RAISE(ABORT, 'record_source_freeze_immutable');
END;
CREATE TRIGGER system_record_source_retirement_prevents_release BEFORE UPDATE ON system_record_source_freezes
WHEN EXISTS (SELECT 1 FROM system_record_source_retirements WHERE freeze_id=OLD.id)
BEGIN
  SELECT RAISE(ABORT,'record_source_already_retired');
END;

-- company_responsibility_source_adoptions
INSERT INTO company_responsibility_source_adoptions (id, organization_id, source_context, source_kind, source_namespace, freeze_id, source_id, source_version, command_id, resource_type, resource_id, resource_revision, snapshot_digest, source_json, actor_account_id, reason, expected_revision, organization_revision, recorded_at)
SELECT source.id,
       source.organization_id,
       source.source_context,
       source.source_kind,
       source.source_namespace,
       source.freeze_id,
       source.source_id,
       source.source_version,
       source.command_id,
       source.resource_type,
       CASE WHEN source.resource_type = 'employee' THEN CASE WHEN source.resource_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.resource_id), source.resource_id) END ELSE CASE WHEN source.resource_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.resource_id), source.resource_id) END END ,
       source.resource_revision,
       source.snapshot_digest,
       source.source_json,
       CASE WHEN source.actor_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.actor_account_id), source.actor_account_id) END ,
       source.reason,
       source.expected_revision,
       source.organization_revision,
       source.recorded_at
FROM "_stage_company_responsibility_source_adoptions" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_responsibility_source_adoptions',
       (SELECT count(*) FROM "_stage_company_responsibility_source_adoptions"),
       (SELECT count(*) FROM company_responsibility_source_adoptions),
       0,
       0,
       0;
DROP TABLE "_stage_company_responsibility_source_adoptions";
CREATE TRIGGER company_responsibility_source_adoptions_insert_guard
BEFORE INSERT ON company_responsibility_source_adoptions
BEGIN
  SELECT RAISE(ABORT, 'company_responsibility_source_adoption_freeze_invalid')
  WHERE NOT EXISTS (
    SELECT 1 FROM system_record_source_freezes freeze
    WHERE freeze.id = NEW.freeze_id
      AND freeze.source_namespace = NEW.source_namespace
      AND freeze.owner_context = NEW.source_context
      AND freeze.revision = 1
  );

  SELECT RAISE(ABORT, 'company_responsibility_source_adoption_resource_invalid')
  WHERE NOT EXISTS (
    SELECT 1
    FROM company_resource_revisions resource
    JOIN company_command_receipts receipt
      ON receipt.organization_id = resource.organization_id
      AND receipt.command_id = resource.command_id
    WHERE resource.organization_id = NEW.organization_id
      AND resource.resource_type = NEW.resource_type
      AND resource.resource_id = NEW.resource_id
      AND resource.revision = NEW.resource_revision
      AND resource.command_id = NEW.command_id
      AND resource.organization_revision = NEW.organization_revision
      AND resource.actor_account_id = NEW.actor_account_id
      AND resource.reason = NEW.reason
      AND resource.recorded_at = NEW.recorded_at
      AND receipt.expected_revision = NEW.expected_revision
  );
END;
CREATE TRIGGER company_responsibility_source_adoptions_update_guard
BEFORE UPDATE ON company_responsibility_source_adoptions
BEGIN
  SELECT RAISE(ABORT, 'company_responsibility_source_adoption_immutable');
END;
CREATE TRIGGER company_responsibility_source_adoptions_delete_guard
BEFORE DELETE ON company_responsibility_source_adoptions
BEGIN
  SELECT RAISE(ABORT, 'company_responsibility_source_adoption_immutable');
END;
CREATE TRIGGER company_responsibility_source_adoptions_identity_update
BEFORE UPDATE OF id ON company_responsibility_source_adoptions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_responsibility_source_cutovers
INSERT INTO company_responsibility_source_cutovers (id, organization_id, source_context, source_kind, source_namespace, freeze_id, source_count, adopted_count, source_manifest_digest, source_manifest_json, audit_event_id, actor_account_id, completed_at)
SELECT source.id,
       source.organization_id,
       source.source_context,
       source.source_kind,
       source.source_namespace,
       source.freeze_id,
       source.source_count,
       source.adopted_count,
       source.source_manifest_digest,
       CASE WHEN json_valid(source.source_manifest_json) AND json_type(source.source_manifest_json) = 'object' THEN json_replace(source.source_manifest_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.source_manifest_json, '$.accountId')), json_extract(source.source_manifest_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.source_manifest_json, '$.actorAccountId')), json_extract(source.source_manifest_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.source_manifest_json, '$.release.actorAccountId')), json_extract(source.source_manifest_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.source_manifest_json, '$.employeeId')), json_extract(source.source_manifest_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.source_manifest_json, '$.managerEmployeeId')), json_extract(source.source_manifest_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.source_manifest_json, '$.targetEmployeeId')), json_extract(source.source_manifest_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.source_manifest_json, '$.requestedByEmployeeId')), json_extract(source.source_manifest_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.source_manifest_json, '$.requestedApproverId')), json_extract(source.source_manifest_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.source_manifest_json, '$.applicantId')), json_extract(source.source_manifest_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.source_manifest_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.source_manifest_json, '$.holderId')), json_extract(source.source_manifest_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.source_manifest_json, '$.personId')), json_extract(source.source_manifest_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.source_manifest_json, '$.employmentId')), json_extract(source.source_manifest_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.source_manifest_json, '$.periodId')), json_extract(source.source_manifest_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.source_manifest_json, '$.resourceId')), json_extract(source.source_manifest_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.source_manifest_json, '$.existingResourceId')), json_extract(source.source_manifest_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.source_manifest_json, '$.scopeId')), json_extract(source.source_manifest_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.source_manifest_json, '$.authorityScopeId')), json_extract(source.source_manifest_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.source_manifest_json, '$.responsibilityId')), json_extract(source.source_manifest_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.source_manifest_json, '$.collectiveBodyId')), json_extract(source.source_manifest_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.source_manifest_json, '$.organizationalOfficeId')), json_extract(source.source_manifest_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.source_manifest_json, '$.positionId')), json_extract(source.source_manifest_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.source_manifest_json, '$.jobId')), json_extract(source.source_manifest_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.source_manifest_json, '$.siteId')), json_extract(source.source_manifest_json, '$.siteId'))) ELSE source.source_manifest_json END ,
       source.audit_event_id,
       CASE WHEN source.actor_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.actor_account_id), source.actor_account_id) END ,
       source.completed_at
FROM "_stage_company_responsibility_source_cutovers" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_responsibility_source_cutovers',
       (SELECT count(*) FROM "_stage_company_responsibility_source_cutovers"),
       (SELECT count(*) FROM company_responsibility_source_cutovers),
       0,
       0,
       0;
DROP TABLE "_stage_company_responsibility_source_cutovers";
CREATE TRIGGER company_responsibility_source_cutovers_insert_guard
BEFORE INSERT ON company_responsibility_source_cutovers
BEGIN
  SELECT RAISE(ABORT, 'company_responsibility_source_cutover_freeze_invalid')
  WHERE NOT EXISTS (
    SELECT 1 FROM system_record_source_freezes freeze
    WHERE freeze.id = NEW.freeze_id
      AND freeze.source_namespace = NEW.source_namespace
      AND freeze.owner_context = NEW.source_context
      AND freeze.revision = 1
  );

  SELECT RAISE(ABORT, 'company_responsibility_source_cutover_manifest_invalid')
  WHERE EXISTS (
    SELECT 1 FROM json_each(NEW.source_manifest_json) entry
    WHERE json_type(entry.value) <> 'object'
      OR NOT EXISTS (
        SELECT 1 FROM company_responsibility_source_adoptions adoption
        WHERE adoption.organization_id = NEW.organization_id
          AND adoption.source_context = NEW.source_context
          AND adoption.source_kind = NEW.source_kind
          AND adoption.source_namespace = NEW.source_namespace
          AND adoption.freeze_id = NEW.freeze_id
          AND adoption.source_id = json_extract(entry.value, '$.sourceId')
          AND adoption.source_version = json_extract(entry.value, '$.sourceVersion')
      )
  ) OR EXISTS (
    SELECT 1 FROM company_responsibility_source_adoptions adoption
    WHERE adoption.organization_id = NEW.organization_id
      AND adoption.source_context = NEW.source_context
      AND adoption.source_kind = NEW.source_kind
      AND adoption.source_namespace = NEW.source_namespace
      AND adoption.freeze_id = NEW.freeze_id
      AND NOT EXISTS (
        SELECT 1 FROM json_each(NEW.source_manifest_json) entry
        WHERE json_extract(entry.value, '$.sourceId') = adoption.source_id
          AND json_extract(entry.value, '$.sourceVersion') = adoption.source_version
      )
  );
END;
CREATE TRIGGER company_responsibility_source_cutovers_update_guard
BEFORE UPDATE ON company_responsibility_source_cutovers
BEGIN
  SELECT RAISE(ABORT, 'company_responsibility_source_cutover_immutable');
END;
CREATE TRIGGER company_responsibility_source_cutovers_delete_guard
BEFORE DELETE ON company_responsibility_source_cutovers
BEGIN
  SELECT RAISE(ABORT, 'company_responsibility_source_cutover_immutable');
END;
CREATE TRIGGER governance_responsibility_cutover_coverage_guard
BEFORE INSERT ON company_responsibility_source_cutovers
BEGIN
  SELECT RAISE(ABORT, 'company_responsibility_source_cutover_coverage_invalid')
  WHERE NEW.source_context <> 'governance'
    OR NEW.source_kind <> 'org-role-assignment'
    OR NEW.source_count <> (SELECT count(*) FROM governance_org_role_assignments)
    OR NEW.adopted_count <> (
      SELECT count(*) FROM company_responsibility_source_adoptions
      WHERE organization_id = NEW.organization_id
        AND source_context = NEW.source_context
        AND source_kind = NEW.source_kind
        AND source_namespace = NEW.source_namespace
        AND freeze_id = NEW.freeze_id
    )
    OR EXISTS (
      SELECT 1
      FROM governance_org_role_assignments source
      LEFT JOIN company_responsibility_source_adoptions adoption
        ON adoption.organization_id = NEW.organization_id
        AND adoption.source_context = NEW.source_context
        AND adoption.source_kind = NEW.source_kind
        AND adoption.source_namespace = NEW.source_namespace
        AND adoption.freeze_id = NEW.freeze_id
        AND adoption.source_id = CAST(source.id AS TEXT)
      LEFT JOIN company_resource_revisions resource
        ON resource.organization_id = adoption.organization_id
        AND resource.resource_type = adoption.resource_type
        AND resource.resource_id = adoption.resource_id
        AND resource.revision = adoption.resource_revision
      WHERE adoption.source_id IS NULL
        OR adoption.source_version <> adoption.snapshot_digest
        OR json_extract(adoption.source_json, '$.id') IS NOT source.id
        OR json_extract(adoption.source_json, '$.org_role_code') IS NOT source.org_role_code
        OR json_extract(adoption.source_json, '$.employee_id') IS NOT CAST(source.employee_id AS TEXT)
        OR json_extract(adoption.source_json, '$.department_code') IS NOT source.department_code
        OR json_extract(adoption.source_json, '$.starts_on') IS NOT source.starts_on
        OR json_extract(adoption.source_json, '$.ends_on') IS NOT source.ends_on
        OR json_extract(adoption.source_json, '$.source_document_code') IS NOT source.source_document_code
        OR json_extract(adoption.source_json, '$.created_by_account_id') IS NOT source.created_by_account_id
        OR json_extract(adoption.source_json, '$.created_at') IS NOT source.created_at
        OR json_extract(adoption.source_json, '$.revoked_by_account_id') IS NOT source.revoked_by_account_id
        OR json_extract(adoption.source_json, '$.revoked_at') IS NOT source.revoked_at
        OR resource.resource_id IS NULL
    );
END;
CREATE TRIGGER company_responsibility_source_cutovers_identity_update
BEFORE UPDATE OF id ON company_responsibility_source_cutovers
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_workforce_connection_completions
INSERT INTO company_workforce_connection_completions (id, organization_id, command_id, actor_account_id, reason, employee_count, employment_count, completed_at)
SELECT source.id,
       source.organization_id,
       source.command_id,
       CASE WHEN source.actor_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.actor_account_id), source.actor_account_id) END ,
       source.reason,
       source.employee_count,
       source.employment_count,
       source.completed_at
FROM "_stage_company_workforce_connection_completions" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_workforce_connection_completions',
       (SELECT count(*) FROM "_stage_company_workforce_connection_completions"),
       (SELECT count(*) FROM company_workforce_connection_completions),
       0,
       0,
       0;
DROP TABLE "_stage_company_workforce_connection_completions";
CREATE TRIGGER company_workforce_connection_completions_no_update
BEFORE UPDATE ON company_workforce_connection_completions
BEGIN SELECT RAISE(ABORT, 'company_workforce_connection_completion_immutable'); END;
CREATE TRIGGER company_workforce_connection_completions_no_delete
BEFORE DELETE ON company_workforce_connection_completions
BEGIN SELECT RAISE(ABORT, 'company_workforce_connection_completion_immutable'); END;
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
CREATE TRIGGER company_workforce_connection_completions_identity_update
BEFORE UPDATE OF id ON company_workforce_connection_completions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- company_workforce_resource_bindings
INSERT INTO company_workforce_resource_bindings (id, resource_type, resource_id, organization_id, employee_id, resource_revision, lifecycle_revision, last_action_id)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.resource_type,
       CASE WHEN source.resource_type = 'employee' THEN CASE WHEN source.resource_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.resource_id), source.resource_id) END ELSE CASE WHEN source.resource_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.resource_id), source.resource_id) END END ,
       source.organization_id,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.resource_revision,
       source.lifecycle_revision,
       CASE WHEN source.last_action_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.last_action_id), source.last_action_id) END
FROM "_stage_company_workforce_resource_bindings" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'company_workforce_resource_bindings',
       (SELECT count(*) FROM "_stage_company_workforce_resource_bindings"),
       (SELECT count(*) FROM company_workforce_resource_bindings),
       0,
       (SELECT count(*) FROM company_workforce_resource_bindings WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_company_workforce_resource_bindings";
CREATE INDEX company_workforce_resource_bindings_employee_idx
  ON company_workforce_resource_bindings(employee_id, resource_type);
CREATE TRIGGER company_reporting_employment_projection_guard
AFTER UPDATE OF lifecycle_revision ON company_workforce_resource_bindings
WHEN NEW.resource_type = 'employee' AND NEW.lifecycle_revision = (
  SELECT revision FROM company_employee_lifecycle_revisions WHERE employee_id = NEW.employee_id
)
BEGIN
  SELECT RAISE(ABORT, 'company reporting employment period is not covered')
  WHERE EXISTS (SELECT 1 FROM company_reporting_employment_violations
    WHERE organization_id = NEW.organization_id AND employee_id = NEW.employee_id);
END;
CREATE TRIGGER company_employment_authority_projection_guard
AFTER UPDATE OF lifecycle_revision ON company_workforce_resource_bindings
WHEN NEW.resource_type = 'employee' AND NEW.lifecycle_revision = (
  SELECT revision FROM company_employee_lifecycle_revisions WHERE employee_id = NEW.employee_id
) AND NOT EXISTS (
  SELECT 1 FROM company_resource_revisions resource
  JOIN company_organizations organization ON organization.id = resource.organization_id
  WHERE resource.organization_id = NEW.organization_id AND resource.organization_revision > organization.revision
)
BEGIN
  SELECT RAISE(ABORT, 'company_employment_authority_period_not_covered')
  WHERE EXISTS (SELECT 1 FROM company_employment_authority_violations
    WHERE organization_id = NEW.organization_id AND employee_id = NEW.employee_id);
END;
CREATE TRIGGER company_responsibility_lifecycle_completion_guard
AFTER UPDATE OF lifecycle_revision ON company_workforce_resource_bindings
WHEN NEW.resource_type = 'employee' AND NEW.lifecycle_revision != OLD.lifecycle_revision
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility public source is stale')
  WHERE EXISTS (
    SELECT 1 FROM company_responsibility_source_mismatches mismatch
    JOIN company_responsibility_resource_bindings source ON source.resource_id = mismatch.resource_id
    WHERE source.employee_id = NEW.employee_id AND source.organization_id = NEW.organization_id
  );
END;
CREATE TRIGGER company_responsibility_assignment_lifecycle_guard
AFTER UPDATE OF lifecycle_revision ON company_workforce_resource_bindings
WHEN NEW.resource_type = 'employee' AND NEW.lifecycle_revision != OLD.lifecycle_revision
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility assignment periods overlap')
  WHERE EXISTS (SELECT 1 FROM company_responsibility_assignment_overlaps
    WHERE organization_id = NEW.organization_id AND holder_type = 'employee' AND holder_id = NEW.employee_id);
END;
CREATE TRIGGER company_workforce_resource_bindings_identity_update
BEFORE UPDATE OF id ON company_workforce_resource_bindings
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- disciplinary_actions
INSERT INTO disciplinary_actions (id, employee_id, kind, summary, decided_on, created_at, legacy_id)
SELECT source.id,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.kind,
       source.summary,
       source.decided_on,
       source.created_at,
       source.legacy_id
FROM "_stage_disciplinary_actions" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'disciplinary_actions',
       (SELECT count(*) FROM "_stage_disciplinary_actions"),
       (SELECT count(*) FROM disciplinary_actions),
       0,
       0,
       0;
DROP TABLE "_stage_disciplinary_actions";
CREATE INDEX idx_disciplinary_actions_employee ON disciplinary_actions (employee_id);
CREATE TRIGGER disciplinary_actions_source_freeze_delete
BEFORE DELETE ON disciplinary_actions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'disciplinary-action' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'disciplinary_action_record_source_frozen'); END;
CREATE TRIGGER disciplinary_actions_source_freeze_insert
BEFORE INSERT ON disciplinary_actions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'disciplinary-action' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'disciplinary_action_record_source_frozen'); END;
CREATE TRIGGER disciplinary_actions_source_freeze_update
BEFORE UPDATE ON disciplinary_actions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'disciplinary-action' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'disciplinary_action_record_source_frozen'); END;
CREATE TRIGGER disciplinary_actions_legacy_id_insert
BEFORE INSERT ON disciplinary_actions
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER disciplinary_actions_identity_update
BEFORE UPDATE OF id, legacy_id ON disciplinary_actions
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- employee_certifications
INSERT INTO employee_certifications (id, legacy_id, employee_id, certification_id, acquired_on, expires_on, note, created_at)
SELECT source.id,
       source.legacy_id,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.certification_id,
       source.acquired_on,
       source.expires_on,
       source.note,
       source.created_at
FROM "_stage_employee_certifications" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'employee_certifications',
       (SELECT count(*) FROM "_stage_employee_certifications"),
       (SELECT count(*) FROM employee_certifications),
       0,
       0,
       0;
DROP TABLE "_stage_employee_certifications";
CREATE INDEX idx_employee_certifications_certification ON employee_certifications (certification_id);
CREATE INDEX idx_employee_certifications_employee ON employee_certifications (employee_id);
CREATE UNIQUE INDEX idx_employee_certifications_unique
  ON employee_certifications (employee_id, certification_id, acquired_on);
CREATE TRIGGER employee_certifications_source_freeze_delete BEFORE DELETE ON employee_certifications
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='certification' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'certification_record_source_frozen'); END;
CREATE TRIGGER employee_certifications_source_freeze_insert BEFORE INSERT ON employee_certifications
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='certification' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'certification_record_source_frozen'); END;
CREATE TRIGGER employee_certifications_source_freeze_update BEFORE UPDATE ON employee_certifications
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='certification' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'certification_record_source_frozen'); END;
CREATE TRIGGER employee_certifications_legacy_id_insert
BEFORE INSERT ON employee_certifications
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER employee_certifications_identity_update
BEFORE UPDATE OF id, legacy_id ON employee_certifications
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- employee_skills
INSERT INTO employee_skills (id, employee_id, skill_code, level, years, note)
SELECT source.id,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.skill_code,
       source.level,
       source.years,
       source.note
FROM "_stage_employee_skills" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'employee_skills',
       (SELECT count(*) FROM "_stage_employee_skills"),
       (SELECT count(*) FROM employee_skills),
       0,
       0,
       0;
DROP TABLE "_stage_employee_skills";
CREATE INDEX idx_employee_skills_employee ON employee_skills (employee_id);
CREATE TRIGGER employee_skills_source_freeze_delete BEFORE DELETE ON employee_skills
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='skill' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'skill_record_source_frozen'); END;
CREATE TRIGGER employee_skills_source_freeze_insert BEFORE INSERT ON employee_skills
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='skill' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'skill_record_source_frozen'); END;
CREATE TRIGGER employee_skills_source_freeze_update BEFORE UPDATE ON employee_skills
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='skill' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'skill_record_source_frozen'); END;
CREATE TRIGGER employee_skills_identity_update
BEFORE UPDATE OF id ON employee_skills
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- employee_work_styles
INSERT INTO employee_work_styles (id, employee_id, style, starts_on, ends_on, note, created_at, legacy_id)
SELECT source.id,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.style,
       source.starts_on,
       source.ends_on,
       source.note,
       source.created_at,
       source.legacy_id
FROM "_stage_employee_work_styles" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'employee_work_styles',
       (SELECT count(*) FROM "_stage_employee_work_styles"),
       (SELECT count(*) FROM employee_work_styles),
       0,
       0,
       0;
DROP TABLE "_stage_employee_work_styles";
CREATE INDEX idx_employee_work_styles_employee ON employee_work_styles (employee_id);
CREATE TRIGGER employee_work_styles_source_freeze_delete
BEFORE DELETE ON employee_work_styles
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'work-style' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'work_style_record_source_frozen'); END;
CREATE TRIGGER employee_work_styles_source_freeze_insert
BEFORE INSERT ON employee_work_styles
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'work-style' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'work_style_record_source_frozen'); END;
CREATE TRIGGER employee_work_styles_source_freeze_update
BEFORE UPDATE ON employee_work_styles
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'work-style' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'work_style_record_source_frozen'); END;
CREATE TRIGGER employee_work_styles_legacy_id_insert
BEFORE INSERT ON employee_work_styles
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER employee_work_styles_identity_update
BEFORE UPDATE OF id, legacy_id ON employee_work_styles
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- evaluation_sheet_audit_logs
INSERT INTO evaluation_sheet_audit_logs (id, legacy_id, sheet_id, actor_id, action, from_value, to_value, note, created_at)
SELECT source.id,
       source.legacy_id,
       source.sheet_id,
       CASE WHEN source.actor_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.actor_id), source.actor_id) END ,
       source.action,
       source.from_value,
       source.to_value,
       source.note,
       source.created_at
FROM "_stage_evaluation_sheet_audit_logs" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'evaluation_sheet_audit_logs',
       (SELECT count(*) FROM "_stage_evaluation_sheet_audit_logs"),
       (SELECT count(*) FROM evaluation_sheet_audit_logs),
       0,
       0,
       0;
DROP TABLE "_stage_evaluation_sheet_audit_logs";
CREATE INDEX idx_evaluation_sheet_audit_logs_sheet ON evaluation_sheet_audit_logs (sheet_id);
CREATE TRIGGER evaluation_sheet_audit_logs_source_freeze_delete BEFORE DELETE ON evaluation_sheet_audit_logs
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;
CREATE TRIGGER evaluation_sheet_audit_logs_source_freeze_insert BEFORE INSERT ON evaluation_sheet_audit_logs
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;
CREATE TRIGGER evaluation_sheet_audit_logs_source_freeze_update BEFORE UPDATE ON evaluation_sheet_audit_logs
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;
CREATE TRIGGER evaluation_sheet_audit_logs_legacy_id_insert
BEFORE INSERT ON evaluation_sheet_audit_logs
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER evaluation_sheet_audit_logs_identity_update
BEFORE UPDATE OF id, legacy_id ON evaluation_sheet_audit_logs
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- evaluation_sheets
INSERT INTO evaluation_sheets (id, legacy_id, employee_id, template_id, period, status, primary_evaluator_id, secondary_evaluator_id, submitted_at, approved_at, finalized_at, created_at, updated_at, revision)
SELECT source.id,
       source.legacy_id,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.template_id,
       source.period,
       source.status,
       CASE WHEN source.primary_evaluator_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.primary_evaluator_id), source.primary_evaluator_id) END ,
       CASE WHEN source.secondary_evaluator_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.secondary_evaluator_id), source.secondary_evaluator_id) END ,
       source.submitted_at,
       source.approved_at,
       source.finalized_at,
       source.created_at,
       source.updated_at,
       source.revision
FROM "_stage_evaluation_sheets" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'evaluation_sheets',
       (SELECT count(*) FROM "_stage_evaluation_sheets"),
       (SELECT count(*) FROM evaluation_sheets),
       0,
       0,
       0;
DROP TABLE "_stage_evaluation_sheets";
CREATE INDEX idx_evaluation_sheets_employee
ON evaluation_sheets (employee_id);
CREATE INDEX idx_evaluation_sheets_period
ON evaluation_sheets (period);
CREATE INDEX idx_evaluation_sheets_status
ON evaluation_sheets (status);
CREATE UNIQUE INDEX uq_evaluation_sheets_employee_period
ON evaluation_sheets (employee_id, period);
CREATE TRIGGER evaluation_sheets_source_freeze_delete BEFORE DELETE ON evaluation_sheets
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;
CREATE TRIGGER evaluation_sheets_source_freeze_insert BEFORE INSERT ON evaluation_sheets
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;
CREATE TRIGGER evaluation_sheets_source_freeze_update BEFORE UPDATE ON evaluation_sheets
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;
CREATE TRIGGER evaluation_sheets_legacy_id_insert
BEFORE INSERT ON evaluation_sheets
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER evaluation_sheets_identity_update
BEFORE UPDATE OF id, legacy_id ON evaluation_sheets
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- evaluation_templates
INSERT INTO evaluation_templates (id, legacy_id, title, period, items, status, created_by, created_at, updated_at)
SELECT source.id,
       source.legacy_id,
       source.title,
       source.period,
       source.items,
       source.status,
       CASE WHEN source.created_by IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.created_by), source.created_by) END ,
       source.created_at,
       source.updated_at
FROM "_stage_evaluation_templates" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'evaluation_templates',
       (SELECT count(*) FROM "_stage_evaluation_templates"),
       (SELECT count(*) FROM evaluation_templates),
       0,
       0,
       0;
DROP TABLE "_stage_evaluation_templates";
CREATE INDEX idx_evaluation_templates_period ON evaluation_templates (period);
CREATE INDEX idx_evaluation_templates_status ON evaluation_templates (status);
CREATE TRIGGER evaluation_templates_source_freeze_delete BEFORE DELETE ON evaluation_templates
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;
CREATE TRIGGER evaluation_templates_source_freeze_insert BEFORE INSERT ON evaluation_templates
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;
CREATE TRIGGER evaluation_templates_source_freeze_update BEFORE UPDATE ON evaluation_templates
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;
CREATE TRIGGER evaluation_templates_legacy_id_insert
BEFORE INSERT ON evaluation_templates
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER evaluation_templates_identity_update
BEFORE UPDATE OF id, legacy_id ON evaluation_templates
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- expense_approvals
INSERT INTO expense_approvals (id, legacy_id, expense_id, approver_id, action, comment, created_at)
SELECT source.id,
       source.legacy_id,
       source.expense_id,
       CASE WHEN source.approver_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.approver_id), source.approver_id) END ,
       source.action,
       source.comment,
       source.created_at
FROM "_stage_expense_approvals" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'expense_approvals',
       (SELECT count(*) FROM "_stage_expense_approvals"),
       (SELECT count(*) FROM expense_approvals),
       0,
       0,
       0;
DROP TABLE "_stage_expense_approvals";
CREATE INDEX idx_expense_approvals_expense ON expense_approvals (expense_id);
CREATE TRIGGER expense_approvals_source_freeze_insert
BEFORE INSERT ON expense_approvals
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'expense' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'expense_record_source_frozen');
END;
CREATE TRIGGER expense_approvals_source_freeze_update
BEFORE UPDATE ON expense_approvals
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'expense' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'expense_record_source_frozen');
END;
CREATE TRIGGER expense_approvals_source_freeze_delete
BEFORE DELETE ON expense_approvals
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'expense' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'expense_record_source_frozen');
END;
CREATE TRIGGER expense_approvals_legacy_id_insert
BEFORE INSERT ON expense_approvals
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER expense_approvals_identity_update
BEFORE UPDATE OF id, legacy_id ON expense_approvals
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- system_cases
INSERT INTO system_cases (id, subject_context, subject_kind, subject_id, subject_version, proposal_digest, created_by_account_id, status, created_at, updated_at)
SELECT source.id,
       source.subject_context,
       source.subject_kind,
       source.subject_id,
       source.subject_version,
       source.proposal_digest,
       CASE WHEN source.created_by_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.created_by_account_id), source.created_by_account_id) END ,
       source.status,
       source.created_at,
       source.updated_at
FROM "_stage_system_cases" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_cases',
       (SELECT count(*) FROM "_stage_system_cases"),
       (SELECT count(*) FROM system_cases),
       0,
       0,
       0;
DROP TABLE "_stage_system_cases";
CREATE INDEX system_cases_subject_idx
  ON system_cases (subject_context, subject_kind, subject_id, subject_version);
CREATE INDEX system_cases_creator_idx
  ON system_cases (created_by_account_id, created_at);
CREATE INDEX system_cases_status_idx
  ON system_cases (status, updated_at);
CREATE TRIGGER system_cases_monotonic_lifecycle
BEFORE UPDATE ON system_cases
WHEN
  NEW.id IS NOT OLD.id
  OR NEW.subject_context IS NOT OLD.subject_context
  OR NEW.subject_kind IS NOT OLD.subject_kind
  OR NEW.subject_id IS NOT OLD.subject_id
  OR NEW.subject_version IS NOT OLD.subject_version
  OR NEW.proposal_digest IS NOT OLD.proposal_digest
  OR NEW.created_by_account_id IS NOT OLD.created_by_account_id
  OR NEW.created_at IS NOT OLD.created_at
  OR NEW.updated_at < OLD.updated_at
  OR (NEW.status IS OLD.status AND NEW.updated_at IS NOT OLD.updated_at)
  OR (
    NEW.status IS NOT OLD.status
    AND NOT (
      (OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected', 'returned', 'cancelled'))
      OR (OLD.status = 'approved' AND NEW.status = 'executed')
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'system case lifecycle is not monotonic');
END;
CREATE TRIGGER system_cases_approved_tasks
BEFORE UPDATE OF status ON system_cases
WHEN NEW.status = 'approved' AND (
  NOT EXISTS (
    SELECT 1 FROM system_decision_tasks
    WHERE case_id = NEW.id
  )
  OR EXISTS (
    SELECT 1 FROM system_decision_tasks
    WHERE case_id = NEW.id AND outcome IS NOT 'approved'
  )
)
BEGIN
  SELECT RAISE(ABORT, 'system case approval requires approved tasks');
END;
CREATE TRIGGER system_cases_negative_decision_evidence
BEFORE UPDATE OF status ON system_cases
WHEN NEW.status IN ('rejected', 'returned') AND (
  NOT EXISTS (
    SELECT 1 FROM system_decision_tasks
    WHERE case_id = NEW.id AND outcome = NEW.status
  )
  OR EXISTS (
    SELECT 1 FROM system_decision_tasks
    WHERE case_id = NEW.id AND outcome IS NULL
  )
  OR (
    NEW.status = 'returned'
    AND EXISTS (
      SELECT 1 FROM system_decision_tasks
      WHERE case_id = NEW.id AND outcome = 'rejected'
    )
  )
)
BEGIN
  SELECT RAISE(ABORT, 'system case decision requires matching task evidence');
END;
CREATE TRIGGER system_cases_cancelled_tasks
BEFORE UPDATE OF status ON system_cases
WHEN NEW.status = 'cancelled' AND EXISTS (
  SELECT 1 FROM system_decision_tasks
  WHERE case_id = NEW.id AND outcome IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'system case cancellation requires closed tasks');
END;
CREATE TRIGGER system_cases_execution_evidence
BEFORE UPDATE OF status ON system_cases
WHEN NEW.status = 'executed' AND (
  NOT EXISTS (
    SELECT 1 FROM system_execution_authorizations
    WHERE case_id = NEW.id
  )
  OR EXISTS (
    SELECT 1 FROM system_execution_authorizations
    WHERE case_id = NEW.id AND used_at IS NULL
  )
)
BEGIN
  SELECT RAISE(ABORT, 'system case execution requires consumed authorizations');
END;
CREATE TRIGGER system_cases_prevent_delete
BEFORE DELETE ON system_cases
BEGIN
  SELECT RAISE(ABORT, 'system case is immutable');
END;

-- system_proposal_series
INSERT INTO system_proposal_series (id, procedure_key, created_by_account_id, created_at)
SELECT source.id,
       source.procedure_key,
       CASE WHEN source.created_by_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.created_by_account_id), source.created_by_account_id) END ,
       source.created_at
FROM "_stage_system_proposal_series" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_proposal_series',
       (SELECT count(*) FROM "_stage_system_proposal_series"),
       (SELECT count(*) FROM system_proposal_series),
       0,
       0,
       0;
DROP TABLE "_stage_system_proposal_series";
CREATE INDEX system_proposal_series_definition_idx
  ON system_proposal_series (procedure_key, created_at);
CREATE INDEX system_proposal_series_creator_idx
  ON system_proposal_series (created_by_account_id, created_at);
CREATE TRIGGER system_proposal_series_prevent_update
BEFORE UPDATE ON system_proposal_series
BEGIN
  SELECT RAISE(ABORT, 'system proposal series is immutable');
END;
CREATE TRIGGER system_proposal_series_prevent_delete
BEFORE DELETE ON system_proposal_series
BEGIN
  SELECT RAISE(ABORT, 'system proposal series is immutable');
END;

-- system_proposal_numbers
INSERT INTO system_proposal_numbers (number, series_id)
SELECT source.number,
       source.series_id
FROM "_stage_system_proposal_numbers" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_proposal_numbers',
       (SELECT count(*) FROM "_stage_system_proposal_numbers"),
       (SELECT count(*) FROM system_proposal_numbers),
       0,
       0,
       0;
DROP TABLE "_stage_system_proposal_numbers";
CREATE UNIQUE INDEX system_proposal_numbers_series_uniq
  ON system_proposal_numbers (series_id);
CREATE TRIGGER system_proposal_numbers_prevent_update
BEFORE UPDATE ON system_proposal_numbers
BEGIN
  SELECT RAISE(ABORT, 'system proposal number is immutable');
END;
CREATE TRIGGER system_proposal_numbers_prevent_delete
BEFORE DELETE ON system_proposal_numbers
BEGIN
  SELECT RAISE(ABORT, 'system proposal number is immutable');
END;

-- expenses
INSERT INTO expenses (id, legacy_id, employee_id, organization_unit_id, category, amount, spent_at, note, status, created_at)
SELECT source.id,
       source.legacy_id,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.organization_unit_id,
       source.category,
       source.amount,
       source.spent_at,
       source.note,
       source.status,
       source.created_at
FROM "_stage_expenses" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'expenses',
       (SELECT count(*) FROM "_stage_expenses"),
       (SELECT count(*) FROM expenses),
       0,
       0,
       0;
DROP TABLE "_stage_expenses";
CREATE INDEX idx_expenses_employee ON expenses (employee_id);
CREATE INDEX idx_expenses_organization_unit ON expenses (organization_unit_id);
CREATE INDEX idx_expenses_status ON expenses (status);
CREATE TRIGGER expense_procedure_request_immutable
BEFORE UPDATE ON expenses
WHEN EXISTS (SELECT 1 FROM expense_procedure_bindings WHERE expense_id = OLD.id)
 AND (NEW.id IS NOT OLD.id OR NEW.employee_id IS NOT OLD.employee_id
   OR NEW.organization_unit_id IS NOT OLD.organization_unit_id OR NEW.category IS NOT OLD.category
   OR NEW.amount IS NOT OLD.amount OR NEW.spent_at IS NOT OLD.spent_at OR NEW.note IS NOT OLD.note
   OR NEW.created_at IS NOT OLD.created_at OR OLD.status <> 'pending'
   OR NEW.status NOT IN ('approved', 'rejected'))
BEGIN
  SELECT RAISE(ABORT, 'expense_procedure_request_immutable');
END;
CREATE TRIGGER expense_procedure_request_requires_execution
BEFORE UPDATE ON expenses
WHEN EXISTS (SELECT 1 FROM expense_procedure_bindings WHERE expense_id = OLD.id)
 AND NOT EXISTS (
   SELECT 1 FROM expense_procedure_bindings binding
   JOIN system_cases workflow_case ON workflow_case.id = binding.case_id
   WHERE binding.expense_id = OLD.id
     AND ((NEW.status = 'rejected' AND workflow_case.status = 'rejected')
       OR (NEW.status = 'approved' AND workflow_case.status = 'approved' AND EXISTS (
         SELECT 1 FROM system_execution_authorizations authorization
         WHERE authorization.case_id = binding.case_id
           AND authorization.operation_key = 'expense.request.authorize'
           AND authorization.proposal_digest = binding.proposal_digest
           AND authorization.used_at IS NULL
           AND authorization.granted_at >= binding.created_at
       )))
 )
BEGIN
  SELECT RAISE(ABORT, 'expense_procedure_execution_required');
END;
CREATE TRIGGER expenses_source_freeze_insert
BEFORE INSERT ON expenses
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'expense' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'expense_record_source_frozen');
END;
CREATE TRIGGER expenses_source_freeze_update
BEFORE UPDATE ON expenses
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'expense' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'expense_record_source_frozen');
END;
CREATE TRIGGER expenses_source_freeze_delete
BEFORE DELETE ON expenses
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'expense' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'expense_record_source_frozen');
END;
CREATE TRIGGER expenses_legacy_id_insert
BEFORE INSERT ON expenses
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER expenses_identity_update
BEFORE UPDATE OF id, legacy_id ON expenses
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- expense_procedure_bindings
INSERT INTO expense_procedure_bindings (id, previous_expense_id, request_key, expense_id, application_id, series_id, case_id, proposal_digest, created_at, attachment_evidence_json)
SELECT source.id,
       source.previous_expense_id,
       source.request_key,
       source.expense_id,
       source.application_id,
       source.series_id,
       source.case_id,
       source.proposal_digest,
       source.created_at,
       source.attachment_evidence_json
FROM "_stage_expense_procedure_bindings" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'expense_procedure_bindings',
       (SELECT count(*) FROM "_stage_expense_procedure_bindings"),
       (SELECT count(*) FROM expense_procedure_bindings),
       0,
       0,
       0;
DROP TABLE "_stage_expense_procedure_bindings";
CREATE UNIQUE INDEX expense_resubmission_once ON expense_procedure_bindings(previous_expense_id) WHERE previous_expense_id IS NOT NULL;
CREATE TRIGGER expense_procedure_binding_matches_proposal
BEFORE INSERT ON expense_procedure_bindings
WHEN NOT EXISTS (
  SELECT 1 FROM expenses request
  JOIN system_proposal_numbers number ON number.number = NEW.application_id AND number.series_id = NEW.series_id
  JOIN system_proposals proposal ON proposal.series_id = NEW.series_id AND proposal.version = 1
  JOIN system_proposal_cases association ON association.proposal_id = proposal.id AND association.case_id = NEW.case_id
  JOIN system_cases workflow_case ON workflow_case.id = NEW.case_id
  JOIN system_procedure_definition_revisions definition
    ON definition.procedure_key = proposal.procedure_key AND definition.revision = proposal.procedure_revision
  WHERE request.id = NEW.expense_id AND request.status = 'pending'
    AND proposal.digest = NEW.proposal_digest AND proposal.created_at = NEW.created_at
    AND request.created_at <= strftime('%Y-%m-%dT%H:%M:%fZ', proposal.created_at / 1000.0, 'unixepoch')
    AND definition.completion_operation_key = 'expense.request.authorize'
    AND workflow_case.subject_context = 'expense' AND workflow_case.subject_kind = 'request'
    AND workflow_case.subject_id = NEW.request_key AND workflow_case.subject_version = '1'
    AND workflow_case.status = 'pending'
    AND json_extract(proposal.body_json, '$.employeeId') IS request.employee_id
    AND json_extract(proposal.body_json, '$.organizationUnitId') IS request.organization_unit_id
    AND json_extract(proposal.body_json, '$.category') IS request.category
    AND json_extract(proposal.body_json, '$.amount') IS request.amount
    AND json_extract(proposal.body_json, '$.spentAt') IS request.spent_at
    AND json_extract(proposal.body_json, '$.note') IS request.note
    AND json_extract(proposal.body_json, '$.attachments') IS json(NEW.attachment_evidence_json)
    AND json_array_length(NEW.attachment_evidence_json) = (
      SELECT count(DISTINCT json_extract(value, '$.id')) FROM json_each(NEW.attachment_evidence_json)
    )
    AND NOT EXISTS (
      SELECT 1 FROM json_each(NEW.attachment_evidence_json) evidence
      WHERE NOT EXISTS (
        SELECT 1 FROM system_attachments attachment
        WHERE attachment.id = json_extract(evidence.value, '$.id')
          AND attachment.owner_account_id = proposal.created_by_account_id
          AND attachment.status = 'linked' AND attachment.erased_at IS NULL
          AND attachment.plaintext_sha256 = json_extract(evidence.value, '$.sha256')
          AND attachment.file_name = json_extract(evidence.value, '$.fileName')
          AND attachment.content_type = json_extract(evidence.value, '$.contentType')
          AND attachment.byte_size = json_extract(evidence.value, '$.byteSize')
      )
    )
    AND (NEW.previous_expense_id IS NULL OR EXISTS (
      SELECT 1 FROM expense_procedure_bindings previous
      JOIN expenses original ON original.id = previous.expense_id
      JOIN system_cases previous_case ON previous_case.id = previous.case_id
      WHERE previous.expense_id = NEW.previous_expense_id AND previous.expense_id <> NEW.expense_id
        AND original.employee_id = request.employee_id AND previous_case.status = 'returned'
        AND previous_case.created_by_account_id = proposal.created_by_account_id
        AND previous_case.updated_at <= NEW.created_at
    ))
)
BEGIN
  SELECT RAISE(ABORT, 'expense_procedure_proposal_mismatch');
END;
CREATE TRIGGER expense_procedure_binding_immutable_update
BEFORE UPDATE ON expense_procedure_bindings
BEGIN
  SELECT RAISE(ABORT, 'expense_procedure_binding_immutable');
END;
CREATE TRIGGER expense_procedure_binding_immutable_delete
BEFORE DELETE ON expense_procedure_bindings
BEGIN
  SELECT RAISE(ABORT, 'expense_procedure_binding_immutable');
END;
CREATE TRIGGER expense_procedure_bindings_source_freeze_insert
BEFORE INSERT ON expense_procedure_bindings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'expense' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'expense_record_source_frozen');
END;
CREATE TRIGGER expense_procedure_bindings_source_freeze_update
BEFORE UPDATE ON expense_procedure_bindings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'expense' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'expense_record_source_frozen');
END;
CREATE TRIGGER expense_procedure_bindings_source_freeze_delete
BEFORE DELETE ON expense_procedure_bindings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'expense' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'expense_record_source_frozen');
END;
CREATE TRIGGER expense_procedure_bindings_identity_update
BEFORE UPDATE OF id ON expense_procedure_bindings
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- family_care_leaves
INSERT INTO family_care_leaves (id, employee_id, leave_kind, start_date, end_date, note, status, created_at)
SELECT source.id,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.leave_kind,
       source.start_date,
       source.end_date,
       source.note,
       source.status,
       source.created_at
FROM "_stage_family_care_leaves" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'family_care_leaves',
       (SELECT count(*) FROM "_stage_family_care_leaves"),
       (SELECT count(*) FROM family_care_leaves),
       0,
       0,
       0;
DROP TABLE "_stage_family_care_leaves";
CREATE INDEX idx_family_care_leaves_employee ON family_care_leaves (employee_id);
CREATE TRIGGER family_care_leaves_source_freeze_delete
BEFORE DELETE ON family_care_leaves
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'family-care-leave' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'family_care_leave_record_source_frozen');
END;
CREATE TRIGGER family_care_leaves_source_freeze_insert
BEFORE INSERT ON family_care_leaves
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'family-care-leave' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'family_care_leave_record_source_frozen');
END;
CREATE TRIGGER family_care_leaves_source_freeze_update
BEFORE UPDATE ON family_care_leaves
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'family-care-leave' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'family_care_leave_record_source_frozen');
END;

-- goal_evaluations
INSERT INTO goal_evaluations (id, legacy_id, goal_id, evaluator_id, kind, score, comment, created_at)
SELECT source.id,
       source.legacy_id,
       source.goal_id,
       CASE WHEN source.evaluator_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.evaluator_id), source.evaluator_id) END ,
       source.kind,
       source.score,
       source.comment,
       source.created_at
FROM "_stage_goal_evaluations" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'goal_evaluations',
       (SELECT count(*) FROM "_stage_goal_evaluations"),
       (SELECT count(*) FROM goal_evaluations),
       0,
       0,
       0;
DROP TABLE "_stage_goal_evaluations";
CREATE UNIQUE INDEX idx_goal_evaluations_evaluator_kind
ON goal_evaluations (goal_id, evaluator_id, kind)
WHERE kind IN ('self', 'manager');
CREATE INDEX idx_goal_evaluations_goal ON goal_evaluations (goal_id);
CREATE UNIQUE INDEX idx_goal_evaluations_goal_final
ON goal_evaluations (goal_id)
WHERE kind = 'final';
CREATE TRIGGER goal_evaluations_source_freeze_delete BEFORE DELETE ON goal_evaluations
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;
CREATE TRIGGER goal_evaluations_source_freeze_insert BEFORE INSERT ON goal_evaluations
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;
CREATE TRIGGER goal_evaluations_source_freeze_update BEFORE UPDATE ON goal_evaluations
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;
CREATE TRIGGER goal_evaluations_legacy_id_insert
BEFORE INSERT ON goal_evaluations
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER goal_evaluations_identity_update
BEFORE UPDATE OF id, legacy_id ON goal_evaluations
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- governance_acknowledgements
INSERT INTO governance_acknowledgements (id, version_id, employee_id, content_hash, acknowledged_at)
SELECT source.id,
       source.version_id,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.content_hash,
       source.acknowledged_at
FROM "_stage_governance_acknowledgements" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'governance_acknowledgements',
       (SELECT count(*) FROM "_stage_governance_acknowledgements"),
       (SELECT count(*) FROM governance_acknowledgements),
       0,
       0,
       0;
DROP TABLE "_stage_governance_acknowledgements";
CREATE TRIGGER governance_acknowledgements_source_freeze_delete BEFORE DELETE ON governance_acknowledgements
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;
CREATE TRIGGER governance_acknowledgements_source_freeze_insert BEFORE INSERT ON governance_acknowledgements
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;
CREATE TRIGGER governance_acknowledgements_source_freeze_update BEFORE UPDATE ON governance_acknowledgements
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;
CREATE TRIGGER governance_acknowledgements_identity_update
BEFORE UPDATE OF id ON governance_acknowledgements
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- governance_document_versions
INSERT INTO governance_document_versions (id, document_id, version, body_md, metadata_json, procedure_json, content_hash, effective_from, effective_to, review_due_on, state, created_by_account_id, created_at, published_by_account_id, published_at)
SELECT source.id,
       source.document_id,
       source.version,
       source.body_md,
       CASE WHEN json_valid(source.metadata_json) AND json_type(source.metadata_json) = 'object' THEN json_replace(source.metadata_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.accountId')), json_extract(source.metadata_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.actorAccountId')), json_extract(source.metadata_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.release.actorAccountId')), json_extract(source.metadata_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.employeeId')), json_extract(source.metadata_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.managerEmployeeId')), json_extract(source.metadata_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.targetEmployeeId')), json_extract(source.metadata_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.requestedByEmployeeId')), json_extract(source.metadata_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.requestedApproverId')), json_extract(source.metadata_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.applicantId')), json_extract(source.metadata_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.holderId')), json_extract(source.metadata_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.personId')), json_extract(source.metadata_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.employmentId')), json_extract(source.metadata_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.periodId')), json_extract(source.metadata_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.resourceId')), json_extract(source.metadata_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.existingResourceId')), json_extract(source.metadata_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.scopeId')), json_extract(source.metadata_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.authorityScopeId')), json_extract(source.metadata_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.responsibilityId')), json_extract(source.metadata_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.collectiveBodyId')), json_extract(source.metadata_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.organizationalOfficeId')), json_extract(source.metadata_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.positionId')), json_extract(source.metadata_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.jobId')), json_extract(source.metadata_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.metadata_json, '$.siteId')), json_extract(source.metadata_json, '$.siteId'))) ELSE source.metadata_json END ,
       CASE WHEN json_valid(source.procedure_json) AND json_type(source.procedure_json) = 'object' THEN json_replace(source.procedure_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.procedure_json, '$.accountId')), json_extract(source.procedure_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.procedure_json, '$.actorAccountId')), json_extract(source.procedure_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.procedure_json, '$.release.actorAccountId')), json_extract(source.procedure_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.procedure_json, '$.employeeId')), json_extract(source.procedure_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.procedure_json, '$.managerEmployeeId')), json_extract(source.procedure_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.procedure_json, '$.targetEmployeeId')), json_extract(source.procedure_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.procedure_json, '$.requestedByEmployeeId')), json_extract(source.procedure_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.procedure_json, '$.requestedApproverId')), json_extract(source.procedure_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.procedure_json, '$.applicantId')), json_extract(source.procedure_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.procedure_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.procedure_json, '$.holderId')), json_extract(source.procedure_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.procedure_json, '$.personId')), json_extract(source.procedure_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.procedure_json, '$.employmentId')), json_extract(source.procedure_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.procedure_json, '$.periodId')), json_extract(source.procedure_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.procedure_json, '$.resourceId')), json_extract(source.procedure_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.procedure_json, '$.existingResourceId')), json_extract(source.procedure_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.procedure_json, '$.scopeId')), json_extract(source.procedure_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.procedure_json, '$.authorityScopeId')), json_extract(source.procedure_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.procedure_json, '$.responsibilityId')), json_extract(source.procedure_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.procedure_json, '$.collectiveBodyId')), json_extract(source.procedure_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.procedure_json, '$.organizationalOfficeId')), json_extract(source.procedure_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.procedure_json, '$.positionId')), json_extract(source.procedure_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.procedure_json, '$.jobId')), json_extract(source.procedure_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.procedure_json, '$.siteId')), json_extract(source.procedure_json, '$.siteId'))) ELSE source.procedure_json END ,
       source.content_hash,
       source.effective_from,
       source.effective_to,
       source.review_due_on,
       source.state,
       CASE WHEN source.created_by_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.created_by_account_id), source.created_by_account_id) END ,
       source.created_at,
       CASE WHEN source.published_by_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.published_by_account_id), source.published_by_account_id) END ,
       source.published_at
FROM "_stage_governance_document_versions" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'governance_document_versions',
       (SELECT count(*) FROM "_stage_governance_document_versions"),
       (SELECT count(*) FROM governance_document_versions),
       0,
       0,
       0;
DROP TABLE "_stage_governance_document_versions";
CREATE INDEX idx_governance_versions_document_state
  ON governance_document_versions (document_id, state);
CREATE TRIGGER governance_document_versions_source_freeze_delete BEFORE DELETE ON governance_document_versions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;
CREATE TRIGGER governance_document_versions_source_freeze_insert BEFORE INSERT ON governance_document_versions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;
CREATE TRIGGER governance_document_versions_source_freeze_update BEFORE UPDATE ON governance_document_versions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;

-- governance_documents
INSERT INTO governance_documents (id, code, title, kind, classification, owner_capability_code, steward_org_role_code, status, current_version_id, source_path, created_by_account_id, created_at, updated_at)
SELECT source.id,
       source.code,
       source.title,
       source.kind,
       source.classification,
       source.owner_capability_code,
       source.steward_org_role_code,
       source.status,
       source.current_version_id,
       source.source_path,
       CASE WHEN source.created_by_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.created_by_account_id), source.created_by_account_id) END ,
       source.created_at,
       source.updated_at
FROM "_stage_governance_documents" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'governance_documents',
       (SELECT count(*) FROM "_stage_governance_documents"),
       (SELECT count(*) FROM governance_documents),
       0,
       0,
       0;
DROP TABLE "_stage_governance_documents";
CREATE TRIGGER governance_documents_source_freeze_delete BEFORE DELETE ON governance_documents
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;
CREATE TRIGGER governance_documents_source_freeze_insert BEFORE INSERT ON governance_documents
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;
CREATE TRIGGER governance_documents_source_freeze_update BEFORE UPDATE ON governance_documents
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;

-- governance_org_role_assignments
INSERT INTO governance_org_role_assignments (id, legacy_id, org_role_code, employee_id, department_code, starts_on, ends_on, source_document_code, created_by_account_id, created_at, revoked_by_account_id, revoked_at)
SELECT source.id,
       source.legacy_id,
       source.org_role_code,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.department_code,
       source.starts_on,
       source.ends_on,
       source.source_document_code,
       CASE WHEN source.created_by_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.created_by_account_id), source.created_by_account_id) END ,
       source.created_at,
       CASE WHEN source.revoked_by_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.revoked_by_account_id), source.revoked_by_account_id) END ,
       source.revoked_at
FROM "_stage_governance_org_role_assignments" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'governance_org_role_assignments',
       (SELECT count(*) FROM "_stage_governance_org_role_assignments"),
       (SELECT count(*) FROM governance_org_role_assignments),
       0,
       0,
       0;
DROP TABLE "_stage_governance_org_role_assignments";
CREATE INDEX idx_governance_role_assignments_employee
  ON governance_org_role_assignments (employee_id);
CREATE INDEX idx_governance_role_assignments_role_period
  ON governance_org_role_assignments (org_role_code, starts_on, ends_on);
CREATE TRIGGER governance_org_role_assignments_source_freeze_delete_guard
BEFORE DELETE ON governance_org_role_assignments
WHEN EXISTS (
  SELECT 1 FROM system_record_source_freezes
  WHERE owner_context = 'governance' AND revision = 1
)
BEGIN
  SELECT RAISE(ABORT, 'governance_org_role_assignment_source_frozen');
END;
CREATE TRIGGER governance_org_role_assignments_source_freeze_insert_guard
BEFORE INSERT ON governance_org_role_assignments
WHEN EXISTS (
  SELECT 1 FROM system_record_source_freezes
  WHERE owner_context = 'governance' AND revision = 1
)
BEGIN
  SELECT RAISE(ABORT, 'governance_org_role_assignment_source_frozen');
END;
CREATE TRIGGER governance_org_role_assignments_source_freeze_update_guard
BEFORE UPDATE ON governance_org_role_assignments
WHEN EXISTS (
  SELECT 1 FROM system_record_source_freezes
  WHERE owner_context = 'governance' AND revision = 1
)
BEGIN
  SELECT RAISE(ABORT, 'governance_org_role_assignment_source_frozen');
END;
CREATE TRIGGER governance_org_role_assignments_legacy_id_insert
BEFORE INSERT ON governance_org_role_assignments
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER governance_org_role_assignments_identity_update
BEFORE UPDATE OF id, legacy_id ON governance_org_role_assignments
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- governance_publication_approvals
INSERT INTO governance_publication_approvals (id, version_id, org_role_code, status, decided_by_employee_id, decided_at, comment)
SELECT source.id,
       source.version_id,
       source.org_role_code,
       source.status,
       CASE WHEN source.decided_by_employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.decided_by_employee_id), source.decided_by_employee_id) END ,
       source.decided_at,
       source.comment
FROM "_stage_governance_publication_approvals" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'governance_publication_approvals',
       (SELECT count(*) FROM "_stage_governance_publication_approvals"),
       (SELECT count(*) FROM governance_publication_approvals),
       0,
       0,
       0;
DROP TABLE "_stage_governance_publication_approvals";
CREATE TRIGGER governance_publication_approvals_source_freeze_delete BEFORE DELETE ON governance_publication_approvals
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;
CREATE TRIGGER governance_publication_approvals_source_freeze_insert BEFORE INSERT ON governance_publication_approvals
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;
CREATE TRIGGER governance_publication_approvals_source_freeze_update BEFORE UPDATE ON governance_publication_approvals
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;
CREATE TRIGGER governance_publication_approvals_identity_update
BEFORE UPDATE OF id ON governance_publication_approvals
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- health_checkups
INSERT INTO health_checkups (id, employee_id, fiscal_year, checkup_kind, conducted_on, status, note, created_at, legacy_id)
SELECT source.id,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.fiscal_year,
       source.checkup_kind,
       source.conducted_on,
       source.status,
       source.note,
       source.created_at,
       source.legacy_id
FROM "_stage_health_checkups" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'health_checkups',
       (SELECT count(*) FROM "_stage_health_checkups"),
       (SELECT count(*) FROM health_checkups),
       0,
       0,
       0;
DROP TABLE "_stage_health_checkups";
CREATE INDEX idx_health_checkups_employee ON health_checkups (employee_id);
CREATE INDEX idx_health_checkups_fiscal_year ON health_checkups (fiscal_year);
CREATE TRIGGER health_checkups_source_freeze_delete
BEFORE DELETE ON health_checkups
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'health-checkup' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'health_checkup_record_source_frozen'); END;
CREATE TRIGGER health_checkups_source_freeze_insert
BEFORE INSERT ON health_checkups
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'health-checkup' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'health_checkup_record_source_frozen'); END;
CREATE TRIGGER health_checkups_source_freeze_update
BEFORE UPDATE ON health_checkups
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'health-checkup' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'health_checkup_record_source_frozen'); END;
CREATE TRIGGER health_checkups_legacy_id_insert
BEFORE INSERT ON health_checkups
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER health_checkups_identity_update
BEFORE UPDATE OF id, legacy_id ON health_checkups
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- knowledge_articles
INSERT INTO knowledge_articles (id, legacy_id, title, category, tags, body_md, author_id, created_at, revision, status)
SELECT source.id,
       source.legacy_id,
       source.title,
       source.category,
       source.tags,
       source.body_md,
       CASE WHEN source.author_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.author_id), source.author_id) END ,
       source.created_at,
       source.revision,
       source.status
FROM "_stage_knowledge_articles" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'knowledge_articles',
       (SELECT count(*) FROM "_stage_knowledge_articles"),
       (SELECT count(*) FROM knowledge_articles),
       0,
       0,
       0;
DROP TABLE "_stage_knowledge_articles";
CREATE INDEX idx_knowledge_articles_category ON knowledge_articles (category);
CREATE TRIGGER knowledge_article_no_delete
BEFORE DELETE ON knowledge_articles
BEGIN
  SELECT RAISE(ABORT, 'knowledge_article_withdrawal_required');
END;
CREATE TRIGGER knowledge_articles_source_freeze_delete
BEFORE DELETE ON knowledge_articles
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'knowledge' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'knowledge_record_source_frozen');
END;
CREATE TRIGGER knowledge_articles_source_freeze_insert
BEFORE INSERT ON knowledge_articles
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'knowledge' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'knowledge_record_source_frozen');
END;
CREATE TRIGGER knowledge_articles_source_freeze_update
BEFORE UPDATE ON knowledge_articles
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'knowledge' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'knowledge_record_source_frozen');
END;
CREATE TRIGGER knowledge_articles_legacy_id_insert
BEFORE INSERT ON knowledge_articles
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER knowledge_articles_identity_update
BEFORE UPDATE OF id, legacy_id ON knowledge_articles
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- knowledge_article_revisions
INSERT INTO knowledge_article_revisions (id, article_id, revision, snapshot_json, status, source, actor_account_id, reason, recorded_at, command_id, request_json)
SELECT source.id,
       source.article_id,
       source.revision,
       CASE WHEN json_valid(source.snapshot_json) AND json_type(source.snapshot_json) = 'object' THEN json_replace(source.snapshot_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.accountId')), json_extract(source.snapshot_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.actorAccountId')), json_extract(source.snapshot_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.release.actorAccountId')), json_extract(source.snapshot_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.employeeId')), json_extract(source.snapshot_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.managerEmployeeId')), json_extract(source.snapshot_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.targetEmployeeId')), json_extract(source.snapshot_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.requestedByEmployeeId')), json_extract(source.snapshot_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.requestedApproverId')), json_extract(source.snapshot_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.applicantId')), json_extract(source.snapshot_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.holderId')), json_extract(source.snapshot_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.personId')), json_extract(source.snapshot_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.employmentId')), json_extract(source.snapshot_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.periodId')), json_extract(source.snapshot_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.resourceId')), json_extract(source.snapshot_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.existingResourceId')), json_extract(source.snapshot_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.scopeId')), json_extract(source.snapshot_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.authorityScopeId')), json_extract(source.snapshot_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.responsibilityId')), json_extract(source.snapshot_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.collectiveBodyId')), json_extract(source.snapshot_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.organizationalOfficeId')), json_extract(source.snapshot_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.positionId')), json_extract(source.snapshot_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.jobId')), json_extract(source.snapshot_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.siteId')), json_extract(source.snapshot_json, '$.siteId'))) ELSE source.snapshot_json END ,
       source.status,
       source.source,
       CASE WHEN source.actor_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.actor_account_id), source.actor_account_id) END ,
       source.reason,
       source.recorded_at,
       source.command_id,
       CASE WHEN json_valid(source.request_json) AND json_type(source.request_json) = 'object' THEN json_replace(source.request_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.request_json, '$.accountId')), json_extract(source.request_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.request_json, '$.actorAccountId')), json_extract(source.request_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.request_json, '$.release.actorAccountId')), json_extract(source.request_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.request_json, '$.employeeId')), json_extract(source.request_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.request_json, '$.managerEmployeeId')), json_extract(source.request_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.request_json, '$.targetEmployeeId')), json_extract(source.request_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.request_json, '$.requestedByEmployeeId')), json_extract(source.request_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.request_json, '$.requestedApproverId')), json_extract(source.request_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.request_json, '$.applicantId')), json_extract(source.request_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.request_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.request_json, '$.holderId')), json_extract(source.request_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.request_json, '$.personId')), json_extract(source.request_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.request_json, '$.employmentId')), json_extract(source.request_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.request_json, '$.periodId')), json_extract(source.request_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.request_json, '$.resourceId')), json_extract(source.request_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.request_json, '$.existingResourceId')), json_extract(source.request_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.request_json, '$.scopeId')), json_extract(source.request_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.request_json, '$.authorityScopeId')), json_extract(source.request_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.request_json, '$.responsibilityId')), json_extract(source.request_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.request_json, '$.collectiveBodyId')), json_extract(source.request_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.request_json, '$.organizationalOfficeId')), json_extract(source.request_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.request_json, '$.positionId')), json_extract(source.request_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.request_json, '$.jobId')), json_extract(source.request_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.request_json, '$.siteId')), json_extract(source.request_json, '$.siteId'))) ELSE source.request_json END
FROM "_stage_knowledge_article_revisions" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'knowledge_article_revisions',
       (SELECT count(*) FROM "_stage_knowledge_article_revisions"),
       (SELECT count(*) FROM knowledge_article_revisions),
       0,
       0,
       0;
DROP TABLE "_stage_knowledge_article_revisions";
CREATE TRIGGER knowledge_article_revision_no_delete
BEFORE DELETE ON knowledge_article_revisions
BEGIN
  SELECT RAISE(ABORT, 'knowledge_revision_immutable');
END;
CREATE TRIGGER knowledge_article_revision_no_update
BEFORE UPDATE ON knowledge_article_revisions
BEGIN
  SELECT RAISE(ABORT, 'knowledge_revision_immutable');
END;
CREATE TRIGGER knowledge_article_revisions_source_freeze_insert
BEFORE INSERT ON knowledge_article_revisions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'knowledge' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'knowledge_record_source_frozen');
END;
CREATE TRIGGER knowledge_article_revisions_identity_update
BEFORE UPDATE OF id ON knowledge_article_revisions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- leave_balances
INSERT INTO leave_balances (id, employee_id, fiscal_year, leave_type, granted_days, used_days, remaining_days)
SELECT source.id,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.fiscal_year,
       source.leave_type,
       source.granted_days,
       source.used_days,
       source.remaining_days
FROM "_stage_leave_balances" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'leave_balances',
       (SELECT count(*) FROM "_stage_leave_balances"),
       (SELECT count(*) FROM leave_balances),
       0,
       0,
       0;
DROP TABLE "_stage_leave_balances";
CREATE INDEX idx_leave_balances_employee ON leave_balances (employee_id, fiscal_year);
CREATE TRIGGER leave_balances_source_freeze_insert BEFORE INSERT ON leave_balances
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'leave' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'leave_record_source_frozen'); END;
CREATE TRIGGER leave_balances_source_freeze_update BEFORE UPDATE ON leave_balances
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'leave' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'leave_record_source_frozen'); END;
CREATE TRIGGER leave_balances_source_freeze_delete BEFORE DELETE ON leave_balances
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'leave' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'leave_record_source_frozen'); END;
CREATE TRIGGER leave_balances_identity_update
BEFORE UPDATE OF id ON leave_balances
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- leave_requests
INSERT INTO leave_requests (id, legacy_id, employee_id, leave_type, start_date, end_date, days, reason, status, approver_id, decided_comment, created_at, unit, hours, consumed_days, previous_leave_request_id)
SELECT source.id,
       source.legacy_id,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.leave_type,
       source.start_date,
       source.end_date,
       source.days,
       source.reason,
       source.status,
       CASE WHEN source.approver_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.approver_id), source.approver_id) END ,
       source.decided_comment,
       source.created_at,
       source.unit,
       source.hours,
       source.consumed_days,
       source.previous_leave_request_id
FROM "_stage_leave_requests" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'leave_requests',
       (SELECT count(*) FROM "_stage_leave_requests"),
       (SELECT count(*) FROM leave_requests),
       0,
       0,
       0;
DROP TABLE "_stage_leave_requests";
CREATE INDEX idx_leave_requests_employee ON leave_requests (employee_id);
CREATE INDEX idx_leave_requests_status ON leave_requests (status);
CREATE TRIGGER leave_procedure_request_immutable
BEFORE UPDATE ON leave_requests
WHEN EXISTS (SELECT 1 FROM leave_procedure_bindings WHERE leave_request_id = OLD.id)
 AND (NEW.id IS NOT OLD.id
   OR NEW.employee_id IS NOT OLD.employee_id
   OR NEW.leave_type IS NOT OLD.leave_type
   OR NEW.start_date IS NOT OLD.start_date
   OR NEW.end_date IS NOT OLD.end_date
   OR NEW.days IS NOT OLD.days
   OR NEW.unit IS NOT OLD.unit
   OR NEW.hours IS NOT OLD.hours
   OR NEW.consumed_days IS NOT OLD.consumed_days
   OR NEW.reason IS NOT OLD.reason
   OR NEW.created_at IS NOT OLD.created_at OR OLD.status <> 'pending'
   OR NEW.status NOT IN ('approved', 'rejected'))
BEGIN
  SELECT RAISE(ABORT, 'leave_procedure_request_immutable');
END;
CREATE TRIGGER leave_procedure_request_requires_execution
BEFORE UPDATE ON leave_requests
WHEN EXISTS (SELECT 1 FROM leave_procedure_bindings WHERE leave_request_id = OLD.id)
 AND NOT EXISTS (
   SELECT 1 FROM leave_procedure_bindings binding
   JOIN system_cases workflow_case ON workflow_case.id = binding.case_id
   WHERE binding.leave_request_id = OLD.id
     AND ((NEW.status = 'rejected' AND workflow_case.status = 'rejected')
       OR (NEW.status = 'approved' AND workflow_case.status = 'approved' AND EXISTS (
         SELECT 1 FROM system_execution_authorizations authorization
         WHERE authorization.case_id = binding.case_id
           AND authorization.operation_key = 'leave.request.authorize'
           AND authorization.proposal_digest = binding.proposal_digest
           AND authorization.used_at IS NULL
       )))
 )
BEGIN
  SELECT RAISE(ABORT, 'leave_procedure_execution_required');
END;
CREATE TRIGGER leave_request_decision_requires_procedure
BEFORE UPDATE OF status ON leave_requests
WHEN OLD.status = 'pending' AND NEW.status <> 'pending'
 AND NOT EXISTS (SELECT 1 FROM leave_procedure_bindings WHERE leave_request_id = OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'leave_procedure_required');
END;
CREATE TRIGGER leave_draft_source_valid
BEFORE INSERT ON leave_requests
WHEN NEW.previous_leave_request_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM leave_requests original
  JOIN leave_procedure_bindings binding ON binding.leave_request_id = original.id
  JOIN system_cases workflow_case ON workflow_case.id = binding.case_id
  WHERE original.id = NEW.previous_leave_request_id
    AND original.employee_id = NEW.employee_id AND workflow_case.status = 'returned'
    AND NOT EXISTS (SELECT 1 FROM leave_procedure_bindings next WHERE next.previous_leave_request_id = original.id)
)
BEGIN
  SELECT RAISE(ABORT, 'leave_draft_source_invalid');
END;
CREATE TRIGGER leave_draft_source_immutable
BEFORE UPDATE OF previous_leave_request_id ON leave_requests
WHEN NEW.previous_leave_request_id IS NOT OLD.previous_leave_request_id
BEGIN
  SELECT RAISE(ABORT, 'leave_draft_source_immutable');
END;
CREATE TRIGGER leave_requests_source_freeze_insert BEFORE INSERT ON leave_requests
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'leave' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'leave_record_source_frozen'); END;
CREATE TRIGGER leave_requests_source_freeze_update BEFORE UPDATE ON leave_requests
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'leave' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'leave_record_source_frozen'); END;
CREATE TRIGGER leave_requests_source_freeze_delete BEFORE DELETE ON leave_requests
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'leave' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'leave_record_source_frozen'); END;
CREATE TRIGGER leave_requests_legacy_id_insert
BEFORE INSERT ON leave_requests
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER leave_requests_identity_update
BEFORE UPDATE OF id, legacy_id ON leave_requests
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- system_jobs
INSERT INTO system_jobs (id, operation_key, payload_digest, idempotency_key, created_by_account_id, status, attempt, max_attempts, available_at, lease_account_id, lease_token_hash, lease_expires_at, last_error_code, created_at, updated_at, completed_at, handler_key)
SELECT source.id,
       source.operation_key,
       source.payload_digest,
       source.idempotency_key,
       CASE WHEN source.created_by_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.created_by_account_id), source.created_by_account_id) END ,
       source.status,
       source.attempt,
       source.max_attempts,
       source.available_at,
       CASE WHEN source.lease_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.lease_account_id), source.lease_account_id) END ,
       source.lease_token_hash,
       source.lease_expires_at,
       source.last_error_code,
       source.created_at,
       source.updated_at,
       source.completed_at,
       source.handler_key
FROM "_stage_system_jobs" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_jobs',
       (SELECT count(*) FROM "_stage_system_jobs"),
       (SELECT count(*) FROM system_jobs),
       0,
       0,
       0;
DROP TABLE "_stage_system_jobs";
CREATE UNIQUE INDEX system_jobs_idempotency_uniq ON system_jobs (operation_key, idempotency_key);
CREATE INDEX system_jobs_claim_idx ON system_jobs (status, available_at, id);
CREATE INDEX system_jobs_lease_idx ON system_jobs (status, lease_expires_at);
CREATE INDEX system_jobs_handler_claim_idx ON system_jobs(handler_key, status, available_at, id);
CREATE TRIGGER system_jobs_monotonic_update
BEFORE UPDATE ON system_jobs
WHEN NEW.id <> OLD.id OR NEW.operation_key <> OLD.operation_key
  OR NEW.payload_digest <> OLD.payload_digest OR NEW.idempotency_key <> OLD.idempotency_key
  OR NEW.created_by_account_id <> OLD.created_by_account_id OR NEW.created_at <> OLD.created_at
  OR NEW.max_attempts <> OLD.max_attempts OR NEW.attempt < OLD.attempt OR NEW.attempt > OLD.attempt + 1
  OR NEW.updated_at < OLD.updated_at OR OLD.status IN ('succeeded', 'dead_letter')
  OR (OLD.status = 'queued' AND NEW.status NOT IN ('queued', 'leased'))
BEGIN
  SELECT RAISE(ABORT, 'system_job_update_invalid');
END;
CREATE TRIGGER system_jobs_no_delete BEFORE DELETE ON system_jobs
BEGIN SELECT RAISE(ABORT, 'system_jobs_are_retained'); END;
CREATE TRIGGER system_jobs_handler_immutable
BEFORE UPDATE ON system_jobs
WHEN NEW.handler_key IS NOT OLD.handler_key
BEGIN
  SELECT RAISE(ABORT, 'system_delivery_handler_immutable');
END;

-- leave_decision_notifications
INSERT INTO leave_decision_notifications (id, job_id, leave_request_id, decision_audit_id, payload_json)
SELECT source.id,
       source.job_id,
       source.leave_request_id,
       source.decision_audit_id,
       source.payload_json
FROM "_stage_leave_decision_notifications" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'leave_decision_notifications',
       (SELECT count(*) FROM "_stage_leave_decision_notifications"),
       (SELECT count(*) FROM leave_decision_notifications),
       0,
       0,
       0;
DROP TABLE "_stage_leave_decision_notifications";
CREATE TRIGGER leave_decision_notifications_immutable_update
BEFORE UPDATE ON leave_decision_notifications
BEGIN
  SELECT RAISE(ABORT, 'leave decision notification is immutable');
END;
CREATE TRIGGER leave_decision_notifications_immutable_delete
BEFORE DELETE ON leave_decision_notifications
BEGIN
  SELECT RAISE(ABORT, 'leave decision notification is immutable');
END;
CREATE TRIGGER leave_decision_notifications_source_freeze_insert BEFORE INSERT ON leave_decision_notifications
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'leave' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'leave_record_source_frozen'); END;
CREATE TRIGGER leave_decision_notifications_source_freeze_update BEFORE UPDATE ON leave_decision_notifications
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'leave' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'leave_record_source_frozen'); END;
CREATE TRIGGER leave_decision_notifications_source_freeze_delete BEFORE DELETE ON leave_decision_notifications
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'leave' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'leave_record_source_frozen'); END;
CREATE TRIGGER leave_decision_notifications_identity_update
BEFORE UPDATE OF id ON leave_decision_notifications
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- leave_procedure_bindings
INSERT INTO leave_procedure_bindings (id, request_key, leave_request_id, previous_leave_request_id, application_id, series_id, case_id, proposal_digest, created_at)
SELECT source.id,
       source.request_key,
       source.leave_request_id,
       source.previous_leave_request_id,
       source.application_id,
       source.series_id,
       source.case_id,
       source.proposal_digest,
       source.created_at
FROM "_stage_leave_procedure_bindings" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'leave_procedure_bindings',
       (SELECT count(*) FROM "_stage_leave_procedure_bindings"),
       (SELECT count(*) FROM leave_procedure_bindings),
       0,
       0,
       0;
DROP TABLE "_stage_leave_procedure_bindings";
CREATE UNIQUE INDEX leave_procedure_resubmission_once
  ON leave_procedure_bindings(previous_leave_request_id) WHERE previous_leave_request_id IS NOT NULL;
CREATE TRIGGER leave_procedure_binding_matches_proposal
BEFORE INSERT ON leave_procedure_bindings
WHEN NOT EXISTS (
  SELECT 1 FROM leave_requests request
  JOIN system_proposal_numbers number ON number.number = NEW.application_id AND number.series_id = NEW.series_id
  JOIN system_proposals proposal ON proposal.series_id = NEW.series_id AND proposal.version = 1
  JOIN system_proposal_cases association ON association.proposal_id = proposal.id AND association.case_id = NEW.case_id
  JOIN system_cases workflow_case ON workflow_case.id = NEW.case_id
  JOIN system_procedure_definition_revisions definition
    ON definition.procedure_key = proposal.procedure_key AND definition.revision = proposal.procedure_revision
  WHERE request.id = NEW.leave_request_id AND request.status = 'pending'
    AND proposal.digest = NEW.proposal_digest AND proposal.created_at = NEW.created_at
    AND request.created_at <= strftime('%Y-%m-%dT%H:%M:%fZ', proposal.created_at / 1000.0, 'unixepoch')
    AND definition.completion_operation_key = 'leave.request.authorize'
    AND workflow_case.subject_context = 'leave' AND workflow_case.subject_kind = 'request'
    AND workflow_case.subject_id = NEW.request_key AND workflow_case.subject_version = '1'
    AND workflow_case.status = 'pending'
    AND json_extract(proposal.body_json, '$.employeeId') IS request.employee_id
    AND json_extract(proposal.body_json, '$.leaveType') IS request.leave_type
    AND json_extract(proposal.body_json, '$.startDate') IS request.start_date
    AND json_extract(proposal.body_json, '$.endDate') IS request.end_date
    AND json_extract(proposal.body_json, '$.days') IS request.days
    AND json_extract(proposal.body_json, '$.unit') IS request.unit
    AND json_extract(proposal.body_json, '$.hours') IS request.hours
    AND json_extract(proposal.body_json, '$.consumedDays') IS request.consumed_days
    AND json_extract(proposal.body_json, '$.reason') IS request.reason
    AND (NEW.previous_leave_request_id IS NULL OR EXISTS (
      SELECT 1 FROM leave_procedure_bindings previous
      JOIN leave_requests original ON original.id = previous.leave_request_id
      JOIN system_cases previous_case ON previous_case.id = previous.case_id
      WHERE previous.leave_request_id = NEW.previous_leave_request_id
        AND previous.leave_request_id <> NEW.leave_request_id
        AND original.employee_id = request.employee_id AND previous_case.status = 'returned'
        AND previous_case.created_by_account_id = proposal.created_by_account_id
        AND previous_case.updated_at <= NEW.created_at
    ))
)
BEGIN
  SELECT RAISE(ABORT, 'leave_procedure_proposal_mismatch');
END;
CREATE TRIGGER leave_procedure_binding_immutable_update
BEFORE UPDATE ON leave_procedure_bindings
BEGIN
  SELECT RAISE(ABORT, 'leave_procedure_binding_immutable');
END;
CREATE TRIGGER leave_procedure_binding_immutable_delete
BEFORE DELETE ON leave_procedure_bindings
BEGIN
  SELECT RAISE(ABORT, 'leave_procedure_binding_immutable');
END;
CREATE TRIGGER leave_procedure_source_matches_draft
BEFORE INSERT ON leave_procedure_bindings
WHEN NOT EXISTS (
  SELECT 1 FROM leave_requests request WHERE request.id = NEW.leave_request_id
    AND request.previous_leave_request_id IS NEW.previous_leave_request_id
)
BEGIN
  SELECT RAISE(ABORT, 'leave_procedure_source_mismatch');
END;
CREATE TRIGGER leave_procedure_bindings_source_freeze_insert BEFORE INSERT ON leave_procedure_bindings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'leave' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'leave_record_source_frozen'); END;
CREATE TRIGGER leave_procedure_bindings_source_freeze_update BEFORE UPDATE ON leave_procedure_bindings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'leave' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'leave_record_source_frozen'); END;
CREATE TRIGGER leave_procedure_bindings_source_freeze_delete BEFORE DELETE ON leave_procedure_bindings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'leave' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'leave_record_source_frozen'); END;
CREATE TRIGGER leave_procedure_bindings_identity_update
BEFORE UPDATE OF id ON leave_procedure_bindings
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- life_events
INSERT INTO life_events (id, employee_id, event_type, event_date, detail, status, created_at)
SELECT source.id,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.event_type,
       source.event_date,
       source.detail,
       source.status,
       source.created_at
FROM "_stage_life_events" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'life_events',
       (SELECT count(*) FROM "_stage_life_events"),
       (SELECT count(*) FROM life_events),
       0,
       0,
       0;
DROP TABLE "_stage_life_events";
CREATE INDEX idx_life_events_employee ON life_events (employee_id);
CREATE TRIGGER life_events_source_freeze_delete
BEFORE DELETE ON life_events
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'life-event' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'life_event_record_source_frozen');
END;
CREATE TRIGGER life_events_source_freeze_insert
BEFORE INSERT ON life_events
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'life-event' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'life_event_record_source_frozen');
END;
CREATE TRIGGER life_events_source_freeze_update
BEFORE UPDATE ON life_events
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'life-event' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'life_event_record_source_frozen');
END;

-- meeting_minutes_records
INSERT INTO meeting_minutes_records (id, legacy_id, meeting_id, held_on, title, attendees, body_md, author_employee_id, created_at)
SELECT source.id,
       source.legacy_id,
       source.meeting_id,
       source.held_on,
       source.title,
       source.attendees,
       source.body_md,
       CASE WHEN source.author_employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.author_employee_id), source.author_employee_id) END ,
       source.created_at
FROM "_stage_meeting_minutes_records" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'meeting_minutes_records',
       (SELECT count(*) FROM "_stage_meeting_minutes_records"),
       (SELECT count(*) FROM meeting_minutes_records),
       0,
       0,
       0;
DROP TABLE "_stage_meeting_minutes_records";
CREATE INDEX idx_meeting_minutes_meeting ON "meeting_minutes_records" (meeting_id);
CREATE TRIGGER meeting_minutes_records_source_freeze_delete BEFORE DELETE ON meeting_minutes_records
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'meeting' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'meeting_record_source_frozen'); END;
CREATE TRIGGER meeting_minutes_records_source_freeze_insert BEFORE INSERT ON meeting_minutes_records
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'meeting' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'meeting_record_source_frozen'); END;
CREATE TRIGGER meeting_minutes_records_source_freeze_update BEFORE UPDATE ON meeting_minutes_records
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'meeting' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'meeting_record_source_frozen'); END;
CREATE TRIGGER meeting_minutes_records_legacy_id_insert
BEFORE INSERT ON meeting_minutes_records
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER meeting_minutes_records_identity_update
BEFORE UPDATE OF id, legacy_id ON meeting_minutes_records
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- onboarding_assignments
INSERT INTO onboarding_assignments (id, legacy_id, employee_id, template_code, kind, status, assigned_at, lifecycle_action_id)
SELECT source.id,
       source.legacy_id,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.template_code,
       source.kind,
       source.status,
       source.assigned_at,
       CASE WHEN source.lifecycle_action_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.lifecycle_action_id), source.lifecycle_action_id) END
FROM "_stage_onboarding_assignments" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'onboarding_assignments',
       (SELECT count(*) FROM "_stage_onboarding_assignments"),
       (SELECT count(*) FROM onboarding_assignments),
       0,
       0,
       0;
DROP TABLE "_stage_onboarding_assignments";
CREATE INDEX idx_onboarding_assignments_employee ON onboarding_assignments (employee_id);
CREATE UNIQUE INDEX onboarding_assignments_lifecycle_action_uniq ON onboarding_assignments(lifecycle_action_id);
CREATE UNIQUE INDEX uq_onboarding_assignments_employee_template
ON onboarding_assignments (employee_id, template_code)
WHERE status NOT IN ('completed', 'superseded');
CREATE TRIGGER onboarding_assignments_lifecycle_immutable
BEFORE UPDATE ON onboarding_assignments
WHEN NEW.lifecycle_action_id IS NOT OLD.lifecycle_action_id
BEGIN
  SELECT RAISE(ABORT, 'onboarding_assignment_lifecycle_immutable');
END;
CREATE TRIGGER onboarding_assignments_source_freeze_delete BEFORE DELETE ON onboarding_assignments
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'onboarding_record_source_frozen'); END;
CREATE TRIGGER onboarding_assignments_source_freeze_insert BEFORE INSERT ON onboarding_assignments
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'onboarding_record_source_frozen'); END;
CREATE TRIGGER onboarding_assignments_source_freeze_update BEFORE UPDATE ON onboarding_assignments
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'onboarding_record_source_frozen'); END;
CREATE TRIGGER onboarding_assignments_supersede_lifecycle_only
BEFORE UPDATE OF status ON onboarding_assignments
WHEN NEW.status = 'superseded' AND OLD.status <> 'superseded'
  AND (OLD.status <> 'in_progress' OR OLD.lifecycle_action_id IS NULL)
BEGIN SELECT RAISE(ABORT, 'onboarding_assignment_supersede_invalid'); END;
CREATE TRIGGER onboarding_assignments_superseded_immutable
BEFORE UPDATE ON onboarding_assignments
WHEN OLD.status = 'superseded'
BEGIN SELECT RAISE(ABORT, 'onboarding_assignment_superseded'); END;
CREATE TRIGGER onboarding_assignments_superseded_insert
BEFORE INSERT ON onboarding_assignments
WHEN NEW.status = 'superseded'
BEGIN SELECT RAISE(ABORT, 'onboarding_assignment_supersede_invalid'); END;
CREATE TRIGGER onboarding_assignments_superseded_no_delete
BEFORE DELETE ON onboarding_assignments
WHEN OLD.status = 'superseded'
BEGIN SELECT RAISE(ABORT, 'onboarding_assignment_superseded'); END;
CREATE TRIGGER onboarding_assignments_legacy_id_insert
BEFORE INSERT ON onboarding_assignments
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER onboarding_assignments_identity_update
BEFORE UPDATE OF id, legacy_id ON onboarding_assignments
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- onboarding_lifecycle_deliveries
INSERT INTO onboarding_lifecycle_deliveries (job_id, action_id, created_at, outcome, assignment_id, processed_at)
SELECT source.job_id,
       CASE WHEN source.action_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.action_id), source.action_id) END ,
       source.created_at,
       source.outcome,
       source.assignment_id,
       source.processed_at
FROM "_stage_onboarding_lifecycle_deliveries" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'onboarding_lifecycle_deliveries',
       (SELECT count(*) FROM "_stage_onboarding_lifecycle_deliveries"),
       (SELECT count(*) FROM onboarding_lifecycle_deliveries),
       0,
       0,
       0;
DROP TABLE "_stage_onboarding_lifecycle_deliveries";
CREATE INDEX onboarding_lifecycle_deliveries_action_idx ON onboarding_lifecycle_deliveries(action_id, created_at);
CREATE TRIGGER onboarding_lifecycle_deliveries_monotonic_update
BEFORE UPDATE ON onboarding_lifecycle_deliveries
WHEN NEW.job_id <> OLD.job_id OR NEW.action_id <> OLD.action_id OR NEW.created_at <> OLD.created_at
  OR OLD.processed_at IS NOT NULL OR NEW.processed_at IS NULL
BEGIN
  SELECT RAISE(ABORT, 'onboarding_lifecycle_delivery_update_invalid');
END;
CREATE TRIGGER onboarding_lifecycle_deliveries_no_delete
BEFORE DELETE ON onboarding_lifecycle_deliveries
BEGIN
  SELECT RAISE(ABORT, 'onboarding_lifecycle_deliveries_are_retained');
END;
CREATE TRIGGER onboarding_lifecycle_deliveries_source_freeze_delete BEFORE DELETE ON onboarding_lifecycle_deliveries
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'onboarding_record_source_frozen'); END;
CREATE TRIGGER onboarding_lifecycle_deliveries_source_freeze_insert BEFORE INSERT ON onboarding_lifecycle_deliveries
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'onboarding_record_source_frozen'); END;
CREATE TRIGGER onboarding_lifecycle_deliveries_source_freeze_update BEFORE UPDATE ON onboarding_lifecycle_deliveries
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'onboarding_record_source_frozen'); END;

-- onboarding_lifecycle_template_bindings
INSERT INTO onboarding_lifecycle_template_bindings (id, effect_type, template_code, updated_at, updated_by_account_id)
SELECT source.id,
       source.effect_type,
       source.template_code,
       source.updated_at,
       CASE WHEN source.updated_by_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.updated_by_account_id), source.updated_by_account_id) END
FROM "_stage_onboarding_lifecycle_template_bindings" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'onboarding_lifecycle_template_bindings',
       (SELECT count(*) FROM "_stage_onboarding_lifecycle_template_bindings"),
       (SELECT count(*) FROM onboarding_lifecycle_template_bindings),
       0,
       0,
       0;
DROP TABLE "_stage_onboarding_lifecycle_template_bindings";
CREATE TRIGGER onboarding_lifecycle_template_bindings_source_freeze_delete BEFORE DELETE ON onboarding_lifecycle_template_bindings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'onboarding_record_source_frozen'); END;
CREATE TRIGGER onboarding_lifecycle_template_bindings_source_freeze_insert BEFORE INSERT ON onboarding_lifecycle_template_bindings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'onboarding_record_source_frozen'); END;
CREATE TRIGGER onboarding_lifecycle_template_bindings_source_freeze_update BEFORE UPDATE ON onboarding_lifecycle_template_bindings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'onboarding_record_source_frozen'); END;
CREATE TRIGGER onboarding_lifecycle_template_bindings_identity_update
BEFORE UPDATE OF id ON onboarding_lifecycle_template_bindings
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- one_on_ones
INSERT INTO one_on_ones (id, member_id, manager_id, held_at, topics, manager_note, next_action, external_reference)
SELECT source.id,
       CASE WHEN source.member_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.member_id), source.member_id) END ,
       CASE WHEN source.manager_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.manager_id), source.manager_id) END ,
       source.held_at,
       source.topics,
       source.manager_note,
       source.next_action,
       source.external_reference
FROM "_stage_one_on_ones" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'one_on_ones',
       (SELECT count(*) FROM "_stage_one_on_ones"),
       (SELECT count(*) FROM one_on_ones),
       0,
       0,
       0;
DROP TABLE "_stage_one_on_ones";
CREATE INDEX idx_one_on_ones_manager ON one_on_ones (manager_id);
CREATE INDEX idx_one_on_ones_member ON one_on_ones (member_id);
CREATE TRIGGER one_on_ones_source_freeze_delete
BEFORE DELETE ON one_on_ones
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'one-on-one' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'one_on_one_record_source_frozen'); END;
CREATE TRIGGER one_on_ones_source_freeze_insert
BEFORE INSERT ON one_on_ones
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'one-on-one' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'one_on_one_record_source_frozen'); END;
CREATE TRIGGER one_on_ones_source_freeze_update
BEFORE UPDATE ON one_on_ones
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'one-on-one' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'one_on_one_record_source_frozen'); END;

-- performance_goals
INSERT INTO performance_goals (id, created_at, legacy_id, employee_id, period, title, kpi, weight, status, owner_type, parent_goal_id, department_code, evaluation_sheet_id)
SELECT source.id,
       source.created_at,
       source.legacy_id,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.period,
       source.title,
       source.kpi,
       source.weight,
       source.status,
       source.owner_type,
       source.parent_goal_id,
       source.department_code,
       source.evaluation_sheet_id
FROM "_stage_performance_goals" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'performance_goals',
       (SELECT count(*) FROM "_stage_performance_goals"),
       (SELECT count(*) FROM performance_goals),
       0,
       0,
       0;
DROP TABLE "_stage_performance_goals";
CREATE INDEX idx_goals_department ON "performance_goals" (department_code);
CREATE INDEX idx_goals_employee ON "performance_goals" (employee_id);
CREATE INDEX idx_goals_owner_type ON "performance_goals" (owner_type);
CREATE INDEX idx_goals_parent ON "performance_goals" (parent_goal_id);
CREATE INDEX idx_goals_period ON "performance_goals" (period);
CREATE INDEX idx_performance_goals_evaluation_sheet
ON performance_goals (evaluation_sheet_id);
CREATE TRIGGER performance_goals_source_freeze_delete BEFORE DELETE ON performance_goals
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;
CREATE TRIGGER performance_goals_source_freeze_insert BEFORE INSERT ON performance_goals
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;
CREATE TRIGGER performance_goals_source_freeze_update BEFORE UPDATE ON performance_goals
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;
CREATE TRIGGER performance_goals_legacy_id_insert
BEFORE INSERT ON performance_goals
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER performance_goals_identity_update
BEFORE UPDATE OF id, legacy_id ON performance_goals
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- rental_reservations
INSERT INTO rental_reservations (id, requester_id, item_name, start_date, end_date, purpose, status, created_at)
SELECT source.id,
       CASE WHEN source.requester_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.requester_id), source.requester_id) END ,
       source.item_name,
       source.start_date,
       source.end_date,
       source.purpose,
       source.status,
       source.created_at
FROM "_stage_rental_reservations" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'rental_reservations',
       (SELECT count(*) FROM "_stage_rental_reservations"),
       (SELECT count(*) FROM rental_reservations),
       0,
       0,
       0;
DROP TABLE "_stage_rental_reservations";
CREATE INDEX idx_rental_reservations_requester ON rental_reservations (requester_id);
CREATE TRIGGER rental_reservations_source_freeze_delete
BEFORE DELETE ON rental_reservations
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'rental' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'rental_reservation_record_source_frozen'); END;
CREATE TRIGGER rental_reservations_source_freeze_insert
BEFORE INSERT ON rental_reservations
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'rental' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'rental_reservation_record_source_frozen'); END;
CREATE TRIGGER rental_reservations_source_freeze_update
BEFORE UPDATE ON rental_reservations
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'rental' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'rental_reservation_record_source_frozen'); END;

-- resignations
INSERT INTO resignations (id, employee_id, resignation_date, last_working_date, reason, status, created_at)
SELECT source.id,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.resignation_date,
       source.last_working_date,
       source.reason,
       source.status,
       source.created_at
FROM "_stage_resignations" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'resignations',
       (SELECT count(*) FROM "_stage_resignations"),
       (SELECT count(*) FROM resignations),
       0,
       0,
       0;
DROP TABLE "_stage_resignations";
CREATE INDEX idx_resignations_employee ON resignations (employee_id);
CREATE UNIQUE INDEX idx_resignations_employee_requested
ON resignations (employee_id)
WHERE status = 'requested';
CREATE TRIGGER resignations_source_freeze_delete
BEFORE DELETE ON resignations
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'resignation' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'resignation_record_source_frozen');
END;
CREATE TRIGGER resignations_source_freeze_insert
BEFORE INSERT ON resignations
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'resignation' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'resignation_record_source_frozen');
END;
CREATE TRIGGER resignations_source_freeze_update
BEFORE UPDATE ON resignations
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'resignation' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'resignation_record_source_frozen');
END;

-- review_forms
INSERT INTO review_forms (id, created_at, legacy_id, cycle_id, subject_employee_id, reviewer_employee_id, reviewer_type, answers, score, status, submitted_at, comment, visibility)
SELECT source.id,
       source.created_at,
       source.legacy_id,
       source.cycle_id,
       CASE WHEN source.subject_employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.subject_employee_id), source.subject_employee_id) END ,
       CASE WHEN source.reviewer_employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.reviewer_employee_id), source.reviewer_employee_id) END ,
       source.reviewer_type,
       source.answers,
       source.score,
       source.status,
       source.submitted_at,
       source.comment,
       source.visibility
FROM "_stage_review_forms" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'review_forms',
       (SELECT count(*) FROM "_stage_review_forms"),
       (SELECT count(*) FROM review_forms),
       0,
       0,
       0;
DROP TABLE "_stage_review_forms";
CREATE INDEX idx_review_forms_cycle_subject ON review_forms (cycle_id, subject_employee_id);
CREATE INDEX idx_review_forms_reviewer ON review_forms (reviewer_employee_id);
CREATE UNIQUE INDEX uq_review_form_assignment
  ON review_forms (cycle_id, subject_employee_id, reviewer_employee_id, reviewer_type);
CREATE TRIGGER review_forms_source_freeze_delete BEFORE DELETE ON review_forms
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;
CREATE TRIGGER review_forms_source_freeze_insert BEFORE INSERT ON review_forms
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;
CREATE TRIGGER review_forms_source_freeze_update BEFORE UPDATE ON review_forms
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;
CREATE TRIGGER review_forms_legacy_id_insert
BEFORE INSERT ON review_forms
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER review_forms_identity_update
BEFORE UPDATE OF id, legacy_id ON review_forms
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- ringi_requests
INSERT INTO ringi_requests (id, legacy_id, applicant_id, approver_id, title, amount, reason, status, decided_at, decision_comment, created_at)
SELECT source.id,
       source.legacy_id,
       CASE WHEN source.applicant_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.applicant_id), source.applicant_id) END ,
       CASE WHEN source.approver_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.approver_id), source.approver_id) END ,
       source.title,
       source.amount,
       source.reason,
       source.status,
       source.decided_at,
       source.decision_comment,
       source.created_at
FROM "_stage_ringi_requests" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'ringi_requests',
       (SELECT count(*) FROM "_stage_ringi_requests"),
       (SELECT count(*) FROM ringi_requests),
       0,
       0,
       0;
DROP TABLE "_stage_ringi_requests";
CREATE INDEX idx_ringi_requests_applicant ON ringi_requests (applicant_id);
CREATE INDEX idx_ringi_requests_approver ON ringi_requests (approver_id);
CREATE INDEX idx_ringi_requests_status ON ringi_requests (status);
CREATE TRIGGER ringi_procedure_request_immutable
BEFORE UPDATE ON ringi_requests
WHEN EXISTS (SELECT 1 FROM ringi_procedure_bindings WHERE ringi_id = OLD.id)
 AND (NEW.id IS NOT OLD.id OR NEW.applicant_id IS NOT OLD.applicant_id
   OR NEW.approver_id IS NOT OLD.approver_id OR NEW.title IS NOT OLD.title
   OR NEW.amount IS NOT OLD.amount OR NEW.reason IS NOT OLD.reason
   OR NEW.created_at IS NOT OLD.created_at OR OLD.status <> 'pending'
   OR NEW.status NOT IN ('approved', 'rejected'))
BEGIN
  SELECT RAISE(ABORT, 'ringi_procedure_request_immutable');
END;
CREATE TRIGGER ringi_procedure_request_requires_execution
BEFORE UPDATE ON ringi_requests
WHEN EXISTS (SELECT 1 FROM ringi_procedure_bindings WHERE ringi_id = OLD.id)
 AND NOT EXISTS (
   SELECT 1 FROM ringi_procedure_bindings binding
   JOIN system_cases workflow_case ON workflow_case.id = binding.case_id
   WHERE binding.ringi_id = OLD.id
     AND ((NEW.status = 'rejected' AND workflow_case.status = 'rejected')
       OR (NEW.status = 'approved' AND workflow_case.status = 'approved' AND EXISTS (
         SELECT 1 FROM system_execution_authorizations authorization
         WHERE authorization.case_id = binding.case_id
           AND authorization.operation_key = 'ringi.request.authorize'
           AND authorization.proposal_digest = binding.proposal_digest
           AND authorization.used_at IS NULL
           AND NEW.decided_at = strftime('%Y-%m-%dT%H:%M:%fZ', authorization.granted_at / 1000.0, 'unixepoch')
       )))
 )
BEGIN
  SELECT RAISE(ABORT, 'ringi_procedure_execution_required');
END;
CREATE TRIGGER ringi_requests_source_freeze_insert BEFORE INSERT ON ringi_requests
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'ringi' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'ringi_record_source_frozen'); END;
CREATE TRIGGER ringi_requests_source_freeze_update BEFORE UPDATE ON ringi_requests
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'ringi' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'ringi_record_source_frozen'); END;
CREATE TRIGGER ringi_requests_source_freeze_delete BEFORE DELETE ON ringi_requests
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'ringi' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'ringi_record_source_frozen'); END;
CREATE TRIGGER ringi_requests_legacy_id_insert
BEFORE INSERT ON ringi_requests
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER ringi_requests_identity_update
BEFORE UPDATE OF id, legacy_id ON ringi_requests
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- ringi_procedure_bindings
INSERT INTO ringi_procedure_bindings (id, request_key, ringi_id, application_id, series_id, case_id, proposal_digest, created_at, previous_ringi_id)
SELECT source.id,
       source.request_key,
       source.ringi_id,
       source.application_id,
       source.series_id,
       source.case_id,
       source.proposal_digest,
       source.created_at,
       source.previous_ringi_id
FROM "_stage_ringi_procedure_bindings" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'ringi_procedure_bindings',
       (SELECT count(*) FROM "_stage_ringi_procedure_bindings"),
       (SELECT count(*) FROM ringi_procedure_bindings),
       0,
       0,
       0;
DROP TABLE "_stage_ringi_procedure_bindings";
CREATE UNIQUE INDEX ringi_resubmission_once ON ringi_procedure_bindings(previous_ringi_id) WHERE previous_ringi_id IS NOT NULL;
CREATE TRIGGER ringi_procedure_binding_immutable_update
BEFORE UPDATE ON ringi_procedure_bindings
BEGIN
  SELECT RAISE(ABORT, 'ringi_procedure_binding_immutable');
END;
CREATE TRIGGER ringi_procedure_binding_immutable_delete
BEFORE DELETE ON ringi_procedure_bindings
BEGIN
  SELECT RAISE(ABORT, 'ringi_procedure_binding_immutable');
END;
CREATE TRIGGER ringi_procedure_binding_matches_proposal
BEFORE INSERT ON ringi_procedure_bindings
WHEN NOT EXISTS (
  SELECT 1 FROM ringi_requests request
  JOIN system_proposal_numbers number ON number.number = NEW.application_id AND number.series_id = NEW.series_id
  JOIN system_proposals proposal ON proposal.series_id = NEW.series_id AND proposal.version = 1
  JOIN system_proposal_cases association ON association.proposal_id = proposal.id AND association.case_id = NEW.case_id
  JOIN system_cases workflow_case ON workflow_case.id = NEW.case_id
  JOIN system_procedure_definition_revisions definition
    ON definition.procedure_key = proposal.procedure_key AND definition.revision = proposal.procedure_revision
  WHERE request.id = NEW.ringi_id AND request.status = 'pending'
    AND request.applicant_id <> request.approver_id
    AND proposal.digest = NEW.proposal_digest AND proposal.created_at = NEW.created_at
    AND request.created_at <= strftime('%Y-%m-%dT%H:%M:%fZ', proposal.created_at / 1000.0, 'unixepoch')
    AND definition.completion_operation_key = 'ringi.request.authorize'
    AND workflow_case.subject_context = 'ringi' AND workflow_case.subject_kind = 'request'
    AND workflow_case.subject_id = NEW.request_key AND workflow_case.subject_version = '1'
    AND workflow_case.status = 'pending'
    AND json_extract(proposal.body_json, '$.applicantId') IS request.applicant_id
    AND json_extract(proposal.body_json, '$.requestedApproverId') IS request.approver_id
    AND json_extract(proposal.body_json, '$.title') IS request.title
    AND json_extract(proposal.body_json, '$.amount') IS request.amount
    AND json_extract(proposal.body_json, '$.reason') IS request.reason
    AND (NEW.previous_ringi_id IS NULL OR EXISTS (
      SELECT 1 FROM ringi_procedure_bindings previous
      JOIN ringi_requests original ON original.id = previous.ringi_id
      JOIN system_cases previous_case ON previous_case.id = previous.case_id
      WHERE previous.ringi_id = NEW.previous_ringi_id AND previous.ringi_id <> NEW.ringi_id
        AND original.applicant_id = request.applicant_id AND previous_case.status = 'returned'
        AND previous_case.created_by_account_id = proposal.created_by_account_id
        AND previous_case.updated_at <= NEW.created_at
    ))
)
BEGIN
  SELECT RAISE(ABORT, 'ringi_procedure_proposal_mismatch');
END;
CREATE TRIGGER ringi_procedure_bindings_source_freeze_insert BEFORE INSERT ON ringi_procedure_bindings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'ringi' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'ringi_record_source_frozen'); END;
CREATE TRIGGER ringi_procedure_bindings_source_freeze_update BEFORE UPDATE ON ringi_procedure_bindings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'ringi' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'ringi_record_source_frozen'); END;
CREATE TRIGGER ringi_procedure_bindings_source_freeze_delete BEFORE DELETE ON ringi_procedure_bindings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'ringi' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'ringi_record_source_frozen'); END;
CREATE TRIGGER ringi_procedure_bindings_identity_update
BEFORE UPDATE OF id ON ringi_procedure_bindings
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- room_reservations
INSERT INTO room_reservations (id, room_id, reserver_id, start_at, end_at, purpose)
SELECT source.id,
       source.room_id,
       CASE WHEN source.reserver_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.reserver_id), source.reserver_id) END ,
       source.start_at,
       source.end_at,
       source.purpose
FROM "_stage_room_reservations" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'room_reservations',
       (SELECT count(*) FROM "_stage_room_reservations"),
       (SELECT count(*) FROM room_reservations),
       0,
       0,
       0;
DROP TABLE "_stage_room_reservations";
CREATE INDEX idx_room_reservations_reserver ON room_reservations (reserver_id);
CREATE INDEX idx_room_reservations_room ON room_reservations (room_id);
CREATE INDEX idx_room_reservations_room_time ON room_reservations (room_id, start_at, end_at);
CREATE TRIGGER room_reservations_source_freeze_delete BEFORE DELETE ON room_reservations
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'room' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'room_record_source_frozen'); END;
CREATE TRIGGER room_reservations_source_freeze_insert BEFORE INSERT ON room_reservations
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'room' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'room_record_source_frozen'); END;
CREATE TRIGGER room_reservations_source_freeze_update BEFORE UPDATE ON room_reservations
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'room' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'room_record_source_frozen'); END;

-- salary_revisions
INSERT INTO salary_revisions (id, employee_id, effective_date, previous_base_salary, new_base_salary, reason, created_at, legacy_id)
SELECT source.id,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.effective_date,
       source.previous_base_salary,
       source.new_base_salary,
       source.reason,
       source.created_at,
       source.legacy_id
FROM "_stage_salary_revisions" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'salary_revisions',
       (SELECT count(*) FROM "_stage_salary_revisions"),
       (SELECT count(*) FROM salary_revisions),
       0,
       0,
       0;
DROP TABLE "_stage_salary_revisions";
CREATE INDEX idx_salary_revisions_employee ON salary_revisions (employee_id);
CREATE UNIQUE INDEX uq_salary_revisions_employee_date ON salary_revisions (employee_id, effective_date);
CREATE TRIGGER salary_revisions_source_freeze_delete BEFORE DELETE ON salary_revisions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='compensation-change' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'compensation_change_record_source_frozen'); END;
CREATE TRIGGER salary_revisions_source_freeze_insert BEFORE INSERT ON salary_revisions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='compensation-change' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'compensation_change_record_source_frozen'); END;
CREATE TRIGGER salary_revisions_source_freeze_update BEFORE UPDATE ON salary_revisions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='compensation-change' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'compensation_change_record_source_frozen'); END;
CREATE TRIGGER salary_revisions_legacy_id_insert
BEFORE INSERT ON salary_revisions
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER salary_revisions_identity_update
BEFORE UPDATE OF id, legacy_id ON salary_revisions
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- shift_assignments
INSERT INTO shift_assignments (id, created_at, legacy_id, employee_id, pattern_id, date, note, published_at)
SELECT source.id,
       source.created_at,
       source.legacy_id,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.pattern_id,
       source.date,
       source.note,
       source.published_at
FROM "_stage_shift_assignments" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'shift_assignments',
       (SELECT count(*) FROM "_stage_shift_assignments"),
       (SELECT count(*) FROM shift_assignments),
       0,
       0,
       0;
DROP TABLE "_stage_shift_assignments";
CREATE INDEX idx_shift_assignments_date ON shift_assignments (date);
CREATE INDEX idx_shift_assignments_employee ON shift_assignments (employee_id);
CREATE INDEX idx_shift_assignments_pattern ON shift_assignments (pattern_id);
CREATE UNIQUE INDEX uq_shift_assignment_employee_date
  ON shift_assignments (employee_id, date);
CREATE TRIGGER shift_assignments_source_freeze_delete BEFORE DELETE ON shift_assignments
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'shift' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'shift_record_source_frozen'); END;
CREATE TRIGGER shift_assignments_source_freeze_insert BEFORE INSERT ON shift_assignments
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'shift' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'shift_record_source_frozen'); END;
CREATE TRIGGER shift_assignments_source_freeze_update BEFORE UPDATE ON shift_assignments
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'shift' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'shift_record_source_frozen'); END;
CREATE TRIGGER shift_assignments_legacy_id_insert
BEFORE INSERT ON shift_assignments
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER shift_assignments_identity_update
BEFORE UPDATE OF id, legacy_id ON shift_assignments
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- shift_swap_requests
INSERT INTO shift_swap_requests (id, created_at, legacy_id, requester_employee_id, target_employee_id, date, note, status, approved_at)
SELECT source.id,
       source.created_at,
       source.legacy_id,
       CASE WHEN source.requester_employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.requester_employee_id), source.requester_employee_id) END ,
       CASE WHEN source.target_employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.target_employee_id), source.target_employee_id) END ,
       source.date,
       source.note,
       source.status,
       source.approved_at
FROM "_stage_shift_swap_requests" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'shift_swap_requests',
       (SELECT count(*) FROM "_stage_shift_swap_requests"),
       (SELECT count(*) FROM shift_swap_requests),
       0,
       0,
       0;
DROP TABLE "_stage_shift_swap_requests";
CREATE UNIQUE INDEX idx_shift_swap_requests_pending
ON shift_swap_requests (requester_employee_id, target_employee_id, date)
WHERE status = 'pending';
CREATE INDEX idx_shift_swap_requests_requester ON shift_swap_requests (requester_employee_id);
CREATE TRIGGER shift_swap_requests_source_freeze_delete BEFORE DELETE ON shift_swap_requests
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'shift' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'shift_record_source_frozen'); END;
CREATE TRIGGER shift_swap_requests_source_freeze_insert BEFORE INSERT ON shift_swap_requests
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'shift' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'shift_record_source_frozen'); END;
CREATE TRIGGER shift_swap_requests_source_freeze_update BEFORE UPDATE ON shift_swap_requests
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'shift' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'shift_record_source_frozen'); END;
CREATE TRIGGER shift_swap_requests_legacy_id_insert
BEFORE INSERT ON shift_swap_requests
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER shift_swap_requests_identity_update
BEFORE UPDATE OF id, legacy_id ON shift_swap_requests
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- software_licenses
INSERT INTO software_licenses (id, legacy_id, name, vendor, category, seats, renewal_deadline, owner_employee_id, note, status, created_at, plan_name, revision)
SELECT source.id,
       source.legacy_id,
       source.name,
       source.vendor,
       source.category,
       source.seats,
       source.renewal_deadline,
       CASE WHEN source.owner_employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.owner_employee_id), source.owner_employee_id) END ,
       source.note,
       source.status,
       source.created_at,
       source.plan_name,
       source.revision
FROM "_stage_software_licenses" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'software_licenses',
       (SELECT count(*) FROM "_stage_software_licenses"),
       (SELECT count(*) FROM software_licenses),
       0,
       0,
       0;
DROP TABLE "_stage_software_licenses";
CREATE INDEX idx_licenses_renewal_deadline ON "software_licenses" (renewal_deadline);
CREATE TRIGGER software_license_active_assignments_guard BEFORE UPDATE ON software_licenses
WHEN (NEW.status <> 'active' AND EXISTS (SELECT 1 FROM software_license_assignments WHERE license_id = OLD.id AND released_at IS NULL))
  OR (NEW.seats IS NOT NULL AND NEW.seats < (SELECT count(*) FROM software_license_assignments WHERE license_id = OLD.id AND released_at IS NULL))
BEGIN SELECT RAISE(ABORT, 'software_license_capacity_conflict'); END;
CREATE TRIGGER software_licenses_source_freeze_insert
BEFORE INSERT ON software_licenses
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'software-license' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'software_license_record_source_frozen'); END;
CREATE TRIGGER software_licenses_source_freeze_update
BEFORE UPDATE ON software_licenses
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'software-license' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'software_license_record_source_frozen'); END;
CREATE TRIGGER software_licenses_source_freeze_delete
BEFORE DELETE ON software_licenses
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'software-license' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'software_license_record_source_frozen'); END;
CREATE TRIGGER software_licenses_legacy_id_insert
BEFORE INSERT ON software_licenses
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER software_licenses_identity_update
BEFORE UPDATE OF id, legacy_id ON software_licenses
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- software_license_assignments
INSERT INTO software_license_assignments (id, license_id, employee_id, service_name, plan_name, account_reference, assigned_at, assigned_by, assigned_reason, released_at, released_by, release_reason)
SELECT source.id,
       source.license_id,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.service_name,
       source.plan_name,
       CASE WHEN source.account_reference IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.account_reference), source.account_reference) END ,
       source.assigned_at,
       CASE WHEN source.assigned_by IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.assigned_by), source.assigned_by) END ,
       source.assigned_reason,
       source.released_at,
       CASE WHEN source.released_by IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.released_by), source.released_by) END ,
       source.release_reason
FROM "_stage_software_license_assignments" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'software_license_assignments',
       (SELECT count(*) FROM "_stage_software_license_assignments"),
       (SELECT count(*) FROM software_license_assignments),
       0,
       0,
       0;
DROP TABLE "_stage_software_license_assignments";
CREATE UNIQUE INDEX software_license_active_employee ON software_license_assignments(license_id, employee_id) WHERE released_at IS NULL;
CREATE UNIQUE INDEX software_license_active_account ON software_license_assignments(license_id, account_reference) WHERE released_at IS NULL AND account_reference IS NOT NULL;
CREATE INDEX software_license_employee_history ON software_license_assignments(employee_id, assigned_at, id);
CREATE TRIGGER software_license_assignment_capacity BEFORE INSERT ON software_license_assignments
BEGIN
  SELECT RAISE(ABORT, 'software_license_capacity_conflict') WHERE NEW.released_at IS NOT NULL OR NOT EXISTS (
    SELECT 1 FROM software_licenses license WHERE license.id = NEW.license_id AND license.status = 'active'
      AND (license.seats IS NULL OR license.seats > (
        SELECT count(*) FROM software_license_assignments WHERE license_id = NEW.license_id AND released_at IS NULL
      ))
  );
END;
CREATE TRIGGER software_license_assignment_history_update BEFORE UPDATE ON software_license_assignments
WHEN OLD.released_at IS NOT NULL OR NEW.released_at IS NULL
  OR NEW.id IS NOT OLD.id OR NEW.license_id IS NOT OLD.license_id OR NEW.employee_id IS NOT OLD.employee_id
  OR NEW.service_name IS NOT OLD.service_name OR NEW.plan_name IS NOT OLD.plan_name
  OR NEW.account_reference IS NOT OLD.account_reference OR NEW.assigned_at IS NOT OLD.assigned_at
  OR NEW.assigned_by IS NOT OLD.assigned_by OR NEW.assigned_reason IS NOT OLD.assigned_reason
BEGIN SELECT RAISE(ABORT, 'software_license_history_immutable'); END;
CREATE TRIGGER software_license_assignment_history_delete BEFORE DELETE ON software_license_assignments
BEGIN SELECT RAISE(ABORT, 'software_license_history_immutable'); END;
CREATE TRIGGER software_license_assignments_source_freeze_insert
BEFORE INSERT ON software_license_assignments
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'software-license' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'software_license_record_source_frozen'); END;
CREATE TRIGGER software_license_assignments_source_freeze_update
BEFORE UPDATE ON software_license_assignments
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'software-license' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'software_license_record_source_frozen'); END;
CREATE TRIGGER software_license_assignments_source_freeze_delete
BEFORE DELETE ON software_license_assignments
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'software-license' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'software_license_record_source_frozen'); END;

-- software_license_changes
INSERT INTO software_license_changes (id, license_id, actor_account_id, recorded_at, command_id, request_json, before_json, after_json)
SELECT source.id,
       source.license_id,
       CASE WHEN source.actor_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.actor_account_id), source.actor_account_id) END ,
       source.recorded_at,
       source.command_id,
       CASE WHEN json_valid(source.request_json) AND json_type(source.request_json) = 'object' THEN json_replace(source.request_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.request_json, '$.accountId')), json_extract(source.request_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.request_json, '$.actorAccountId')), json_extract(source.request_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.request_json, '$.release.actorAccountId')), json_extract(source.request_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.request_json, '$.employeeId')), json_extract(source.request_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.request_json, '$.managerEmployeeId')), json_extract(source.request_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.request_json, '$.targetEmployeeId')), json_extract(source.request_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.request_json, '$.requestedByEmployeeId')), json_extract(source.request_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.request_json, '$.requestedApproverId')), json_extract(source.request_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.request_json, '$.applicantId')), json_extract(source.request_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.request_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.request_json, '$.holderId')), json_extract(source.request_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.request_json, '$.personId')), json_extract(source.request_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.request_json, '$.employmentId')), json_extract(source.request_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.request_json, '$.periodId')), json_extract(source.request_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.request_json, '$.resourceId')), json_extract(source.request_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.request_json, '$.existingResourceId')), json_extract(source.request_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.request_json, '$.scopeId')), json_extract(source.request_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.request_json, '$.authorityScopeId')), json_extract(source.request_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.request_json, '$.responsibilityId')), json_extract(source.request_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.request_json, '$.collectiveBodyId')), json_extract(source.request_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.request_json, '$.organizationalOfficeId')), json_extract(source.request_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.request_json, '$.positionId')), json_extract(source.request_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.request_json, '$.jobId')), json_extract(source.request_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.request_json, '$.siteId')), json_extract(source.request_json, '$.siteId'))) ELSE source.request_json END ,
       CASE WHEN json_valid(source.before_json) AND json_type(source.before_json) = 'object' THEN json_replace(source.before_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.before_json, '$.accountId')), json_extract(source.before_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.before_json, '$.actorAccountId')), json_extract(source.before_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.before_json, '$.release.actorAccountId')), json_extract(source.before_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.before_json, '$.employeeId')), json_extract(source.before_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.before_json, '$.managerEmployeeId')), json_extract(source.before_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.before_json, '$.targetEmployeeId')), json_extract(source.before_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.before_json, '$.requestedByEmployeeId')), json_extract(source.before_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.before_json, '$.requestedApproverId')), json_extract(source.before_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.before_json, '$.applicantId')), json_extract(source.before_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.before_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.holderId')), json_extract(source.before_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.personId')), json_extract(source.before_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.employmentId')), json_extract(source.before_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.periodId')), json_extract(source.before_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.resourceId')), json_extract(source.before_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.existingResourceId')), json_extract(source.before_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.scopeId')), json_extract(source.before_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.authorityScopeId')), json_extract(source.before_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.responsibilityId')), json_extract(source.before_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.collectiveBodyId')), json_extract(source.before_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.organizationalOfficeId')), json_extract(source.before_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.positionId')), json_extract(source.before_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.jobId')), json_extract(source.before_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.before_json, '$.siteId')), json_extract(source.before_json, '$.siteId'))) ELSE source.before_json END ,
       CASE WHEN json_valid(source.after_json) AND json_type(source.after_json) = 'object' THEN json_replace(source.after_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.after_json, '$.accountId')), json_extract(source.after_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.after_json, '$.actorAccountId')), json_extract(source.after_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.after_json, '$.release.actorAccountId')), json_extract(source.after_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.after_json, '$.employeeId')), json_extract(source.after_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.after_json, '$.managerEmployeeId')), json_extract(source.after_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.after_json, '$.targetEmployeeId')), json_extract(source.after_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.after_json, '$.requestedByEmployeeId')), json_extract(source.after_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.after_json, '$.requestedApproverId')), json_extract(source.after_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.after_json, '$.applicantId')), json_extract(source.after_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.after_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.holderId')), json_extract(source.after_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.personId')), json_extract(source.after_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.employmentId')), json_extract(source.after_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.periodId')), json_extract(source.after_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.resourceId')), json_extract(source.after_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.existingResourceId')), json_extract(source.after_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.scopeId')), json_extract(source.after_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.authorityScopeId')), json_extract(source.after_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.responsibilityId')), json_extract(source.after_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.collectiveBodyId')), json_extract(source.after_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.organizationalOfficeId')), json_extract(source.after_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.positionId')), json_extract(source.after_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.jobId')), json_extract(source.after_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.after_json, '$.siteId')), json_extract(source.after_json, '$.siteId'))) ELSE source.after_json END
FROM "_stage_software_license_changes" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'software_license_changes',
       (SELECT count(*) FROM "_stage_software_license_changes"),
       (SELECT count(*) FROM software_license_changes),
       0,
       0,
       0;
DROP TABLE "_stage_software_license_changes";
CREATE INDEX software_license_change_history ON software_license_changes(license_id, recorded_at, id);
CREATE TRIGGER software_license_changes_update BEFORE UPDATE ON software_license_changes
BEGIN SELECT RAISE(ABORT, 'software_license_history_immutable'); END;
CREATE TRIGGER software_license_changes_delete BEFORE DELETE ON software_license_changes
BEGIN SELECT RAISE(ABORT, 'software_license_history_immutable'); END;
CREATE TRIGGER software_license_changes_source_freeze_insert
BEFORE INSERT ON software_license_changes
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'software-license' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'software_license_record_source_frozen'); END;
CREATE TRIGGER software_license_changes_source_freeze_update
BEFORE UPDATE ON software_license_changes
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'software-license' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'software_license_record_source_frozen'); END;
CREATE TRIGGER software_license_changes_source_freeze_delete
BEFORE DELETE ON software_license_changes
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'software-license' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'software_license_record_source_frozen'); END;

-- stocktake_items
INSERT INTO stocktake_items (id, stocktake_id, asset_code, checked_at, checker_employee_id, location_note)
SELECT source.id,
       source.stocktake_id,
       source.asset_code,
       source.checked_at,
       CASE WHEN source.checker_employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.checker_employee_id), source.checker_employee_id) END ,
       source.location_note
FROM "_stage_stocktake_items" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'stocktake_items',
       (SELECT count(*) FROM "_stage_stocktake_items"),
       (SELECT count(*) FROM stocktake_items),
       0,
       0,
       0;
DROP TABLE "_stage_stocktake_items";
CREATE INDEX idx_stocktake_items_asset ON stocktake_items (asset_code);
CREATE TRIGGER stocktake_items_source_freeze_delete BEFORE DELETE ON stocktake_items
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='asset' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'asset_record_source_frozen'); END;
CREATE TRIGGER stocktake_items_source_freeze_insert BEFORE INSERT ON stocktake_items
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='asset' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'asset_record_source_frozen'); END;
CREATE TRIGGER stocktake_items_source_freeze_update BEFORE UPDATE ON stocktake_items
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='asset' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'asset_record_source_frozen'); END;
CREATE TRIGGER stocktake_items_identity_update
BEFORE UPDATE OF id ON stocktake_items
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- survey_responses
INSERT INTO survey_responses (id, legacy_id, survey_id, respondent_id, answers_json, submitted_at)
SELECT source.id,
       source.legacy_id,
       source.survey_id,
       CASE WHEN source.respondent_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.respondent_id), source.respondent_id) END ,
       CASE WHEN json_valid(source.answers_json) AND json_type(source.answers_json) = 'object' THEN json_replace(source.answers_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.answers_json, '$.accountId')), json_extract(source.answers_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.answers_json, '$.actorAccountId')), json_extract(source.answers_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.answers_json, '$.release.actorAccountId')), json_extract(source.answers_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.answers_json, '$.employeeId')), json_extract(source.answers_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.answers_json, '$.managerEmployeeId')), json_extract(source.answers_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.answers_json, '$.targetEmployeeId')), json_extract(source.answers_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.answers_json, '$.requestedByEmployeeId')), json_extract(source.answers_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.answers_json, '$.requestedApproverId')), json_extract(source.answers_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.answers_json, '$.applicantId')), json_extract(source.answers_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.answers_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.answers_json, '$.holderId')), json_extract(source.answers_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.answers_json, '$.personId')), json_extract(source.answers_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.answers_json, '$.employmentId')), json_extract(source.answers_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.answers_json, '$.periodId')), json_extract(source.answers_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.answers_json, '$.resourceId')), json_extract(source.answers_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.answers_json, '$.existingResourceId')), json_extract(source.answers_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.answers_json, '$.scopeId')), json_extract(source.answers_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.answers_json, '$.authorityScopeId')), json_extract(source.answers_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.answers_json, '$.responsibilityId')), json_extract(source.answers_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.answers_json, '$.collectiveBodyId')), json_extract(source.answers_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.answers_json, '$.organizationalOfficeId')), json_extract(source.answers_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.answers_json, '$.positionId')), json_extract(source.answers_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.answers_json, '$.jobId')), json_extract(source.answers_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.answers_json, '$.siteId')), json_extract(source.answers_json, '$.siteId'))) ELSE source.answers_json END ,
       source.submitted_at
FROM "_stage_survey_responses" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'survey_responses',
       (SELECT count(*) FROM "_stage_survey_responses"),
       (SELECT count(*) FROM survey_responses),
       0,
       0,
       0;
DROP TABLE "_stage_survey_responses";
CREATE INDEX idx_survey_responses_respondent ON survey_responses (respondent_id);
CREATE INDEX idx_survey_responses_survey ON survey_responses (survey_id);
CREATE UNIQUE INDEX idx_survey_responses_survey_respondent
  ON survey_responses (survey_id, respondent_id);
CREATE TRIGGER survey_responses_source_freeze_delete BEFORE DELETE ON survey_responses
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='survey' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'survey_record_source_frozen'); END;
CREATE TRIGGER survey_responses_source_freeze_insert BEFORE INSERT ON survey_responses
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='survey' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'survey_record_source_frozen'); END;
CREATE TRIGGER survey_responses_source_freeze_update BEFORE UPDATE ON survey_responses
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='survey' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'survey_record_source_frozen'); END;
CREATE TRIGGER survey_responses_legacy_id_insert
BEFORE INSERT ON survey_responses
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER survey_responses_identity_update
BEFORE UPDATE OF id, legacy_id ON survey_responses
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- system_account_invitations
INSERT INTO system_account_invitations (id, token, subject, role_id, accepted_by_account_id, expires_at, revoked_at, created_at, updated_at, resource_type, resource_id, related_resource_id)
SELECT map.new_id,
       source.token,
       source.subject,
       source.role_id,
       CASE WHEN source.accepted_by_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.accepted_by_account_id), source.accepted_by_account_id) END ,
       source.expires_at,
       source.revoked_at,
       source.created_at,
       source.updated_at,
       source.resource_type,
       source.resource_id,
       source.related_resource_id
FROM "_stage_system_account_invitations" source
INNER JOIN _system_account_invitations_id_map map ON map.old_id = source.id;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_account_invitations',
       (SELECT count(*) FROM "_stage_system_account_invitations"),
       (SELECT count(*) FROM system_account_invitations),
       0,
       (SELECT count(*) FROM system_account_invitations WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_account_invitations";
CREATE UNIQUE INDEX system_account_invitations_token_uniq
  ON system_account_invitations(token);
CREATE INDEX system_account_invitations_role_idx
  ON system_account_invitations(role_id, created_at);
CREATE INDEX system_account_invitations_subject_idx
  ON system_account_invitations(subject, created_at);
CREATE INDEX system_account_invitations_resource_idx
  ON system_account_invitations (resource_type, resource_id);

-- system_attachment_preservations
INSERT INTO system_attachment_preservations (id, attachment_id, plaintext_sha256, kind, retain_until, reason, created_by_account_id, created_at, created_audit_event_id, revision, release_operation_id, released_by_account_id, released_at, release_reason, release_audit_event_id)
SELECT source.id,
       source.attachment_id,
       source.plaintext_sha256,
       source.kind,
       source.retain_until,
       source.reason,
       CASE WHEN source.created_by_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.created_by_account_id), source.created_by_account_id) END ,
       source.created_at,
       source.created_audit_event_id,
       source.revision,
       source.release_operation_id,
       CASE WHEN source.released_by_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.released_by_account_id), source.released_by_account_id) END ,
       source.released_at,
       source.release_reason,
       source.release_audit_event_id
FROM "_stage_system_attachment_preservations" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_attachment_preservations',
       (SELECT count(*) FROM "_stage_system_attachment_preservations"),
       (SELECT count(*) FROM system_attachment_preservations),
       0,
       0,
       0;
DROP TABLE "_stage_system_attachment_preservations";
CREATE INDEX system_attachment_preservations_target_idx ON system_attachment_preservations(attachment_id, id);
CREATE TRIGGER system_attachment_preservations_insert
BEFORE INSERT ON system_attachment_preservations
BEGIN
  SELECT RAISE(ABORT, 'attachment_preservation_target_unavailable')
  WHERE NEW.revision <> 1 OR NOT EXISTS (
    SELECT 1 FROM system_attachments WHERE id = NEW.attachment_id AND status IN ('uploading', 'pending', 'linked')
      AND wrapped_dek IS NOT NULL AND plaintext_sha256 = NEW.plaintext_sha256 AND created_at <= NEW.created_at
  );
  SELECT RAISE(ABORT, 'attachment_preservation_audit_missing')
  WHERE NOT EXISTS (
    SELECT 1 FROM system_audit_events WHERE event_id = NEW.created_audit_event_id
      AND actor_account_id = NEW.created_by_account_id AND action = 'system.attachment.preservation.created'
      AND target_type = 'system:attachment-preservation' AND target_id = NEW.id AND outcome = 'succeeded'
      AND occurred_at = NEW.created_at AND before_json IS NULL
      AND json_extract(after_json, '$.id') = NEW.id AND json_extract(after_json, '$.attachmentId') = NEW.attachment_id
      AND json_extract(after_json, '$.sha256') = NEW.plaintext_sha256 AND json_extract(after_json, '$.kind') = NEW.kind
      AND json_extract(after_json, '$.reason') = NEW.reason AND json_extract(after_json, '$.revision') = 1
      AND json_extract(after_json, '$.retainUntil') IS strftime('%Y-%m-%dT%H:%M:%fZ', NEW.retain_until / 1000.0, 'unixepoch')
      AND json_extract(after_json, '$.actorAccountId') = NEW.created_by_account_id
      AND json_extract(after_json, '$.createdAt') = strftime('%Y-%m-%dT%H:%M:%fZ', NEW.created_at / 1000.0, 'unixepoch')
      AND json_extract(after_json, '$.auditEventId') = NEW.created_audit_event_id
      AND json_type(after_json, '$.release') = 'null'
  );
END;
CREATE TRIGGER system_attachment_preservations_update
BEFORE UPDATE ON system_attachment_preservations
BEGIN
  SELECT RAISE(ABORT, 'attachment_preservation_immutable')
  WHERE OLD.revision <> 1 OR NEW.revision <> 2 OR OLD.kind <> 'hold'
    OR NEW.id IS NOT OLD.id OR NEW.attachment_id IS NOT OLD.attachment_id OR NEW.plaintext_sha256 IS NOT OLD.plaintext_sha256
    OR NEW.kind IS NOT OLD.kind OR NEW.retain_until IS NOT OLD.retain_until OR NEW.reason IS NOT OLD.reason
    OR NEW.created_by_account_id IS NOT OLD.created_by_account_id OR NEW.created_at IS NOT OLD.created_at
    OR NEW.created_audit_event_id IS NOT OLD.created_audit_event_id;
  SELECT RAISE(ABORT, 'attachment_preservation_audit_missing')
  WHERE NOT EXISTS (
    SELECT 1 FROM system_audit_events WHERE event_id = NEW.release_audit_event_id
      AND actor_account_id = NEW.released_by_account_id AND action = 'system.attachment.preservation.released'
      AND target_type = 'system:attachment-preservation' AND target_id = NEW.id AND outcome = 'succeeded'
      AND occurred_at = NEW.released_at AND json_extract(before_json, '$.revision') = 1
      AND json_extract(after_json, '$.id') = NEW.id AND json_extract(after_json, '$.revision') = 2
      AND json_extract(after_json, '$.release.operationId') = NEW.release_operation_id
      AND json_extract(after_json, '$.release.reason') = NEW.release_reason
      AND json_extract(after_json, '$.attachmentId') = NEW.attachment_id
      AND json_extract(after_json, '$.sha256') = NEW.plaintext_sha256
      AND json_extract(after_json, '$.kind') = NEW.kind
      AND json_extract(after_json, '$.retainUntil') IS NULL
      AND json_extract(after_json, '$.reason') = NEW.reason
      AND json_extract(after_json, '$.actorAccountId') = NEW.created_by_account_id
      AND json_extract(after_json, '$.createdAt') = strftime('%Y-%m-%dT%H:%M:%fZ', NEW.created_at / 1000.0, 'unixepoch')
      AND json_extract(after_json, '$.auditEventId') = NEW.created_audit_event_id
      AND json_extract(after_json, '$.release.actorAccountId') = NEW.released_by_account_id
      AND json_extract(after_json, '$.release.at') = strftime('%Y-%m-%dT%H:%M:%fZ', NEW.released_at / 1000.0, 'unixepoch')
      AND json_extract(after_json, '$.release.auditEventId') = NEW.release_audit_event_id
      AND json_extract(before_json, '$.id') = OLD.id
      AND json_extract(before_json, '$.attachmentId') = OLD.attachment_id
      AND json_extract(before_json, '$.sha256') = OLD.plaintext_sha256
      AND json_extract(before_json, '$.kind') = OLD.kind
      AND json_type(before_json, '$.retainUntil') = 'null'
      AND json_extract(before_json, '$.reason') = OLD.reason
      AND json_extract(before_json, '$.actorAccountId') = OLD.created_by_account_id
      AND json_extract(before_json, '$.createdAt') = strftime('%Y-%m-%dT%H:%M:%fZ', OLD.created_at / 1000.0, 'unixepoch')
      AND json_extract(before_json, '$.auditEventId') = OLD.created_audit_event_id
      AND json_type(before_json, '$.release') = 'null'
  );
END;
CREATE TRIGGER system_attachment_preservations_delete
BEFORE DELETE ON system_attachment_preservations
BEGIN
  SELECT RAISE(ABORT, 'attachment_preservation_immutable');
END;

-- system_attachments
INSERT INTO system_attachments (id, owner_account_id, object_key, status, content_type, byte_size, file_name, plaintext_sha256, wrapped_dek, wrapped_dek_iv, content_iv, kek_version, created_at, linked_at, erased_at)
SELECT source.id,
       CASE WHEN source.owner_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.owner_account_id), source.owner_account_id) END ,
       source.object_key,
       source.status,
       source.content_type,
       source.byte_size,
       source.file_name,
       source.plaintext_sha256,
       source.wrapped_dek,
       source.wrapped_dek_iv,
       source.content_iv,
       source.kek_version,
       source.created_at,
       source.linked_at,
       source.erased_at
FROM "_stage_system_attachments" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_attachments',
       (SELECT count(*) FROM "_stage_system_attachments"),
       (SELECT count(*) FROM system_attachments),
       0,
       0,
       0;
DROP TABLE "_stage_system_attachments";
CREATE INDEX idx_system_attachments_owner_status
  ON system_attachments (owner_account_id, status);
CREATE INDEX idx_system_attachments_created_at
  ON system_attachments (created_at);
CREATE TRIGGER system_attachment_preservation_erase_guard
BEFORE UPDATE ON system_attachments
WHEN NEW.status = 'erased' OR NEW.wrapped_dek IS NULL
BEGIN
  SELECT RAISE(ABORT, 'attachment_preserved')
  WHERE EXISTS (
    SELECT 1 FROM system_attachment_preservations WHERE attachment_id = OLD.id
      AND ((kind = 'hold' AND released_at IS NULL)
        OR (kind = 'retention' AND (NEW.erased_at IS NULL OR retain_until > NEW.erased_at)))
  );
END;
CREATE TRIGGER system_attachment_preservation_delete_guard
BEFORE DELETE ON system_attachments
BEGIN
  SELECT RAISE(ABORT, 'attachment_preserved')
  WHERE EXISTS (
    SELECT 1 FROM system_attachment_preservations WHERE attachment_id = OLD.id
      AND ((kind = 'hold' AND released_at IS NULL)
        OR (kind = 'retention' AND (OLD.status <> 'erased' OR OLD.erased_at IS NULL OR retain_until > OLD.erased_at)))
  );
END;
CREATE TRIGGER system_attachment_preservation_content_guard
BEFORE UPDATE ON system_attachments
WHEN NEW.id IS NOT OLD.id OR NEW.owner_account_id IS NOT OLD.owner_account_id
  OR NEW.object_key IS NOT OLD.object_key OR NEW.plaintext_sha256 IS NOT OLD.plaintext_sha256
  OR NEW.content_type IS NOT OLD.content_type OR NEW.byte_size IS NOT OLD.byte_size
  OR NEW.file_name IS NOT OLD.file_name OR NEW.content_iv IS NOT OLD.content_iv OR NEW.created_at IS NOT OLD.created_at
  OR (NEW.status <> 'erased' AND (NEW.wrapped_dek IS NOT OLD.wrapped_dek OR NEW.wrapped_dek_iv IS NOT OLD.wrapped_dek_iv OR NEW.kek_version IS NOT OLD.kek_version))
BEGIN
  SELECT RAISE(ABORT, 'attachment_preserved_content_immutable')
  WHERE EXISTS (SELECT 1 FROM system_attachment_preservations WHERE attachment_id = OLD.id);
END;
CREATE TRIGGER system_attachment_preservation_identity_guard
BEFORE INSERT ON system_attachments
WHEN EXISTS (SELECT 1 FROM system_attachment_preservations WHERE attachment_id = NEW.id)
BEGIN
  SELECT RAISE(ABORT, 'attachment_preserved_identity_immutable');
END;
CREATE TRIGGER system_attachments_retirement_frozen_insert BEFORE INSERT ON system_attachments
BEGIN
  SELECT RAISE(ABORT,'record_retirement_source_attachment_frozen') WHERE EXISTS (
    SELECT 1 FROM system_record_retirement_attachment_pins pin
    JOIN system_record_retirement_receipts receipt ON receipt.id=pin.receipt_id
    JOIN system_record_retirement_plans plan ON plan.id=receipt.plan_id
    JOIN system_record_source_freezes freeze ON freeze.id=plan.freeze_id AND freeze.revision=1
    JOIN system_attachments attachment ON attachment.id=pin.attachment_id
    WHERE attachment.id=NEW.id OR attachment.object_key=NEW.object_key
  );
END;
CREATE TRIGGER system_attachments_retirement_frozen_update BEFORE UPDATE ON system_attachments
BEGIN
  SELECT RAISE(ABORT,'record_retirement_source_attachment_frozen') WHERE EXISTS (
    SELECT 1 FROM system_record_retirement_attachment_pins pin
    JOIN system_record_retirement_receipts receipt ON receipt.id=pin.receipt_id
    JOIN system_record_retirement_plans plan ON plan.id=receipt.plan_id
    JOIN system_record_source_freezes freeze ON freeze.id=plan.freeze_id AND freeze.revision=1
    JOIN system_attachments attachment ON attachment.id=pin.attachment_id
    WHERE attachment.id=OLD.id OR attachment.id=NEW.id OR attachment.object_key=NEW.object_key
  );
END;
CREATE TRIGGER system_attachments_retirement_frozen_delete BEFORE DELETE ON system_attachments
BEGIN
  SELECT RAISE(ABORT,'record_retirement_source_attachment_frozen') WHERE EXISTS (
    SELECT 1 FROM system_record_retirement_attachment_pins pin
    JOIN system_record_retirement_receipts receipt ON receipt.id=pin.receipt_id
    JOIN system_record_retirement_plans plan ON plan.id=receipt.plan_id
    JOIN system_record_source_freezes freeze ON freeze.id=plan.freeze_id AND freeze.revision=1
    JOIN system_attachments attachment ON attachment.id=pin.attachment_id
    WHERE attachment.id=OLD.id
  );
END;

-- system_audit_disclosure_policy_revisions
INSERT INTO system_audit_disclosure_policy_revisions (id, scope, revision, command_id, enabled, allowed_fields_json, allowed_target_types_json, allowed_purposes_json, expires_at, reason, actor_account_id, recorded_at, audit_event_id)
SELECT source.id,
       source.scope,
       source.revision,
       source.command_id,
       source.enabled,
       CASE WHEN json_valid(source.allowed_fields_json) AND json_type(source.allowed_fields_json) = 'object' THEN json_replace(source.allowed_fields_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.allowed_fields_json, '$.accountId')), json_extract(source.allowed_fields_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.allowed_fields_json, '$.actorAccountId')), json_extract(source.allowed_fields_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.allowed_fields_json, '$.release.actorAccountId')), json_extract(source.allowed_fields_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.allowed_fields_json, '$.employeeId')), json_extract(source.allowed_fields_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.allowed_fields_json, '$.managerEmployeeId')), json_extract(source.allowed_fields_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.allowed_fields_json, '$.targetEmployeeId')), json_extract(source.allowed_fields_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.allowed_fields_json, '$.requestedByEmployeeId')), json_extract(source.allowed_fields_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.allowed_fields_json, '$.requestedApproverId')), json_extract(source.allowed_fields_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.allowed_fields_json, '$.applicantId')), json_extract(source.allowed_fields_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.allowed_fields_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_fields_json, '$.holderId')), json_extract(source.allowed_fields_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_fields_json, '$.personId')), json_extract(source.allowed_fields_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_fields_json, '$.employmentId')), json_extract(source.allowed_fields_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_fields_json, '$.periodId')), json_extract(source.allowed_fields_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_fields_json, '$.resourceId')), json_extract(source.allowed_fields_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_fields_json, '$.existingResourceId')), json_extract(source.allowed_fields_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_fields_json, '$.scopeId')), json_extract(source.allowed_fields_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_fields_json, '$.authorityScopeId')), json_extract(source.allowed_fields_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_fields_json, '$.responsibilityId')), json_extract(source.allowed_fields_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_fields_json, '$.collectiveBodyId')), json_extract(source.allowed_fields_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_fields_json, '$.organizationalOfficeId')), json_extract(source.allowed_fields_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_fields_json, '$.positionId')), json_extract(source.allowed_fields_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_fields_json, '$.jobId')), json_extract(source.allowed_fields_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_fields_json, '$.siteId')), json_extract(source.allowed_fields_json, '$.siteId'))) ELSE source.allowed_fields_json END ,
       CASE WHEN json_valid(source.allowed_target_types_json) AND json_type(source.allowed_target_types_json) = 'object' THEN json_replace(source.allowed_target_types_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.allowed_target_types_json, '$.accountId')), json_extract(source.allowed_target_types_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.allowed_target_types_json, '$.actorAccountId')), json_extract(source.allowed_target_types_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.allowed_target_types_json, '$.release.actorAccountId')), json_extract(source.allowed_target_types_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.allowed_target_types_json, '$.employeeId')), json_extract(source.allowed_target_types_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.allowed_target_types_json, '$.managerEmployeeId')), json_extract(source.allowed_target_types_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.allowed_target_types_json, '$.targetEmployeeId')), json_extract(source.allowed_target_types_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.allowed_target_types_json, '$.requestedByEmployeeId')), json_extract(source.allowed_target_types_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.allowed_target_types_json, '$.requestedApproverId')), json_extract(source.allowed_target_types_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.allowed_target_types_json, '$.applicantId')), json_extract(source.allowed_target_types_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.allowed_target_types_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_target_types_json, '$.holderId')), json_extract(source.allowed_target_types_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_target_types_json, '$.personId')), json_extract(source.allowed_target_types_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_target_types_json, '$.employmentId')), json_extract(source.allowed_target_types_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_target_types_json, '$.periodId')), json_extract(source.allowed_target_types_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_target_types_json, '$.resourceId')), json_extract(source.allowed_target_types_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_target_types_json, '$.existingResourceId')), json_extract(source.allowed_target_types_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_target_types_json, '$.scopeId')), json_extract(source.allowed_target_types_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_target_types_json, '$.authorityScopeId')), json_extract(source.allowed_target_types_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_target_types_json, '$.responsibilityId')), json_extract(source.allowed_target_types_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_target_types_json, '$.collectiveBodyId')), json_extract(source.allowed_target_types_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_target_types_json, '$.organizationalOfficeId')), json_extract(source.allowed_target_types_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_target_types_json, '$.positionId')), json_extract(source.allowed_target_types_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_target_types_json, '$.jobId')), json_extract(source.allowed_target_types_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_target_types_json, '$.siteId')), json_extract(source.allowed_target_types_json, '$.siteId'))) ELSE source.allowed_target_types_json END ,
       CASE WHEN json_valid(source.allowed_purposes_json) AND json_type(source.allowed_purposes_json) = 'object' THEN json_replace(source.allowed_purposes_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.allowed_purposes_json, '$.accountId')), json_extract(source.allowed_purposes_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.allowed_purposes_json, '$.actorAccountId')), json_extract(source.allowed_purposes_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.allowed_purposes_json, '$.release.actorAccountId')), json_extract(source.allowed_purposes_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.allowed_purposes_json, '$.employeeId')), json_extract(source.allowed_purposes_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.allowed_purposes_json, '$.managerEmployeeId')), json_extract(source.allowed_purposes_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.allowed_purposes_json, '$.targetEmployeeId')), json_extract(source.allowed_purposes_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.allowed_purposes_json, '$.requestedByEmployeeId')), json_extract(source.allowed_purposes_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.allowed_purposes_json, '$.requestedApproverId')), json_extract(source.allowed_purposes_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.allowed_purposes_json, '$.applicantId')), json_extract(source.allowed_purposes_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.allowed_purposes_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_purposes_json, '$.holderId')), json_extract(source.allowed_purposes_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_purposes_json, '$.personId')), json_extract(source.allowed_purposes_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_purposes_json, '$.employmentId')), json_extract(source.allowed_purposes_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_purposes_json, '$.periodId')), json_extract(source.allowed_purposes_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_purposes_json, '$.resourceId')), json_extract(source.allowed_purposes_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_purposes_json, '$.existingResourceId')), json_extract(source.allowed_purposes_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_purposes_json, '$.scopeId')), json_extract(source.allowed_purposes_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_purposes_json, '$.authorityScopeId')), json_extract(source.allowed_purposes_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_purposes_json, '$.responsibilityId')), json_extract(source.allowed_purposes_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_purposes_json, '$.collectiveBodyId')), json_extract(source.allowed_purposes_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_purposes_json, '$.organizationalOfficeId')), json_extract(source.allowed_purposes_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_purposes_json, '$.positionId')), json_extract(source.allowed_purposes_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_purposes_json, '$.jobId')), json_extract(source.allowed_purposes_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.allowed_purposes_json, '$.siteId')), json_extract(source.allowed_purposes_json, '$.siteId'))) ELSE source.allowed_purposes_json END ,
       source.expires_at,
       source.reason,
       CASE WHEN source.actor_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.actor_account_id), source.actor_account_id) END ,
       source.recorded_at,
       source.audit_event_id
FROM "_stage_system_audit_disclosure_policy_revisions" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_audit_disclosure_policy_revisions',
       (SELECT count(*) FROM "_stage_system_audit_disclosure_policy_revisions"),
       (SELECT count(*) FROM system_audit_disclosure_policy_revisions),
       0,
       0,
       0;
DROP TABLE "_stage_system_audit_disclosure_policy_revisions";
CREATE UNIQUE INDEX system_audit_disclosure_scope_revision_uniq
  ON system_audit_disclosure_policy_revisions (scope, revision);
CREATE TRIGGER system_audit_disclosure_revision_insert
BEFORE INSERT ON system_audit_disclosure_policy_revisions
BEGIN
  SELECT RAISE(ABORT, 'audit_disclosure_revision_conflict')
  WHERE NEW.revision <> 1 + COALESCE((SELECT MAX(revision) FROM system_audit_disclosure_policy_revisions WHERE scope = NEW.scope), 0)
    OR NEW.recorded_at < COALESCE((SELECT MAX(recorded_at) FROM system_audit_disclosure_policy_revisions WHERE scope = NEW.scope), 0);
  SELECT RAISE(ABORT, 'audit_disclosure_scope_unavailable')
  WHERE NEW.scope <> '*' AND NOT EXISTS (SELECT 1 FROM system_accounts WHERE id = NEW.scope);
  SELECT RAISE(ABORT, 'audit_disclosure_fields_invalid')
  WHERE json_array_length(NEW.allowed_fields_json) > 7
    OR EXISTS (SELECT 1 FROM json_each(NEW.allowed_fields_json) WHERE type <> 'text' OR value NOT IN ('actor_account_id', 'target_id', 'reason_code', 'authorization_json', 'before_json', 'after_json', 'metadata_json'))
    OR (SELECT COUNT(*) FROM json_each(NEW.allowed_fields_json)) <> (SELECT COUNT(DISTINCT value) FROM json_each(NEW.allowed_fields_json));
  SELECT RAISE(ABORT, 'audit_disclosure_labels_invalid')
  WHERE json_array_length(NEW.allowed_target_types_json) > 64 OR json_array_length(NEW.allowed_purposes_json) > 64
    OR EXISTS (SELECT 1 FROM json_each(NEW.allowed_target_types_json) WHERE type <> 'text' OR length(trim(value)) NOT BETWEEN 1 AND 100)
    OR EXISTS (SELECT 1 FROM json_each(NEW.allowed_purposes_json) WHERE type <> 'text' OR length(trim(value)) NOT BETWEEN 1 AND 100);
  SELECT RAISE(ABORT, 'audit_disclosure_audit_mismatch')
  WHERE NOT EXISTS (
    SELECT 1 FROM system_audit_events audit
    WHERE audit.event_id = NEW.audit_event_id AND audit.actor_account_id = NEW.actor_account_id
      AND audit.action = 'system.audit.disclosure.published' AND audit.target_type = 'system:audit-disclosure-policy'
      AND audit.target_id = NEW.scope AND audit.outcome = 'succeeded' AND audit.occurred_at = NEW.recorded_at
      AND json_extract(audit.after_json, '$.scope') IS NEW.scope
      AND json_extract(audit.after_json, '$.revision') IS NEW.revision
      AND json_extract(audit.after_json, '$.commandId') IS NEW.command_id
      AND json_extract(audit.after_json, '$.enabled') IS NEW.enabled
      AND json_extract(audit.after_json, '$.allowedFields') IS NEW.allowed_fields_json
      AND json_extract(audit.after_json, '$.allowedTargetTypes') IS NEW.allowed_target_types_json
      AND json_extract(audit.after_json, '$.allowedPurposes') IS NEW.allowed_purposes_json
      AND json_extract(audit.after_json, '$.expiresAt') IS strftime('%Y-%m-%dT%H:%M:%fZ', NEW.expires_at / 1000.0, 'unixepoch')
      AND json_extract(audit.after_json, '$.reason') IS NEW.reason
      AND json_extract(audit.after_json, '$.actorAccountId') IS NEW.actor_account_id
      AND json_extract(audit.after_json, '$.recordedAt') IS strftime('%Y-%m-%dT%H:%M:%fZ', NEW.recorded_at / 1000.0, 'unixepoch')
      AND json_extract(audit.after_json, '$.auditEventId') IS NEW.audit_event_id
      AND ((NEW.revision = 1 AND audit.before_json IS NULL) OR (NEW.revision > 1 AND audit.before_json = (
        SELECT previous_audit.after_json FROM system_audit_disclosure_policy_revisions previous
        JOIN system_audit_events previous_audit ON previous_audit.event_id = previous.audit_event_id
        WHERE previous.scope = NEW.scope AND previous.revision = NEW.revision - 1
      )))
  );
END;
CREATE TRIGGER system_audit_disclosure_revision_update
BEFORE UPDATE ON system_audit_disclosure_policy_revisions
BEGIN
  SELECT RAISE(ABORT, 'audit disclosure revisions are immutable');
END;
CREATE TRIGGER system_audit_disclosure_revision_delete
BEFORE DELETE ON system_audit_disclosure_policy_revisions
BEGIN
  SELECT RAISE(ABORT, 'audit disclosure revisions are immutable');
END;

-- system_authentication_attempts
INSERT INTO system_authentication_attempts (id, identifier, ip, attempted_at)
SELECT map.new_id,
       source.identifier,
       source.ip,
       source.attempted_at
FROM "_stage_system_authentication_attempts" source
INNER JOIN _system_authentication_attempts_id_map map ON map.old_id = source.id;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_authentication_attempts',
       (SELECT count(*) FROM "_stage_system_authentication_attempts"),
       (SELECT count(*) FROM system_authentication_attempts),
       0,
       (SELECT count(*) FROM system_authentication_attempts WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_authentication_attempts";
CREATE INDEX system_authentication_attempts_identifier_attempted_at_idx
  ON system_authentication_attempts (identifier, attempted_at);
CREATE INDEX system_authentication_attempts_ip_attempted_at_idx
  ON system_authentication_attempts (ip, attempted_at);

-- system_role_bindings
INSERT INTO system_role_bindings (id, legacy_id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
SELECT source.id,
       source.legacy_id,
       CASE WHEN source.account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.account_id), source.account_id) END ,
       source.role_id,
       source.resource_type,
       source.resource_id,
       source.created_at,
       source.revoked_at
FROM "_stage_system_role_bindings" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_role_bindings',
       (SELECT count(*) FROM "_stage_system_role_bindings"),
       (SELECT count(*) FROM system_role_bindings),
       0,
       0,
       0;
DROP TABLE "_stage_system_role_bindings";
CREATE UNIQUE INDEX system_role_bindings_active_uniq
  ON system_role_bindings (
    account_id,
    role_id,
    coalesce(resource_type, ''),
    coalesce(resource_id, '')
  )
  WHERE revoked_at IS NULL;
CREATE INDEX system_role_bindings_account_idx
  ON system_role_bindings (account_id, created_at);
CREATE INDEX system_role_bindings_role_idx
  ON system_role_bindings (role_id, created_at);
CREATE INDEX system_role_bindings_resource_idx
  ON system_role_bindings (resource_type, resource_id);
CREATE TRIGGER system_role_bindings_monotonic_lifecycle
BEFORE UPDATE ON system_role_bindings
WHEN
  NEW.id IS NOT OLD.id
  OR NEW.account_id IS NOT OLD.account_id
  OR NEW.role_id IS NOT OLD.role_id
  OR NEW.resource_type IS NOT OLD.resource_type
  OR NEW.resource_id IS NOT OLD.resource_id
  OR NEW.created_at IS NOT OLD.created_at
  OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NOT OLD.revoked_at)
BEGIN
  SELECT RAISE(ABORT, 'role binding lifecycle is not monotonic');
END;
CREATE TRIGGER system_role_bindings_closed_account_guard
BEFORE INSERT ON system_role_bindings
WHEN EXISTS (
  SELECT 1 FROM system_accounts
  WHERE id = NEW.account_id AND closed_at IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'closed account cannot receive a role binding');
END;
CREATE TRIGGER system_role_bindings_legacy_id_insert
BEFORE INSERT ON system_role_bindings
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER system_role_bindings_identity_update
BEFORE UPDATE OF id, legacy_id ON system_role_bindings
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- system_bootstrap_state
INSERT INTO system_bootstrap_state (singleton, completed_by_account_id, root_binding_id, completed_at)
SELECT source.singleton,
       CASE WHEN source.completed_by_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.completed_by_account_id), source.completed_by_account_id) END ,
       source.root_binding_id,
       source.completed_at
FROM "_stage_system_bootstrap_state" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_bootstrap_state',
       (SELECT count(*) FROM "_stage_system_bootstrap_state"),
       (SELECT count(*) FROM system_bootstrap_state),
       0,
       0,
       0;
DROP TABLE "_stage_system_bootstrap_state";
CREATE TRIGGER system_bootstrap_state_validate_root
BEFORE INSERT ON system_bootstrap_state
WHEN NOT EXISTS (
  SELECT 1
  FROM system_role_bindings binding
  INNER JOIN system_accounts account
    ON account.id = binding.account_id
  INNER JOIN system_iam_role_permissions permission
    ON permission.role_id = binding.role_id
  WHERE binding.id = NEW.root_binding_id
    AND binding.account_id = NEW.completed_by_account_id
    AND binding.resource_type IS NULL
    AND binding.resource_id IS NULL
    AND binding.revoked_at IS NULL
    AND account.status = 'active'
    AND permission.permission_key = 'system:admin'
)
BEGIN
  SELECT RAISE(ABORT, 'bootstrap requires an active global System root binding');
END;
CREATE TRIGGER system_bootstrap_state_prevent_update
BEFORE UPDATE ON system_bootstrap_state
BEGIN
  SELECT RAISE(ABORT, 'bootstrap state is immutable');
END;
CREATE TRIGGER system_bootstrap_state_prevent_delete
BEFORE DELETE ON system_bootstrap_state
BEGIN
  SELECT RAISE(ABORT, 'bootstrap state is immutable');
END;

-- system_browser_login_codes
INSERT INTO system_browser_login_codes (code_hash, account_id, created_at, expires_at)
SELECT source.code_hash,
       CASE WHEN source.account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.account_id), source.account_id) END ,
       source.created_at,
       source.expires_at
FROM "_stage_system_browser_login_codes" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_browser_login_codes',
       (SELECT count(*) FROM "_stage_system_browser_login_codes"),
       (SELECT count(*) FROM system_browser_login_codes),
       0,
       0,
       0;
DROP TABLE "_stage_system_browser_login_codes";
CREATE INDEX system_browser_login_codes_expires_idx
  ON system_browser_login_codes (expires_at);

-- system_cli_login_codes
INSERT INTO system_cli_login_codes (code_hash, account_id, created_at, expires_at)
SELECT source.code_hash,
       CASE WHEN source.account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.account_id), source.account_id) END ,
       source.created_at,
       source.expires_at
FROM "_stage_system_cli_login_codes" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_cli_login_codes',
       (SELECT count(*) FROM "_stage_system_cli_login_codes"),
       (SELECT count(*) FROM system_cli_login_codes),
       0,
       0,
       0;
DROP TABLE "_stage_system_cli_login_codes";
CREATE INDEX system_cli_login_codes_expires_idx
  ON system_cli_login_codes (expires_at);

-- system_dead_letters
INSERT INTO system_dead_letters (id, source_type, source_id, payload_digest, reason_code, attempt, recorded_at, requeued_job_id, requeued_at)
SELECT source.id,
       source.source_type,
       source.source_id,
       source.payload_digest,
       source.reason_code,
       source.attempt,
       source.recorded_at,
       source.requeued_job_id,
       source.requeued_at
FROM "_stage_system_dead_letters" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_dead_letters',
       (SELECT count(*) FROM "_stage_system_dead_letters"),
       (SELECT count(*) FROM system_dead_letters),
       0,
       0,
       0;
DROP TABLE "_stage_system_dead_letters";
CREATE UNIQUE INDEX system_dead_letters_source_uniq ON system_dead_letters (source_type, source_id);
CREATE INDEX system_dead_letters_recorded_idx ON system_dead_letters (recorded_at, id);
CREATE TRIGGER system_dead_letters_source_guard
BEFORE INSERT ON system_dead_letters
WHEN (NEW.source_type = 'job' AND NOT EXISTS (
    SELECT 1 FROM system_jobs WHERE id = NEW.source_id AND status = 'dead_letter'
  )) OR (NEW.source_type = 'outbox' AND NOT EXISTS (
    SELECT 1 FROM system_outbox_messages WHERE id = NEW.source_id AND status = 'dead_letter'
  )) OR (NEW.source_type = 'inbox' AND NOT EXISTS (
    SELECT 1 FROM system_inbox_messages WHERE id = NEW.source_id AND status = 'rejected'
  ))
BEGIN
  SELECT RAISE(ABORT, 'system_dead_letter_source_invalid');
END;
CREATE TRIGGER system_dead_letters_monotonic_update
BEFORE UPDATE ON system_dead_letters
WHEN NEW.id <> OLD.id OR NEW.source_type <> OLD.source_type OR NEW.source_id <> OLD.source_id
  OR NEW.payload_digest <> OLD.payload_digest OR NEW.reason_code <> OLD.reason_code
  OR NEW.attempt <> OLD.attempt OR NEW.recorded_at <> OLD.recorded_at
  OR OLD.requeued_at IS NOT NULL OR NEW.requeued_at IS NULL OR NEW.requeued_job_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'system_dead_letter_update_invalid');
END;
CREATE TRIGGER system_dead_letters_no_delete BEFORE DELETE ON system_dead_letters
BEGIN SELECT RAISE(ABORT, 'system_dead_letters_are_retained'); END;

-- system_decision_tasks
INSERT INTO system_decision_tasks (id, case_id, task_key, round, required_approvals, proposal_digest, opened_at, due_at, outcome, closed_at, required_participants, negative_decision_rule, delegation_policy, return_policy)
SELECT source.id,
       source.case_id,
       source.task_key,
       source.round,
       source.required_approvals,
       source.proposal_digest,
       source.opened_at,
       source.due_at,
       source.outcome,
       source.closed_at,
       source.required_participants,
       source.negative_decision_rule,
       source.delegation_policy,
       source.return_policy
FROM "_stage_system_decision_tasks" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_decision_tasks',
       (SELECT count(*) FROM "_stage_system_decision_tasks"),
       (SELECT count(*) FROM system_decision_tasks),
       0,
       0,
       0;
DROP TABLE "_stage_system_decision_tasks";
CREATE INDEX system_decision_tasks_open_idx
  ON system_decision_tasks (due_at, opened_at)
  WHERE closed_at IS NULL;
CREATE TRIGGER system_decision_tasks_valid_insert
BEFORE INSERT ON system_decision_tasks
WHEN
  NOT EXISTS (
    SELECT 1 FROM system_cases
    WHERE
      id = NEW.case_id
      AND status = 'pending'
      AND proposal_digest = NEW.proposal_digest
  )
  OR EXISTS (
    SELECT 1 FROM system_decision_tasks
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND outcome IS NULL
  )
  OR (
    NEW.round > 1
    AND NOT EXISTS (
      SELECT 1 FROM system_decision_tasks
      WHERE
        case_id = NEW.case_id
        AND task_key = NEW.task_key
        AND round = NEW.round - 1
        AND outcome = 'cancelled'
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'decision task requires matching pending case');
END;
CREATE TRIGGER system_decision_tasks_prevent_delete
BEFORE DELETE ON system_decision_tasks
BEGIN
  SELECT RAISE(ABORT, 'decision task is immutable');
END;
CREATE TRIGGER system_decision_tasks_monotonic_lifecycle
BEFORE UPDATE ON system_decision_tasks
WHEN
  NEW.case_id IS NOT OLD.case_id
  OR NEW.task_key IS NOT OLD.task_key
  OR NEW.round IS NOT OLD.round
  OR NEW.required_approvals IS NOT OLD.required_approvals
  OR NEW.required_participants IS NOT OLD.required_participants
  OR NEW.negative_decision_rule IS NOT OLD.negative_decision_rule
  OR NEW.delegation_policy IS NOT OLD.delegation_policy
  OR NEW.return_policy IS NOT OLD.return_policy
  OR NEW.proposal_digest IS NOT OLD.proposal_digest
  OR NEW.opened_at IS NOT OLD.opened_at
  OR NEW.due_at IS NOT OLD.due_at
  OR OLD.outcome IS NOT NULL
  OR OLD.closed_at IS NOT NULL
  OR NEW.outcome IS NULL
  OR NEW.closed_at IS NULL
BEGIN
  SELECT RAISE(ABORT, 'decision task lifecycle is not monotonic');
END;
CREATE TRIGGER system_decision_tasks_approved_quorum
BEFORE UPDATE OF outcome ON system_decision_tasks
WHEN NEW.outcome = 'approved' AND (
  EXISTS (
    SELECT 1 FROM system_human_attestations
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND round = NEW.round
      AND action = 'return'
  )
  OR (
    NEW.negative_decision_rule = 'any-reject'
    AND EXISTS (
      SELECT 1 FROM system_human_attestations
      WHERE
        case_id = NEW.case_id
        AND task_key = NEW.task_key
        AND round = NEW.round
        AND action = 'reject'
    )
  )
  OR (
    SELECT count(*) FROM system_human_attestations
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND round = NEW.round
      AND action = 'approve'
  ) < NEW.required_approvals
  OR (
    SELECT count(*) FROM system_human_attestations
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND round = NEW.round
  ) < NEW.required_participants
)
BEGIN
  SELECT RAISE(ABORT, 'decision task approval requires quorum');
END;
CREATE TRIGGER system_decision_tasks_negative_evidence
BEFORE UPDATE OF outcome ON system_decision_tasks
WHEN NEW.outcome IN ('rejected', 'returned') AND (
  (
    NEW.outcome = 'returned'
    AND NOT EXISTS (
      SELECT 1 FROM system_human_attestations
      WHERE
        case_id = NEW.case_id
        AND task_key = NEW.task_key
        AND round = NEW.round
        AND action = 'return'
    )
  )
  OR (
    NEW.outcome = 'rejected'
    AND (
      (
        NEW.negative_decision_rule = 'any-reject'
        AND NOT EXISTS (
          SELECT 1 FROM system_human_attestations
          WHERE
            case_id = NEW.case_id
            AND task_key = NEW.task_key
            AND round = NEW.round
            AND action = 'reject'
        )
      )
      OR (
        NEW.negative_decision_rule = 'approval-impossible'
        AND (
          SELECT count(*) FROM system_human_attestations
          WHERE
            case_id = NEW.case_id
            AND task_key = NEW.task_key
            AND round = NEW.round
            AND action = 'reject'
        ) <= (
          SELECT count(*) FROM system_decision_task_candidates
          WHERE
            case_id = NEW.case_id
            AND task_key = NEW.task_key
            AND round = NEW.round
        ) - NEW.required_approvals
      )
    )
  )
)
BEGIN
  SELECT RAISE(ABORT, 'decision task outcome requires matching attestation');
END;
CREATE TRIGGER system_decision_tasks_identity_update
BEFORE UPDATE OF id ON system_decision_tasks
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- system_decision_task_candidates
INSERT INTO system_decision_task_candidates (id, case_id, task_key, round, candidate_account_id, source, evidence_context, evidence_kind, evidence_id, evidence_version, eligibility_digest, eligible_from, resolved_at)
SELECT source.id,
       source.case_id,
       source.task_key,
       source.round,
       CASE WHEN source.candidate_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.candidate_account_id), source.candidate_account_id) END ,
       source.source,
       source.evidence_context,
       source.evidence_kind,
       source.evidence_id,
       source.evidence_version,
       source.eligibility_digest,
       source.eligible_from,
       source.resolved_at
FROM "_stage_system_decision_task_candidates" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_decision_task_candidates',
       (SELECT count(*) FROM "_stage_system_decision_task_candidates"),
       (SELECT count(*) FROM system_decision_task_candidates),
       0,
       0,
       0;
DROP TABLE "_stage_system_decision_task_candidates";
CREATE UNIQUE INDEX system_decision_task_candidates_account_uniq
  ON system_decision_task_candidates (case_id, task_key, round, candidate_account_id);
CREATE INDEX system_decision_task_candidates_account_idx
  ON system_decision_task_candidates (candidate_account_id, resolved_at);
CREATE TRIGGER system_decision_task_candidates_valid_insert
BEFORE INSERT ON system_decision_task_candidates
WHEN
  NOT EXISTS (
    SELECT 1 FROM system_decision_tasks
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND round = NEW.round
      AND closed_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM system_human_attestations
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND round = NEW.round
  )
  OR EXISTS (
    SELECT 1 FROM system_cases
    WHERE id = NEW.case_id AND created_by_account_id = NEW.candidate_account_id
  )
  OR EXISTS (
    SELECT 1 FROM system_decision_task_exclusions
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND round = NEW.round
      AND excluded_account_id = NEW.candidate_account_id
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid decision task candidate');
END;
CREATE TRIGGER system_decision_task_candidates_prevent_update
BEFORE UPDATE ON system_decision_task_candidates
BEGIN
  SELECT RAISE(ABORT, 'decision task candidate is immutable');
END;
CREATE TRIGGER system_decision_task_candidates_prevent_delete
BEFORE DELETE ON system_decision_task_candidates
BEGIN
  SELECT RAISE(ABORT, 'decision task candidate is immutable');
END;
CREATE TRIGGER system_decision_candidate_requires_human
BEFORE INSERT ON system_decision_task_candidates
WHEN NOT EXISTS (
  SELECT 1 FROM system_accounts account
  JOIN system_principals principal ON principal.account_id = account.id
  WHERE account.id = NEW.candidate_account_id AND account.status = 'active' AND account.closed_at IS NULL
    AND account.created_at <= NEW.resolved_at AND principal.kind = 'human' AND principal.created_at <= NEW.resolved_at
)
BEGIN
  SELECT RAISE(ABORT, 'system_decision_candidate_requires_human');
END;
CREATE TRIGGER system_decision_task_candidates_identity_update
BEFORE UPDATE OF id ON system_decision_task_candidates
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- system_decision_task_exclusions
INSERT INTO system_decision_task_exclusions (id, case_id, task_key, round, excluded_account_id, reason)
SELECT source.id,
       source.case_id,
       source.task_key,
       source.round,
       CASE WHEN source.excluded_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.excluded_account_id), source.excluded_account_id) END ,
       source.reason
FROM "_stage_system_decision_task_exclusions" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_decision_task_exclusions',
       (SELECT count(*) FROM "_stage_system_decision_task_exclusions"),
       (SELECT count(*) FROM system_decision_task_exclusions),
       0,
       0,
       0;
DROP TABLE "_stage_system_decision_task_exclusions";
CREATE INDEX system_decision_task_exclusions_account_idx
  ON system_decision_task_exclusions (excluded_account_id);
CREATE TRIGGER system_decision_task_exclusions_valid_insert
BEFORE INSERT ON system_decision_task_exclusions
WHEN
  NOT EXISTS (
    SELECT 1 FROM system_decision_tasks
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND round = NEW.round
      AND closed_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM system_human_attestations
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND round = NEW.round
  )
  OR EXISTS (
    SELECT 1 FROM system_decision_task_candidates
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND round = NEW.round
      AND candidate_account_id = NEW.excluded_account_id
  )
  OR (
    NEW.reason = 'creator'
    AND NOT EXISTS (
      SELECT 1 FROM system_cases
      WHERE id = NEW.case_id AND created_by_account_id = NEW.excluded_account_id
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid decision task exclusion');
END;
CREATE TRIGGER system_decision_task_exclusions_prevent_update
BEFORE UPDATE ON system_decision_task_exclusions
BEGIN
  SELECT RAISE(ABORT, 'decision task exclusion is immutable');
END;
CREATE TRIGGER system_decision_task_exclusions_prevent_delete
BEFORE DELETE ON system_decision_task_exclusions
BEGIN
  SELECT RAISE(ABORT, 'decision task exclusion is immutable');
END;
CREATE TRIGGER system_decision_task_exclusions_identity_update
BEFORE UPDATE OF id ON system_decision_task_exclusions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- system_delegations
INSERT INTO system_delegations (id, delegator_account_id, delegate_account_id, scope_context, scope_kind, scope_id, scope_version, starts_at, ends_at, created_at, revoked_at)
SELECT source.id,
       CASE WHEN source.delegator_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.delegator_account_id), source.delegator_account_id) END ,
       CASE WHEN source.delegate_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.delegate_account_id), source.delegate_account_id) END ,
       source.scope_context,
       source.scope_kind,
       source.scope_id,
       source.scope_version,
       source.starts_at,
       source.ends_at,
       source.created_at,
       source.revoked_at
FROM "_stage_system_delegations" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_delegations',
       (SELECT count(*) FROM "_stage_system_delegations"),
       (SELECT count(*) FROM system_delegations),
       0,
       0,
       0;
DROP TABLE "_stage_system_delegations";
CREATE INDEX system_delegations_delegator_idx
  ON system_delegations (delegator_account_id, starts_at);
CREATE INDEX system_delegations_delegate_idx
  ON system_delegations (delegate_account_id, starts_at);
CREATE TRIGGER system_delegations_monotonic_lifecycle
BEFORE UPDATE ON system_delegations
WHEN
  NEW.id IS NOT OLD.id
  OR NEW.delegator_account_id IS NOT OLD.delegator_account_id
  OR NEW.delegate_account_id IS NOT OLD.delegate_account_id
  OR NEW.scope_context IS NOT OLD.scope_context
  OR NEW.scope_kind IS NOT OLD.scope_kind
  OR NEW.scope_id IS NOT OLD.scope_id
  OR NEW.scope_version IS NOT OLD.scope_version
  OR NEW.starts_at IS NOT OLD.starts_at
  OR NEW.ends_at IS NOT OLD.ends_at
  OR NEW.created_at IS NOT OLD.created_at
  OR OLD.revoked_at IS NOT NULL
  OR NEW.revoked_at IS NULL
BEGIN
  SELECT RAISE(ABORT, 'delegation lifecycle is not monotonic');
END;
CREATE TRIGGER system_delegations_prevent_delete
BEFORE DELETE ON system_delegations
BEGIN
  SELECT RAISE(ABORT, 'delegation is immutable');
END;

-- system_delegation_numbers
INSERT INTO system_delegation_numbers (number, delegation_id)
SELECT source.number,
       source.delegation_id
FROM "_stage_system_delegation_numbers" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_delegation_numbers',
       (SELECT count(*) FROM "_stage_system_delegation_numbers"),
       (SELECT count(*) FROM system_delegation_numbers),
       0,
       0,
       0;
DROP TABLE "_stage_system_delegation_numbers";
CREATE UNIQUE INDEX system_delegation_numbers_delegation_uniq
  ON system_delegation_numbers (delegation_id);
CREATE TRIGGER system_delegation_numbers_prevent_update
BEFORE UPDATE ON system_delegation_numbers
BEGIN
  SELECT RAISE(ABORT, 'delegation number is immutable');
END;
CREATE TRIGGER system_delegation_numbers_prevent_delete
BEFORE DELETE ON system_delegation_numbers
BEGIN
  SELECT RAISE(ABORT, 'delegation number is immutable');
END;

-- system_delegation_procedure_scopes
INSERT INTO system_delegation_procedure_scopes (delegation_id, procedure_key)
SELECT source.delegation_id,
       source.procedure_key
FROM "_stage_system_delegation_procedure_scopes" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_delegation_procedure_scopes',
       (SELECT count(*) FROM "_stage_system_delegation_procedure_scopes"),
       (SELECT count(*) FROM system_delegation_procedure_scopes),
       0,
       0,
       0;
DROP TABLE "_stage_system_delegation_procedure_scopes";
CREATE UNIQUE INDEX system_delegation_procedure_scopes_pair_uniq
  ON system_delegation_procedure_scopes (delegation_id, procedure_key);
CREATE TRIGGER system_delegation_procedure_scopes_valid_insert
BEFORE INSERT ON system_delegation_procedure_scopes
WHEN NOT EXISTS (
  SELECT 1 FROM system_delegations
  WHERE id = NEW.delegation_id
    AND scope_context IS NULL
    AND scope_kind IS NULL
    AND scope_id IS NULL
    AND scope_version IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'procedure scope requires an otherwise global delegation');
END;
CREATE TRIGGER system_delegation_procedure_scopes_prevent_update
BEFORE UPDATE ON system_delegation_procedure_scopes
BEGIN
  SELECT RAISE(ABORT, 'delegation procedure scope is immutable');
END;
CREATE TRIGGER system_delegation_procedure_scopes_prevent_delete
BEFORE DELETE ON system_delegation_procedure_scopes
BEGIN
  SELECT RAISE(ABORT, 'delegation procedure scope is immutable');
END;

-- system_execution_authorizations
INSERT INTO system_execution_authorizations (id, case_id, operation_key, proposal_digest, granted_to_account_id, granted_at, expires_at, used_at)
SELECT source.id,
       source.case_id,
       source.operation_key,
       source.proposal_digest,
       CASE WHEN source.granted_to_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.granted_to_account_id), source.granted_to_account_id) END ,
       source.granted_at,
       source.expires_at,
       source.used_at
FROM "_stage_system_execution_authorizations" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_execution_authorizations',
       (SELECT count(*) FROM "_stage_system_execution_authorizations"),
       (SELECT count(*) FROM system_execution_authorizations),
       0,
       0,
       0;
DROP TABLE "_stage_system_execution_authorizations";
CREATE UNIQUE INDEX system_execution_authorizations_case_operation_uniq
  ON system_execution_authorizations (case_id, operation_key);
CREATE INDEX system_execution_authorizations_grantee_idx
  ON system_execution_authorizations (granted_to_account_id, granted_at);
CREATE TRIGGER system_execution_authorizations_valid_insert
BEFORE INSERT ON system_execution_authorizations
WHEN NOT EXISTS (
  SELECT 1 FROM system_cases
  WHERE
    id = NEW.case_id
    AND status = 'approved'
    AND proposal_digest = NEW.proposal_digest
)
BEGIN
  SELECT RAISE(ABORT, 'execution authorization requires approved case');
END;
CREATE TRIGGER system_execution_authorizations_single_use
BEFORE UPDATE ON system_execution_authorizations
WHEN
  NEW.id IS NOT OLD.id
  OR NEW.case_id IS NOT OLD.case_id
  OR NEW.operation_key IS NOT OLD.operation_key
  OR NEW.proposal_digest IS NOT OLD.proposal_digest
  OR NEW.granted_to_account_id IS NOT OLD.granted_to_account_id
  OR NEW.granted_at IS NOT OLD.granted_at
  OR NEW.expires_at IS NOT OLD.expires_at
  OR OLD.used_at IS NOT NULL
  OR NEW.used_at IS NULL
  OR NOT EXISTS (
    SELECT 1 FROM system_cases
    WHERE
      id = NEW.case_id
      AND status = 'approved'
      AND proposal_digest = NEW.proposal_digest
  )
BEGIN
  SELECT RAISE(ABORT, 'execution authorization is single use');
END;
CREATE TRIGGER system_execution_authorizations_prevent_delete
BEFORE DELETE ON system_execution_authorizations
BEGIN
  SELECT RAISE(ABORT, 'execution authorization is immutable');
END;

-- system_human_attestations
INSERT INTO system_human_attestations (id, case_id, task_key, round, actor_account_id, represented_account_id, delegation_id, action, proposal_digest, comment, decided_at)
SELECT source.id,
       source.case_id,
       source.task_key,
       source.round,
       CASE WHEN source.actor_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.actor_account_id), source.actor_account_id) END ,
       CASE WHEN source.represented_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.represented_account_id), source.represented_account_id) END ,
       source.delegation_id,
       source.action,
       source.proposal_digest,
       source.comment,
       source.decided_at
FROM "_stage_system_human_attestations" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_human_attestations',
       (SELECT count(*) FROM "_stage_system_human_attestations"),
       (SELECT count(*) FROM system_human_attestations),
       0,
       0,
       0;
DROP TABLE "_stage_system_human_attestations";
CREATE UNIQUE INDEX system_human_attestations_actor_uniq
  ON system_human_attestations (case_id, task_key, round, actor_account_id);
CREATE UNIQUE INDEX system_human_attestations_represented_uniq
  ON system_human_attestations (case_id, task_key, round, represented_account_id);
CREATE INDEX system_human_attestations_decided_idx
  ON system_human_attestations (decided_at);
CREATE TRIGGER system_human_attestations_valid_insert
BEFORE INSERT ON system_human_attestations
WHEN
  NOT EXISTS (
    SELECT 1
    FROM system_decision_tasks AS task
    JOIN system_cases AS workflow_case ON workflow_case.id = task.case_id
    WHERE
      task.case_id = NEW.case_id
      AND task.task_key = NEW.task_key
      AND task.round = NEW.round
      AND task.closed_at IS NULL
      AND task.proposal_digest = NEW.proposal_digest
      AND workflow_case.status = 'pending'
      AND workflow_case.proposal_digest = NEW.proposal_digest
      AND workflow_case.created_by_account_id <> NEW.actor_account_id
  )
  OR NOT EXISTS (
    SELECT 1 FROM system_decision_task_candidates
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND round = NEW.round
      AND candidate_account_id = NEW.represented_account_id
      AND (eligible_from IS NULL OR eligible_from <= NEW.decided_at)
  )
  OR EXISTS (
    SELECT 1 FROM system_decision_task_exclusions
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND round = NEW.round
      AND excluded_account_id = NEW.represented_account_id
  )
  OR (
    NEW.delegation_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM system_delegations AS delegation
      JOIN system_cases AS workflow_case ON workflow_case.id = NEW.case_id
      WHERE
        delegation.id = NEW.delegation_id
        AND delegation.delegator_account_id = NEW.represented_account_id
        AND delegation.delegate_account_id = NEW.actor_account_id
        AND delegation.starts_at <= NEW.decided_at
        AND delegation.ends_at > NEW.decided_at
        AND (delegation.revoked_at IS NULL OR delegation.revoked_at > NEW.decided_at)
        AND (
          delegation.scope_context IS NULL
          OR (
            delegation.scope_context = workflow_case.subject_context
            AND delegation.scope_kind = workflow_case.subject_kind
            AND delegation.scope_id = workflow_case.subject_id
            AND delegation.scope_version = workflow_case.subject_version
          )
        )
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid human attestation');
END;
CREATE TRIGGER system_human_attestations_prevent_update
BEFORE UPDATE ON system_human_attestations
BEGIN
  SELECT RAISE(ABORT, 'human attestation is immutable');
END;
CREATE TRIGGER system_human_attestations_prevent_delete
BEFORE DELETE ON system_human_attestations
BEGIN
  SELECT RAISE(ABORT, 'human attestation is immutable');
END;
CREATE TRIGGER system_human_attestations_procedure_delegation
BEFORE INSERT ON system_human_attestations
WHEN NEW.delegation_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM system_delegation_procedure_scopes
    WHERE delegation_id = NEW.delegation_id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM system_delegation_procedure_scopes AS procedure_scope
    JOIN system_proposal_cases AS proposal_case ON proposal_case.case_id = NEW.case_id
    JOIN system_proposals AS proposal ON proposal.id = proposal_case.proposal_id
    WHERE procedure_scope.delegation_id = NEW.delegation_id
      AND procedure_scope.procedure_key = proposal.procedure_key
  )
BEGIN
  SELECT RAISE(ABORT, 'delegation does not cover this procedure');
END;
CREATE TRIGGER system_human_attestations_task_policy
BEFORE INSERT ON system_human_attestations
WHEN EXISTS (
  SELECT 1 FROM system_decision_tasks
  WHERE
    case_id = NEW.case_id
    AND task_key = NEW.task_key
    AND round = NEW.round
    AND (
      (delegation_policy = 'forbidden' AND NEW.delegation_id IS NOT NULL)
      OR (return_policy = 'forbidden' AND NEW.action = 'return')
    )
)
BEGIN
  SELECT RAISE(ABORT, 'human attestation violates task policy');
END;
CREATE TRIGGER system_attestation_requires_human
BEFORE INSERT ON system_human_attestations
WHEN NOT EXISTS (
  SELECT 1 FROM system_accounts account
  JOIN system_principals principal ON principal.account_id = account.id
  WHERE account.id = NEW.actor_account_id AND account.status = 'active' AND account.closed_at IS NULL
    AND account.created_at <= NEW.decided_at AND principal.kind = 'human' AND principal.created_at <= NEW.decided_at
) OR NOT EXISTS (
  SELECT 1 FROM system_accounts account
  JOIN system_principals principal ON principal.account_id = account.id
  WHERE account.id = NEW.represented_account_id AND account.status = 'active' AND account.closed_at IS NULL
    AND account.created_at <= NEW.decided_at AND principal.kind = 'human' AND principal.created_at <= NEW.decided_at
)
BEGIN
  SELECT RAISE(ABORT, 'system_attestation_requires_human');
END;

-- system_identity_profiles
INSERT INTO system_identity_profiles (identity_id, email, email_verified, last_used_at, updated_at, can_receive_email)
SELECT CASE WHEN source.identity_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _system_identity_bindings_id_map ref WHERE ref.old_id = source.identity_id), CAST(source.identity_id AS TEXT)) END ,
       source.email,
       source.email_verified,
       source.last_used_at,
       source.updated_at,
       source.can_receive_email
FROM "_stage_system_identity_profiles" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_identity_profiles',
       (SELECT count(*) FROM "_stage_system_identity_profiles"),
       (SELECT count(*) FROM system_identity_profiles),
       0,
       (SELECT count(*) FROM system_identity_profiles WHERE NOT (length(identity_id) = 36 AND identity_id NOT GLOB '*[^0-9a-f-]*' AND substr(identity_id, 9, 1) = '-' AND substr(identity_id, 14, 1) = '-' AND substr(identity_id, 19, 1) = '-' AND substr(identity_id, 24, 1) = '-' AND length(replace(identity_id, '-', '')) = 32 AND substr(identity_id, 15, 1) GLOB '[1-8]' AND substr(identity_id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_identity_profiles";
CREATE INDEX system_identity_profiles_email_idx
  ON system_identity_profiles (email);

-- system_notification_messages
INSERT INTO system_notification_messages (id, kind, title, body, source_type, source_id, created_at, action_url, priority, dedupe_key, action_type, action_id)
SELECT source.id,
       source.kind,
       source.title,
       source.body,
       source.source_type,
       source.source_id,
       source.created_at,
       source.action_url,
       source.priority,
       source.dedupe_key,
       source.action_type,
       CASE WHEN source.action_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.action_id), source.action_id) END
FROM "_stage_system_notification_messages" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_notification_messages',
       (SELECT count(*) FROM "_stage_system_notification_messages"),
       (SELECT count(*) FROM system_notification_messages),
       0,
       0,
       0;
DROP TABLE "_stage_system_notification_messages";
CREATE INDEX system_notification_messages_source_idx
  ON system_notification_messages (source_type, source_id);
CREATE INDEX system_notification_messages_priority_idx
  ON system_notification_messages(priority, created_at);
CREATE UNIQUE INDEX system_notification_messages_dedupe_key_uniq
  ON system_notification_messages(dedupe_key);
CREATE TRIGGER system_notification_messages_prevent_update
BEFORE UPDATE ON system_notification_messages
BEGIN
  SELECT RAISE(ABORT, 'notification message is immutable');
END;
CREATE TRIGGER system_notification_messages_prevent_delete
BEFORE DELETE ON system_notification_messages
BEGIN
  SELECT RAISE(ABORT, 'notification message is immutable');
END;
CREATE TRIGGER system_notification_messages_action_pair_guard
BEFORE INSERT ON system_notification_messages
WHEN (NEW.action_type IS NULL) != (NEW.action_id IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'notification action reference is incomplete');
END;

-- system_notification_deliveries
INSERT INTO system_notification_deliveries (id, message_id, recipient_account_id, delivered_at, read_at, dismissed_at)
SELECT source.id,
       source.message_id,
       CASE WHEN source.recipient_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.recipient_account_id), source.recipient_account_id) END ,
       source.delivered_at,
       source.read_at,
       source.dismissed_at
FROM "_stage_system_notification_deliveries" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_notification_deliveries',
       (SELECT count(*) FROM "_stage_system_notification_deliveries"),
       (SELECT count(*) FROM system_notification_deliveries),
       0,
       0,
       0;
DROP TABLE "_stage_system_notification_deliveries";
CREATE UNIQUE INDEX system_notification_deliveries_message_account_uniq
  ON system_notification_deliveries (message_id, recipient_account_id);
CREATE INDEX system_notification_deliveries_account_idx
  ON system_notification_deliveries (recipient_account_id, delivered_at);
CREATE INDEX system_notification_deliveries_unread_idx
  ON system_notification_deliveries (recipient_account_id, delivered_at)
  WHERE read_at IS NULL AND dismissed_at IS NULL;
CREATE TRIGGER system_notification_deliveries_monotonic_read
BEFORE UPDATE ON system_notification_deliveries
WHEN
  NEW.id IS NOT OLD.id
  OR NEW.message_id IS NOT OLD.message_id
  OR NEW.recipient_account_id IS NOT OLD.recipient_account_id
  OR NEW.delivered_at IS NOT OLD.delivered_at
  OR (OLD.read_at IS NOT NULL AND NEW.read_at IS NOT OLD.read_at)
  OR (OLD.dismissed_at IS NOT NULL AND NEW.dismissed_at IS NOT OLD.dismissed_at)
  OR (OLD.dismissed_at IS NOT NULL AND NEW.read_at IS NOT OLD.read_at)
BEGIN
  SELECT RAISE(ABORT, 'notification delivery is immutable except first read and dismiss');
END;

-- system_notification_resource_scopes
INSERT INTO system_notification_resource_scopes (message_id, resource_type, resource_id)
SELECT source.message_id,
       source.resource_type,
       source.resource_id
FROM "_stage_system_notification_resource_scopes" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_notification_resource_scopes',
       (SELECT count(*) FROM "_stage_system_notification_resource_scopes"),
       (SELECT count(*) FROM system_notification_resource_scopes),
       0,
       0,
       0;
DROP TABLE "_stage_system_notification_resource_scopes";
CREATE INDEX system_notification_resource_scopes_resource_idx
  ON system_notification_resource_scopes (resource_type, resource_id, message_id);

-- system_oidc_access_tokens
INSERT INTO system_oidc_access_tokens (token_hash, issuer, client_id, account_id, scope, expires_at, created_at)
SELECT source.token_hash,
       source.issuer,
       source.client_id,
       CASE WHEN source.account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.account_id), source.account_id) END ,
       source.scope,
       source.expires_at,
       source.created_at
FROM "_stage_system_oidc_access_tokens" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_oidc_access_tokens',
       (SELECT count(*) FROM "_stage_system_oidc_access_tokens"),
       (SELECT count(*) FROM system_oidc_access_tokens),
       0,
       0,
       0;
DROP TABLE "_stage_system_oidc_access_tokens";
CREATE INDEX system_oidc_access_tokens_expires_idx
  ON system_oidc_access_tokens (expires_at);

-- system_oidc_authorization_codes
INSERT INTO system_oidc_authorization_codes (code_hash, issuer, client_id, redirect_uri, account_id, code_challenge, nonce, scope, expires_at, created_at)
SELECT source.code_hash,
       source.issuer,
       source.client_id,
       source.redirect_uri,
       CASE WHEN source.account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.account_id), source.account_id) END ,
       source.code_challenge,
       source.nonce,
       source.scope,
       source.expires_at,
       source.created_at
FROM "_stage_system_oidc_authorization_codes" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_oidc_authorization_codes',
       (SELECT count(*) FROM "_stage_system_oidc_authorization_codes"),
       (SELECT count(*) FROM system_oidc_authorization_codes),
       0,
       0,
       0;
DROP TABLE "_stage_system_oidc_authorization_codes";
CREATE INDEX system_oidc_authorization_codes_expires_idx
  ON system_oidc_authorization_codes (expires_at);

-- system_operation_receipts
INSERT INTO system_operation_receipts (id, operation_key, scope_key, command_id, actor_account_id, actor_principal_id, request_digest, result_json, result_digest, recorded_at)
SELECT source.id,
       source.operation_key,
       source.scope_key,
       source.command_id,
       CASE WHEN source.actor_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.actor_account_id), source.actor_account_id) END ,
       CASE WHEN source.actor_principal_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.actor_principal_id), source.actor_principal_id) END ,
       source.request_digest,
       CASE WHEN json_valid(source.result_json) AND json_type(source.result_json) = 'object' THEN json_replace(source.result_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.result_json, '$.accountId')), json_extract(source.result_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.result_json, '$.actorAccountId')), json_extract(source.result_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.result_json, '$.release.actorAccountId')), json_extract(source.result_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.result_json, '$.employeeId')), json_extract(source.result_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.result_json, '$.managerEmployeeId')), json_extract(source.result_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.result_json, '$.targetEmployeeId')), json_extract(source.result_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.result_json, '$.requestedByEmployeeId')), json_extract(source.result_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.result_json, '$.requestedApproverId')), json_extract(source.result_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.result_json, '$.applicantId')), json_extract(source.result_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.result_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.result_json, '$.holderId')), json_extract(source.result_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.result_json, '$.personId')), json_extract(source.result_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.result_json, '$.employmentId')), json_extract(source.result_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.result_json, '$.periodId')), json_extract(source.result_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.result_json, '$.resourceId')), json_extract(source.result_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.result_json, '$.existingResourceId')), json_extract(source.result_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.result_json, '$.scopeId')), json_extract(source.result_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.result_json, '$.authorityScopeId')), json_extract(source.result_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.result_json, '$.responsibilityId')), json_extract(source.result_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.result_json, '$.collectiveBodyId')), json_extract(source.result_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.result_json, '$.organizationalOfficeId')), json_extract(source.result_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.result_json, '$.positionId')), json_extract(source.result_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.result_json, '$.jobId')), json_extract(source.result_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.result_json, '$.siteId')), json_extract(source.result_json, '$.siteId'))) ELSE source.result_json END ,
       source.result_digest,
       source.recorded_at
FROM "_stage_system_operation_receipts" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_operation_receipts',
       (SELECT count(*) FROM "_stage_system_operation_receipts"),
       (SELECT count(*) FROM system_operation_receipts),
       0,
       0,
       0;
DROP TABLE "_stage_system_operation_receipts";
CREATE INDEX system_operation_receipts_actor_idx ON system_operation_receipts (actor_account_id, recorded_at);
CREATE TRIGGER system_operation_receipts_no_update BEFORE UPDATE ON system_operation_receipts
BEGIN SELECT RAISE(ABORT, 'system operation receipt is immutable'); END;
CREATE TRIGGER system_operation_receipts_no_delete BEFORE DELETE ON system_operation_receipts
BEGIN SELECT RAISE(ABORT, 'system operation receipt is immutable'); END;
CREATE TRIGGER system_operation_receipts_identity_update
BEFORE UPDATE OF id ON system_operation_receipts
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- system_outbox_messages
INSERT INTO system_outbox_messages (id, topic, source_context, source_kind, source_id, source_version, payload_digest, idempotency_key, created_by_account_id, status, attempt, max_attempts, available_at, lease_account_id, lease_token_hash, lease_expires_at, last_error_code, created_at, updated_at, completed_at, handler_key)
SELECT source.id,
       source.topic,
       source.source_context,
       source.source_kind,
       source.source_id,
       source.source_version,
       source.payload_digest,
       source.idempotency_key,
       CASE WHEN source.created_by_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.created_by_account_id), source.created_by_account_id) END ,
       source.status,
       source.attempt,
       source.max_attempts,
       source.available_at,
       CASE WHEN source.lease_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.lease_account_id), source.lease_account_id) END ,
       source.lease_token_hash,
       source.lease_expires_at,
       source.last_error_code,
       source.created_at,
       source.updated_at,
       source.completed_at,
       source.handler_key
FROM "_stage_system_outbox_messages" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_outbox_messages',
       (SELECT count(*) FROM "_stage_system_outbox_messages"),
       (SELECT count(*) FROM system_outbox_messages),
       0,
       0,
       0;
DROP TABLE "_stage_system_outbox_messages";
CREATE UNIQUE INDEX system_outbox_messages_idempotency_uniq
  ON system_outbox_messages (topic, idempotency_key);
CREATE INDEX system_outbox_messages_claim_idx ON system_outbox_messages (status, available_at, id);
CREATE INDEX system_outbox_messages_lease_idx ON system_outbox_messages (status, lease_expires_at);
CREATE INDEX system_outbox_handler_claim_idx ON system_outbox_messages(handler_key, status, available_at, id);
CREATE TRIGGER system_outbox_messages_monotonic_update
BEFORE UPDATE ON system_outbox_messages
WHEN NEW.id <> OLD.id OR NEW.topic <> OLD.topic OR NEW.source_context <> OLD.source_context
  OR NEW.source_kind <> OLD.source_kind OR NEW.source_id <> OLD.source_id
  OR NEW.source_version <> OLD.source_version OR NEW.payload_digest <> OLD.payload_digest
  OR NEW.idempotency_key <> OLD.idempotency_key
  OR NEW.created_by_account_id <> OLD.created_by_account_id OR NEW.created_at <> OLD.created_at
  OR NEW.max_attempts <> OLD.max_attempts OR NEW.attempt < OLD.attempt OR NEW.attempt > OLD.attempt + 1
  OR NEW.updated_at < OLD.updated_at OR OLD.status IN ('succeeded', 'dead_letter')
  OR (OLD.status = 'queued' AND NEW.status NOT IN ('queued', 'leased'))
BEGIN
  SELECT RAISE(ABORT, 'system_outbox_update_invalid');
END;
CREATE TRIGGER system_outbox_messages_no_delete BEFORE DELETE ON system_outbox_messages
BEGIN SELECT RAISE(ABORT, 'system_outbox_messages_are_retained'); END;
CREATE TRIGGER system_outbox_handler_immutable
BEFORE UPDATE ON system_outbox_messages
WHEN NEW.handler_key IS NOT OLD.handler_key
BEGIN
  SELECT RAISE(ABORT, 'system_delivery_handler_immutable');
END;

-- system_password_credentials
INSERT INTO system_password_credentials (identity_id, password_hash, changed_at, created_at, updated_at)
SELECT CASE WHEN source.identity_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _system_identity_bindings_id_map ref WHERE ref.old_id = source.identity_id), CAST(source.identity_id AS TEXT)) END ,
       source.password_hash,
       source.changed_at,
       source.created_at,
       source.updated_at
FROM "_stage_system_password_credentials" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_password_credentials',
       (SELECT count(*) FROM "_stage_system_password_credentials"),
       (SELECT count(*) FROM system_password_credentials),
       0,
       (SELECT count(*) FROM system_password_credentials WHERE NOT (length(identity_id) = 36 AND identity_id NOT GLOB '*[^0-9a-f-]*' AND substr(identity_id, 9, 1) = '-' AND substr(identity_id, 14, 1) = '-' AND substr(identity_id, 19, 1) = '-' AND substr(identity_id, 24, 1) = '-' AND length(replace(identity_id, '-', '')) = 32 AND substr(identity_id, 15, 1) GLOB '[1-8]' AND substr(identity_id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_password_credentials";
CREATE TRIGGER system_password_credentials_provider_insert
BEFORE INSERT ON system_password_credentials
WHEN NOT EXISTS (
  SELECT 1 FROM system_identity_bindings
  WHERE id = NEW.identity_id AND provider = 'password'
)
BEGIN
  SELECT RAISE(ABORT, 'password credential requires password identity');
END;
CREATE TRIGGER system_password_credentials_provider_update
BEFORE UPDATE OF identity_id ON system_password_credentials
WHEN NOT EXISTS (
  SELECT 1 FROM system_identity_bindings
  WHERE id = NEW.identity_id AND provider = 'password'
)
BEGIN
  SELECT RAISE(ABORT, 'password credential requires password identity');
END;
CREATE TRIGGER system_password_credentials_monotonic_change
BEFORE UPDATE ON system_password_credentials
WHEN
  NEW.identity_id IS NOT OLD.identity_id
  OR NEW.created_at IS NOT OLD.created_at
  OR NEW.changed_at < OLD.changed_at
  OR NEW.updated_at < OLD.updated_at
BEGIN
  SELECT RAISE(ABORT, 'password credential change is not monotonic');
END;

-- system_password_reset_challenges
INSERT INTO system_password_reset_challenges (id, token_hash, account_id, identity_id, created_at, expires_at, used_at)
SELECT map.new_id,
       source.token_hash,
       CASE WHEN source.account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.account_id), source.account_id) END ,
       CASE WHEN source.identity_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.identity_id), source.identity_id) END ,
       source.created_at,
       source.expires_at,
       source.used_at
FROM "_stage_system_password_reset_challenges" source
INNER JOIN _system_password_reset_challenges_id_map map ON map.old_id = source.id;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_password_reset_challenges',
       (SELECT count(*) FROM "_stage_system_password_reset_challenges"),
       (SELECT count(*) FROM system_password_reset_challenges),
       0,
       (SELECT count(*) FROM system_password_reset_challenges WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_password_reset_challenges";
CREATE UNIQUE INDEX system_password_reset_challenges_token_hash_uniq
  ON system_password_reset_challenges (token_hash);
CREATE INDEX system_password_reset_challenges_account_idx
  ON system_password_reset_challenges (account_id, created_at);
CREATE INDEX system_password_reset_challenges_expires_idx
  ON system_password_reset_challenges (expires_at);
CREATE TRIGGER system_password_reset_challenges_password_identity_insert
BEFORE INSERT ON system_password_reset_challenges
WHEN NOT EXISTS (
  SELECT 1 FROM system_identity_bindings
  WHERE id = NEW.identity_id
    AND account_id = NEW.account_id
    AND provider = 'password'
    AND revoked_at IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'password reset challenge requires a password identity');
END;
CREATE TRIGGER system_password_reset_challenges_monotonic_use
BEFORE UPDATE ON system_password_reset_challenges
WHEN
  NEW.id IS NOT OLD.id
  OR NEW.token_hash IS NOT OLD.token_hash
  OR NEW.account_id IS NOT OLD.account_id
  OR NEW.identity_id IS NOT OLD.identity_id
  OR NEW.created_at IS NOT OLD.created_at
  OR NEW.expires_at IS NOT OLD.expires_at
  OR (OLD.used_at IS NOT NULL AND NEW.used_at IS NOT OLD.used_at)
BEGIN
  SELECT RAISE(ABORT, 'password reset challenge lifecycle is not monotonic');
END;

-- system_record_disclosure_policies
INSERT INTO system_record_disclosure_policies (revision_id, id, revision, record_id, audit_event_id, snapshot_json)
SELECT source.revision_id,
       source.id,
       source.revision,
       source.record_id,
       source.audit_event_id,
       source.snapshot_json
FROM "_stage_system_record_disclosure_policies" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_record_disclosure_policies',
       (SELECT count(*) FROM "_stage_system_record_disclosure_policies"),
       (SELECT count(*) FROM system_record_disclosure_policies),
       0,
       0,
       0;
DROP TABLE "_stage_system_record_disclosure_policies";
CREATE TRIGGER system_record_disclosure_publication_guard
BEFORE INSERT ON system_record_disclosure_policies
WHEN NEW.revision != COALESCE((SELECT MAX(revision) FROM system_record_disclosure_policies WHERE id = NEW.id), 0) + 1
  OR EXISTS (SELECT 1 FROM system_record_disclosure_policies p WHERE p.id = NEW.id AND (
    p.record_id != NEW.record_id OR julianday(json_extract(p.snapshot_json, '$.publishedAt')) > julianday(json_extract(NEW.snapshot_json, '$.publishedAt'))))
  OR NOT EXISTS (SELECT 1 FROM system_audit_events a WHERE a.event_id = NEW.audit_event_id
    AND a.action = 'system.record.disclosure_policy.published' AND a.target_type = 'system:record-disclosure-policy'
    AND a.target_id = NEW.id AND a.outcome = 'succeeded'
    AND a.actor_account_id = json_extract(NEW.snapshot_json, '$.actorAccountId')
    AND a.after_json = NEW.snapshot_json
    AND strftime('%Y-%m-%dT%H:%M:%fZ', a.occurred_at / 1000.0, 'unixepoch') = json_extract(NEW.snapshot_json, '$.publishedAt'))
BEGIN
  SELECT RAISE(ABORT, 'record_disclosure_publication_invalid');
END;
CREATE TRIGGER system_record_disclosure_prevent_update
BEFORE UPDATE ON system_record_disclosure_policies
BEGIN
  SELECT RAISE(ABORT, 'record_disclosure_history_immutable');
END;
CREATE TRIGGER system_record_disclosure_prevent_delete
BEFORE DELETE ON system_record_disclosure_policies
BEGIN
  SELECT RAISE(ABORT, 'record_disclosure_history_immutable');
END;
CREATE TRIGGER system_record_disclosure_policies_identity_update
BEFORE UPDATE OF id ON system_record_disclosure_policies
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- system_preserved_records
INSERT INTO system_preserved_records (id, attachment_id, preservation_id, disclosure_policy_id, disclosure_policy_revision, audit_event_id, snapshot_json)
SELECT source.id,
       source.attachment_id,
       source.preservation_id,
       source.disclosure_policy_id,
       source.disclosure_policy_revision,
       source.audit_event_id,
       source.snapshot_json
FROM "_stage_system_preserved_records" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_preserved_records',
       (SELECT count(*) FROM "_stage_system_preserved_records"),
       (SELECT count(*) FROM system_preserved_records),
       0,
       0,
       0;
DROP TABLE "_stage_system_preserved_records";
CREATE INDEX system_preserved_records_source_idx ON system_preserved_records (
  json_extract(snapshot_json, '$.source.sourceNamespace'),
  json_extract(snapshot_json, '$.source.ownerContext'),
  json_extract(snapshot_json, '$.source.recordKind'),
  json_extract(snapshot_json, '$.source.recordId')
);
CREATE TRIGGER system_preserved_record_prevent_update
BEFORE UPDATE ON system_preserved_records
BEGIN
  SELECT RAISE(ABORT, 'preserved_record_immutable');
END;
CREATE TRIGGER system_preserved_record_prevent_delete
BEFORE DELETE ON system_preserved_records
BEGIN
  SELECT RAISE(ABORT, 'preserved_record_immutable');
END;
CREATE TRIGGER system_preserved_record_insert_guard
BEFORE INSERT ON system_preserved_records
WHEN NOT EXISTS (
  SELECT 1 FROM system_attachments a JOIN system_attachment_preservations h ON h.attachment_id = a.id
  WHERE a.id = NEW.attachment_id AND h.id = NEW.preservation_id
    AND a.status = 'linked' AND a.content_type IN ('application/vnd.record-preservation+json', 'application/vnd.record-preservation+binary')
    AND a.plaintext_sha256 = json_extract(NEW.snapshot_json, '$.attachmentDigest')
    AND h.plaintext_sha256 = a.plaintext_sha256 AND h.released_at IS NULL
    AND h.created_by_account_id = json_extract(NEW.snapshot_json, '$.actorAccountId')
    AND strftime('%Y-%m-%dT%H:%M:%fZ', h.created_at / 1000.0, 'unixepoch') = json_extract(NEW.snapshot_json, '$.finalizedAt')
    AND (h.kind = 'hold' OR h.retain_until > h.created_at))
  OR NOT EXISTS (SELECT 1 FROM system_record_disclosure_policies p
    WHERE p.id = NEW.disclosure_policy_id AND p.revision = NEW.disclosure_policy_revision
      AND p.record_id = NEW.id AND json_extract(p.snapshot_json, '$.status') = 'active'
      AND julianday(json_extract(p.snapshot_json, '$.publishedAt')) <= julianday(json_extract(NEW.snapshot_json, '$.finalizedAt'))
      AND NOT EXISTS (SELECT 1 FROM system_record_disclosure_policies later WHERE later.id = p.id AND later.revision > p.revision))
  OR NOT EXISTS (SELECT 1 FROM system_audit_events a WHERE a.event_id = NEW.audit_event_id
    AND a.action = 'system.record.preserved' AND a.target_type = 'system:preserved-record'
    AND a.target_id = NEW.id AND a.outcome = 'succeeded'
    AND a.actor_account_id = json_extract(NEW.snapshot_json, '$.actorAccountId')
    AND a.after_json = NEW.snapshot_json
    AND strftime('%Y-%m-%dT%H:%M:%fZ', a.occurred_at / 1000.0, 'unixepoch') = json_extract(NEW.snapshot_json, '$.finalizedAt'))
BEGIN
  SELECT RAISE(ABORT, 'preserved_record_dependencies_invalid');
END;

-- system_procedure_definition_revisions
INSERT INTO system_procedure_definition_revisions (id, procedure_key, revision, title, category, description, input_schema_json, decision_policy_json, completion_operation_key, created_by_account_id, created_at)
SELECT source.id,
       source.procedure_key,
       source.revision,
       source.title,
       source.category,
       source.description,
       CASE WHEN json_valid(source.input_schema_json) AND json_type(source.input_schema_json) = 'object' THEN json_replace(source.input_schema_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.input_schema_json, '$.accountId')), json_extract(source.input_schema_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.input_schema_json, '$.actorAccountId')), json_extract(source.input_schema_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.input_schema_json, '$.release.actorAccountId')), json_extract(source.input_schema_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.input_schema_json, '$.employeeId')), json_extract(source.input_schema_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.input_schema_json, '$.managerEmployeeId')), json_extract(source.input_schema_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.input_schema_json, '$.targetEmployeeId')), json_extract(source.input_schema_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.input_schema_json, '$.requestedByEmployeeId')), json_extract(source.input_schema_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.input_schema_json, '$.requestedApproverId')), json_extract(source.input_schema_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.input_schema_json, '$.applicantId')), json_extract(source.input_schema_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.input_schema_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.input_schema_json, '$.holderId')), json_extract(source.input_schema_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.input_schema_json, '$.personId')), json_extract(source.input_schema_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.input_schema_json, '$.employmentId')), json_extract(source.input_schema_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.input_schema_json, '$.periodId')), json_extract(source.input_schema_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.input_schema_json, '$.resourceId')), json_extract(source.input_schema_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.input_schema_json, '$.existingResourceId')), json_extract(source.input_schema_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.input_schema_json, '$.scopeId')), json_extract(source.input_schema_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.input_schema_json, '$.authorityScopeId')), json_extract(source.input_schema_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.input_schema_json, '$.responsibilityId')), json_extract(source.input_schema_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.input_schema_json, '$.collectiveBodyId')), json_extract(source.input_schema_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.input_schema_json, '$.organizationalOfficeId')), json_extract(source.input_schema_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.input_schema_json, '$.positionId')), json_extract(source.input_schema_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.input_schema_json, '$.jobId')), json_extract(source.input_schema_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.input_schema_json, '$.siteId')), json_extract(source.input_schema_json, '$.siteId'))) ELSE source.input_schema_json END ,
       CASE WHEN json_valid(source.decision_policy_json) AND json_type(source.decision_policy_json) = 'object' THEN json_replace(source.decision_policy_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.decision_policy_json, '$.accountId')), json_extract(source.decision_policy_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.decision_policy_json, '$.actorAccountId')), json_extract(source.decision_policy_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.decision_policy_json, '$.release.actorAccountId')), json_extract(source.decision_policy_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.decision_policy_json, '$.employeeId')), json_extract(source.decision_policy_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.decision_policy_json, '$.managerEmployeeId')), json_extract(source.decision_policy_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.decision_policy_json, '$.targetEmployeeId')), json_extract(source.decision_policy_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.decision_policy_json, '$.requestedByEmployeeId')), json_extract(source.decision_policy_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.decision_policy_json, '$.requestedApproverId')), json_extract(source.decision_policy_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.decision_policy_json, '$.applicantId')), json_extract(source.decision_policy_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.decision_policy_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.decision_policy_json, '$.holderId')), json_extract(source.decision_policy_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.decision_policy_json, '$.personId')), json_extract(source.decision_policy_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.decision_policy_json, '$.employmentId')), json_extract(source.decision_policy_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.decision_policy_json, '$.periodId')), json_extract(source.decision_policy_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.decision_policy_json, '$.resourceId')), json_extract(source.decision_policy_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.decision_policy_json, '$.existingResourceId')), json_extract(source.decision_policy_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.decision_policy_json, '$.scopeId')), json_extract(source.decision_policy_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.decision_policy_json, '$.authorityScopeId')), json_extract(source.decision_policy_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.decision_policy_json, '$.responsibilityId')), json_extract(source.decision_policy_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.decision_policy_json, '$.collectiveBodyId')), json_extract(source.decision_policy_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.decision_policy_json, '$.organizationalOfficeId')), json_extract(source.decision_policy_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.decision_policy_json, '$.positionId')), json_extract(source.decision_policy_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.decision_policy_json, '$.jobId')), json_extract(source.decision_policy_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.decision_policy_json, '$.siteId')), json_extract(source.decision_policy_json, '$.siteId'))) ELSE source.decision_policy_json END ,
       source.completion_operation_key,
       CASE WHEN source.created_by_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.created_by_account_id), source.created_by_account_id) END ,
       source.created_at
FROM "_stage_system_procedure_definition_revisions" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_procedure_definition_revisions',
       (SELECT count(*) FROM "_stage_system_procedure_definition_revisions"),
       (SELECT count(*) FROM system_procedure_definition_revisions),
       0,
       0,
       0;
DROP TABLE "_stage_system_procedure_definition_revisions";
CREATE INDEX system_procedure_definition_revisions_creator_idx
  ON system_procedure_definition_revisions (created_by_account_id, created_at);
CREATE TRIGGER system_procedure_definition_revisions_valid_insert
BEFORE INSERT ON system_procedure_definition_revisions
WHEN NOT EXISTS (
  SELECT 1 FROM system_procedure_definitions
  WHERE key = NEW.procedure_key
    AND NEW.revision IN (current_revision, current_revision + 1)
)
BEGIN
  SELECT RAISE(ABORT, 'invalid system procedure revision');
END;
CREATE TRIGGER system_procedure_definition_revisions_prevent_update
BEFORE UPDATE ON system_procedure_definition_revisions
BEGIN
  SELECT RAISE(ABORT, 'system procedure revision is immutable');
END;
CREATE TRIGGER system_procedure_definition_revisions_prevent_delete
BEFORE DELETE ON system_procedure_definition_revisions
BEGIN
  SELECT RAISE(ABORT, 'system procedure revision is immutable');
END;
CREATE TRIGGER system_procedure_definition_revisions_identity_update
BEFORE UPDATE OF id ON system_procedure_definition_revisions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- system_proposals
INSERT INTO system_proposals (id, series_id, version, procedure_key, procedure_revision, body_json, digest, created_by_account_id, supersedes_proposal_id, created_at)
SELECT source.id,
       source.series_id,
       source.version,
       source.procedure_key,
       source.procedure_revision,
       CASE WHEN json_valid(source.body_json) AND json_type(source.body_json) = 'object' THEN json_replace(source.body_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.body_json, '$.accountId')), json_extract(source.body_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.body_json, '$.actorAccountId')), json_extract(source.body_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.body_json, '$.release.actorAccountId')), json_extract(source.body_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.body_json, '$.employeeId')), json_extract(source.body_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.body_json, '$.managerEmployeeId')), json_extract(source.body_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.body_json, '$.targetEmployeeId')), json_extract(source.body_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.body_json, '$.requestedByEmployeeId')), json_extract(source.body_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.body_json, '$.requestedApproverId')), json_extract(source.body_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.body_json, '$.applicantId')), json_extract(source.body_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.body_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.body_json, '$.holderId')), json_extract(source.body_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.body_json, '$.personId')), json_extract(source.body_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.body_json, '$.employmentId')), json_extract(source.body_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.body_json, '$.periodId')), json_extract(source.body_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.body_json, '$.resourceId')), json_extract(source.body_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.body_json, '$.existingResourceId')), json_extract(source.body_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.body_json, '$.scopeId')), json_extract(source.body_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.body_json, '$.authorityScopeId')), json_extract(source.body_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.body_json, '$.responsibilityId')), json_extract(source.body_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.body_json, '$.collectiveBodyId')), json_extract(source.body_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.body_json, '$.organizationalOfficeId')), json_extract(source.body_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.body_json, '$.positionId')), json_extract(source.body_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.body_json, '$.jobId')), json_extract(source.body_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.body_json, '$.siteId')), json_extract(source.body_json, '$.siteId'))) ELSE source.body_json END ,
       source.digest,
       CASE WHEN source.created_by_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.created_by_account_id), source.created_by_account_id) END ,
       source.supersedes_proposal_id,
       source.created_at
FROM "_stage_system_proposals" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_proposals',
       (SELECT count(*) FROM "_stage_system_proposals"),
       (SELECT count(*) FROM system_proposals),
       0,
       0,
       0;
DROP TABLE "_stage_system_proposals";
CREATE UNIQUE INDEX system_proposals_series_version_uniq
  ON system_proposals (series_id, version);
CREATE INDEX system_proposals_definition_idx
  ON system_proposals (procedure_key, procedure_revision);
CREATE INDEX system_proposals_creator_idx
  ON system_proposals (created_by_account_id, created_at);
CREATE TRIGGER system_proposals_valid_insert
BEFORE INSERT ON system_proposals
WHEN
  NOT EXISTS (
    SELECT 1 FROM system_procedure_definitions
    WHERE key = NEW.procedure_key
      AND status = 'active'
      AND current_revision = NEW.procedure_revision
  )
  OR NOT EXISTS (
    SELECT 1 FROM system_proposal_series AS series
    WHERE series.id = NEW.series_id
      AND series.procedure_key = NEW.procedure_key
      AND series.created_by_account_id = NEW.created_by_account_id
      AND series.created_at <= NEW.created_at
  )
  OR (
    NEW.version > 1
    AND NOT EXISTS (
      SELECT 1 FROM system_proposals AS previous
      WHERE previous.id = NEW.supersedes_proposal_id
        AND previous.series_id = NEW.series_id
        AND previous.version = NEW.version - 1
        AND previous.procedure_key = NEW.procedure_key
        AND previous.created_by_account_id = NEW.created_by_account_id
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid system proposal');
END;
CREATE TRIGGER system_proposals_prevent_update
BEFORE UPDATE ON system_proposals
BEGIN
  SELECT RAISE(ABORT, 'system proposal is immutable');
END;
CREATE TRIGGER system_proposals_prevent_delete
BEFORE DELETE ON system_proposals
BEGIN
  SELECT RAISE(ABORT, 'system proposal is immutable');
END;

-- system_proposal_cases
INSERT INTO system_proposal_cases (proposal_id, case_id, linked_at)
SELECT source.proposal_id,
       source.case_id,
       source.linked_at
FROM "_stage_system_proposal_cases" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_proposal_cases',
       (SELECT count(*) FROM "_stage_system_proposal_cases"),
       (SELECT count(*) FROM system_proposal_cases),
       0,
       0,
       0;
DROP TABLE "_stage_system_proposal_cases";
CREATE UNIQUE INDEX system_proposal_cases_case_uniq
  ON system_proposal_cases (case_id);
CREATE TRIGGER system_proposal_cases_prevent_update
BEFORE UPDATE ON system_proposal_cases
BEGIN
  SELECT RAISE(ABORT, 'system proposal case is immutable');
END;
CREATE TRIGGER system_proposal_cases_prevent_delete
BEFORE DELETE ON system_proposal_cases
BEGIN
  SELECT RAISE(ABORT, 'system proposal case is immutable');
END;
CREATE TRIGGER system_proposal_cases_valid_insert
BEFORE INSERT ON system_proposal_cases
WHEN NOT EXISTS (
  SELECT 1
  FROM system_proposals AS proposal
  JOIN system_cases AS workflow_case ON workflow_case.id = NEW.case_id
  WHERE proposal.id = NEW.proposal_id
    AND (
      workflow_case.subject_context <> 'system'
      OR (
        workflow_case.subject_kind = 'proposal'
        AND workflow_case.subject_id = proposal.series_id
        AND workflow_case.subject_version = CAST(proposal.version AS TEXT)
      )
      OR (
        workflow_case.subject_context = 'system'
        AND workflow_case.subject_kind = 'record-preservation'
        AND workflow_case.subject_version = '1'
        AND json_extract(proposal.body_json, '$.operation') IS 'system.record.preserve'
        AND json_extract(proposal.body_json, '$.version') IS 1
        AND json_extract(proposal.body_json, '$.recordId') IS workflow_case.subject_id
      )
    )
    AND workflow_case.proposal_digest = proposal.digest
    AND workflow_case.created_by_account_id = proposal.created_by_account_id
    AND workflow_case.created_at = NEW.linked_at
)
BEGIN
  SELECT RAISE(ABORT, 'system proposal case does not match');
END;

-- system_record_coverage_pages
INSERT INTO system_record_coverage_pages (id, freeze_id, record_kind, sequence, digest, previous_digest, after_cursor, next_cursor, audit_event_id, snapshot_json)
SELECT source.id,
       source.freeze_id,
       source.record_kind,
       source.sequence,
       source.digest,
       source.previous_digest,
       source.after_cursor,
       source.next_cursor,
       source.audit_event_id,
       source.snapshot_json
FROM "_stage_system_record_coverage_pages" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_record_coverage_pages',
       (SELECT count(*) FROM "_stage_system_record_coverage_pages"),
       (SELECT count(*) FROM system_record_coverage_pages),
       0,
       0,
       0;
DROP TABLE "_stage_system_record_coverage_pages";
CREATE UNIQUE INDEX system_record_coverage_pages_cursor_idx
  ON system_record_coverage_pages(freeze_id,record_kind,after_cursor) WHERE after_cursor IS NOT NULL;
CREATE TRIGGER system_record_coverage_pages_insert BEFORE INSERT ON system_record_coverage_pages
BEGIN
  SELECT RAISE(ABORT,'record_coverage_page_conflict') WHERE EXISTS (
    SELECT 1 FROM system_record_coverage_pages WHERE id=NEW.id
      OR (freeze_id=NEW.freeze_id AND record_kind=NEW.record_kind AND sequence>=NEW.sequence)
  );
  SELECT RAISE(ABORT,'record_coverage_freeze_unavailable') WHERE NOT EXISTS (
    SELECT 1 FROM system_record_source_freezes WHERE id=NEW.freeze_id AND revision=1
      AND source_namespace IS json_extract(NEW.snapshot_json,'$.sourceNamespace')
      AND owner_context IS json_extract(NEW.snapshot_json,'$.ownerContext')
  );
  SELECT RAISE(ABORT,'record_coverage_page_gap') WHERE
    (NEW.sequence=1 AND (NEW.previous_digest IS NOT NULL OR NEW.after_cursor IS NOT NULL))
    OR (NEW.sequence>1 AND NOT EXISTS (
      SELECT 1 FROM system_record_coverage_pages p WHERE p.freeze_id=NEW.freeze_id
        AND p.record_kind=NEW.record_kind AND p.sequence=NEW.sequence-1
        AND p.digest IS NEW.previous_digest AND p.next_cursor IS NOT NULL AND p.next_cursor IS NEW.after_cursor
        AND julianday(json_extract(NEW.snapshot_json,'$.checkedAt')) >= julianday(json_extract(p.snapshot_json,'$.checkedAt'))
    ));
  SELECT RAISE(ABORT,'record_coverage_audit_missing') WHERE NOT EXISTS (
    SELECT 1 FROM system_audit_events a WHERE a.event_id=NEW.audit_event_id
      AND a.action='system.record.coverage.page.verified' AND a.target_type='system:record-coverage-page'
      AND a.target_id=NEW.id AND a.outcome='succeeded'
      AND a.actor_account_id IS json_extract(NEW.snapshot_json,'$.actorAccountId')
      AND a.after_json IS NEW.snapshot_json
      AND a.before_json IS (SELECT p.snapshot_json FROM system_record_coverage_pages p WHERE p.freeze_id=NEW.freeze_id AND p.record_kind=NEW.record_kind AND p.sequence=NEW.sequence-1)
      AND strftime('%Y-%m-%dT%H:%M:%fZ',a.occurred_at/1000.0,'unixepoch') IS json_extract(NEW.snapshot_json,'$.checkedAt')
  );
END;
CREATE TRIGGER system_record_coverage_pages_index AFTER INSERT ON system_record_coverage_pages
BEGIN
  INSERT INTO system_record_coverage_entries(page_id,freeze_id,record_kind,source_record_id,preserved_record_id)
    SELECT NEW.id,NEW.freeze_id,NEW.record_kind,json_extract(item.value,'$.source.recordId'),json_extract(item.value,'$.preservedRecordId')
    FROM json_each(NEW.snapshot_json,'$.records') item;
END;
CREATE TRIGGER system_record_coverage_pages_update BEFORE UPDATE ON system_record_coverage_pages
BEGIN
  SELECT RAISE(ABORT,'record_coverage_immutable');
END;
CREATE TRIGGER system_record_coverage_pages_delete BEFORE DELETE ON system_record_coverage_pages
BEGIN
  SELECT RAISE(ABORT,'record_coverage_immutable');
END;

-- system_record_coverage_entries
INSERT INTO system_record_coverage_entries (id, page_id, freeze_id, record_kind, source_record_id, preserved_record_id)
SELECT source.id,
       source.page_id,
       source.freeze_id,
       source.record_kind,
       source.source_record_id,
       source.preserved_record_id
FROM "_stage_system_record_coverage_entries" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_record_coverage_entries',
       (SELECT count(*) FROM "_stage_system_record_coverage_entries"),
       (SELECT count(*) FROM system_record_coverage_entries),
       0,
       0,
       0;
DROP TABLE "_stage_system_record_coverage_entries";
CREATE TRIGGER system_record_coverage_entries_update BEFORE UPDATE ON system_record_coverage_entries
BEGIN
  SELECT RAISE(ABORT,'record_coverage_immutable');
END;
CREATE TRIGGER system_record_coverage_entries_delete BEFORE DELETE ON system_record_coverage_entries
BEGIN
  SELECT RAISE(ABORT,'record_coverage_immutable');
END;
CREATE TRIGGER system_record_coverage_entries_insert BEFORE INSERT ON system_record_coverage_entries
BEGIN
  SELECT RAISE(ABORT,'record_coverage_entry_duplicate') WHERE EXISTS (
    SELECT 1 FROM system_record_coverage_entries WHERE freeze_id=NEW.freeze_id
      AND ((record_kind=NEW.record_kind AND source_record_id=NEW.source_record_id) OR preserved_record_id=NEW.preserved_record_id)
  );
  SELECT RAISE(ABORT,'record_coverage_source_mismatch') WHERE NOT EXISTS (
    SELECT 1 FROM system_record_coverage_pages p, json_each(p.snapshot_json,'$.records') item
    JOIN system_preserved_records r ON r.id=NEW.preserved_record_id
    WHERE p.id=NEW.page_id AND p.freeze_id=NEW.freeze_id AND p.record_kind=NEW.record_kind
      AND json_extract(item.value,'$.preservedRecordId') IS NEW.preserved_record_id
      AND json_extract(item.value,'$.source.recordId') IS NEW.source_record_id
      AND json_extract(item.value,'$.source.sourceNamespace') IS json_extract(p.snapshot_json,'$.sourceNamespace')
      AND json_extract(item.value,'$.source.ownerContext') IS json_extract(p.snapshot_json,'$.ownerContext')
      AND json_extract(item.value,'$.source.recordKind') IS NEW.record_kind
      AND json_extract(item.value,'$.source') IS json_extract(r.snapshot_json,'$.source')
  );
END;
CREATE TRIGGER system_record_coverage_entries_identity_update
BEFORE UPDATE OF id ON system_record_coverage_entries
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- system_record_retirement_plans
INSERT INTO system_record_retirement_plans (id, freeze_id, digest, audit_event_id, snapshot_json)
SELECT source.id,
       source.freeze_id,
       source.digest,
       source.audit_event_id,
       source.snapshot_json
FROM "_stage_system_record_retirement_plans" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_record_retirement_plans',
       (SELECT count(*) FROM "_stage_system_record_retirement_plans"),
       (SELECT count(*) FROM system_record_retirement_plans),
       0,
       0,
       0;
DROP TABLE "_stage_system_record_retirement_plans";
CREATE TRIGGER system_record_retirement_plans_insert BEFORE INSERT ON system_record_retirement_plans
BEGIN
  SELECT RAISE(ABORT,'record_retirement_plan_conflict') WHERE EXISTS (
    SELECT 1 FROM system_record_retirement_plans WHERE id=NEW.id
  );
  SELECT RAISE(ABORT,'record_retirement_plan_freeze_unavailable') WHERE NOT EXISTS (
    SELECT 1 FROM system_record_source_freezes WHERE id=NEW.freeze_id AND revision=1
      AND source_namespace IS json_extract(NEW.snapshot_json,'$.sourceNamespace')
      AND owner_context IS json_extract(NEW.snapshot_json,'$.ownerContext')
      AND julianday(json_extract(snapshot_json,'$.createdAt')) <= julianday(json_extract(NEW.snapshot_json,'$.createdAt'))
  );
  SELECT RAISE(ABORT,'record_retirement_plan_coverage_invalid') WHERE EXISTS (
    SELECT 1 FROM json_each(NEW.snapshot_json,'$.coverage') c
    WHERE json_extract(c.value,'$.recordKind') IS NOT json_extract(NEW.snapshot_json,'$.capability.recordKinds[' || c.key || ']')
      OR NOT EXISTS (
        SELECT 1 FROM system_record_coverage_pages p
        WHERE p.id IS json_extract(c.value,'$.terminalPageId') AND p.freeze_id=NEW.freeze_id
          AND p.record_kind IS json_extract(c.value,'$.recordKind') AND p.next_cursor IS NULL
          AND p.digest IS json_extract(c.value,'$.terminalDigest')
          AND p.sequence IS json_extract(c.value,'$.pageCount')
          AND json_extract(p.snapshot_json,'$.purpose') IS json_extract(NEW.snapshot_json,'$.purpose')
          AND julianday(json_extract(p.snapshot_json,'$.checkedAt')) <= julianday(json_extract(NEW.snapshot_json,'$.createdAt'))
          AND (SELECT count(*) FROM system_record_coverage_entries e WHERE e.freeze_id=NEW.freeze_id AND e.record_kind=p.record_kind)
            IS json_extract(c.value,'$.recordCount')
      )
  );
  SELECT RAISE(ABORT,'record_retirement_plan_coverage_invalid') WHERE
    (SELECT count(DISTINCT json_extract(value,'$.recordKind')) FROM json_each(NEW.snapshot_json,'$.coverage'))
      <> json_array_length(NEW.snapshot_json,'$.coverage');
  SELECT RAISE(ABORT,'record_retirement_plan_audit_missing') WHERE NOT EXISTS (
    SELECT 1 FROM system_audit_events a WHERE a.event_id=NEW.audit_event_id
      AND a.action='system.record.retirement.plan.created' AND a.target_type='system:record-retirement-plan'
      AND a.target_id=NEW.id AND a.outcome='succeeded' AND a.before_json IS NULL
      AND a.actor_account_id IS json_extract(NEW.snapshot_json,'$.actorAccountId')
      AND a.after_json IS NEW.snapshot_json
      AND strftime('%Y-%m-%dT%H:%M:%fZ',a.occurred_at/1000.0,'unixepoch') IS json_extract(NEW.snapshot_json,'$.createdAt')
  );
END;
CREATE TRIGGER system_record_retirement_plans_update BEFORE UPDATE ON system_record_retirement_plans
BEGIN
  SELECT RAISE(ABORT,'record_retirement_plan_immutable');
END;
CREATE TRIGGER system_record_retirement_plans_delete BEFORE DELETE ON system_record_retirement_plans
BEGIN
  SELECT RAISE(ABORT,'record_retirement_plan_immutable');
END;

-- system_record_retirement_receipts
INSERT INTO system_record_retirement_receipts (id, plan_id, ordinal, digest, coverage_page_id, audit_event_id, snapshot_json)
SELECT source.id,
       source.plan_id,
       source.ordinal,
       source.digest,
       source.coverage_page_id,
       source.audit_event_id,
       source.snapshot_json
FROM "_stage_system_record_retirement_receipts" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_record_retirement_receipts',
       (SELECT count(*) FROM "_stage_system_record_retirement_receipts"),
       (SELECT count(*) FROM system_record_retirement_receipts),
       0,
       0,
       0;
DROP TABLE "_stage_system_record_retirement_receipts";
CREATE TRIGGER system_record_retirement_receipts_insert BEFORE INSERT ON system_record_retirement_receipts
BEGIN
  SELECT RAISE(ABORT,'record_retirement_receipt_conflict') WHERE EXISTS (
    SELECT 1 FROM system_record_retirement_receipts WHERE id=NEW.id
      OR (plan_id=NEW.plan_id AND (ordinal>=NEW.ordinal OR coverage_page_id=NEW.coverage_page_id))
  );
  SELECT RAISE(ABORT,'record_retirement_receipt_plan_invalid') WHERE NOT EXISTS (
    SELECT 1 FROM system_record_retirement_plans plan
    JOIN system_record_source_freezes freeze ON freeze.id=plan.freeze_id AND freeze.revision=1
    JOIN json_each(plan.snapshot_json,'$.coverage') c
    JOIN system_record_coverage_pages page ON page.id=NEW.coverage_page_id
      AND page.freeze_id=plan.freeze_id AND page.record_kind IS json_extract(c.value,'$.recordKind')
    WHERE plan.id=NEW.plan_id AND plan.digest IS json_extract(NEW.snapshot_json,'$.planDigest')
      AND page.digest IS json_extract(NEW.snapshot_json,'$.coveragePageDigest')
      AND page.sequence <= json_extract(c.value,'$.pageCount')
      AND NEW.ordinal IS page.sequence + (SELECT coalesce(sum(json_extract(prior.value,'$.pageCount')),0)
        FROM json_each(plan.snapshot_json,'$.coverage') prior WHERE prior.key<c.key)
      AND julianday(json_extract(NEW.snapshot_json,'$.checkedAt')) >= julianday(json_extract(plan.snapshot_json,'$.createdAt'))
      AND julianday(json_extract(NEW.snapshot_json,'$.checkedAt')) >= julianday(json_extract(page.snapshot_json,'$.checkedAt'))
  );
  SELECT RAISE(ABORT,'record_retirement_receipt_order_invalid') WHERE
    (NEW.ordinal=1 AND json_type(NEW.snapshot_json,'$.previousReceiptDigest') IS NOT 'null')
    OR (NEW.ordinal>1 AND NOT EXISTS (
      SELECT 1 FROM system_record_retirement_receipts previous
      WHERE previous.plan_id=NEW.plan_id AND previous.ordinal=NEW.ordinal-1
        AND previous.digest IS json_extract(NEW.snapshot_json,'$.previousReceiptDigest')
        AND julianday(json_extract(NEW.snapshot_json,'$.checkedAt')) >= julianday(json_extract(previous.snapshot_json,'$.checkedAt'))
    ));
  SELECT RAISE(ABORT,'record_retirement_receipt_audit_missing') WHERE NOT EXISTS (
    SELECT 1 FROM system_audit_events a WHERE a.event_id=NEW.audit_event_id
      AND a.action='system.record.retirement.page.verified' AND a.target_type='system:record-retirement-receipt'
      AND a.target_id=NEW.id AND a.outcome='succeeded' AND a.before_json IS NULL
      AND a.actor_account_id IS json_extract(NEW.snapshot_json,'$.actorAccountId')
      AND a.after_json IS NEW.snapshot_json
      AND strftime('%Y-%m-%dT%H:%M:%fZ',a.occurred_at/1000.0,'unixepoch') IS json_extract(NEW.snapshot_json,'$.checkedAt')
  );
END;
CREATE TRIGGER system_record_retirement_receipts_update BEFORE UPDATE ON system_record_retirement_receipts
BEGIN
  SELECT RAISE(ABORT,'record_retirement_receipt_immutable');
END;
CREATE TRIGGER system_record_retirement_receipts_delete BEFORE DELETE ON system_record_retirement_receipts
BEGIN
  SELECT RAISE(ABORT,'record_retirement_receipt_immutable');
END;
CREATE TRIGGER system_record_retirement_receipts_pin_attachments AFTER INSERT ON system_record_retirement_receipts
BEGIN
  SELECT RAISE(ABORT,'record_retirement_attachment_format_unsupported') WHERE EXISTS (
    SELECT 1 FROM system_record_coverage_pages page, json_each(page.snapshot_json,'$.records') item
    WHERE page.id=NEW.coverage_page_id
      AND json_extract(item.value,'$.source.formatId')='system-attachment-record'
      AND json_extract(item.value,'$.source.formatVersion') IS NOT 1
  );
  INSERT INTO system_record_retirement_attachment_pins(receipt_id,attachment_id)
    SELECT NEW.id,json_extract(item.value,'$.source.recordId')
    FROM system_record_coverage_pages page, json_each(page.snapshot_json,'$.records') item
    WHERE page.id=NEW.coverage_page_id AND json_extract(item.value,'$.source.formatId')='system-attachment-record';
END;
CREATE TRIGGER system_record_retirement_receipts_storage_keys BEFORE INSERT ON system_record_retirement_receipts
BEGIN
  SELECT RAISE(ABORT,'record_retirement_storage_keys_invalid') WHERE
    json_type(NEW.snapshot_json,'$.storageKeys') IS NOT 'array'
    OR json_array_length(NEW.snapshot_json,'$.storageKeys')>200
    OR (SELECT count(DISTINCT json_extract(value,'$.version')) FROM json_each(NEW.snapshot_json,'$.storageKeys'))
      <>json_array_length(NEW.snapshot_json,'$.storageKeys')
    OR EXISTS (SELECT 1 FROM json_each(NEW.snapshot_json,'$.storageKeys') key
      WHERE json_type(key.value,'$.version') IS NOT 'integer' OR json_extract(key.value,'$.version')<=0
        OR length(json_extract(key.value,'$.digest')) IS NOT 64
        OR json_extract(key.value,'$.digest') GLOB '*[^0-9a-f]*');
  SELECT RAISE(ABORT,'record_retirement_storage_keys_incomplete') WHERE
    EXISTS (SELECT 1 FROM (SELECT attachment.kek_version AS version FROM system_record_coverage_pages page
      JOIN json_each(page.snapshot_json,'$.records') item
      JOIN system_preserved_records record ON record.id=json_extract(item.value,'$.preservedRecordId')
      JOIN system_attachments attachment ON attachment.id=record.attachment_id WHERE page.id=NEW.coverage_page_id
      UNION SELECT attachment.kek_version AS version FROM system_record_coverage_pages page
      JOIN json_each(page.snapshot_json,'$.records') item
      JOIN system_attachments attachment ON attachment.id=json_extract(item.value,'$.source.recordId')
      WHERE page.id=NEW.coverage_page_id AND json_extract(item.value,'$.source.formatId')='system-attachment-record' ) expected WHERE NOT EXISTS (
      SELECT 1 FROM json_each(NEW.snapshot_json,'$.storageKeys') key WHERE json_extract(key.value,'$.version') IS expected.version
    )) OR EXISTS (SELECT 1 FROM json_each(NEW.snapshot_json,'$.storageKeys') key WHERE NOT EXISTS (
      SELECT 1 FROM (SELECT attachment.kek_version AS version FROM system_record_coverage_pages page
      JOIN json_each(page.snapshot_json,'$.records') item
      JOIN system_preserved_records record ON record.id=json_extract(item.value,'$.preservedRecordId')
      JOIN system_attachments attachment ON attachment.id=record.attachment_id WHERE page.id=NEW.coverage_page_id
      UNION SELECT attachment.kek_version AS version FROM system_record_coverage_pages page
      JOIN json_each(page.snapshot_json,'$.records') item
      JOIN system_attachments attachment ON attachment.id=json_extract(item.value,'$.source.recordId')
      WHERE page.id=NEW.coverage_page_id AND json_extract(item.value,'$.source.formatId')='system-attachment-record' ) expected WHERE expected.version IS json_extract(key.value,'$.version')
    ));
END;

-- system_record_retirement_attachment_pins
INSERT INTO system_record_retirement_attachment_pins (id, receipt_id, attachment_id)
SELECT source.id,
       source.receipt_id,
       source.attachment_id
FROM "_stage_system_record_retirement_attachment_pins" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_record_retirement_attachment_pins',
       (SELECT count(*) FROM "_stage_system_record_retirement_attachment_pins"),
       (SELECT count(*) FROM system_record_retirement_attachment_pins),
       0,
       0,
       0;
DROP TABLE "_stage_system_record_retirement_attachment_pins";
CREATE INDEX system_record_retirement_attachment_pins_attachment_idx
  ON system_record_retirement_attachment_pins(attachment_id,receipt_id);
CREATE TRIGGER system_record_retirement_attachment_pins_insert BEFORE INSERT ON system_record_retirement_attachment_pins
BEGIN
  SELECT RAISE(ABORT,'record_retirement_attachment_pin_duplicate') WHERE EXISTS (
    SELECT 1 FROM system_record_retirement_attachment_pins WHERE receipt_id=NEW.receipt_id AND attachment_id=NEW.attachment_id
  );
  SELECT RAISE(ABORT,'record_retirement_attachment_pin_invalid') WHERE NOT EXISTS (
    SELECT 1 FROM system_record_retirement_receipts receipt
    JOIN system_record_retirement_plans plan ON plan.id=receipt.plan_id
    JOIN system_record_source_freezes freeze ON freeze.id=plan.freeze_id AND freeze.revision=1
    JOIN system_record_coverage_pages page ON page.id=receipt.coverage_page_id
    JOIN json_each(page.snapshot_json,'$.records') item
    JOIN system_attachments attachment ON attachment.id=NEW.attachment_id
    WHERE receipt.id=NEW.receipt_id
      AND json_extract(item.value,'$.source.recordId') IS NEW.attachment_id
      AND json_extract(item.value,'$.source.formatId')='system-attachment-record'
      AND json_extract(item.value,'$.source.formatVersion') IS 1
      AND attachment.status='linked' AND attachment.erased_at IS NULL
      AND attachment.wrapped_dek IS NOT NULL AND attachment.wrapped_dek_iv IS NOT NULL
      AND attachment.linked_at IS NOT NULL AND attachment.created_at<=attachment.linked_at
      AND attachment.linked_at<=round((julianday(json_extract(receipt.snapshot_json,'$.checkedAt'))-2440587.5)*86400000)
  );
END;
CREATE TRIGGER system_record_retirement_attachment_pins_update BEFORE UPDATE ON system_record_retirement_attachment_pins
BEGIN
  SELECT RAISE(ABORT,'record_retirement_attachment_pin_immutable');
END;
CREATE TRIGGER system_record_retirement_attachment_pins_delete BEFORE DELETE ON system_record_retirement_attachment_pins
BEGIN
  SELECT RAISE(ABORT,'record_retirement_attachment_pin_immutable');
END;
CREATE TRIGGER system_record_retirement_attachment_pins_identity_update
BEFORE UPDATE OF id ON system_record_retirement_attachment_pins
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- system_record_source_retirements
INSERT INTO system_record_source_retirements (id, freeze_id, plan_id, terminal_receipt_id, proposal_id, case_id, execution_authorization_id, audit_event_id, snapshot_json)
SELECT source.id,
       source.freeze_id,
       source.plan_id,
       source.terminal_receipt_id,
       source.proposal_id,
       source.case_id,
       source.execution_authorization_id,
       source.audit_event_id,
       source.snapshot_json
FROM "_stage_system_record_source_retirements" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_record_source_retirements',
       (SELECT count(*) FROM "_stage_system_record_source_retirements"),
       (SELECT count(*) FROM system_record_source_retirements),
       0,
       0,
       0;
DROP TABLE "_stage_system_record_source_retirements";
CREATE TRIGGER system_record_source_retirements_insert BEFORE INSERT ON system_record_source_retirements
BEGIN
  SELECT RAISE(ABORT,'record_source_retirement_execution_invalid') WHERE NOT EXISTS (
    SELECT 1 FROM system_execution_authorizations authorization
    JOIN system_cases workflow_case ON workflow_case.id=authorization.case_id
    JOIN system_proposal_cases link ON link.case_id=workflow_case.id
    JOIN system_proposals proposal ON proposal.id=link.proposal_id
    JOIN system_record_retirement_plans plan ON plan.id=NEW.plan_id
    JOIN system_record_source_freezes freeze ON freeze.id=NEW.freeze_id AND freeze.revision=1
    JOIN system_record_retirement_receipts receipt ON receipt.id=NEW.terminal_receipt_id
    WHERE authorization.id=NEW.execution_authorization_id AND authorization.case_id=NEW.case_id
      AND authorization.operation_key='system.record.retire' AND authorization.used_at IS NOT NULL
      AND authorization.granted_at<=authorization.used_at AND authorization.expires_at>authorization.used_at
      AND workflow_case.status='executed' AND workflow_case.proposal_digest=authorization.proposal_digest
      AND workflow_case.updated_at=authorization.used_at
      AND proposal.id=NEW.proposal_id AND proposal.digest=authorization.proposal_digest
      AND proposal.version IS json_extract(NEW.snapshot_json,'$.proposalVersion')
      AND proposal.digest IS json_extract(NEW.snapshot_json,'$.proposalDigest')
      AND proposal.created_by_account_id=authorization.granted_to_account_id
      AND authorization.granted_to_account_id IS json_extract(NEW.snapshot_json,'$.actorAccountId')
      AND json_extract(proposal.body_json,'$.operation')='system.record.retire'
      AND json_extract(proposal.body_json,'$.actorAccountId')=authorization.granted_to_account_id
      AND json_extract(proposal.body_json,'$.plan.id')=plan.id AND plan.freeze_id=freeze.id
      AND json_extract(proposal.body_json,'$.plan.freezeId')=freeze.id
      AND json_extract(proposal.body_json,'$.plan.sourceNamespace')=freeze.source_namespace
      AND json_extract(proposal.body_json,'$.plan.ownerContext')=freeze.owner_context
      AND json_extract(proposal.body_json,'$.planDigest')=plan.digest
      AND plan.digest IS json_extract(NEW.snapshot_json,'$.planDigest')
      AND json_extract(proposal.body_json,'$.terminalReceipt.id')=receipt.id AND receipt.plan_id=plan.id
      AND json_extract(proposal.body_json,'$.terminalReceiptDigest')=receipt.digest
      AND receipt.digest IS json_extract(NEW.snapshot_json,'$.terminalReceiptDigest')
      AND receipt.ordinal=(SELECT sum(json_extract(value,'$.pageCount')) FROM json_each(plan.snapshot_json,'$.coverage'))
      AND julianday(json_extract(receipt.snapshot_json,'$.checkedAt'))<=julianday(json_extract(NEW.snapshot_json,'$.finalizedAt'))
      AND strftime('%Y-%m-%dT%H:%M:%fZ',authorization.used_at/1000.0,'unixepoch') IS json_extract(NEW.snapshot_json,'$.finalizedAt')
  );
  SELECT RAISE(ABORT,'record_source_retirement_audit_missing') WHERE NOT EXISTS (
    SELECT 1 FROM system_audit_events audit WHERE audit.event_id=NEW.audit_event_id
      AND audit.action='system.record.source.retired' AND audit.target_type='system:record-source-retirement'
      AND audit.target_id=NEW.id AND audit.outcome='succeeded' AND audit.before_json IS NULL
      AND audit.after_json IS NEW.snapshot_json
      AND audit.actor_account_id IS json_extract(NEW.snapshot_json,'$.actorAccountId')
      AND json_extract(audit.authorization_json,'$.executionAuthorizationId') IS NEW.execution_authorization_id
      AND strftime('%Y-%m-%dT%H:%M:%fZ',audit.occurred_at/1000.0,'unixepoch') IS json_extract(NEW.snapshot_json,'$.finalizedAt')
  );
END;
CREATE TRIGGER system_record_source_retirements_update BEFORE UPDATE ON system_record_source_retirements
BEGIN
  SELECT RAISE(ABORT,'record_source_retirement_immutable');
END;
CREATE TRIGGER system_record_source_retirements_delete BEFORE DELETE ON system_record_source_retirements
BEGIN
  SELECT RAISE(ABORT,'record_source_retirement_immutable');
END;

-- system_sessions
INSERT INTO system_sessions (id, account_id, family_id, token_hash, token_version, created_at, expires_at, rotated_at, revoked_at, authenticated_at)
SELECT map.new_id,
       CASE WHEN source.account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.account_id), source.account_id) END ,
       source.family_id,
       source.token_hash,
       source.token_version,
       source.created_at,
       source.expires_at,
       source.rotated_at,
       source.revoked_at,
       source.authenticated_at
FROM "_stage_system_sessions" source
INNER JOIN _system_sessions_id_map map ON map.old_id = source.id;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_sessions',
       (SELECT count(*) FROM "_stage_system_sessions"),
       (SELECT count(*) FROM system_sessions),
       0,
       (SELECT count(*) FROM system_sessions WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_sessions";
CREATE UNIQUE INDEX system_sessions_token_hash_uniq
  ON system_sessions (token_hash);
CREATE INDEX system_sessions_account_idx
  ON system_sessions (account_id, created_at);
CREATE INDEX system_sessions_active_family_idx
  ON system_sessions (family_id) WHERE revoked_at IS NULL;
CREATE TRIGGER system_sessions_closed_account_guard
BEFORE INSERT ON system_sessions
WHEN EXISTS (
  SELECT 1 FROM system_accounts
  WHERE id = NEW.account_id AND closed_at IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'closed account cannot receive a session');
END;
CREATE TRIGGER system_sessions_monotonic_lifecycle
BEFORE UPDATE ON system_sessions
WHEN
  NEW.id IS NOT OLD.id
  OR NEW.account_id IS NOT OLD.account_id
  OR NEW.family_id IS NOT OLD.family_id
  OR NEW.token_hash IS NOT OLD.token_hash
  OR NEW.token_version IS NOT OLD.token_version
  OR NEW.created_at IS NOT OLD.created_at
  OR NEW.expires_at IS NOT OLD.expires_at
  OR (OLD.authenticated_at IS NOT NULL AND NEW.authenticated_at IS NOT OLD.authenticated_at)
  OR (OLD.rotated_at IS NOT NULL AND NEW.rotated_at IS NOT OLD.rotated_at)
  OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NOT OLD.revoked_at)
BEGIN
  SELECT RAISE(ABORT, 'session lifecycle is not monotonic');
END;

-- system_step_up_grants
INSERT INTO system_step_up_grants (id, account_id, token_hash, method, issued_at, expires_at, last_used_at, revoked_at)
SELECT map.new_id,
       CASE WHEN source.account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.account_id), source.account_id) END ,
       source.token_hash,
       source.method,
       source.issued_at,
       source.expires_at,
       source.last_used_at,
       source.revoked_at
FROM "_stage_system_step_up_grants" source
INNER JOIN _system_step_up_grants_id_map map ON map.old_id = source.id;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_step_up_grants',
       (SELECT count(*) FROM "_stage_system_step_up_grants"),
       (SELECT count(*) FROM system_step_up_grants),
       0,
       (SELECT count(*) FROM system_step_up_grants WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_step_up_grants";
CREATE INDEX system_step_up_grants_account_idx
  ON system_step_up_grants (account_id, expires_at);
CREATE TRIGGER system_step_up_grants_monotonic_update
BEFORE UPDATE ON system_step_up_grants
WHEN NEW.account_id <> OLD.account_id
  OR NEW.token_hash <> OLD.token_hash
  OR NEW.method <> OLD.method
  OR NEW.issued_at <> OLD.issued_at
  OR NEW.expires_at <> OLD.expires_at
  OR (OLD.last_used_at IS NOT NULL AND (NEW.last_used_at IS NULL OR NEW.last_used_at < OLD.last_used_at))
  OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at <> OLD.revoked_at)
BEGIN
  SELECT RAISE(ABORT, 'system_step_up_grant_update_invalid');
END;
CREATE TRIGGER system_step_up_grants_no_delete
BEFORE DELETE ON system_step_up_grants
BEGIN
  SELECT RAISE(ABORT, 'system_step_up_grants_are_retained');
END;

-- system_work_items
INSERT INTO system_work_items (id, title, instructions, acceptance_criteria, created_by_account_id, created_by_principal_id, created_at, due_at, previous_revision_id)
SELECT source.id,
       source.title,
       source.instructions,
       source.acceptance_criteria,
       CASE WHEN source.created_by_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.created_by_account_id), source.created_by_account_id) END ,
       CASE WHEN source.created_by_principal_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.created_by_principal_id), source.created_by_principal_id) END ,
       source.created_at,
       source.due_at,
       source.previous_revision_id
FROM "_stage_system_work_items" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_work_items',
       (SELECT count(*) FROM "_stage_system_work_items"),
       (SELECT count(*) FROM system_work_items),
       0,
       0,
       0;
DROP TABLE "_stage_system_work_items";
CREATE TRIGGER system_work_items_update BEFORE UPDATE ON system_work_items
BEGIN
  SELECT RAISE(ABORT, 'work item records are immutable');
END;
CREATE TRIGGER system_work_items_delete BEFORE DELETE ON system_work_items
BEGIN
  SELECT RAISE(ABORT, 'work item records are immutable');
END;

-- system_work_item_revisions
INSERT INTO system_work_item_revisions (id, work_item_id, revision, command_id, action, state, actor_account_id, actor_principal_id, accountable_account_id, accountable_principal_id, assignee_account_id, assignee_principal_id, recorded_at, snapshot_json, audit_event_id)
SELECT source.id,
       source.work_item_id,
       source.revision,
       source.command_id,
       source.action,
       source.state,
       CASE WHEN source.actor_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.actor_account_id), source.actor_account_id) END ,
       CASE WHEN source.actor_principal_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.actor_principal_id), source.actor_principal_id) END ,
       CASE WHEN source.accountable_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.accountable_account_id), source.accountable_account_id) END ,
       CASE WHEN source.accountable_principal_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.accountable_principal_id), source.accountable_principal_id) END ,
       CASE WHEN source.assignee_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.assignee_account_id), source.assignee_account_id) END ,
       CASE WHEN source.assignee_principal_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = source.assignee_principal_id), source.assignee_principal_id) END ,
       source.recorded_at,
       CASE WHEN json_valid(source.snapshot_json) AND json_type(source.snapshot_json) = 'object' THEN json_replace(source.snapshot_json, '$.accountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.accountId')), json_extract(source.snapshot_json, '$.accountId')), '$.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.actorAccountId')), json_extract(source.snapshot_json, '$.actorAccountId')), '$.release.actorAccountId', COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.release.actorAccountId')), json_extract(source.snapshot_json, '$.release.actorAccountId')), '$.employeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.employeeId')), json_extract(source.snapshot_json, '$.employeeId')), '$.managerEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.managerEmployeeId')), json_extract(source.snapshot_json, '$.managerEmployeeId')), '$.targetEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.targetEmployeeId')), json_extract(source.snapshot_json, '$.targetEmployeeId')), '$.requestedByEmployeeId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.requestedByEmployeeId')), json_extract(source.snapshot_json, '$.requestedByEmployeeId')), '$.requestedApproverId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.requestedApproverId')), json_extract(source.snapshot_json, '$.requestedApproverId')), '$.applicantId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.applicantId')), json_extract(source.snapshot_json, '$.applicantId')), '$.holderId', COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.holderId')), (SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.holderId')), json_extract(source.snapshot_json, '$.holderId')), '$.personId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.personId')), json_extract(source.snapshot_json, '$.personId')), '$.employmentId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.employmentId')), json_extract(source.snapshot_json, '$.employmentId')), '$.periodId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.periodId')), json_extract(source.snapshot_json, '$.periodId')), '$.resourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.resourceId')), json_extract(source.snapshot_json, '$.resourceId')), '$.existingResourceId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.existingResourceId')), json_extract(source.snapshot_json, '$.existingResourceId')), '$.scopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.scopeId')), json_extract(source.snapshot_json, '$.scopeId')), '$.authorityScopeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.authorityScopeId')), json_extract(source.snapshot_json, '$.authorityScopeId')), '$.responsibilityId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.responsibilityId')), json_extract(source.snapshot_json, '$.responsibilityId')), '$.collectiveBodyId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.collectiveBodyId')), json_extract(source.snapshot_json, '$.collectiveBodyId')), '$.organizationalOfficeId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.organizationalOfficeId')), json_extract(source.snapshot_json, '$.organizationalOfficeId')), '$.positionId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.positionId')), json_extract(source.snapshot_json, '$.positionId')), '$.jobId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.jobId')), json_extract(source.snapshot_json, '$.jobId')), '$.siteId', COALESCE((SELECT m.new_id FROM _f_misc_id_map m WHERE m.old_id = json_extract(source.snapshot_json, '$.siteId')), json_extract(source.snapshot_json, '$.siteId'))) ELSE source.snapshot_json END ,
       source.audit_event_id
FROM "_stage_system_work_item_revisions" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_work_item_revisions',
       (SELECT count(*) FROM "_stage_system_work_item_revisions"),
       (SELECT count(*) FROM system_work_item_revisions),
       0,
       0,
       0;
DROP TABLE "_stage_system_work_item_revisions";
CREATE INDEX system_work_items_accountable_idx ON system_work_item_revisions(accountable_account_id, work_item_id, revision);
CREATE INDEX system_work_items_assignee_idx ON system_work_item_revisions(assignee_account_id, work_item_id, revision);
CREATE TRIGGER system_work_revision_insert BEFORE INSERT ON system_work_item_revisions
BEGIN
  SELECT RAISE(ABORT, 'work_item_shape_invalid')
  WHERE NOT COALESCE((
    (SELECT count(*) FROM json_each(NEW.snapshot_json)) = 23
    AND NOT EXISTS (SELECT 1 FROM json_each(NEW.snapshot_json) WHERE key NOT IN ('id','revision','commandId','requestDigest','action','title','instructions','acceptanceCriteria','dueAt','previousRevisionId','createdBy','createdAt','assignee','accountable','state','result','handover','actor','authentication','recovery','reason','recordedAt','auditEventId'))
    AND json_extract(NEW.snapshot_json, '$.id') IS NEW.work_item_id
    AND json_extract(NEW.snapshot_json, '$.revision') IS NEW.revision
    AND json_extract(NEW.snapshot_json, '$.commandId') IS NEW.command_id
    AND json_extract(NEW.snapshot_json, '$.action') IS NEW.action
    AND json_extract(NEW.snapshot_json, '$.state') IS NEW.state
    AND json_extract(NEW.snapshot_json, '$.actor.accountId') IS NEW.actor_account_id
    AND json_extract(NEW.snapshot_json, '$.actor.principalId') IS NEW.actor_principal_id
    AND json_extract(NEW.snapshot_json, '$.accountable.accountId') IS NEW.accountable_account_id
    AND json_extract(NEW.snapshot_json, '$.accountable.principalId') IS NEW.accountable_principal_id
    AND json_extract(NEW.snapshot_json, '$.assignee.accountId') IS NEW.assignee_account_id
    AND json_extract(NEW.snapshot_json, '$.assignee.principalId') IS NEW.assignee_principal_id
    AND json_extract(NEW.snapshot_json, '$.auditEventId') IS NEW.audit_event_id
    AND json_extract(NEW.snapshot_json, '$.recordedAt') IS strftime('%Y-%m-%dT%H:%M:%fZ', NEW.recorded_at / 1000.0, 'unixepoch')
    AND json_type(NEW.snapshot_json, '$.requestDigest') IS 'text' AND length(json_extract(NEW.snapshot_json, '$.requestDigest')) = 64 AND json_extract(NEW.snapshot_json, '$.requestDigest') NOT GLOB '*[^0-9a-f]*'
    AND json_type(NEW.snapshot_json, '$.recovery') IN ('true','false')
    AND json_type(NEW.snapshot_json, '$.reason') IS 'text' AND length(trim(json_extract(NEW.snapshot_json, '$.reason'))) BETWEEN 1 AND 1000
    AND json_type(NEW.snapshot_json, '$.authentication') IS 'object' AND (SELECT count(*) FROM json_each(NEW.snapshot_json, '$.authentication')) = 3
    AND json_type(NEW.snapshot_json, '$.authentication.tokenVersion') IS 'integer' AND json_extract(NEW.snapshot_json, '$.authentication.tokenVersion') BETWEEN 0 AND 9007199254740991
    AND (json_type(NEW.snapshot_json, '$.authentication.credentialId') IS 'null' OR (json_type(NEW.snapshot_json, '$.authentication.credentialId') IS 'text' AND length(json_extract(NEW.snapshot_json, '$.authentication.credentialId')) BETWEEN 1 AND 255))
    AND (json_type(NEW.snapshot_json, '$.authentication.stepUpGrantId') IS 'null' OR (json_type(NEW.snapshot_json, '$.authentication.stepUpGrantId') IS 'text' AND length(json_extract(NEW.snapshot_json, '$.authentication.stepUpGrantId')) BETWEEN 1 AND 255))
    AND json_type(NEW.snapshot_json, '$.createdBy') IS 'object' AND (SELECT count(*) FROM json_each(NEW.snapshot_json, '$.createdBy')) = 3
    AND json_type(NEW.snapshot_json, '$.createdBy.kind') IS 'text' AND json_extract(NEW.snapshot_json, '$.createdBy.kind') IN ('human')
    AND json_type(NEW.snapshot_json, '$.createdBy.accountId') IS 'text' AND length(trim(json_extract(NEW.snapshot_json, '$.createdBy.accountId'))) BETWEEN 1 AND 255
    AND json_type(NEW.snapshot_json, '$.createdBy.principalId') IS 'text' AND length(trim(json_extract(NEW.snapshot_json, '$.createdBy.principalId'))) BETWEEN 1 AND 255
    AND json_type(NEW.snapshot_json, '$.actor') IS 'object' AND (SELECT count(*) FROM json_each(NEW.snapshot_json, '$.actor')) = 3
    AND json_type(NEW.snapshot_json, '$.actor.kind') IS 'text' AND json_extract(NEW.snapshot_json, '$.actor.kind') IN ('human','agent')
    AND json_type(NEW.snapshot_json, '$.actor.accountId') IS 'text' AND length(trim(json_extract(NEW.snapshot_json, '$.actor.accountId'))) BETWEEN 1 AND 255
    AND json_type(NEW.snapshot_json, '$.actor.principalId') IS 'text' AND length(trim(json_extract(NEW.snapshot_json, '$.actor.principalId'))) BETWEEN 1 AND 255
    AND json_type(NEW.snapshot_json, '$.assignee') IS 'object' AND (SELECT count(*) FROM json_each(NEW.snapshot_json, '$.assignee')) = 3
    AND json_type(NEW.snapshot_json, '$.assignee.kind') IS 'text' AND json_extract(NEW.snapshot_json, '$.assignee.kind') IN ('human','agent')
    AND json_type(NEW.snapshot_json, '$.assignee.accountId') IS 'text' AND length(trim(json_extract(NEW.snapshot_json, '$.assignee.accountId'))) BETWEEN 1 AND 255
    AND json_type(NEW.snapshot_json, '$.assignee.principalId') IS 'text' AND length(trim(json_extract(NEW.snapshot_json, '$.assignee.principalId'))) BETWEEN 1 AND 255
    AND json_type(NEW.snapshot_json, '$.accountable') IS 'object' AND (SELECT count(*) FROM json_each(NEW.snapshot_json, '$.accountable')) = 3
    AND json_type(NEW.snapshot_json, '$.accountable.kind') IS 'text' AND json_extract(NEW.snapshot_json, '$.accountable.kind') IN ('human')
    AND json_type(NEW.snapshot_json, '$.accountable.accountId') IS 'text' AND length(trim(json_extract(NEW.snapshot_json, '$.accountable.accountId'))) BETWEEN 1 AND 255
    AND json_type(NEW.snapshot_json, '$.accountable.principalId') IS 'text' AND length(trim(json_extract(NEW.snapshot_json, '$.accountable.principalId'))) BETWEEN 1 AND 255
    AND (json_type(NEW.snapshot_json, '$.result') IS 'null' OR (
    json_type(NEW.snapshot_json, '$.result') IS 'object'
    AND (SELECT count(*) FROM json_each(NEW.snapshot_json, '$.result')) = 6
    AND json_type(NEW.snapshot_json, '$.result.id') IS 'text'
    AND json_type(NEW.snapshot_json, '$.result.summary') IS 'text'
    AND length(trim(json_extract(NEW.snapshot_json, '$.result.summary'))) BETWEEN 1 AND 10000
    AND json_type(NEW.snapshot_json, '$.result.digest') IS 'text'
    AND length(json_extract(NEW.snapshot_json, '$.result.digest')) = 64
    AND json_extract(NEW.snapshot_json, '$.result.digest') NOT GLOB '*[^0-9a-f]*'
    AND json_type(NEW.snapshot_json, '$.result.evidence') IS 'array'
    AND json_array_length(NEW.snapshot_json, '$.result.evidence') <= 20
    AND (SELECT count(*) FROM json_each(NEW.snapshot_json, '$.result.evidence')) = (SELECT count(DISTINCT json_extract(value, '$.attachmentId')) FROM json_each(NEW.snapshot_json, '$.result.evidence'))
    AND NOT EXISTS (SELECT 1 FROM json_each(NEW.snapshot_json, '$.result.evidence') evidence
      WHERE evidence.type <> 'object' OR (SELECT count(*) FROM json_each(evidence.value)) <> 2
        OR json_type(evidence.value, '$.attachmentId') IS NOT 'text'
        OR length(trim(json_extract(evidence.value, '$.attachmentId'))) NOT BETWEEN 1 AND 64
        OR json_type(evidence.value, '$.sha256') IS NOT 'text'
        OR length(json_extract(evidence.value, '$.sha256')) <> 64
        OR json_extract(evidence.value, '$.sha256') GLOB '*[^0-9a-f]*')
    AND json_extract(NEW.snapshot_json, '$.result.submittedBy') IS json_extract(NEW.snapshot_json, '$.assignee')
    AND json_type(NEW.snapshot_json, '$.result.submittedAt') IS 'text'
    AND json_extract(NEW.snapshot_json, '$.result.submittedAt') >= json_extract(NEW.snapshot_json, '$.createdAt')
    AND json_extract(NEW.snapshot_json, '$.result.submittedAt') <= json_extract(NEW.snapshot_json, '$.recordedAt')
  ))
    AND (json_type(NEW.snapshot_json, '$.handover') IS 'null' OR (
    json_type(NEW.snapshot_json, '$.handover') IS 'object'
    AND (SELECT count(*) FROM json_each(NEW.snapshot_json, '$.handover')) = 5
    AND json_type(NEW.snapshot_json, '$.handover.id') IS 'text'
    AND json_type(NEW.snapshot_json, '$.handover.reason') IS 'text'
    AND length(trim(json_extract(NEW.snapshot_json, '$.handover.reason'))) BETWEEN 1 AND 1000
    AND json_type(NEW.snapshot_json, '$.handover.requestedAt') IS 'text'
    AND json_extract(NEW.snapshot_json, '$.handover.requestedAt') >= json_extract(NEW.snapshot_json, '$.createdAt')
    AND json_extract(NEW.snapshot_json, '$.handover.requestedAt') <= json_extract(NEW.snapshot_json, '$.recordedAt')
    AND json_type(NEW.snapshot_json, '$.handover.to') IS 'object'
    AND (SELECT count(*) FROM json_each(NEW.snapshot_json, '$.handover.to'))=3
    AND json_extract(NEW.snapshot_json, '$.handover.to.kind') IS 'human'
    AND json_extract(NEW.snapshot_json, '$.handover.requestedBy.kind') IS 'human'
    AND json_extract(NEW.snapshot_json, '$.handover.to') IS NOT json_extract(NEW.snapshot_json, '$.accountable')
  ))
  ), 0);
  SELECT RAISE(ABORT, 'work_item_revision_conflict')
  WHERE NOT COALESCE((
    NEW.revision = 1 + COALESCE((SELECT max(revision) FROM system_work_item_revisions WHERE work_item_id=NEW.work_item_id),0)
    AND NEW.recorded_at >= COALESCE((SELECT max(recorded_at) FROM system_work_item_revisions WHERE work_item_id=NEW.work_item_id),0)
  ), 0);
  SELECT RAISE(ABORT, 'work_item_definition_changed')
  WHERE NOT COALESCE((
    EXISTS (SELECT 1 FROM system_work_items item WHERE item.id=NEW.work_item_id AND json_extract(NEW.snapshot_json, '$.title') IS item.title AND json_extract(NEW.snapshot_json, '$.instructions') IS item.instructions AND json_extract(NEW.snapshot_json, '$.acceptanceCriteria') IS item.acceptance_criteria AND json_extract(NEW.snapshot_json, '$.createdBy.accountId') IS item.created_by_account_id AND json_extract(NEW.snapshot_json, '$.createdBy.principalId') IS item.created_by_principal_id AND json_extract(NEW.snapshot_json, '$.previousRevisionId') IS item.previous_revision_id AND json_extract(NEW.snapshot_json, '$.createdAt') IS strftime('%Y-%m-%dT%H:%M:%fZ', item.created_at / 1000.0, 'unixepoch') AND json_extract(NEW.snapshot_json, '$.dueAt') IS strftime('%Y-%m-%dT%H:%M:%fZ', item.due_at / 1000.0, 'unixepoch') AND item.created_at <= NEW.recorded_at)
  ), 0);
  SELECT RAISE(ABORT, 'work_item_actor_unavailable') WHERE NOT EXISTS (
    SELECT 1 FROM system_accounts account JOIN system_principals principal ON principal.account_id=account.id
    WHERE account.id=NEW.actor_account_id AND principal.id=NEW.actor_principal_id
      AND principal.kind=json_extract(NEW.snapshot_json,'$.actor.kind') AND principal.kind IN ('human','agent')
      AND account.status='active' AND account.closed_at IS NULL AND account.created_at<=NEW.recorded_at
      AND principal.created_at<=NEW.recorded_at AND account.token_version=json_extract(NEW.snapshot_json,'$.authentication.tokenVersion')
      AND ((principal.kind='human' AND json_type(NEW.snapshot_json,'$.authentication.credentialId') IS 'null')
        OR (principal.kind='agent' AND json_type(NEW.snapshot_json,'$.authentication.stepUpGrantId') IS 'null' AND EXISTS (
          SELECT 1 FROM system_machine_credentials credential
          WHERE credential.id=json_extract(NEW.snapshot_json,'$.authentication.credentialId') AND credential.principal_id=principal.id
            AND credential.status='active' AND credential.revoked_at IS NULL AND credential.created_at<=NEW.recorded_at
            AND (credential.expires_at IS NULL OR NEW.recorded_at<credential.expires_at))))
      AND (NEW.action IN ('create','accept','submit') OR (principal.kind='human' AND EXISTS (
        SELECT 1 FROM system_step_up_grants grant WHERE grant.id=json_extract(NEW.snapshot_json,'$.authentication.stepUpGrantId')
          AND grant.account_id=account.id AND grant.issued_at<=NEW.recorded_at AND NEW.recorded_at<grant.expires_at
          AND grant.revoked_at IS NULL AND grant.last_used_at<=NEW.recorded_at)))
  );
  SELECT RAISE(ABORT, 'work_item_permission_denied')
  WHERE NOT COALESCE((
    (EXISTS (SELECT 1 FROM (SELECT permission.permission_key FROM system_role_bindings binding
    JOIN system_iam_roles role ON role.id=binding.role_id
    JOIN system_iam_role_permissions permission ON permission.role_id=role.id
    WHERE binding.account_id=NEW.actor_account_id AND binding.resource_type IS NULL AND binding.resource_id IS NULL
      AND role.resource_type IS NULL AND role.created_at<=NEW.recorded_at AND binding.created_at<=NEW.recorded_at
      AND (binding.revoked_at IS NULL OR NEW.recorded_at<binding.revoked_at)) grants WHERE permission_key='system:admin') OR (EXISTS (SELECT 1 FROM (SELECT permission.permission_key FROM system_role_bindings binding
    JOIN system_iam_roles role ON role.id=binding.role_id
    JOIN system_iam_role_permissions permission ON permission.role_id=role.id
    WHERE binding.account_id=NEW.actor_account_id AND binding.resource_type IS NULL AND binding.resource_id IS NULL
      AND role.resource_type IS NULL AND role.created_at<=NEW.recorded_at AND binding.created_at<=NEW.recorded_at
      AND (binding.revoked_at IS NULL OR NEW.recorded_at<binding.revoked_at)) grants WHERE permission_key='system:work:read') AND EXISTS (SELECT 1 FROM (SELECT permission.permission_key FROM system_role_bindings binding
    JOIN system_iam_roles role ON role.id=binding.role_id
    JOIN system_iam_role_permissions permission ON permission.role_id=role.id
    WHERE binding.account_id=NEW.actor_account_id AND binding.resource_type IS NULL AND binding.resource_id IS NULL
      AND role.resource_type IS NULL AND role.created_at<=NEW.recorded_at AND binding.created_at<=NEW.recorded_at
      AND (binding.revoked_at IS NULL OR NEW.recorded_at<binding.revoked_at)) grants WHERE
      (NEW.action='create' AND permission_key='system:work:create')
      OR (NEW.action IN ('accept','submit') AND permission_key='system:work:perform')
      OR (NEW.action IN ('approve','return') AND permission_key='system:work:review')
      OR (NEW.action IN ('request_handover','accept_handover','decline_handover','cancel') AND permission_key='system:work:manage'))))
    AND (json_extract(NEW.snapshot_json, '$.recovery')=0 OR (NEW.action='request_handover' AND EXISTS (SELECT 1 FROM (SELECT permission.permission_key FROM system_role_bindings binding
    JOIN system_iam_roles role ON role.id=binding.role_id
    JOIN system_iam_role_permissions permission ON permission.role_id=role.id
    WHERE binding.account_id=NEW.actor_account_id AND binding.resource_type IS NULL AND binding.resource_id IS NULL
      AND role.resource_type IS NULL AND role.created_at<=NEW.recorded_at AND binding.created_at<=NEW.recorded_at
      AND (binding.revoked_at IS NULL OR NEW.recorded_at<binding.revoked_at)) grants WHERE permission_key='system:admin')))
  ), 0);
  SELECT RAISE(ABORT, 'work_item_transition_invalid')
  WHERE NOT COALESCE((
    (NEW.revision=1 AND NEW.action='create' AND NEW.state='offered' AND json_type(NEW.snapshot_json, '$.result') IS 'null' AND json_type(NEW.snapshot_json, '$.handover') IS 'null' AND json_extract(NEW.snapshot_json, '$.actor') IS json_extract(NEW.snapshot_json, '$.createdBy') AND json_extract(NEW.snapshot_json, '$.actor') IS json_extract(NEW.snapshot_json, '$.accountable') AND json_extract(NEW.snapshot_json, '$.createdAt') IS json_extract(NEW.snapshot_json, '$.recordedAt')) OR (NEW.revision>1 AND EXISTS (SELECT 1 FROM system_work_item_revisions previous WHERE previous.work_item_id=NEW.work_item_id AND previous.revision=NEW.revision-1 AND previous.state NOT IN ('completed','cancelled') AND json_extract(NEW.snapshot_json, '$.assignee') IS json_extract(previous.snapshot_json, '$.assignee') AND (json_type(previous.snapshot_json, '$.handover') IS 'null' OR NEW.action IN ('accept_handover','decline_handover','cancel') OR (NEW.action='request_handover' AND json_extract(NEW.snapshot_json, '$.recovery')=1)) AND (NEW.action='submit' OR json_extract(NEW.snapshot_json, '$.result') IS json_extract(previous.snapshot_json, '$.result')) AND (NEW.action='accept_handover' OR json_extract(NEW.snapshot_json, '$.accountable') IS json_extract(previous.snapshot_json, '$.accountable')) AND (NEW.action='request_handover' OR json_type(NEW.snapshot_json, '$.handover') IS 'null') AND (
      (NEW.action='accept' AND previous.state='offered' AND NEW.state='active' AND json_extract(NEW.snapshot_json, '$.actor') IS json_extract(previous.snapshot_json, '$.assignee'))
      OR (NEW.action='submit' AND previous.state='active' AND NEW.state='review_pending' AND json_extract(NEW.snapshot_json, '$.actor') IS json_extract(previous.snapshot_json, '$.assignee') AND json_type(NEW.snapshot_json, '$.result') IS 'object' AND json_extract(NEW.snapshot_json, '$.result.id') IS NEW.command_id AND json_extract(NEW.snapshot_json, '$.result.submittedAt') IS json_extract(NEW.snapshot_json, '$.recordedAt'))
      OR (NEW.action='approve' AND previous.state='review_pending' AND NEW.state='completed' AND json_extract(NEW.snapshot_json, '$.actor') IS json_extract(previous.snapshot_json, '$.accountable') AND json_type(NEW.snapshot_json, '$.result') IS 'object' AND NEW.actor_account_id<>NEW.assignee_account_id AND NEW.actor_principal_id<>NEW.assignee_principal_id)
      OR (NEW.action='return' AND previous.state='review_pending' AND NEW.state='active' AND json_extract(NEW.snapshot_json, '$.actor') IS json_extract(previous.snapshot_json, '$.accountable') AND json_type(NEW.snapshot_json, '$.result') IS 'object')
      OR (NEW.action='request_handover' AND NEW.state=previous.state AND (json_extract(NEW.snapshot_json, '$.actor') IS json_extract(previous.snapshot_json, '$.accountable') OR json_extract(NEW.snapshot_json, '$.recovery')=1) AND json_extract(NEW.snapshot_json, '$.recovery') IS (json_type(previous.snapshot_json, '$.handover') IS 'object' OR json_extract(NEW.snapshot_json, '$.actor') IS NOT json_extract(previous.snapshot_json, '$.accountable')) AND json_type(NEW.snapshot_json, '$.handover') IS 'object' AND json_extract(NEW.snapshot_json, '$.handover.id') IS NEW.command_id AND json_extract(NEW.snapshot_json, '$.handover.requestedAt') IS json_extract(NEW.snapshot_json, '$.recordedAt') AND json_extract(NEW.snapshot_json, '$.handover.requestedBy') IS json_extract(NEW.snapshot_json, '$.actor') AND json_extract(NEW.snapshot_json, '$.handover.reason') IS json_extract(NEW.snapshot_json, '$.reason'))
      OR (NEW.action='accept_handover' AND NEW.state=previous.state AND json_type(previous.snapshot_json, '$.handover') IS 'object' AND json_extract(NEW.snapshot_json, '$.actor') IS json_extract(previous.snapshot_json, '$.handover.to') AND json_extract(NEW.snapshot_json, '$.accountable') IS json_extract(previous.snapshot_json, '$.handover.to'))
      OR (NEW.action='decline_handover' AND NEW.state=previous.state AND json_type(previous.snapshot_json, '$.handover') IS 'object' AND json_extract(NEW.snapshot_json, '$.actor') IS json_extract(previous.snapshot_json, '$.handover.to'))
      OR (NEW.action='cancel' AND NEW.state='cancelled' AND json_extract(NEW.snapshot_json, '$.actor') IS json_extract(previous.snapshot_json, '$.accountable')))))
  ), 0);
  SELECT RAISE(ABORT, 'work_item_recipient_unavailable')
  WHERE NOT COALESCE((
    NOT (NEW.action='create') OR EXISTS (SELECT 1 FROM system_accounts account JOIN system_principals principal ON principal.account_id=account.id WHERE account.id=json_extract(NEW.snapshot_json, '$.assignee.accountId') AND principal.id=json_extract(NEW.snapshot_json, '$.assignee.principalId') AND principal.kind=json_extract(NEW.snapshot_json, '$.assignee.kind') AND principal.kind IN ('human','agent') AND account.status='active' AND account.closed_at IS NULL AND account.created_at<=NEW.recorded_at AND principal.created_at<=NEW.recorded_at)
  ), 0);
  SELECT RAISE(ABORT, 'work_item_recipient_unavailable')
  WHERE NOT COALESCE((
    NOT (NEW.action='request_handover') OR EXISTS (SELECT 1 FROM system_accounts account JOIN system_principals principal ON principal.account_id=account.id WHERE account.id=json_extract(NEW.snapshot_json, '$.handover.to.accountId') AND principal.id=json_extract(NEW.snapshot_json, '$.handover.to.principalId') AND principal.kind=json_extract(NEW.snapshot_json, '$.handover.to.kind') AND principal.kind = 'human' AND account.status='active' AND account.closed_at IS NULL AND account.created_at<=NEW.recorded_at AND principal.created_at<=NEW.recorded_at)
  ), 0);
  SELECT RAISE(ABORT, 'work_item_previous_unavailable')
  WHERE NOT COALESCE((
    NEW.action<>'create' OR json_type(NEW.snapshot_json, '$.previousRevisionId') IS 'null' OR EXISTS (SELECT 1 FROM system_work_item_revisions prior WHERE prior.command_id=json_extract(NEW.snapshot_json, '$.previousRevisionId') AND prior.state IN ('completed','cancelled') AND prior.work_item_id<>NEW.work_item_id AND prior.recorded_at<=NEW.recorded_at AND (prior.accountable_account_id=NEW.actor_account_id AND prior.accountable_principal_id=NEW.actor_principal_id OR prior.assignee_account_id=NEW.actor_account_id AND prior.assignee_principal_id=NEW.actor_principal_id OR EXISTS (SELECT 1 FROM (SELECT permission.permission_key FROM system_role_bindings binding
    JOIN system_iam_roles role ON role.id=binding.role_id
    JOIN system_iam_role_permissions permission ON permission.role_id=role.id
    WHERE binding.account_id=NEW.actor_account_id AND binding.resource_type IS NULL AND binding.resource_id IS NULL
      AND role.resource_type IS NULL AND role.created_at<=NEW.recorded_at AND binding.created_at<=NEW.recorded_at
      AND (binding.revoked_at IS NULL OR NEW.recorded_at<binding.revoked_at)) grants WHERE permission_key='system:admin')))
  ), 0);
  SELECT RAISE(ABORT, 'work_item_audit_invalid')
  WHERE NOT COALESCE((
    EXISTS (SELECT 1 FROM system_audit_events audit WHERE audit.event_id=NEW.audit_event_id
    AND audit.actor_account_id=NEW.actor_account_id AND audit.action='system.work.'||NEW.action
    AND audit.target_type='system:work-item' AND audit.target_id=NEW.work_item_id
    AND audit.outcome='succeeded' AND audit.reason_code IS NULL AND audit.metadata_json IS NULL
    AND audit.occurred_at=NEW.recorded_at AND audit.after_json IS NEW.snapshot_json
    AND audit.before_json IS (SELECT snapshot_json FROM system_work_item_revisions WHERE work_item_id=NEW.work_item_id AND revision=NEW.revision-1)
    AND json_extract(audit.authorization_json,'$.principal_id') IS NEW.actor_principal_id
    AND json_extract(audit.authorization_json,'$.principal_kind') IS json_extract(NEW.snapshot_json, '$.actor.kind')
    AND json_extract(audit.authorization_json,'$.token_version') IS json_extract(NEW.snapshot_json, '$.authentication.tokenVersion')
    AND json_extract(audit.authorization_json,'$.credential_id') IS json_extract(NEW.snapshot_json, '$.authentication.credentialId')
    AND json_extract(audit.authorization_json,'$.step_up_grant_id') IS json_extract(NEW.snapshot_json, '$.authentication.stepUpGrantId')
    AND json_extract(audit.authorization_json,'$.recovery') IS json_extract(NEW.snapshot_json, '$.recovery'))
  ), 0);
  SELECT RAISE(ABORT, 'work_item_evidence_unavailable')
  WHERE NOT COALESCE((
    NEW.action NOT IN ('submit','approve') OR NOT EXISTS (
    SELECT 1 FROM json_each(NEW.snapshot_json,'$.result.evidence') evidence WHERE NOT EXISTS (
      SELECT 1 FROM system_attachments attachment WHERE attachment.id=json_extract(evidence.value,'$.attachmentId')
        AND attachment.plaintext_sha256=json_extract(evidence.value,'$.sha256') AND attachment.erased_at IS NULL
        AND attachment.wrapped_dek IS NOT NULL AND attachment.created_at<=NEW.recorded_at
        AND ((NEW.action='submit' AND attachment.owner_account_id=NEW.actor_account_id
          AND attachment.status='pending' AND attachment.linked_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM system_work_evidence claim WHERE claim.attachment_id=attachment.id))
        OR (attachment.status='linked' AND attachment.linked_at IS NOT NULL AND EXISTS (
          SELECT 1 FROM system_work_evidence claim WHERE claim.attachment_id=attachment.id
            AND claim.work_item_id=NEW.work_item_id AND claim.plaintext_sha256=attachment.plaintext_sha256)))))
  ), 0);
END;
CREATE TRIGGER system_work_submit_evidence AFTER INSERT ON system_work_item_revisions
WHEN NEW.action='submit'
BEGIN
  INSERT INTO system_work_evidence (attachment_id,work_item_id,plaintext_sha256,submitted_by_account_id,command_id,created_at)
  SELECT json_extract(evidence.value,'$.attachmentId'),NEW.work_item_id,json_extract(evidence.value,'$.sha256'),
    NEW.actor_account_id,NEW.command_id,NEW.recorded_at
  FROM json_each(NEW.snapshot_json,'$.result.evidence') evidence
  WHERE NOT EXISTS (SELECT 1 FROM system_work_evidence claim WHERE claim.attachment_id=json_extract(evidence.value,'$.attachmentId'));
  UPDATE system_attachments SET status='linked',linked_at=NEW.recorded_at
  WHERE id IN (SELECT attachment_id FROM system_work_evidence WHERE command_id=NEW.command_id)
    AND status='pending' AND linked_at IS NULL AND erased_at IS NULL;
  SELECT RAISE(ABORT, 'work_item_evidence_unavailable') WHERE EXISTS (
    SELECT 1 FROM json_each(NEW.snapshot_json,'$.result.evidence') evidence WHERE NOT EXISTS (
      SELECT 1 FROM system_work_evidence claim JOIN system_attachments attachment ON attachment.id=claim.attachment_id
      WHERE claim.attachment_id=json_extract(evidence.value,'$.attachmentId') AND claim.work_item_id=NEW.work_item_id
        AND claim.plaintext_sha256=json_extract(evidence.value,'$.sha256')
        AND attachment.plaintext_sha256=claim.plaintext_sha256 AND attachment.status='linked'
        AND attachment.linked_at IS NOT NULL AND attachment.erased_at IS NULL AND attachment.wrapped_dek IS NOT NULL));
END;
CREATE TRIGGER system_work_item_revisions_update BEFORE UPDATE ON system_work_item_revisions
BEGIN
  SELECT RAISE(ABORT, 'work item records are immutable');
END;
CREATE TRIGGER system_work_item_revisions_delete BEFORE DELETE ON system_work_item_revisions
BEGIN
  SELECT RAISE(ABORT, 'work item records are immutable');
END;
CREATE TRIGGER system_work_item_revisions_identity_update
BEFORE UPDATE OF id ON system_work_item_revisions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- system_work_evidence
INSERT INTO system_work_evidence (attachment_id, work_item_id, plaintext_sha256, submitted_by_account_id, command_id, created_at)
SELECT source.attachment_id,
       source.work_item_id,
       source.plaintext_sha256,
       CASE WHEN source.submitted_by_account_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _system_accounts_id_map m WHERE m.old_id = source.submitted_by_account_id), source.submitted_by_account_id) END ,
       source.command_id,
       source.created_at
FROM "_stage_system_work_evidence" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'system_work_evidence',
       (SELECT count(*) FROM "_stage_system_work_evidence"),
       (SELECT count(*) FROM system_work_evidence),
       0,
       0,
       0;
DROP TABLE "_stage_system_work_evidence";
CREATE INDEX system_work_evidence_work_idx ON system_work_evidence(work_item_id, attachment_id);
CREATE TRIGGER system_work_evidence_insert BEFORE INSERT ON system_work_evidence
BEGIN
  SELECT RAISE(ABORT, 'work_item_evidence_unavailable') WHERE NOT EXISTS (
    SELECT 1 FROM system_work_item_revisions revision, json_each(revision.snapshot_json,'$.result.evidence') evidence
    JOIN system_attachments attachment ON attachment.id=json_extract(evidence.value,'$.attachmentId')
    WHERE revision.command_id=NEW.command_id AND revision.work_item_id=NEW.work_item_id AND revision.action='submit'
      AND revision.actor_account_id=NEW.submitted_by_account_id AND revision.recorded_at=NEW.created_at
      AND attachment.id=NEW.attachment_id AND attachment.owner_account_id=NEW.submitted_by_account_id
      AND attachment.status='pending' AND attachment.linked_at IS NULL AND attachment.erased_at IS NULL
      AND attachment.wrapped_dek IS NOT NULL AND attachment.plaintext_sha256=NEW.plaintext_sha256
      AND json_extract(evidence.value,'$.sha256')=NEW.plaintext_sha256 AND attachment.created_at<=NEW.created_at
  );
END;
CREATE TRIGGER system_work_evidence_update BEFORE UPDATE ON system_work_evidence
BEGIN
  SELECT RAISE(ABORT, 'work item records are immutable');
END;
CREATE TRIGGER system_work_evidence_delete BEFORE DELETE ON system_work_evidence
BEGIN
  SELECT RAISE(ABORT, 'work item records are immutable');
END;

-- thanks_messages
INSERT INTO thanks_messages (id, legacy_id, sender_employee_id, recipient_employee_id, message, points, created_at)
SELECT source.id,
       source.legacy_id,
       CASE WHEN source.sender_employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.sender_employee_id), source.sender_employee_id) END ,
       CASE WHEN source.recipient_employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.recipient_employee_id), source.recipient_employee_id) END ,
       source.message,
       source.points,
       source.created_at
FROM "_stage_thanks_messages" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'thanks_messages',
       (SELECT count(*) FROM "_stage_thanks_messages"),
       (SELECT count(*) FROM thanks_messages),
       0,
       0,
       0;
DROP TABLE "_stage_thanks_messages";
CREATE INDEX idx_thanks_created_at ON "thanks_messages" (created_at);
CREATE INDEX idx_thanks_recipient ON "thanks_messages" (recipient_employee_id);
CREATE TRIGGER thanks_messages_source_freeze_delete BEFORE DELETE ON thanks_messages
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='thanks' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'thanks_record_source_frozen'); END;
CREATE TRIGGER thanks_messages_source_freeze_insert BEFORE INSERT ON thanks_messages
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='thanks' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'thanks_record_source_frozen'); END;
CREATE TRIGGER thanks_messages_source_freeze_update BEFORE UPDATE ON thanks_messages
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='thanks' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'thanks_record_source_frozen'); END;
CREATE TRIGGER thanks_messages_legacy_id_insert
BEFORE INSERT ON thanks_messages
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER thanks_messages_identity_update
BEFORE UPDATE OF id, legacy_id ON thanks_messages
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- thanks_point_budgets
INSERT INTO thanks_point_budgets (id, legacy_id, employee_id, period, granted_points, consumed_points, created_at)
SELECT source.id,
       source.legacy_id,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.period,
       source.granted_points,
       source.consumed_points,
       source.created_at
FROM "_stage_thanks_point_budgets" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'thanks_point_budgets',
       (SELECT count(*) FROM "_stage_thanks_point_budgets"),
       (SELECT count(*) FROM thanks_point_budgets),
       0,
       0,
       0;
DROP TABLE "_stage_thanks_point_budgets";
CREATE UNIQUE INDEX uq_thanks_point_budgets_employee_period
  ON thanks_point_budgets (employee_id, period);
CREATE TRIGGER thanks_point_budgets_source_freeze_delete BEFORE DELETE ON thanks_point_budgets
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='thanks' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'thanks_record_source_frozen'); END;
CREATE TRIGGER thanks_point_budgets_source_freeze_insert BEFORE INSERT ON thanks_point_budgets
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='thanks' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'thanks_record_source_frozen'); END;
CREATE TRIGGER thanks_point_budgets_source_freeze_update BEFORE UPDATE ON thanks_point_budgets
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='thanks' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'thanks_record_source_frozen'); END;
CREATE TRIGGER thanks_point_budgets_legacy_id_insert
BEFORE INSERT ON thanks_point_budgets
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER thanks_point_budgets_identity_update
BEFORE UPDATE OF id, legacy_id ON thanks_point_budgets
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- thanks_redemptions
INSERT INTO thanks_redemptions (id, legacy_id, employee_id, reward_id, point_cost, status, created_at, decided_at, decider_id)
SELECT source.id,
       source.legacy_id,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.reward_id,
       source.point_cost,
       source.status,
       source.created_at,
       source.decided_at,
       CASE WHEN source.decider_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.decider_id), source.decider_id) END
FROM "_stage_thanks_redemptions" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'thanks_redemptions',
       (SELECT count(*) FROM "_stage_thanks_redemptions"),
       (SELECT count(*) FROM thanks_redemptions),
       0,
       0,
       0;
DROP TABLE "_stage_thanks_redemptions";
CREATE INDEX idx_thanks_redemptions_employee ON thanks_redemptions (employee_id);
CREATE UNIQUE INDEX idx_thanks_redemptions_employee_pending
  ON thanks_redemptions (employee_id) WHERE status = 'pending';
CREATE INDEX idx_thanks_redemptions_status ON thanks_redemptions (status);
CREATE TRIGGER thanks_redemptions_source_freeze_delete BEFORE DELETE ON thanks_redemptions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='thanks' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'thanks_record_source_frozen'); END;
CREATE TRIGGER thanks_redemptions_source_freeze_insert BEFORE INSERT ON thanks_redemptions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='thanks' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'thanks_record_source_frozen'); END;
CREATE TRIGGER thanks_redemptions_source_freeze_update BEFORE UPDATE ON thanks_redemptions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='thanks' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'thanks_record_source_frozen'); END;
CREATE TRIGGER thanks_redemptions_legacy_id_insert
BEFORE INSERT ON thanks_redemptions
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER thanks_redemptions_identity_update
BEFORE UPDATE OF id, legacy_id ON thanks_redemptions
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- training_enrollments
INSERT INTO training_enrollments (id, created_at, legacy_id, course_id, employee_id, status, completed_at, score, due_date)
SELECT source.id,
       source.created_at,
       source.legacy_id,
       source.course_id,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.status,
       source.completed_at,
       source.score,
       source.due_date
FROM "_stage_training_enrollments" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'training_enrollments',
       (SELECT count(*) FROM "_stage_training_enrollments"),
       (SELECT count(*) FROM training_enrollments),
       0,
       0,
       0;
DROP TABLE "_stage_training_enrollments";
CREATE INDEX idx_training_enrollments_course ON training_enrollments (course_id);
CREATE UNIQUE INDEX idx_training_enrollments_course_employee
  ON training_enrollments (course_id, employee_id);
CREATE INDEX idx_training_enrollments_employee ON training_enrollments (employee_id);
CREATE TRIGGER training_enrollments_source_freeze_delete BEFORE DELETE ON training_enrollments
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='training' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'training_record_source_frozen'); END;
CREATE TRIGGER training_enrollments_source_freeze_insert BEFORE INSERT ON training_enrollments
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='training' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'training_record_source_frozen'); END;
CREATE TRIGGER training_enrollments_source_freeze_update BEFORE UPDATE ON training_enrollments
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='training' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'training_record_source_frozen'); END;
CREATE TRIGGER training_enrollments_legacy_id_insert
BEFORE INSERT ON training_enrollments
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER training_enrollments_identity_update
BEFORE UPDATE OF id, legacy_id ON training_enrollments
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- work_accidents
INSERT INTO work_accidents (id, occurred_on, employee_id, location, summary, severity, status, created_at, legacy_id)
SELECT source.id,
       source.occurred_on,
       CASE WHEN source.employee_id IS NULL THEN NULL ELSE COALESCE((SELECT m.new_id FROM _company_employees_id_map m WHERE m.old_id = source.employee_id), source.employee_id) END ,
       source.location,
       source.summary,
       source.severity,
       source.status,
       source.created_at,
       source.legacy_id
FROM "_stage_work_accidents" source;
INSERT INTO _identity_uuid_primary_key_validation
SELECT 'work_accidents',
       (SELECT count(*) FROM "_stage_work_accidents"),
       (SELECT count(*) FROM work_accidents),
       0,
       0,
       0;
DROP TABLE "_stage_work_accidents";
CREATE INDEX idx_work_accidents_employee ON work_accidents (employee_id);
CREATE INDEX idx_work_accidents_occurred_on ON work_accidents (occurred_on);
CREATE TRIGGER work_accidents_source_freeze_delete
BEFORE DELETE ON work_accidents
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'work-accident' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'work_accident_record_source_frozen'); END;
CREATE TRIGGER work_accidents_source_freeze_insert
BEFORE INSERT ON work_accidents
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'work-accident' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'work_accident_record_source_frozen'); END;
CREATE TRIGGER work_accidents_source_freeze_update
BEFORE UPDATE ON work_accidents
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'work-accident' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'work_accident_record_source_frozen'); END;
CREATE TRIGGER work_accidents_legacy_id_insert
BEFORE INSERT ON work_accidents
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER work_accidents_identity_update
BEFORE UPDATE OF id, legacy_id ON work_accidents
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER company_organization_resource_operation_commit_guard
BEFORE UPDATE OF revision ON company_organizations
WHEN NEW.revision != OLD.revision
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is incomplete')
  WHERE EXISTS (
    SELECT 1 FROM company_command_receipts receipt
    JOIN company_organization_change_operations operation
      ON operation.id = (SELECT key_operation.id FROM company_organization_change_operations key_operation WHERE key_operation.operation_key = 'org-resource:' || receipt.fingerprint)
    WHERE receipt.organization_id = NEW.id AND receipt.organization_revision = NEW.revision
      AND operation.status != 'COMPLETED'
  );
END;
DROP TABLE _company_employees_id_map;
DROP TABLE _system_accounts_id_map;
DROP TABLE _company_organization_change_operations_id_map;
DROP TABLE _company_employments_id_map;
DROP TABLE _company_employment_attributes_id_map;
DROP TABLE _system_principals_id_map;
DROP TABLE _system_machine_credentials_id_map;
DROP TABLE _system_identity_bindings_id_map;
DROP TABLE _company_personnel_action_requests_id_map;
DROP TABLE _company_personnel_actions_id_map;
DROP TABLE _system_account_invitations_id_map;
DROP TABLE _system_authentication_attempts_id_map;
DROP TABLE _system_password_reset_challenges_id_map;
DROP TABLE _system_sessions_id_map;
DROP TABLE _system_step_up_grants_id_map;
DROP TABLE _f_misc_id_map;
DROP TABLE _identity_uuid_primary_key_validation;
