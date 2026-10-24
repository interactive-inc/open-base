-- 稟議（ringi）、ソフトウェアライセンス（software-license）、休暇（leave）の table を UUID の主キーへ移す (Issue )。
--
-- 対象:
-- - 整数の主キー: ringi_requests, software_licenses, leave_requests
-- - 主キーが既に TEXT の UUID: software_license_assignments, software_license_changes
-- - 冪等性キーや複合の主キー: ringi_procedure_bindings, leave_procedure_bindings（request_key）,
--   leave_balances（社員・年度・休暇種別）
-- - System の job の 1:1 の拡張: leave_decision_notifications（job_id）
--
-- 整数の主キーは v4 の UUID に置き換え、旧来の整数の主キーを同じ行の legacy_id（TEXT、UNIQUE）に残す。
-- System の監査の対象 ID（稟議、休暇、ライセンスの割当）、案件、提案と digest は書き換えず、
-- 旧 ID は legacy_id で現在の行へ辿る。提案本文は業務の記録の ID を含まない。
--
-- leave_decision_notifications の job_id は System の job の ID で、UUID ではない形（leave-decision:<監査 ID>）を含む。
-- 値を変えず一意な属性として残し、新しい UUID の id を主キーにする。
--
-- 手続きの結び付け（procedure bindings）は client の冪等性キー request_key を主キーにしていた。
-- request_key は System の案件の subject でもあるため値を変えず一意な属性として残し、新しい UUID の id を
-- 主キーにする。結び付けと割当の履歴は変更不能だが、業務の記録を指す列（ringi_id、previous_ringi_id、
-- leave_request_id、previous_leave_request_id、license_id）は記録の新しい UUID へ書き換える。
--
-- leave_decision_notifications は休暇の判断通知の不変の記録で、payload_json の leaveRequestId が
-- leave_request_id と一致することを CHECK で求める。業務の記録の一部なので、payload_json の leaveRequestId も
-- 新しい UUID へ書き換える。System の job の payload は書き換えない。
--
-- 退避と削除は参照元から、作り直しは参照先から行う。所有業務が撤去の停止中なら検証表の CHECK で止める。
--
-- ALTER TABLE RENAME は trigger を含む全 schema を解析し直し、table ごとに数十 ms かかる。
-- 名前を変えずに行を退避し、同じ名前で作り直してから戻す。

CREATE TABLE _ringi_license_leave_uuid_primary_key_validation (
  resource TEXT PRIMARY KEY NOT NULL,
  source_count INTEGER NOT NULL,
  target_count INTEGER NOT NULL,
  orphan_count INTEGER NOT NULL,
  non_uuid_count INTEGER NOT NULL,
  blocked_count INTEGER NOT NULL,
  CHECK (source_count = target_count AND orphan_count = 0 AND non_uuid_count = 0 AND blocked_count = 0)
);

-- ringi_requests
CREATE TABLE _ringi_requests_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _ringi_requests_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM ringi_requests;

-- software_licenses
CREATE TABLE _software_licenses_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _software_licenses_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM software_licenses;

-- software_license_assignments
CREATE TABLE _software_license_assignments_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _software_license_assignments_id_map (old_id, new_id)
SELECT id, CASE WHEN length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]' THEN id ELSE lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) END
FROM software_license_assignments;

-- software_license_changes
CREATE TABLE _software_license_changes_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _software_license_changes_id_map (old_id, new_id)
SELECT id, CASE WHEN length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]' THEN id ELSE lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) END
FROM software_license_changes;

-- leave_requests
CREATE TABLE _leave_requests_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _leave_requests_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM leave_requests;

