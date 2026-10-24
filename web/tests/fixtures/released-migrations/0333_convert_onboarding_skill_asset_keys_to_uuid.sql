-- 入社・退社手続き（onboarding）、スキル（skill）、資産（asset）の残りの table を UUID の主キーへ移す (Issue )。
--
-- 対象:
-- - 整数の主キー: onboarding_templates, onboarding_assignments, onboarding_tasks
-- - 業務コードや複合の主キー: onboarding_template_tasks, onboarding_lifecycle_template_bindings,
--   skill_definitions, employee_skills, assets, stocktake_items
-- - System の job の 1:1 の拡張: onboarding_lifecycle_deliveries
--
-- 整数の主キーは v4 の UUID に置き換え、旧来の整数の主キーを同じ行の legacy_id（TEXT、UNIQUE）に残す。
-- 業務コード（テンプレートコード、スキルコード、資産コード、効果種別）と複合の主キーは主キーから外し、
-- 一意な属性として残したまま、新しい UUID の id を主キーにする。業務コードによる参照
-- （template_code、template_task_code、skill_code、asset_code）は書き換えない。業務コードは変わらず、
-- 保全の元 ID も業務コードのまま使う。
--
-- onboarding_tasks.assignment_id（外部キーなし）と onboarding_lifecycle_deliveries.assignment_id（外部キーあり）は
-- 割当の新しい UUID へ書き換える。onboarding_lifecycle_deliveries の主キー job_id は System の job の ID で、
-- 値を変えずに UUID の CHECK を課す。
--
-- 外部キーで参照される table を参照元より先に落とさないよう、退避と削除は参照元から、作り直しは参照先から行う。
-- 所有業務が撤去の停止中なら検証表の CHECK で止める。index と trigger は作り直す前の定義から復元する。
--
-- ALTER TABLE RENAME は trigger を含む全 schema を解析し直し、table ごとに数十 ms かかる。
-- 名前を変えずに行を退避し、同じ名前で作り直してから戻す。

CREATE TABLE _business_uuid_primary_key_stage6_validation (
  resource TEXT PRIMARY KEY NOT NULL,
  source_count INTEGER NOT NULL,
  target_count INTEGER NOT NULL,
  orphan_count INTEGER NOT NULL,
  non_uuid_count INTEGER NOT NULL,
  blocked_count INTEGER NOT NULL,
  CHECK (source_count = target_count AND orphan_count = 0 AND non_uuid_count = 0 AND blocked_count = 0)
);

-- onboarding_templates
CREATE TABLE _onboarding_templates_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _onboarding_templates_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM onboarding_templates;

-- onboarding_assignments
CREATE TABLE _onboarding_assignments_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _onboarding_assignments_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM onboarding_assignments;

-- onboarding_tasks
CREATE TABLE _onboarding_tasks_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _onboarding_tasks_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM onboarding_tasks;

-- 外部キーの無い参照が移行前から指す先を持たない行の数。移行で増えないことを最後に確かめる。
CREATE TABLE _uuid_reference_orphans (
  resource TEXT PRIMARY KEY NOT NULL,
  orphan_count INTEGER NOT NULL
);
INSERT INTO _uuid_reference_orphans VALUES ('onboarding_tasks.assignment_id', (SELECT count(*) FROM onboarding_tasks child WHERE child.assignment_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM onboarding_assignments parent WHERE parent.id = child.assignment_id)));
INSERT INTO _uuid_reference_orphans VALUES ('onboarding_lifecycle_deliveries.assignment_id', (SELECT count(*) FROM onboarding_lifecycle_deliveries child WHERE child.assignment_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM onboarding_assignments parent WHERE parent.id = child.assignment_id)));

-- 参照元から順に行を退避して table を削除する。
CREATE TABLE "_stage_stocktake_items" AS SELECT * FROM stocktake_items;
DROP TABLE stocktake_items;
CREATE TABLE "_stage_assets" AS SELECT * FROM assets;
DROP TABLE assets;
CREATE TABLE "_stage_employee_skills" AS SELECT * FROM employee_skills;
DROP TABLE employee_skills;
CREATE TABLE "_stage_skill_definitions" AS SELECT * FROM skill_definitions;
DROP TABLE skill_definitions;
CREATE TABLE "_stage_onboarding_lifecycle_template_bindings" AS SELECT * FROM onboarding_lifecycle_template_bindings;
DROP TABLE onboarding_lifecycle_template_bindings;
CREATE TABLE "_stage_onboarding_lifecycle_deliveries" AS SELECT * FROM onboarding_lifecycle_deliveries;
DROP TABLE onboarding_lifecycle_deliveries;
CREATE TABLE "_stage_onboarding_tasks" AS SELECT * FROM onboarding_tasks;
DROP TABLE onboarding_tasks;
CREATE TABLE "_stage_onboarding_assignments" AS SELECT * FROM onboarding_assignments;
DROP TABLE onboarding_assignments;
CREATE TABLE "_stage_onboarding_template_tasks" AS SELECT * FROM onboarding_template_tasks;
DROP TABLE onboarding_template_tasks;
CREATE TABLE "_stage_onboarding_templates" AS SELECT * FROM onboarding_templates;
DROP TABLE onboarding_templates;

