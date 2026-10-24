-- 整数の主キーを持つ業務の葉 table を UUID の主キーへ移す (Issue )。
--
-- 対象: commendations, disciplinary_actions, work_accidents, health_checkups, it_incidents,
-- headcount_plans, employee_work_styles, salary_revisions, company_calendar_days,
-- document_ledger_entries
--
-- どの table も他の table から参照されない。各行に v4 の UUID を割り当て、旧来の整数の主キーは
-- 同じ行の legacy_id（TEXT、UNIQUE）に残す。保全・撤去・監査の証跡は変更不能なので書き換えず、
-- 証跡が指す旧 ID は legacy_id で現在の行へ辿る。legacy_id は保全の原文にも含まれるため、
-- 記録を撤去した後も証跡どうしを結び付けられる。移行後に作る行の legacy_id は NULL になる。
--
-- 所有業務が撤去の停止中なら検証表の CHECK で止める。停止中の記録の主キーを変えると、
-- 照合済みの頁と保全の対応が崩れるため。
--
-- table を作り直すと消える index と trigger は、作り直す前の定義から復元する。

CREATE TABLE _business_leaf_uuid_primary_key_validation (
  resource TEXT PRIMARY KEY NOT NULL,
  source_count INTEGER NOT NULL,
  target_count INTEGER NOT NULL,
  orphan_count INTEGER NOT NULL,
  non_uuid_count INTEGER NOT NULL,
  blocked_count INTEGER NOT NULL,
  CHECK (source_count = target_count AND orphan_count = 0 AND non_uuid_count = 0 AND blocked_count = 0)
);

-- commendations
CREATE TABLE _commendations_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _commendations_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM commendations;

-- disciplinary_actions
CREATE TABLE _disciplinary_actions_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _disciplinary_actions_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM disciplinary_actions;

-- work_accidents
CREATE TABLE _work_accidents_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _work_accidents_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM work_accidents;

-- health_checkups
CREATE TABLE _health_checkups_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _health_checkups_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM health_checkups;

-- it_incidents
CREATE TABLE _it_incidents_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _it_incidents_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM it_incidents;

-- headcount_plans
CREATE TABLE _headcount_plans_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _headcount_plans_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM headcount_plans;

-- employee_work_styles
CREATE TABLE _employee_work_styles_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _employee_work_styles_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM employee_work_styles;

-- salary_revisions
CREATE TABLE _salary_revisions_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _salary_revisions_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM salary_revisions;

-- company_calendar_days
CREATE TABLE _company_calendar_days_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _company_calendar_days_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM company_calendar_days;

-- document_ledger_entries
CREATE TABLE _document_ledger_entries_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _document_ledger_entries_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM document_ledger_entries;