-- 外部キーの無い参照が移行前から指す先を持たない行の数。移行で増えないことを最後に確かめる。
CREATE TABLE _uuid_reference_orphans (
  resource TEXT PRIMARY KEY NOT NULL,
  orphan_count INTEGER NOT NULL
);
INSERT INTO _uuid_reference_orphans VALUES ('ringi_procedure_bindings.ringi_id', (SELECT count(*) FROM ringi_procedure_bindings child WHERE child.ringi_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ringi_requests parent WHERE parent.id = child.ringi_id)));
INSERT INTO _uuid_reference_orphans VALUES ('ringi_procedure_bindings.previous_ringi_id', (SELECT count(*) FROM ringi_procedure_bindings child WHERE child.previous_ringi_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ringi_requests parent WHERE parent.id = child.previous_ringi_id)));
INSERT INTO _uuid_reference_orphans VALUES ('software_license_assignments.license_id', (SELECT count(*) FROM software_license_assignments child WHERE child.license_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM software_licenses parent WHERE parent.id = child.license_id)));
INSERT INTO _uuid_reference_orphans VALUES ('software_license_changes.license_id', (SELECT count(*) FROM software_license_changes child WHERE child.license_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM software_licenses parent WHERE parent.id = child.license_id)));
INSERT INTO _uuid_reference_orphans VALUES ('leave_requests.previous_leave_request_id', (SELECT count(*) FROM leave_requests child WHERE child.previous_leave_request_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM leave_requests parent WHERE parent.id = child.previous_leave_request_id)));
INSERT INTO _uuid_reference_orphans VALUES ('leave_procedure_bindings.leave_request_id', (SELECT count(*) FROM leave_procedure_bindings child WHERE child.leave_request_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM leave_requests parent WHERE parent.id = child.leave_request_id)));
INSERT INTO _uuid_reference_orphans VALUES ('leave_procedure_bindings.previous_leave_request_id', (SELECT count(*) FROM leave_procedure_bindings child WHERE child.previous_leave_request_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM leave_requests parent WHERE parent.id = child.previous_leave_request_id)));
INSERT INTO _uuid_reference_orphans VALUES ('leave_decision_notifications.leave_request_id', (SELECT count(*) FROM leave_decision_notifications child WHERE child.leave_request_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM leave_requests parent WHERE parent.id = child.leave_request_id)));

-- 参照元から順に行を退避して table を削除する。
CREATE TABLE "_stage_leave_balances" AS SELECT * FROM leave_balances;
DROP TABLE leave_balances;
CREATE TABLE "_stage_leave_decision_notifications" AS SELECT * FROM leave_decision_notifications;
DROP TABLE leave_decision_notifications;
CREATE TABLE "_stage_leave_procedure_bindings" AS SELECT * FROM leave_procedure_bindings;
DROP TABLE leave_procedure_bindings;
CREATE TABLE "_stage_leave_requests" AS SELECT * FROM leave_requests;
DROP TABLE leave_requests;
CREATE TABLE "_stage_software_license_changes" AS SELECT * FROM software_license_changes;
DROP TABLE software_license_changes;
CREATE TABLE "_stage_software_license_assignments" AS SELECT * FROM software_license_assignments;
DROP TABLE software_license_assignments;
CREATE TABLE "_stage_software_licenses" AS SELECT * FROM software_licenses;
DROP TABLE software_licenses;
CREATE TABLE "_stage_ringi_procedure_bindings" AS SELECT * FROM ringi_procedure_bindings;
DROP TABLE ringi_procedure_bindings;
CREATE TABLE "_stage_ringi_requests" AS SELECT * FROM ringi_requests;
DROP TABLE ringi_requests;

-- ringi_requests
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
INSERT INTO ringi_requests (id, applicant_id, approver_id, title, amount, reason, status, decided_at, decision_comment, created_at, legacy_id)
SELECT map.new_id,
       source.applicant_id,
       source.approver_id,
       source.title,
       source.amount,
       source.reason,
       source.status,
       source.decided_at,
       source.decision_comment,
       source.created_at,
       CAST(source.id AS TEXT)
