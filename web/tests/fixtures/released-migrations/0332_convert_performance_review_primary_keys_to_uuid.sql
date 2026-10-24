-- 評価（performance-review）の table を UUID の主キーへ移す (Issue )。
--
-- 対象: review_cycles, review_cycle_policies, review_forms, evaluation_templates, evaluation_sheets,
-- evaluation_sheet_audit_logs, performance_goals, goal_evaluations
--
-- 各行に v4 の UUID を割り当て、旧来の整数の主キーは同じ行の legacy_id（TEXT、UNIQUE）に残す。
-- System の監査・保全・撤去の証跡は書き換えず、証跡が指す旧 ID は legacy_id で現在の行へ辿る。
--
-- 外部キーの無い同じ業務内の参照（review_forms.cycle_id、evaluation_sheets.template_id、
-- evaluation_sheet_audit_logs.sheet_id、performance_goals.parent_goal_id、performance_goals.evaluation_sheet_id、
-- goal_evaluations.goal_id）は、参照先の新しい UUID へ書き換える。評価シートの操作履歴は評価シートを
-- sheet_id で引くため、履歴の行も新しい主キーを指す。移行前から参照先を持たない値は旧 ID の文字列のまま残し、
-- 参照先を持たない行が移行で増えないことを検証表で確かめる。
--
-- review_cycle_policies は評価期間の 1:1 の拡張で、主キーの cycle_id は評価期間の主キーそのものである。
-- 評価期間の新しい UUID へ置き換え、UUID の CHECK を課す。旧 ID は評価期間の legacy_id が保持する。
--
-- review_cycles、review_forms、performance_goals は作成日時を持たず、整数の主キーの順を作成順として
-- 並べていた。UUID は順序を持たないため created_at を足す。既存行の作成日時は不明なので移行時刻を入れ、
-- 同じ時刻の行は legacy_id の数値順で旧来の並びを保つ。
--
-- 所有業務が撤去の停止中なら検証表の CHECK で止める。index と trigger は作り直す前の定義から復元する。
--
-- ALTER TABLE RENAME は trigger を含む全 schema を解析し直し、table ごとに数十 ms かかる。
-- 名前を変えずに行を退避し、同じ名前で作り直してから戻す。

CREATE TABLE _performance_review_uuid_primary_key_validation (
  resource TEXT PRIMARY KEY NOT NULL,
  source_count INTEGER NOT NULL,
  target_count INTEGER NOT NULL,
  orphan_count INTEGER NOT NULL,
  non_uuid_count INTEGER NOT NULL,
  blocked_count INTEGER NOT NULL,
  CHECK (source_count = target_count AND orphan_count = 0 AND non_uuid_count = 0 AND blocked_count = 0)
);

-- review_cycles
CREATE TABLE _review_cycles_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _review_cycles_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM review_cycles;

-- review_forms
CREATE TABLE _review_forms_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _review_forms_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM review_forms;

-- evaluation_templates
CREATE TABLE _evaluation_templates_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _evaluation_templates_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM evaluation_templates;

-- evaluation_sheets
CREATE TABLE _evaluation_sheets_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _evaluation_sheets_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM evaluation_sheets;

-- evaluation_sheet_audit_logs
CREATE TABLE _evaluation_sheet_audit_logs_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _evaluation_sheet_audit_logs_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM evaluation_sheet_audit_logs;

-- performance_goals
CREATE TABLE _performance_goals_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _performance_goals_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM performance_goals;

-- goal_evaluations
CREATE TABLE _goal_evaluations_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _goal_evaluations_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM goal_evaluations;

-- 外部キーの無い参照が移行前から指す先を持たない行の数。移行で増えないことを最後に確かめる。
CREATE TABLE _uuid_reference_orphans (
  resource TEXT PRIMARY KEY NOT NULL,
  orphan_count INTEGER NOT NULL
);
INSERT INTO _uuid_reference_orphans VALUES ('review_forms.cycle_id', (SELECT count(*) FROM review_forms child WHERE child.cycle_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM review_cycles parent WHERE parent.id = child.cycle_id)));
INSERT INTO _uuid_reference_orphans VALUES ('evaluation_sheets.template_id', (SELECT count(*) FROM evaluation_sheets child WHERE child.template_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM evaluation_templates parent WHERE parent.id = child.template_id)));
INSERT INTO _uuid_reference_orphans VALUES ('evaluation_sheet_audit_logs.sheet_id', (SELECT count(*) FROM evaluation_sheet_audit_logs child WHERE child.sheet_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM evaluation_sheets parent WHERE parent.id = child.sheet_id)));
INSERT INTO _uuid_reference_orphans VALUES ('performance_goals.parent_goal_id', (SELECT count(*) FROM performance_goals child WHERE child.parent_goal_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM performance_goals parent WHERE parent.id = child.parent_goal_id)));
INSERT INTO _uuid_reference_orphans VALUES ('performance_goals.evaluation_sheet_id', (SELECT count(*) FROM performance_goals child WHERE child.evaluation_sheet_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM evaluation_sheets parent WHERE parent.id = child.evaluation_sheet_id)));
INSERT INTO _uuid_reference_orphans VALUES ('goal_evaluations.goal_id', (SELECT count(*) FROM goal_evaluations child WHERE child.goal_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM performance_goals parent WHERE parent.id = child.goal_id)));