-- commendations
CREATE TABLE "__new_commendations" (
  id TEXT PRIMARY KEY NOT NULL,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  title TEXT NOT NULL,
  reason TEXT NOT NULL,
  awarded_on TEXT NOT NULL,
  created_at TEXT NOT NULL,
  legacy_id TEXT UNIQUE,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO "__new_commendations" (id, employee_id, title, reason, awarded_on, created_at, legacy_id)
SELECT map.new_id,
       source.employee_id,
       source.title,
       source.reason,
       source.awarded_on,
       source.created_at,
       CAST(source.id AS TEXT)
FROM commendations source
INNER JOIN _commendations_id_map map ON map.old_id = source.id;
INSERT INTO _business_leaf_uuid_primary_key_validation
SELECT 'commendations',
       (SELECT count(*) FROM commendations),
       (SELECT count(*) FROM "__new_commendations"),
       0,
       (SELECT count(*) FROM "__new_commendations" WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'commendation' AND revision = 1);
DROP TABLE commendations;
ALTER TABLE "__new_commendations" RENAME TO commendations;
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

-- disciplinary_actions
CREATE TABLE "__new_disciplinary_actions" (
  id TEXT PRIMARY KEY NOT NULL,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  kind TEXT NOT NULL,
  summary TEXT NOT NULL,
  decided_on TEXT NOT NULL,
  created_at TEXT NOT NULL,
  legacy_id TEXT UNIQUE,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO "__new_disciplinary_actions" (id, employee_id, kind, summary, decided_on, created_at, legacy_id)
SELECT map.new_id,
       source.employee_id,
       source.kind,
       source.summary,
       source.decided_on,
       source.created_at,
       CAST(source.id AS TEXT)
FROM disciplinary_actions source
INNER JOIN _disciplinary_actions_id_map map ON map.old_id = source.id;
INSERT INTO _business_leaf_uuid_primary_key_validation
SELECT 'disciplinary_actions',
       (SELECT count(*) FROM disciplinary_actions),
       (SELECT count(*) FROM "__new_disciplinary_actions"),
       0,
       (SELECT count(*) FROM "__new_disciplinary_actions" WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'disciplinary-action' AND revision = 1);
DROP TABLE disciplinary_actions;
ALTER TABLE "__new_disciplinary_actions" RENAME TO disciplinary_actions;
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

-- work_accidents
CREATE TABLE "__new_work_accidents" (
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
INSERT INTO "__new_work_accidents" (id, occurred_on, employee_id, location, summary, severity, status, created_at, legacy_id)
SELECT map.new_id,
       source.occurred_on,
       source.employee_id,
       source.location,
       source.summary,
       source.severity,
       source.status,
       source.created_at,
       CAST(source.id AS TEXT)
FROM work_accidents source
INNER JOIN _work_accidents_id_map map ON map.old_id = source.id;
INSERT INTO _business_leaf_uuid_primary_key_validation
SELECT 'work_accidents',
       (SELECT count(*) FROM work_accidents),
       (SELECT count(*) FROM "__new_work_accidents"),
       0,
       (SELECT count(*) FROM "__new_work_accidents" WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'work-accident' AND revision = 1);
DROP TABLE work_accidents;
ALTER TABLE "__new_work_accidents" RENAME TO work_accidents;
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

-- health_checkups
CREATE TABLE "__new_health_checkups" (
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
INSERT INTO "__new_health_checkups" (id, employee_id, fiscal_year, checkup_kind, conducted_on, status, note, created_at, legacy_id)
SELECT map.new_id,
       source.employee_id,
       source.fiscal_year,
       source.checkup_kind,
       source.conducted_on,
       source.status,
       source.note,
       source.created_at,
       CAST(source.id AS TEXT)
FROM health_checkups source
INNER JOIN _health_checkups_id_map map ON map.old_id = source.id;
INSERT INTO _business_leaf_uuid_primary_key_validation
SELECT 'health_checkups',
       (SELECT count(*) FROM health_checkups),
       (SELECT count(*) FROM "__new_health_checkups"),
       0,
       (SELECT count(*) FROM "__new_health_checkups" WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'health-checkup' AND revision = 1);
DROP TABLE health_checkups;
ALTER TABLE "__new_health_checkups" RENAME TO health_checkups;
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

-- it_incidents
CREATE TABLE "__new_it_incidents" (
  id TEXT PRIMARY KEY NOT NULL,
  occurred_at TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  severity TEXT,
  status TEXT NOT NULL,
  resolved_at TEXT,
  created_at TEXT NOT NULL,
  legacy_id TEXT UNIQUE,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO "__new_it_incidents" (id, occurred_at, title, summary, severity, status, resolved_at, created_at, legacy_id)
SELECT map.new_id,
       source.occurred_at,
       source.title,
       source.summary,
       source.severity,
       source.status,
       source.resolved_at,
       source.created_at,
       CAST(source.id AS TEXT)
FROM it_incidents source
INNER JOIN _it_incidents_id_map map ON map.old_id = source.id;
INSERT INTO _business_leaf_uuid_primary_key_validation
SELECT 'it_incidents',
       (SELECT count(*) FROM it_incidents),
       (SELECT count(*) FROM "__new_it_incidents"),
       0,
       (SELECT count(*) FROM "__new_it_incidents" WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'it-incident' AND revision = 1);
DROP TABLE it_incidents;
ALTER TABLE "__new_it_incidents" RENAME TO it_incidents;
CREATE INDEX idx_it_incidents_occurred_at ON it_incidents (occurred_at);
CREATE TRIGGER it_incidents_source_freeze_delete
BEFORE DELETE ON it_incidents
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'it-incident' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'it_incident_record_source_frozen'); END;
CREATE TRIGGER it_incidents_source_freeze_insert
BEFORE INSERT ON it_incidents
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'it-incident' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'it_incident_record_source_frozen'); END;
CREATE TRIGGER it_incidents_source_freeze_update
BEFORE UPDATE ON it_incidents
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'it-incident' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'it_incident_record_source_frozen'); END;
CREATE TRIGGER it_incidents_legacy_id_insert
BEFORE INSERT ON it_incidents
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER it_incidents_identity_update
BEFORE UPDATE OF id, legacy_id ON it_incidents
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- headcount_plans
CREATE TABLE "__new_headcount_plans" (
  id TEXT PRIMARY KEY NOT NULL,
  fiscal_year INTEGER NOT NULL,
  department_code TEXT,
  planned_count INTEGER NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  legacy_id TEXT UNIQUE,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO "__new_headcount_plans" (id, fiscal_year, department_code, planned_count, note, created_at, legacy_id)
SELECT map.new_id,
       source.fiscal_year,
       source.department_code,
       source.planned_count,
       source.note,
       source.created_at,
       CAST(source.id AS TEXT)
FROM headcount_plans source
INNER JOIN _headcount_plans_id_map map ON map.old_id = source.id;
INSERT INTO _business_leaf_uuid_primary_key_validation
SELECT 'headcount_plans',
       (SELECT count(*) FROM headcount_plans),
       (SELECT count(*) FROM "__new_headcount_plans"),
       0,
       (SELECT count(*) FROM "__new_headcount_plans" WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'headcount-plan' AND revision = 1);
DROP TABLE headcount_plans;
ALTER TABLE "__new_headcount_plans" RENAME TO headcount_plans;
CREATE UNIQUE INDEX uq_headcount_plans_year_department
  ON headcount_plans (fiscal_year, department_code);
CREATE TRIGGER headcount_plans_source_freeze_delete
BEFORE DELETE ON headcount_plans
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'headcount-plan' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'headcount_plan_record_source_frozen'); END;
CREATE TRIGGER headcount_plans_source_freeze_insert
BEFORE INSERT ON headcount_plans
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'headcount-plan' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'headcount_plan_record_source_frozen'); END;
CREATE TRIGGER headcount_plans_source_freeze_update
BEFORE UPDATE ON headcount_plans
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'headcount-plan' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'headcount_plan_record_source_frozen'); END;
CREATE TRIGGER headcount_plans_legacy_id_insert
BEFORE INSERT ON headcount_plans
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER headcount_plans_identity_update
BEFORE UPDATE OF id, legacy_id ON headcount_plans
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- employee_work_styles
CREATE TABLE "__new_employee_work_styles" (
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
INSERT INTO "__new_employee_work_styles" (id, employee_id, style, starts_on, ends_on, note, created_at, legacy_id)
SELECT map.new_id,
       source.employee_id,
       source.style,
       source.starts_on,
       source.ends_on,
       source.note,
       source.created_at,
       CAST(source.id AS TEXT)
FROM employee_work_styles source
INNER JOIN _employee_work_styles_id_map map ON map.old_id = source.id;
INSERT INTO _business_leaf_uuid_primary_key_validation
SELECT 'employee_work_styles',
       (SELECT count(*) FROM employee_work_styles),
       (SELECT count(*) FROM "__new_employee_work_styles"),
       0,
       (SELECT count(*) FROM "__new_employee_work_styles" WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'work-style' AND revision = 1);
DROP TABLE employee_work_styles;
ALTER TABLE "__new_employee_work_styles" RENAME TO employee_work_styles;
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

-- salary_revisions
CREATE TABLE "__new_salary_revisions" (
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
INSERT INTO "__new_salary_revisions" (id, employee_id, effective_date, previous_base_salary, new_base_salary, reason, created_at, legacy_id)
SELECT map.new_id,
       source.employee_id,
       source.effective_date,
       source.previous_base_salary,
       source.new_base_salary,
       source.reason,
       source.created_at,
       CAST(source.id AS TEXT)
FROM salary_revisions source
INNER JOIN _salary_revisions_id_map map ON map.old_id = source.id;
INSERT INTO _business_leaf_uuid_primary_key_validation
SELECT 'salary_revisions',
       (SELECT count(*) FROM salary_revisions),
       (SELECT count(*) FROM "__new_salary_revisions"),
       0,
       (SELECT count(*) FROM "__new_salary_revisions" WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'compensation-change' AND revision = 1);
DROP TABLE salary_revisions;
ALTER TABLE "__new_salary_revisions" RENAME TO salary_revisions;
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

-- company_calendar_days
CREATE TABLE "__new_company_calendar_days" (
  id TEXT PRIMARY KEY NOT NULL,
  calendar_date TEXT NOT NULL,
  kind TEXT NOT NULL,
  name TEXT,
  created_at TEXT NOT NULL,
  legacy_id TEXT UNIQUE,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO "__new_company_calendar_days" (id, calendar_date, kind, name, created_at, legacy_id)
SELECT map.new_id,
       source.calendar_date,
       source.kind,
       source.name,
       source.created_at,
       CAST(source.id AS TEXT)
FROM company_calendar_days source
INNER JOIN _company_calendar_days_id_map map ON map.old_id = source.id;
INSERT INTO _business_leaf_uuid_primary_key_validation
SELECT 'company_calendar_days',
       (SELECT count(*) FROM company_calendar_days),
       (SELECT count(*) FROM "__new_company_calendar_days"),
       0,
       (SELECT count(*) FROM "__new_company_calendar_days" WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'company-calendar' AND revision = 1);
DROP TABLE company_calendar_days;
ALTER TABLE "__new_company_calendar_days" RENAME TO company_calendar_days;
CREATE UNIQUE INDEX uq_company_calendar_days_date ON company_calendar_days (calendar_date);
CREATE TRIGGER company_calendar_days_source_freeze_delete
BEFORE DELETE ON company_calendar_days
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'company-calendar' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'company_calendar_record_source_frozen'); END;
CREATE TRIGGER company_calendar_days_source_freeze_insert
BEFORE INSERT ON company_calendar_days
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'company-calendar' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'company_calendar_record_source_frozen'); END;
CREATE TRIGGER company_calendar_days_source_freeze_update
BEFORE UPDATE ON company_calendar_days
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'company-calendar' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'company_calendar_record_source_frozen'); END;
CREATE TRIGGER company_calendar_days_legacy_id_insert
BEFORE INSERT ON company_calendar_days
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER company_calendar_days_identity_update
BEFORE UPDATE OF id, legacy_id ON company_calendar_days
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- document_ledger_entries
CREATE TABLE "__new_document_ledger_entries" (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  category TEXT,
  location TEXT NOT NULL,
  counterparty_reference TEXT,
  expires_on TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  legacy_id TEXT UNIQUE,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO "__new_document_ledger_entries" (id, title, category, location, counterparty_reference, expires_on, note, created_at, legacy_id)
SELECT map.new_id,
       source.title,
       source.category,
       source.location,
       source.counterparty_reference,
       source.expires_on,
       source.note,
       source.created_at,
       CAST(source.id AS TEXT)
FROM document_ledger_entries source
INNER JOIN _document_ledger_entries_id_map map ON map.old_id = source.id;
INSERT INTO _business_leaf_uuid_primary_key_validation
SELECT 'document_ledger_entries',
       (SELECT count(*) FROM document_ledger_entries),
       (SELECT count(*) FROM "__new_document_ledger_entries"),
       0,
       (SELECT count(*) FROM "__new_document_ledger_entries" WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'document' AND revision = 1);
DROP TABLE document_ledger_entries;
ALTER TABLE "__new_document_ledger_entries" RENAME TO document_ledger_entries;
CREATE INDEX idx_documents_expires_on ON "document_ledger_entries" (expires_on);
CREATE TRIGGER document_ledger_entries_source_freeze_delete
BEFORE DELETE ON document_ledger_entries
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'document' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'document_record_source_frozen');
END;
CREATE TRIGGER document_ledger_entries_source_freeze_insert
BEFORE INSERT ON document_ledger_entries
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'document' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'document_record_source_frozen');
END;
CREATE TRIGGER document_ledger_entries_source_freeze_update
BEFORE UPDATE ON document_ledger_entries
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'document' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'document_record_source_frozen');
END;
CREATE TRIGGER document_ledger_entries_legacy_id_insert
BEFORE INSERT ON document_ledger_entries
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER document_ledger_entries_identity_update
BEFORE UPDATE OF id, legacy_id ON document_ledger_entries
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

DROP TABLE _commendations_id_map;
DROP TABLE _disciplinary_actions_id_map;
DROP TABLE _work_accidents_id_map;
DROP TABLE _health_checkups_id_map;
DROP TABLE _it_incidents_id_map;
DROP TABLE _headcount_plans_id_map;
DROP TABLE _employee_work_styles_id_map;
DROP TABLE _salary_revisions_id_map;
DROP TABLE _company_calendar_days_id_map;
DROP TABLE _document_ledger_entries_id_map;
DROP TABLE _business_leaf_uuid_primary_key_validation;