FROM "_stage_ringi_requests" source
INNER JOIN _ringi_requests_id_map map ON map.old_id = source.id;
INSERT INTO _ringi_license_leave_uuid_primary_key_validation
SELECT 'ringi_requests',
       (SELECT count(*) FROM "_stage_ringi_requests"),
       (SELECT count(*) FROM ringi_requests),
       0,
       (SELECT count(*) FROM ringi_requests WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'ringi' AND revision = 1);
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
INSERT INTO ringi_procedure_bindings (id, request_key, ringi_id, application_id, series_id, case_id, proposal_digest, created_at, previous_ringi_id)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.request_key,
       CASE WHEN source.ringi_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _ringi_requests_id_map ref WHERE ref.old_id = source.ringi_id), CAST(source.ringi_id AS TEXT)) END,
       source.application_id,
       source.series_id,
       source.case_id,
       source.proposal_digest,
       source.created_at,
       CASE WHEN source.previous_ringi_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _ringi_requests_id_map ref WHERE ref.old_id = source.previous_ringi_id), CAST(source.previous_ringi_id AS TEXT)) END
FROM "_stage_ringi_procedure_bindings" source;
INSERT INTO _ringi_license_leave_uuid_primary_key_validation
SELECT 'ringi_procedure_bindings',
       (SELECT count(*) FROM "_stage_ringi_procedure_bindings"),
       (SELECT count(*) FROM ringi_procedure_bindings),
       0,
       (SELECT count(*) FROM ringi_procedure_bindings WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'ringi' AND revision = 1);
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

-- software_licenses
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
INSERT INTO software_licenses (id, name, vendor, category, seats, renewal_deadline, owner_employee_id, note, status, created_at, plan_name, revision, legacy_id)
SELECT map.new_id,
       source.name,
       source.vendor,
       source.category,
       source.seats,
       source.renewal_deadline,
       source.owner_employee_id,
       source.note,
       source.status,
       source.created_at,
       source.plan_name,
       source.revision,
       CAST(source.id AS TEXT)
FROM "_stage_software_licenses" source
INNER JOIN _software_licenses_id_map map ON map.old_id = source.id;
INSERT INTO _ringi_license_leave_uuid_primary_key_validation
SELECT 'software_licenses',
       (SELECT count(*) FROM "_stage_software_licenses"),
       (SELECT count(*) FROM software_licenses),
       0,
       (SELECT count(*) FROM software_licenses WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'software-license' AND revision = 1);
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
INSERT INTO software_license_assignments (id, license_id, employee_id, service_name, plan_name, account_reference, assigned_at, assigned_by, assigned_reason, released_at, released_by, release_reason)
SELECT map.new_id,
       CASE WHEN source.license_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _software_licenses_id_map ref WHERE ref.old_id = source.license_id), CAST(source.license_id AS TEXT)) END,
       source.employee_id,
       source.service_name,
       source.plan_name,
       source.account_reference,
       source.assigned_at,
       source.assigned_by,
       source.assigned_reason,
       source.released_at,
       source.released_by,
       source.release_reason
FROM "_stage_software_license_assignments" source
INNER JOIN _software_license_assignments_id_map map ON map.old_id = source.id;
INSERT INTO _ringi_license_leave_uuid_primary_key_validation
SELECT 'software_license_assignments',
       (SELECT count(*) FROM "_stage_software_license_assignments"),
       (SELECT count(*) FROM software_license_assignments),
       0,
       (SELECT count(*) FROM software_license_assignments WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'software-license' AND revision = 1)
         + (SELECT count(*) FROM _software_license_assignments_id_map WHERE old_id IS NOT new_id AND (
             EXISTS (SELECT 1 FROM system_record_coverage_entries entry WHERE entry.source_record_id = _software_license_assignments_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_preserved_records preserved WHERE json_extract(preserved.snapshot_json, '$.source.recordId') = _software_license_assignments_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_cases workflow_case WHERE workflow_case.subject_id = _software_license_assignments_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_audit_events audit WHERE audit.target_id = _software_license_assignments_id_map.old_id)));
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
INSERT INTO software_license_changes (id, license_id, actor_account_id, recorded_at, command_id, request_json, before_json, after_json)
SELECT map.new_id,
       CASE WHEN source.license_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _software_licenses_id_map ref WHERE ref.old_id = source.license_id), CAST(source.license_id AS TEXT)) END,
       source.actor_account_id,
       source.recorded_at,
       source.command_id,
       source.request_json,
       source.before_json,
       source.after_json