-- onboarding_templates
CREATE TABLE onboarding_templates (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  description TEXT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO onboarding_templates (id, code, name, kind, description, legacy_id)
SELECT map.new_id,
       source.code,
       source.name,
       source.kind,
       source.description,
       CAST(source.id AS TEXT)
FROM "_stage_onboarding_templates" source
INNER JOIN _onboarding_templates_id_map map ON map.old_id = source.id;
INSERT INTO _business_uuid_primary_key_stage6_validation
SELECT 'onboarding_templates',
       (SELECT count(*) FROM "_stage_onboarding_templates"),
       (SELECT count(*) FROM onboarding_templates),
       0,
       (SELECT count(*) FROM onboarding_templates WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1);
DROP TABLE "_stage_onboarding_templates";
CREATE INDEX idx_onboarding_templates_kind ON onboarding_templates (kind);
CREATE TRIGGER onboarding_templates_source_freeze_delete BEFORE DELETE ON onboarding_templates
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'onboarding_record_source_frozen'); END;
CREATE TRIGGER onboarding_templates_source_freeze_insert BEFORE INSERT ON onboarding_templates
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'onboarding_record_source_frozen'); END;
CREATE TRIGGER onboarding_templates_source_freeze_update BEFORE UPDATE ON onboarding_templates
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'onboarding_record_source_frozen'); END;
CREATE TRIGGER onboarding_templates_legacy_id_insert
BEFORE INSERT ON onboarding_templates
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER onboarding_templates_identity_update
BEFORE UPDATE OF id, legacy_id ON onboarding_templates
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- onboarding_template_tasks
CREATE TABLE onboarding_template_tasks (
  id TEXT PRIMARY KEY NOT NULL,
  template_code TEXT NOT NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  owner_role TEXT,
  UNIQUE (template_code, code),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO onboarding_template_tasks (id, template_code, code, title, sort_order, owner_role)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.template_code,
       source.code,
       source.title,
       source.sort_order,
       source.owner_role
FROM "_stage_onboarding_template_tasks" source;
INSERT INTO _business_uuid_primary_key_stage6_validation
SELECT 'onboarding_template_tasks',
       (SELECT count(*) FROM "_stage_onboarding_template_tasks"),
       (SELECT count(*) FROM onboarding_template_tasks),
       0,
       (SELECT count(*) FROM onboarding_template_tasks WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1);
DROP TABLE "_stage_onboarding_template_tasks";
CREATE INDEX idx_onboarding_template_tasks_template ON onboarding_template_tasks (template_code);
CREATE TRIGGER onboarding_template_tasks_source_freeze_delete BEFORE DELETE ON onboarding_template_tasks
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'onboarding_record_source_frozen'); END;
CREATE TRIGGER onboarding_template_tasks_source_freeze_insert BEFORE INSERT ON onboarding_template_tasks
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'onboarding_record_source_frozen'); END;
CREATE TRIGGER onboarding_template_tasks_source_freeze_update BEFORE UPDATE ON onboarding_template_tasks
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'onboarding_record_source_frozen'); END;
CREATE TRIGGER onboarding_template_tasks_identity_update
BEFORE UPDATE OF id ON onboarding_template_tasks
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- onboarding_assignments
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
INSERT INTO onboarding_assignments (id, employee_id, template_code, kind, status, assigned_at, lifecycle_action_id, legacy_id)
SELECT map.new_id,
       source.employee_id,
       source.template_code,
       source.kind,
       source.status,
       source.assigned_at,
       source.lifecycle_action_id,
       CAST(source.id AS TEXT)
FROM "_stage_onboarding_assignments" source
INNER JOIN _onboarding_assignments_id_map map ON map.old_id = source.id;
INSERT INTO _business_uuid_primary_key_stage6_validation
SELECT 'onboarding_assignments',
       (SELECT count(*) FROM "_stage_onboarding_assignments"),
       (SELECT count(*) FROM onboarding_assignments),
       0,
       (SELECT count(*) FROM onboarding_assignments WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1);
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