-- review_cycles
CREATE TABLE "_stage_review_cycles" AS SELECT * FROM review_cycles;
DROP TABLE review_cycles;
CREATE TABLE review_cycles (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  legacy_id TEXT UNIQUE,
  title TEXT NOT NULL,
  period TEXT NOT NULL,
  status TEXT NOT NULL,
  due_date TEXT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO review_cycles (id, title, period, status, due_date, legacy_id, created_at)
SELECT map.new_id,
       source.title,
       source.period,
       source.status,
       source.due_date,
       CAST(source.id AS TEXT),
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM "_stage_review_cycles" source
INNER JOIN _review_cycles_id_map map ON map.old_id = source.id;
INSERT INTO _performance_review_uuid_primary_key_validation
SELECT 'review_cycles',
       (SELECT count(*) FROM "_stage_review_cycles"),
       (SELECT count(*) FROM review_cycles),
       0,
       (SELECT count(*) FROM review_cycles WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1);
DROP TABLE "_stage_review_cycles";
CREATE INDEX idx_review_cycles_status ON review_cycles (status);
CREATE TRIGGER review_cycles_source_freeze_delete BEFORE DELETE ON review_cycles
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;
CREATE TRIGGER review_cycles_source_freeze_insert BEFORE INSERT ON review_cycles
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;
CREATE TRIGGER review_cycles_source_freeze_update BEFORE UPDATE ON review_cycles
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;
CREATE TRIGGER review_cycles_legacy_id_insert
BEFORE INSERT ON review_cycles
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER review_cycles_identity_update
BEFORE UPDATE OF id, legacy_id ON review_cycles
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- review_forms
CREATE TABLE "_stage_review_forms" AS SELECT * FROM review_forms;
DROP TABLE review_forms;
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
INSERT INTO review_forms (id, cycle_id, subject_employee_id, reviewer_employee_id, reviewer_type, answers, score, status, submitted_at, comment, visibility, legacy_id, created_at)
SELECT map.new_id,
       CASE WHEN source.cycle_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _review_cycles_id_map ref WHERE ref.old_id = source.cycle_id), CAST(source.cycle_id AS TEXT)) END,
       source.subject_employee_id,
       source.reviewer_employee_id,
       source.reviewer_type,
       source.answers,
       source.score,
       source.status,
       source.submitted_at,
       source.comment,
       source.visibility,
       CAST(source.id AS TEXT),
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM "_stage_review_forms" source
INNER JOIN _review_forms_id_map map ON map.old_id = source.id;
INSERT INTO _performance_review_uuid_primary_key_validation
SELECT 'review_forms',
       (SELECT count(*) FROM "_stage_review_forms"),
       (SELECT count(*) FROM review_forms),
       0,
       (SELECT count(*) FROM review_forms WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1);
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

-- evaluation_templates
CREATE TABLE "_stage_evaluation_templates" AS SELECT * FROM evaluation_templates;
DROP TABLE evaluation_templates;
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
INSERT INTO evaluation_templates (id, title, period, items, status, created_by, created_at, updated_at, legacy_id)
SELECT map.new_id,
       source.title,
       source.period,
       source.items,
       source.status,
       source.created_by,
       source.created_at,
       source.updated_at,
       CAST(source.id AS TEXT)
FROM "_stage_evaluation_templates" source
INNER JOIN _evaluation_templates_id_map map ON map.old_id = source.id;
INSERT INTO _performance_review_uuid_primary_key_validation
SELECT 'evaluation_templates',
       (SELECT count(*) FROM "_stage_evaluation_templates"),
       (SELECT count(*) FROM evaluation_templates),
       0,
       (SELECT count(*) FROM evaluation_templates WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1);
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