FROM "_stage_software_license_changes" source
INNER JOIN _software_license_changes_id_map map ON map.old_id = source.id;
INSERT INTO _ringi_license_leave_uuid_primary_key_validation
SELECT 'software_license_changes',
       (SELECT count(*) FROM "_stage_software_license_changes"),
       (SELECT count(*) FROM software_license_changes),
       0,
       (SELECT count(*) FROM software_license_changes WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'software-license' AND revision = 1)
         + (SELECT count(*) FROM _software_license_changes_id_map WHERE old_id IS NOT new_id AND (
             EXISTS (SELECT 1 FROM system_record_coverage_entries entry WHERE entry.source_record_id = _software_license_changes_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_preserved_records preserved WHERE json_extract(preserved.snapshot_json, '$.source.recordId') = _software_license_changes_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_cases workflow_case WHERE workflow_case.subject_id = _software_license_changes_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_audit_events audit WHERE audit.target_id = _software_license_changes_id_map.old_id)));
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

-- leave_requests
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
INSERT INTO leave_requests (id, employee_id, leave_type, start_date, end_date, days, reason, status, approver_id, decided_comment, created_at, unit, hours, consumed_days, previous_leave_request_id, legacy_id)
SELECT map.new_id,
       source.employee_id,
       source.leave_type,
       source.start_date,
       source.end_date,
       source.days,
       source.reason,
       source.status,
       source.approver_id,
       source.decided_comment,
       source.created_at,
       source.unit,
       source.hours,
       source.consumed_days,
       CASE WHEN source.previous_leave_request_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _leave_requests_id_map ref WHERE ref.old_id = source.previous_leave_request_id), CAST(source.previous_leave_request_id AS TEXT)) END,
       CAST(source.id AS TEXT)
FROM "_stage_leave_requests" source
INNER JOIN _leave_requests_id_map map ON map.old_id = source.id;
INSERT INTO _ringi_license_leave_uuid_primary_key_validation
SELECT 'leave_requests',
       (SELECT count(*) FROM "_stage_leave_requests"),
       (SELECT count(*) FROM leave_requests),
       0,
       (SELECT count(*) FROM leave_requests WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'leave' AND revision = 1);
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

-- leave_procedure_bindings
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
INSERT INTO leave_procedure_bindings (id, request_key, leave_request_id, previous_leave_request_id, application_id, series_id, case_id, proposal_digest, created_at)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.request_key,
       CASE WHEN source.leave_request_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _leave_requests_id_map ref WHERE ref.old_id = source.leave_request_id), CAST(source.leave_request_id AS TEXT)) END,
       CASE WHEN source.previous_leave_request_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _leave_requests_id_map ref WHERE ref.old_id = source.previous_leave_request_id), CAST(source.previous_leave_request_id AS TEXT)) END,
       source.application_id,
       source.series_id,
       source.case_id,
       source.proposal_digest,
       source.created_at
FROM "_stage_leave_procedure_bindings" source;
INSERT INTO _ringi_license_leave_uuid_primary_key_validation
SELECT 'leave_procedure_bindings',
       (SELECT count(*) FROM "_stage_leave_procedure_bindings"),
       (SELECT count(*) FROM leave_procedure_bindings),
       0,
       (SELECT count(*) FROM leave_procedure_bindings WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'leave' AND revision = 1);
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

-- leave_decision_notifications
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
INSERT INTO leave_decision_notifications (id, job_id, leave_request_id, decision_audit_id, payload_json)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.job_id,
       CASE WHEN source.leave_request_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _leave_requests_id_map ref WHERE ref.old_id = source.leave_request_id), CAST(source.leave_request_id AS TEXT)) END,
       source.decision_audit_id,
       json_set(source.payload_json, '$.leaveRequestId', COALESCE((SELECT ref.new_id FROM _leave_requests_id_map ref WHERE ref.old_id = source.leave_request_id), CAST(source.leave_request_id AS TEXT)))
