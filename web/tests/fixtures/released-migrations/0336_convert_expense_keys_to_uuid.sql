-- 経費（expense）の table を UUID の主キーへ移す (Issue )。これで業務 context の全 table が UUID の主キーになる。
--
-- 対象:
-- - 整数の主キー: expenses, expense_approvals, expense_budgets
-- - 冪等性キーや複合の主キー: expense_procedure_bindings（request_key）, expense_attachments（経費・添付）
--
-- 整数の主キーは v4 の UUID に置き換え、旧来の整数の主キーを同じ行の legacy_id（TEXT、UNIQUE）に残す。
-- System の監査の対象 ID（経費）、案件、提案と digest、添付の保全は書き換えず、旧 ID は legacy_id で現在の行へ辿る。
--
-- 手続きの結び付けは request_key（System の案件の subject）を一意な属性として残し、新しい UUID の id を主キーにする。
-- 経費と添付の対応も新しい UUID の id を主キーにし、(expense_id, attachment_id) を一意に残す。
-- 業務の記録を指す列（expense_id、previous_expense_id）は経費の新しい UUID へ書き換える。
--
-- 退避と削除は参照元から、作り直しは参照先から行う。所有業務が撤去の停止中なら検証表の CHECK で止める。
--
-- ALTER TABLE RENAME は trigger を含む全 schema を解析し直し、table ごとに数十 ms かかる。
-- 名前を変えずに行を退避し、同じ名前で作り直してから戻す。

CREATE TABLE _expense_uuid_primary_key_validation (
  resource TEXT PRIMARY KEY NOT NULL,
  source_count INTEGER NOT NULL,
  target_count INTEGER NOT NULL,
  orphan_count INTEGER NOT NULL,
  non_uuid_count INTEGER NOT NULL,
  blocked_count INTEGER NOT NULL,
  CHECK (source_count = target_count AND orphan_count = 0 AND non_uuid_count = 0 AND blocked_count = 0)
);

-- expense_budgets
CREATE TABLE _expense_budgets_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _expense_budgets_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM expense_budgets;

-- expenses
CREATE TABLE _expenses_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _expenses_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM expenses;

-- expense_approvals
CREATE TABLE _expense_approvals_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _expense_approvals_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM expense_approvals;

-- 外部キーの無い参照が移行前から指す先を持たない行の数。移行で増えないことを最後に確かめる。
CREATE TABLE _uuid_reference_orphans (
  resource TEXT PRIMARY KEY NOT NULL,
  orphan_count INTEGER NOT NULL
);
INSERT INTO _uuid_reference_orphans VALUES ('expense_approvals.expense_id', (SELECT count(*) FROM expense_approvals child WHERE child.expense_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM expenses parent WHERE parent.id = child.expense_id)));
INSERT INTO _uuid_reference_orphans VALUES ('expense_attachments.expense_id', (SELECT count(*) FROM expense_attachments child WHERE child.expense_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM expenses parent WHERE parent.id = child.expense_id)));
INSERT INTO _uuid_reference_orphans VALUES ('expense_procedure_bindings.expense_id', (SELECT count(*) FROM expense_procedure_bindings child WHERE child.expense_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM expenses parent WHERE parent.id = child.expense_id)));
INSERT INTO _uuid_reference_orphans VALUES ('expense_procedure_bindings.previous_expense_id', (SELECT count(*) FROM expense_procedure_bindings child WHERE child.previous_expense_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM expenses parent WHERE parent.id = child.previous_expense_id)));

-- 参照元から順に行を退避して table を削除する。
CREATE TABLE "_stage_expense_procedure_bindings" AS SELECT * FROM expense_procedure_bindings;
DROP TABLE expense_procedure_bindings;
CREATE TABLE "_stage_expense_attachments" AS SELECT * FROM expense_attachments;
DROP TABLE expense_attachments;
CREATE TABLE "_stage_expense_approvals" AS SELECT * FROM expense_approvals;
DROP TABLE expense_approvals;
CREATE TABLE "_stage_expenses" AS SELECT * FROM expenses;
DROP TABLE expenses;
CREATE TABLE "_stage_expense_budgets" AS SELECT * FROM expense_budgets;
DROP TABLE expense_budgets;