-- onboarding_tasks
CREATE TABLE onboarding_tasks (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  assignment_id TEXT NOT NULL,
  template_task_code TEXT NOT NULL,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  status TEXT NOT NULL,
  completed_at TEXT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO onboarding_tasks (id, assignment_id, template_task_code, title, sort_order, status, completed_at, legacy_id)
SELECT map.new_id,
       CASE WHEN source.assignment_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _onboarding_assignments_id_map ref WHERE ref.old_id = source.assignment_id), CAST(source.assignment_id AS TEXT)) END,
       source.template_task_code,
       source.title,
       source.sort_order,
       source.status,
       source.completed_at,
       CAST(source.id AS TEXT)
FROM "_stage_onboarding_tasks" source
INNER JOIN _onboarding_tasks_id_map map ON map.old_id = source.id;
INSERT INTO _business_uuid_primary_key_stage6_validation
SELECT 'onboarding_tasks',
       (SELECT count(*) FROM "_stage_onboarding_tasks"),
       (SELECT count(*) FROM onboarding_tasks),
       0,
       (SELECT count(*) FROM onboarding_tasks WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1);
DROP TABLE "_stage_onboarding_tasks";
CREATE INDEX idx_onboarding_tasks_assignment ON onboarding_tasks (assignment_id);
CREATE TRIGGER onboarding_tasks_source_freeze_delete BEFORE DELETE ON onboarding_tasks
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'onboarding_record_source_frozen'); END;
CREATE TRIGGER onboarding_tasks_source_freeze_insert BEFORE INSERT ON onboarding_tasks
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'onboarding_record_source_frozen'); END;
CREATE TRIGGER onboarding_tasks_source_freeze_update BEFORE UPDATE ON onboarding_tasks
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'onboarding_record_source_frozen'); END;
CREATE TRIGGER onboarding_tasks_superseded_insert
BEFORE INSERT ON onboarding_tasks
WHEN (SELECT status FROM onboarding_assignments WHERE id = NEW.assignment_id) = 'superseded'
BEGIN SELECT RAISE(ABORT, 'onboarding_assignment_superseded'); END;
CREATE TRIGGER onboarding_tasks_superseded_no_delete
BEFORE DELETE ON onboarding_tasks
WHEN (SELECT status FROM onboarding_assignments WHERE id = OLD.assignment_id) = 'superseded'
BEGIN SELECT RAISE(ABORT, 'onboarding_assignment_superseded'); END;
CREATE TRIGGER onboarding_tasks_superseded_update
BEFORE UPDATE ON onboarding_tasks
WHEN (SELECT status FROM onboarding_assignments WHERE id = OLD.assignment_id) = 'superseded'
  OR (SELECT status FROM onboarding_assignments WHERE id = NEW.assignment_id) = 'superseded'
BEGIN SELECT RAISE(ABORT, 'onboarding_assignment_superseded'); END;
CREATE TRIGGER onboarding_tasks_legacy_id_insert
BEFORE INSERT ON onboarding_tasks
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER onboarding_tasks_identity_update
BEFORE UPDATE OF id, legacy_id ON onboarding_tasks
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- onboarding_lifecycle_deliveries
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
INSERT INTO onboarding_lifecycle_deliveries (job_id, action_id, created_at, outcome, assignment_id, processed_at)
SELECT source.job_id,
       source.action_id,
       source.created_at,
       source.outcome,
       CASE WHEN source.assignment_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _onboarding_assignments_id_map ref WHERE ref.old_id = source.assignment_id), CAST(source.assignment_id AS TEXT)) END,
       source.processed_at