-- evaluation_sheets
CREATE TABLE "_stage_evaluation_sheets" AS SELECT * FROM evaluation_sheets;
DROP TABLE evaluation_sheets;
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
INSERT INTO evaluation_sheets (id, employee_id, template_id, period, status, primary_evaluator_id, secondary_evaluator_id, submitted_at, approved_at, finalized_at, created_at, updated_at, revision, legacy_id)
SELECT map.new_id,
       source.employee_id,
       CASE WHEN source.template_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _evaluation_templates_id_map ref WHERE ref.old_id = source.template_id), CAST(source.template_id AS TEXT)) END,
       source.period,
       source.status,
       source.primary_evaluator_id,
       source.secondary_evaluator_id,
       source.submitted_at,
       source.approved_at,
       source.finalized_at,
       source.created_at,
       source.updated_at,
       source.revision,
       CAST(source.id AS TEXT)
FROM "_stage_evaluation_sheets" source
INNER JOIN _evaluation_sheets_id_map map ON map.old_id = source.id;
INSERT INTO _performance_review_uuid_primary_key_validation
SELECT 'evaluation_sheets',
       (SELECT count(*) FROM "_stage_evaluation_sheets"),
       (SELECT count(*) FROM evaluation_sheets),
       0,
       (SELECT count(*) FROM evaluation_sheets WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1);
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

-- evaluation_sheet_audit_logs
CREATE TABLE "_stage_evaluation_sheet_audit_logs" AS SELECT * FROM evaluation_sheet_audit_logs;
DROP TABLE evaluation_sheet_audit_logs;
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
INSERT INTO evaluation_sheet_audit_logs (id, sheet_id, actor_id, action, from_value, to_value, note, created_at, legacy_id)
SELECT map.new_id,
       CASE WHEN source.sheet_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _evaluation_sheets_id_map ref WHERE ref.old_id = source.sheet_id), CAST(source.sheet_id AS TEXT)) END,
       source.actor_id,
       source.action,
       source.from_value,
       source.to_value,
       source.note,
       source.created_at,
       CAST(source.id AS TEXT)
FROM "_stage_evaluation_sheet_audit_logs" source
INNER JOIN _evaluation_sheet_audit_logs_id_map map ON map.old_id = source.id;
INSERT INTO _performance_review_uuid_primary_key_validation
SELECT 'evaluation_sheet_audit_logs',
       (SELECT count(*) FROM "_stage_evaluation_sheet_audit_logs"),
       (SELECT count(*) FROM evaluation_sheet_audit_logs),
       0,
       (SELECT count(*) FROM evaluation_sheet_audit_logs WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1);
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

-- performance_goals
CREATE TABLE "_stage_performance_goals" AS SELECT * FROM performance_goals;
DROP TABLE performance_goals;
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
INSERT INTO performance_goals (id, employee_id, period, title, kpi, weight, status, owner_type, parent_goal_id, department_code, evaluation_sheet_id, legacy_id, created_at)
SELECT map.new_id,
       source.employee_id,
       source.period,
       source.title,
       source.kpi,
       source.weight,
       source.status,
       source.owner_type,
       CASE WHEN source.parent_goal_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _performance_goals_id_map ref WHERE ref.old_id = source.parent_goal_id), CAST(source.parent_goal_id AS TEXT)) END,
       source.department_code,
       CASE WHEN source.evaluation_sheet_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _evaluation_sheets_id_map ref WHERE ref.old_id = source.evaluation_sheet_id), CAST(source.evaluation_sheet_id AS TEXT)) END,
       CAST(source.id AS TEXT),
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM "_stage_performance_goals" source
INNER JOIN _performance_goals_id_map map ON map.old_id = source.id;
INSERT INTO _performance_review_uuid_primary_key_validation
SELECT 'performance_goals',
       (SELECT count(*) FROM "_stage_performance_goals"),
       (SELECT count(*) FROM performance_goals),
       0,
       (SELECT count(*) FROM performance_goals WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1);
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

-- goal_evaluations
CREATE TABLE "_stage_goal_evaluations" AS SELECT * FROM goal_evaluations;
DROP TABLE goal_evaluations;
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
INSERT INTO goal_evaluations (id, goal_id, evaluator_id, kind, score, comment, created_at, legacy_id)
SELECT map.new_id,
       CASE WHEN source.goal_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _performance_goals_id_map ref WHERE ref.old_id = source.goal_id), CAST(source.goal_id AS TEXT)) END,
       source.evaluator_id,
       source.kind,
       source.score,
       source.comment,
       source.created_at,
       CAST(source.id AS TEXT)
FROM "_stage_goal_evaluations" source
INNER JOIN _goal_evaluations_id_map map ON map.old_id = source.id;
INSERT INTO _performance_review_uuid_primary_key_validation
SELECT 'goal_evaluations',
       (SELECT count(*) FROM "_stage_goal_evaluations"),
       (SELECT count(*) FROM goal_evaluations),
       0,
       (SELECT count(*) FROM goal_evaluations WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1);
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