-- expense_budgets
CREATE TABLE expense_budgets (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  organization_unit_id TEXT NOT NULL
    REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  fiscal_period TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  amount INTEGER NOT NULL,
  name TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO expense_budgets (id, organization_unit_id, fiscal_period, period_start, period_end, amount, name, note, created_at, legacy_id)
SELECT map.new_id,
       source.organization_unit_id,
       source.fiscal_period,
       source.period_start,
       source.period_end,
       source.amount,
       source.name,
       source.note,
       source.created_at,
       CAST(source.id AS TEXT)
FROM "_stage_expense_budgets" source
INNER JOIN _expense_budgets_id_map map ON map.old_id = source.id;
INSERT INTO _expense_uuid_primary_key_validation
SELECT 'expense_budgets',
       (SELECT count(*) FROM "_stage_expense_budgets"),
       (SELECT count(*) FROM expense_budgets),
       0,
       (SELECT count(*) FROM expense_budgets WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'expense' AND revision = 1);
DROP TABLE "_stage_expense_budgets";
CREATE INDEX idx_expense_budgets_organization_unit
  ON expense_budgets(organization_unit_id);
CREATE INDEX idx_expense_budgets_fiscal_period
  ON expense_budgets(fiscal_period);
CREATE TRIGGER expense_budgets_source_freeze_insert
BEFORE INSERT ON expense_budgets
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'expense' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'expense_record_source_frozen');
END;
CREATE TRIGGER expense_budgets_source_freeze_update
BEFORE UPDATE ON expense_budgets
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'expense' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'expense_record_source_frozen');
END;
CREATE TRIGGER expense_budgets_source_freeze_delete
BEFORE DELETE ON expense_budgets
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'expense' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'expense_record_source_frozen');
END;
CREATE TRIGGER expense_budgets_legacy_id_insert
BEFORE INSERT ON expense_budgets
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER expense_budgets_identity_update
BEFORE UPDATE OF id, legacy_id ON expense_budgets
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- expenses
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
INSERT INTO expenses (id, employee_id, organization_unit_id, category, amount, spent_at, note, status, created_at, legacy_id)
SELECT map.new_id,
       source.employee_id,
       source.organization_unit_id,
       source.category,
       source.amount,
       source.spent_at,
       source.note,
       source.status,
       source.created_at,
       CAST(source.id AS TEXT)
FROM "_stage_expenses" source
INNER JOIN _expenses_id_map map ON map.old_id = source.id;
INSERT INTO _expense_uuid_primary_key_validation
SELECT 'expenses',
       (SELECT count(*) FROM "_stage_expenses"),
       (SELECT count(*) FROM expenses),
       0,
       (SELECT count(*) FROM expenses WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'expense' AND revision = 1);
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

-- expense_approvals
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
INSERT INTO expense_approvals (id, expense_id, approver_id, action, comment, created_at, legacy_id)
SELECT map.new_id,
       CASE WHEN source.expense_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _expenses_id_map ref WHERE ref.old_id = source.expense_id), CAST(source.expense_id AS TEXT)) END,
       source.approver_id,
       source.action,
       source.comment,
       source.created_at,
       CAST(source.id AS TEXT)
FROM "_stage_expense_approvals" source
INNER JOIN _expense_approvals_id_map map ON map.old_id = source.id;
INSERT INTO _expense_uuid_primary_key_validation
SELECT 'expense_approvals',
       (SELECT count(*) FROM "_stage_expense_approvals"),
       (SELECT count(*) FROM expense_approvals),
       0,
       (SELECT count(*) FROM expense_approvals WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'expense' AND revision = 1);
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

-- expense_attachments
CREATE TABLE expense_attachments (
  id TEXT PRIMARY KEY NOT NULL,
  expense_id TEXT NOT NULL,
  attachment_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (expense_id, attachment_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO expense_attachments (id, expense_id, attachment_id, created_at)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       CASE WHEN source.expense_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _expenses_id_map ref WHERE ref.old_id = source.expense_id), CAST(source.expense_id AS TEXT)) END,
       source.attachment_id,
       source.created_at
FROM "_stage_expense_attachments" source;
INSERT INTO _expense_uuid_primary_key_validation
SELECT 'expense_attachments',
       (SELECT count(*) FROM "_stage_expense_attachments"),
       (SELECT count(*) FROM expense_attachments),
       0,
       (SELECT count(*) FROM expense_attachments WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'expense' AND revision = 1);
DROP TABLE "_stage_expense_attachments";
CREATE INDEX idx_expense_attachments_expense
  ON expense_attachments (expense_id);