FROM "_stage_onboarding_lifecycle_deliveries" source;
INSERT INTO _business_uuid_primary_key_stage6_validation
SELECT 'onboarding_lifecycle_deliveries',
       (SELECT count(*) FROM "_stage_onboarding_lifecycle_deliveries"),
       (SELECT count(*) FROM onboarding_lifecycle_deliveries),
       0,
       (SELECT count(*) FROM onboarding_lifecycle_deliveries WHERE NOT (length(job_id) = 36 AND job_id NOT GLOB '*[^0-9a-f-]*' AND substr(job_id, 9, 1) = '-' AND substr(job_id, 14, 1) = '-' AND substr(job_id, 19, 1) = '-' AND substr(job_id, 24, 1) = '-' AND length(replace(job_id, '-', '')) = 32 AND substr(job_id, 15, 1) GLOB '[1-8]' AND substr(job_id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1);
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
INSERT INTO onboarding_lifecycle_template_bindings (id, effect_type, template_code, updated_at, updated_by_account_id)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.effect_type,
       source.template_code,
       source.updated_at,
       source.updated_by_account_id
FROM "_stage_onboarding_lifecycle_template_bindings" source;
INSERT INTO _business_uuid_primary_key_stage6_validation
SELECT 'onboarding_lifecycle_template_bindings',
       (SELECT count(*) FROM "_stage_onboarding_lifecycle_template_bindings"),
       (SELECT count(*) FROM onboarding_lifecycle_template_bindings),
       0,
       (SELECT count(*) FROM onboarding_lifecycle_template_bindings WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1);
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

-- skill_definitions
CREATE TABLE skill_definitions (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO skill_definitions (id, code, name, category)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.code,
       source.name,
       source.category
FROM "_stage_skill_definitions" source;
INSERT INTO _business_uuid_primary_key_stage6_validation
SELECT 'skill_definitions',
       (SELECT count(*) FROM "_stage_skill_definitions"),
       (SELECT count(*) FROM skill_definitions),
       0,
       (SELECT count(*) FROM skill_definitions WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'skill' AND revision = 1);
DROP TABLE "_stage_skill_definitions";
CREATE INDEX idx_skills_category ON "skill_definitions" (category);
CREATE TRIGGER skill_definitions_source_freeze_delete BEFORE DELETE ON skill_definitions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='skill' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'skill_record_source_frozen'); END;
CREATE TRIGGER skill_definitions_source_freeze_insert BEFORE INSERT ON skill_definitions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='skill' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'skill_record_source_frozen'); END;
CREATE TRIGGER skill_definitions_source_freeze_update BEFORE UPDATE ON skill_definitions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='skill' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'skill_record_source_frozen'); END;
CREATE TRIGGER skill_definitions_identity_update
BEFORE UPDATE OF id ON skill_definitions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- employee_skills
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
INSERT INTO employee_skills (id, employee_id, skill_code, level, years, note)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.employee_id,
       source.skill_code,
       source.level,
       source.years,
       source.note
FROM "_stage_employee_skills" source;
INSERT INTO _business_uuid_primary_key_stage6_validation
SELECT 'employee_skills',
       (SELECT count(*) FROM "_stage_employee_skills"),
       (SELECT count(*) FROM employee_skills),
       0,
       (SELECT count(*) FROM employee_skills WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'skill' AND revision = 1);
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

-- assets
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
INSERT INTO assets (id, code, name, kind, serial, purchased_on, status, holder_employee_id, disposed_on, disposal_reason)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.code,
       source.name,
       source.kind,
       source.serial,
       source.purchased_on,
       source.status,
       source.holder_employee_id,
       source.disposed_on,
       source.disposal_reason
FROM "_stage_assets" source;
INSERT INTO _business_uuid_primary_key_stage6_validation
SELECT 'assets',
       (SELECT count(*) FROM "_stage_assets"),
       (SELECT count(*) FROM assets),
       0,
       (SELECT count(*) FROM assets WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'asset' AND revision = 1);
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

-- stocktake_items
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
INSERT INTO stocktake_items (id, stocktake_id, asset_code, checked_at, checker_employee_id, location_note)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.stocktake_id,
       source.asset_code,
       source.checked_at,
       source.checker_employee_id,
       source.location_note
FROM "_stage_stocktake_items" source;
INSERT INTO _business_uuid_primary_key_stage6_validation
SELECT 'stocktake_items',
       (SELECT count(*) FROM "_stage_stocktake_items"),
       (SELECT count(*) FROM stocktake_items),
       0,
       (SELECT count(*) FROM stocktake_items WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'asset' AND revision = 1);
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

INSERT INTO _business_uuid_primary_key_stage6_validation
SELECT 'onboarding_tasks.assignment_id', orphan_count, (SELECT count(*) FROM onboarding_tasks child WHERE child.assignment_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM onboarding_assignments parent WHERE parent.id = child.assignment_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'onboarding_tasks.assignment_id';
INSERT INTO _business_uuid_primary_key_stage6_validation
SELECT 'onboarding_lifecycle_deliveries.assignment_id', orphan_count, (SELECT count(*) FROM onboarding_lifecycle_deliveries child WHERE child.assignment_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM onboarding_assignments parent WHERE parent.id = child.assignment_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'onboarding_lifecycle_deliveries.assignment_id';
DROP TABLE _uuid_reference_orphans;
DROP TABLE _onboarding_templates_id_map;
DROP TABLE _onboarding_assignments_id_map;
DROP TABLE _onboarding_tasks_id_map;
DROP TABLE _business_uuid_primary_key_stage6_validation;