INSERT INTO _performance_review_uuid_primary_key_validation
SELECT 'review_forms.cycle_id', orphan_count, (SELECT count(*) FROM review_forms child WHERE child.cycle_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM review_cycles parent WHERE parent.id = child.cycle_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'review_forms.cycle_id';
INSERT INTO _performance_review_uuid_primary_key_validation
SELECT 'evaluation_sheets.template_id', orphan_count, (SELECT count(*) FROM evaluation_sheets child WHERE child.template_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM evaluation_templates parent WHERE parent.id = child.template_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'evaluation_sheets.template_id';
INSERT INTO _performance_review_uuid_primary_key_validation
SELECT 'evaluation_sheet_audit_logs.sheet_id', orphan_count, (SELECT count(*) FROM evaluation_sheet_audit_logs child WHERE child.sheet_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM evaluation_sheets parent WHERE parent.id = child.sheet_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'evaluation_sheet_audit_logs.sheet_id';
INSERT INTO _performance_review_uuid_primary_key_validation
SELECT 'performance_goals.parent_goal_id', orphan_count, (SELECT count(*) FROM performance_goals child WHERE child.parent_goal_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM performance_goals parent WHERE parent.id = child.parent_goal_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'performance_goals.parent_goal_id';
INSERT INTO _performance_review_uuid_primary_key_validation
SELECT 'performance_goals.evaluation_sheet_id', orphan_count, (SELECT count(*) FROM performance_goals child WHERE child.evaluation_sheet_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM evaluation_sheets parent WHERE parent.id = child.evaluation_sheet_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'performance_goals.evaluation_sheet_id';
INSERT INTO _performance_review_uuid_primary_key_validation
SELECT 'goal_evaluations.goal_id', orphan_count, (SELECT count(*) FROM goal_evaluations child WHERE child.goal_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM performance_goals parent WHERE parent.id = child.goal_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'goal_evaluations.goal_id';
DROP TABLE _uuid_reference_orphans;

-- review_cycle_policies: 主キーの cycle_id を評価期間の新しい UUID へ置き換える。
-- 評価期間を持たない方針は旧 ID の文字列を残せず UUID の CHECK に当たるため、移行前に無いことを確かめる。
INSERT INTO _performance_review_uuid_primary_key_validation
SELECT 'review_cycle_policies.cycle_id', 0, 0,
       (SELECT count(*) FROM review_cycle_policies policy
        WHERE NOT EXISTS (SELECT 1 FROM _review_cycles_id_map map WHERE map.old_id = policy.cycle_id)),
       0, 0;
CREATE TABLE "_stage_review_cycle_policies" AS SELECT * FROM review_cycle_policies;
DROP TABLE review_cycle_policies;
CREATE TABLE review_cycle_policies (
  cycle_id TEXT PRIMARY KEY NOT NULL,
  policy_json TEXT NOT NULL,
  CHECK (length(cycle_id) = 36 AND cycle_id NOT GLOB '*[^0-9a-f-]*' AND substr(cycle_id, 9, 1) = '-' AND substr(cycle_id, 14, 1) = '-' AND substr(cycle_id, 19, 1) = '-' AND substr(cycle_id, 24, 1) = '-' AND length(replace(cycle_id, '-', '')) = 32 AND substr(cycle_id, 15, 1) GLOB '[1-8]' AND substr(cycle_id, 20, 1) GLOB '[89ab]')
);
INSERT INTO review_cycle_policies (cycle_id, policy_json)
SELECT map.new_id, policy.policy_json
FROM "_stage_review_cycle_policies" policy
INNER JOIN _review_cycles_id_map map ON map.old_id = policy.cycle_id;
INSERT INTO _performance_review_uuid_primary_key_validation
SELECT 'review_cycle_policies',
       (SELECT count(*) FROM "_stage_review_cycle_policies"),
       (SELECT count(*) FROM review_cycle_policies),
       0, 0, 0;
DROP TABLE "_stage_review_cycle_policies";
CREATE TRIGGER review_cycle_policies_source_freeze_delete BEFORE DELETE ON review_cycle_policies
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;
CREATE TRIGGER review_cycle_policies_source_freeze_insert BEFORE INSERT ON review_cycle_policies
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;
CREATE TRIGGER review_cycle_policies_source_freeze_update BEFORE UPDATE ON review_cycle_policies
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;

DROP TABLE _review_cycles_id_map;
DROP TABLE _review_forms_id_map;
DROP TABLE _evaluation_templates_id_map;
DROP TABLE _evaluation_sheets_id_map;
DROP TABLE _evaluation_sheet_audit_logs_id_map;
DROP TABLE _performance_goals_id_map;
DROP TABLE _goal_evaluations_id_map;
DROP TABLE _performance_review_uuid_primary_key_validation;