CREATE TRIGGER expense_procedure_attachment_matches_snapshot
BEFORE INSERT ON expense_attachments
WHEN EXISTS (SELECT 1 FROM expense_procedure_bindings WHERE expense_id = NEW.expense_id)
 AND NOT EXISTS (
   SELECT 1 FROM expense_procedure_bindings binding, json_each(binding.attachment_evidence_json) evidence
   WHERE binding.expense_id = NEW.expense_id AND json_extract(evidence.value, '$.id') = NEW.attachment_id
 )
BEGIN
  SELECT RAISE(ABORT, 'expense_procedure_attachment_mismatch');
END;
CREATE TRIGGER expense_procedure_attachment_immutable_update
BEFORE UPDATE ON expense_attachments
WHEN EXISTS (SELECT 1 FROM expense_procedure_bindings WHERE expense_id IN (OLD.expense_id, NEW.expense_id))
BEGIN
  SELECT RAISE(ABORT, 'expense_procedure_attachment_immutable');
END;
CREATE TRIGGER expense_procedure_attachment_immutable_delete
BEFORE DELETE ON expense_attachments
WHEN EXISTS (SELECT 1 FROM expense_procedure_bindings WHERE expense_id = OLD.expense_id)
BEGIN
  SELECT RAISE(ABORT, 'expense_procedure_attachment_immutable');
END;
CREATE TRIGGER expense_attachments_source_freeze_insert
BEFORE INSERT ON expense_attachments
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'expense' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'expense_record_source_frozen');
END;
CREATE TRIGGER expense_attachments_source_freeze_update
BEFORE UPDATE ON expense_attachments
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'expense' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'expense_record_source_frozen');
END;
CREATE TRIGGER expense_attachments_source_freeze_delete
BEFORE DELETE ON expense_attachments
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'expense' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'expense_record_source_frozen');
END;
CREATE TRIGGER expense_attachments_identity_update
BEFORE UPDATE OF id ON expense_attachments
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- expense_procedure_bindings
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
INSERT INTO expense_procedure_bindings (id, previous_expense_id, request_key, expense_id, application_id, series_id, case_id, proposal_digest, created_at, attachment_evidence_json)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       CASE WHEN source.previous_expense_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _expenses_id_map ref WHERE ref.old_id = source.previous_expense_id), CAST(source.previous_expense_id AS TEXT)) END,
       source.request_key,
       CASE WHEN source.expense_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _expenses_id_map ref WHERE ref.old_id = source.expense_id), CAST(source.expense_id AS TEXT)) END,
       source.application_id,
       source.series_id,
       source.case_id,
       source.proposal_digest,
       source.created_at,
       source.attachment_evidence_json
FROM "_stage_expense_procedure_bindings" source;
INSERT INTO _expense_uuid_primary_key_validation
SELECT 'expense_procedure_bindings',
       (SELECT count(*) FROM "_stage_expense_procedure_bindings"),
       (SELECT count(*) FROM expense_procedure_bindings),
       0,
       (SELECT count(*) FROM expense_procedure_bindings WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'expense' AND revision = 1);
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

INSERT INTO _expense_uuid_primary_key_validation
SELECT 'expense_approvals.expense_id', orphan_count, (SELECT count(*) FROM expense_approvals child WHERE child.expense_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM expenses parent WHERE parent.id = child.expense_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'expense_approvals.expense_id';
INSERT INTO _expense_uuid_primary_key_validation
SELECT 'expense_attachments.expense_id', orphan_count, (SELECT count(*) FROM expense_attachments child WHERE child.expense_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM expenses parent WHERE parent.id = child.expense_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'expense_attachments.expense_id';
INSERT INTO _expense_uuid_primary_key_validation
SELECT 'expense_procedure_bindings.expense_id', orphan_count, (SELECT count(*) FROM expense_procedure_bindings child WHERE child.expense_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM expenses parent WHERE parent.id = child.expense_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'expense_procedure_bindings.expense_id';
INSERT INTO _expense_uuid_primary_key_validation
SELECT 'expense_procedure_bindings.previous_expense_id', orphan_count, (SELECT count(*) FROM expense_procedure_bindings child WHERE child.previous_expense_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM expenses parent WHERE parent.id = child.previous_expense_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'expense_procedure_bindings.previous_expense_id';
DROP TABLE _uuid_reference_orphans;
DROP TABLE _expense_budgets_id_map;
DROP TABLE _expenses_id_map;
DROP TABLE _expense_approvals_id_map;
DROP TABLE _expense_uuid_primary_key_validation;