FROM "_stage_leave_decision_notifications" source;
INSERT INTO _ringi_license_leave_uuid_primary_key_validation
SELECT 'leave_decision_notifications',
       (SELECT count(*) FROM "_stage_leave_decision_notifications"),
       (SELECT count(*) FROM leave_decision_notifications),
       0,
       (SELECT count(*) FROM leave_decision_notifications WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'leave' AND revision = 1);
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

-- leave_balances
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
INSERT INTO leave_balances (id, employee_id, fiscal_year, leave_type, granted_days, used_days, remaining_days)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.employee_id,
       source.fiscal_year,
       source.leave_type,
       source.granted_days,
       source.used_days,
       source.remaining_days
FROM "_stage_leave_balances" source;
INSERT INTO _ringi_license_leave_uuid_primary_key_validation
SELECT 'leave_balances',
       (SELECT count(*) FROM "_stage_leave_balances"),
       (SELECT count(*) FROM leave_balances),
       0,
       (SELECT count(*) FROM leave_balances WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'leave' AND revision = 1);
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

INSERT INTO _ringi_license_leave_uuid_primary_key_validation
SELECT 'ringi_procedure_bindings.ringi_id', orphan_count, (SELECT count(*) FROM ringi_procedure_bindings child WHERE child.ringi_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ringi_requests parent WHERE parent.id = child.ringi_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'ringi_procedure_bindings.ringi_id';
INSERT INTO _ringi_license_leave_uuid_primary_key_validation
SELECT 'ringi_procedure_bindings.previous_ringi_id', orphan_count, (SELECT count(*) FROM ringi_procedure_bindings child WHERE child.previous_ringi_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ringi_requests parent WHERE parent.id = child.previous_ringi_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'ringi_procedure_bindings.previous_ringi_id';
INSERT INTO _ringi_license_leave_uuid_primary_key_validation
SELECT 'software_license_assignments.license_id', orphan_count, (SELECT count(*) FROM software_license_assignments child WHERE child.license_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM software_licenses parent WHERE parent.id = child.license_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'software_license_assignments.license_id';
INSERT INTO _ringi_license_leave_uuid_primary_key_validation
SELECT 'software_license_changes.license_id', orphan_count, (SELECT count(*) FROM software_license_changes child WHERE child.license_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM software_licenses parent WHERE parent.id = child.license_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'software_license_changes.license_id';
INSERT INTO _ringi_license_leave_uuid_primary_key_validation
SELECT 'leave_requests.previous_leave_request_id', orphan_count, (SELECT count(*) FROM leave_requests child WHERE child.previous_leave_request_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM leave_requests parent WHERE parent.id = child.previous_leave_request_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'leave_requests.previous_leave_request_id';
INSERT INTO _ringi_license_leave_uuid_primary_key_validation
SELECT 'leave_procedure_bindings.leave_request_id', orphan_count, (SELECT count(*) FROM leave_procedure_bindings child WHERE child.leave_request_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM leave_requests parent WHERE parent.id = child.leave_request_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'leave_procedure_bindings.leave_request_id';
INSERT INTO _ringi_license_leave_uuid_primary_key_validation
SELECT 'leave_procedure_bindings.previous_leave_request_id', orphan_count, (SELECT count(*) FROM leave_procedure_bindings child WHERE child.previous_leave_request_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM leave_requests parent WHERE parent.id = child.previous_leave_request_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'leave_procedure_bindings.previous_leave_request_id';
INSERT INTO _ringi_license_leave_uuid_primary_key_validation
SELECT 'leave_decision_notifications.leave_request_id', orphan_count, (SELECT count(*) FROM leave_decision_notifications child WHERE child.leave_request_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM leave_requests parent WHERE parent.id = child.leave_request_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'leave_decision_notifications.leave_request_id';
DROP TABLE _uuid_reference_orphans;
DROP TABLE _ringi_requests_id_map;
DROP TABLE _software_licenses_id_map;
DROP TABLE _software_license_assignments_id_map;
DROP TABLE _software_license_changes_id_map;
DROP TABLE _leave_requests_id_map;
DROP TABLE _ringi_license_leave_uuid_primary_key_validation;
