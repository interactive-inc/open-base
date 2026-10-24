-- 整数の主キーを持つ業務 table と、同じ業務内でその主キーを外部キーなしで参照する table を UUID の主キーへ移す (Issue )。
--
-- 対象: rooms, room_reservations（room_id の型だけを変える）, shift_patterns, shift_assignments,
-- shift_swap_requests, surveys, survey_responses, thanks_rewards, thanks_messages, thanks_point_budgets,
-- thanks_redemptions, training_courses, training_enrollments, job_openings, recruitment_candidates
--
-- 各行に v4 の UUID を割り当て、旧来の整数の主キーは同じ行の legacy_id（TEXT、UNIQUE）に残す。
-- 保全・撤去・監査の証跡は書き換えず、証跡が指す旧 ID は legacy_id で現在の行へ辿る。
--
-- 外部キーの無い同じ業務内の参照（room_reservations.room_id、shift_assignments.pattern_id、
-- survey_responses.survey_id、thanks_redemptions.reward_id、training_enrollments.course_id、
-- recruitment_candidates.position_id）は、参照先の新しい UUID へ書き換える。移行前から参照先を持たない値は
-- 旧 ID の文字列のまま残し、参照先を持たない行が移行で増えないことを検証表で確かめる。
--
-- rooms、shift_patterns、shift_assignments、shift_swap_requests、surveys、training_courses、
-- training_enrollments は作成日時を持たず、整数の主キーの順を作成順として並べていた。UUID は順序を
-- 持たないため created_at を足す。既存行の作成日時は不明なので移行時刻を入れ、同じ時刻の行は
-- legacy_id の数値順で旧来の並びを保つ。
--
-- 所有業務が撤去の停止中なら検証表の CHECK で止める。index と trigger は作り直す前の定義から復元する。
--
-- ALTER TABLE RENAME は trigger を含む全 schema を解析し直し、table ごとに数十 ms かかる。
-- 名前を変えずに行を退避し、同じ名前で作り直してから戻す。

CREATE TABLE _business_uuid_primary_key_stage4_validation (
  resource TEXT PRIMARY KEY NOT NULL,
  source_count INTEGER NOT NULL,
  target_count INTEGER NOT NULL,
  orphan_count INTEGER NOT NULL,
  non_uuid_count INTEGER NOT NULL,
  blocked_count INTEGER NOT NULL,
  CHECK (source_count = target_count AND orphan_count = 0 AND non_uuid_count = 0 AND blocked_count = 0)
);

-- rooms
CREATE TABLE _rooms_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _rooms_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM rooms;

-- room_reservations
CREATE TABLE _room_reservations_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _room_reservations_id_map (old_id, new_id)
SELECT id, CASE WHEN length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]' THEN id ELSE lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) END
FROM room_reservations;

-- shift_patterns
CREATE TABLE _shift_patterns_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _shift_patterns_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM shift_patterns;

-- shift_assignments
CREATE TABLE _shift_assignments_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _shift_assignments_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM shift_assignments;

-- shift_swap_requests
CREATE TABLE _shift_swap_requests_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _shift_swap_requests_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM shift_swap_requests;

-- surveys
CREATE TABLE _surveys_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _surveys_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM surveys;

-- survey_responses
CREATE TABLE _survey_responses_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _survey_responses_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM survey_responses;

-- thanks_rewards
CREATE TABLE _thanks_rewards_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _thanks_rewards_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM thanks_rewards;

-- thanks_messages
CREATE TABLE _thanks_messages_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _thanks_messages_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM thanks_messages;

-- thanks_point_budgets
CREATE TABLE _thanks_point_budgets_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _thanks_point_budgets_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM thanks_point_budgets;

-- thanks_redemptions
CREATE TABLE _thanks_redemptions_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _thanks_redemptions_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM thanks_redemptions;

-- training_courses
CREATE TABLE _training_courses_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _training_courses_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM training_courses;

-- training_enrollments
CREATE TABLE _training_enrollments_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _training_enrollments_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM training_enrollments;

-- job_openings
CREATE TABLE _job_openings_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _job_openings_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM job_openings;

-- recruitment_candidates
CREATE TABLE _recruitment_candidates_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _recruitment_candidates_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM recruitment_candidates;

-- 外部キーの無い参照が移行前から指す先を持たない行の数。移行で増えないことを最後に確かめる。
CREATE TABLE _uuid_reference_orphans (
  resource TEXT PRIMARY KEY NOT NULL,
  orphan_count INTEGER NOT NULL
);
INSERT INTO _uuid_reference_orphans VALUES ('room_reservations.room_id', (SELECT count(*) FROM room_reservations child WHERE child.room_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM rooms parent WHERE parent.id = child.room_id)));
INSERT INTO _uuid_reference_orphans VALUES ('shift_assignments.pattern_id', (SELECT count(*) FROM shift_assignments child WHERE child.pattern_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM shift_patterns parent WHERE parent.id = child.pattern_id)));
INSERT INTO _uuid_reference_orphans VALUES ('survey_responses.survey_id', (SELECT count(*) FROM survey_responses child WHERE child.survey_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM surveys parent WHERE parent.id = child.survey_id)));
INSERT INTO _uuid_reference_orphans VALUES ('thanks_redemptions.reward_id', (SELECT count(*) FROM thanks_redemptions child WHERE child.reward_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM thanks_rewards parent WHERE parent.id = child.reward_id)));
INSERT INTO _uuid_reference_orphans VALUES ('training_enrollments.course_id', (SELECT count(*) FROM training_enrollments child WHERE child.course_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM training_courses parent WHERE parent.id = child.course_id)));
INSERT INTO _uuid_reference_orphans VALUES ('recruitment_candidates.position_id', (SELECT count(*) FROM recruitment_candidates child WHERE child.position_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM job_openings parent WHERE parent.id = child.position_id)));

-- rooms
CREATE TABLE "_stage_rooms" AS SELECT * FROM rooms;
DROP TABLE rooms;
CREATE TABLE rooms (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  legacy_id TEXT UNIQUE,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  location TEXT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO rooms (id, name, capacity, location, legacy_id, created_at)
SELECT map.new_id,
       source.name,
       source.capacity,
       source.location,
       CAST(source.id AS TEXT),
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM "_stage_rooms" source
INNER JOIN _rooms_id_map map ON map.old_id = source.id;
INSERT INTO _business_uuid_primary_key_stage4_validation
SELECT 'rooms',
       (SELECT count(*) FROM "_stage_rooms"),
       (SELECT count(*) FROM rooms),
       0,
       (SELECT count(*) FROM rooms WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'room' AND revision = 1);
DROP TABLE "_stage_rooms";
CREATE INDEX idx_rooms_capacity ON rooms (capacity);
CREATE TRIGGER rooms_source_freeze_delete BEFORE DELETE ON rooms
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'room' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'room_record_source_frozen'); END;
CREATE TRIGGER rooms_source_freeze_insert BEFORE INSERT ON rooms
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'room' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'room_record_source_frozen'); END;
CREATE TRIGGER rooms_source_freeze_update BEFORE UPDATE ON rooms
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'room' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'room_record_source_frozen'); END;
CREATE TRIGGER rooms_legacy_id_insert
BEFORE INSERT ON rooms
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER rooms_identity_update
BEFORE UPDATE OF id, legacy_id ON rooms
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- room_reservations
CREATE TABLE "_stage_room_reservations" AS SELECT * FROM room_reservations;
DROP TABLE room_reservations;
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
INSERT INTO room_reservations (id, room_id, reserver_id, start_at, end_at, purpose)
SELECT map.new_id,
       CASE WHEN source.room_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _rooms_id_map ref WHERE ref.old_id = source.room_id), CAST(source.room_id AS TEXT)) END,
       source.reserver_id,
       source.start_at,
       source.end_at,
       source.purpose
FROM "_stage_room_reservations" source
INNER JOIN _room_reservations_id_map map ON map.old_id = source.id;
INSERT INTO _business_uuid_primary_key_stage4_validation
SELECT 'room_reservations',
       (SELECT count(*) FROM "_stage_room_reservations"),
       (SELECT count(*) FROM room_reservations),
       0,
       (SELECT count(*) FROM room_reservations WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'room' AND revision = 1)
         + (SELECT count(*) FROM _room_reservations_id_map WHERE old_id IS NOT new_id AND (
             EXISTS (SELECT 1 FROM system_record_coverage_entries entry WHERE entry.source_record_id = _room_reservations_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_preserved_records preserved WHERE json_extract(preserved.snapshot_json, '$.source.recordId') = _room_reservations_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_cases workflow_case WHERE workflow_case.subject_id = _room_reservations_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_audit_events audit WHERE audit.target_id = _room_reservations_id_map.old_id)));
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

-- shift_patterns
CREATE TABLE "_stage_shift_patterns" AS SELECT * FROM shift_patterns;
DROP TABLE shift_patterns;
CREATE TABLE shift_patterns (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  legacy_id TEXT UNIQUE,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  break_minutes INTEGER NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO shift_patterns (id, code, name, start_time, end_time, break_minutes, legacy_id, created_at)
SELECT map.new_id,
       source.code,
       source.name,
       source.start_time,
       source.end_time,
       source.break_minutes,
       CAST(source.id AS TEXT),
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM "_stage_shift_patterns" source
INNER JOIN _shift_patterns_id_map map ON map.old_id = source.id;
INSERT INTO _business_uuid_primary_key_stage4_validation
SELECT 'shift_patterns',
       (SELECT count(*) FROM "_stage_shift_patterns"),
       (SELECT count(*) FROM shift_patterns),
       0,
       (SELECT count(*) FROM shift_patterns WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'shift' AND revision = 1);
DROP TABLE "_stage_shift_patterns";
CREATE INDEX idx_shift_patterns_code ON shift_patterns (code);
CREATE TRIGGER shift_patterns_source_freeze_delete BEFORE DELETE ON shift_patterns
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'shift' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'shift_record_source_frozen'); END;
CREATE TRIGGER shift_patterns_source_freeze_insert BEFORE INSERT ON shift_patterns
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'shift' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'shift_record_source_frozen'); END;
CREATE TRIGGER shift_patterns_source_freeze_update BEFORE UPDATE ON shift_patterns
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'shift' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'shift_record_source_frozen'); END;
CREATE TRIGGER shift_patterns_legacy_id_insert
BEFORE INSERT ON shift_patterns
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER shift_patterns_identity_update
BEFORE UPDATE OF id, legacy_id ON shift_patterns
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- shift_assignments
CREATE TABLE "_stage_shift_assignments" AS SELECT * FROM shift_assignments;
DROP TABLE shift_assignments;
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
INSERT INTO shift_assignments (id, employee_id, pattern_id, date, note, published_at, legacy_id, created_at)
SELECT map.new_id,
       source.employee_id,
       CASE WHEN source.pattern_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _shift_patterns_id_map ref WHERE ref.old_id = source.pattern_id), CAST(source.pattern_id AS TEXT)) END,
       source.date,
       source.note,
       source.published_at,
       CAST(source.id AS TEXT),
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM "_stage_shift_assignments" source
INNER JOIN _shift_assignments_id_map map ON map.old_id = source.id;
INSERT INTO _business_uuid_primary_key_stage4_validation
SELECT 'shift_assignments',
       (SELECT count(*) FROM "_stage_shift_assignments"),
       (SELECT count(*) FROM shift_assignments),
       0,
       (SELECT count(*) FROM shift_assignments WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'shift' AND revision = 1);
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
CREATE TABLE "_stage_shift_swap_requests" AS SELECT * FROM shift_swap_requests;
DROP TABLE shift_swap_requests;
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
INSERT INTO shift_swap_requests (id, requester_employee_id, target_employee_id, date, note, status, approved_at, legacy_id, created_at)
SELECT map.new_id,
       source.requester_employee_id,
       source.target_employee_id,
       source.date,
       source.note,
       source.status,
       source.approved_at,
       CAST(source.id AS TEXT),
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM "_stage_shift_swap_requests" source
INNER JOIN _shift_swap_requests_id_map map ON map.old_id = source.id;
INSERT INTO _business_uuid_primary_key_stage4_validation
SELECT 'shift_swap_requests',
       (SELECT count(*) FROM "_stage_shift_swap_requests"),
       (SELECT count(*) FROM shift_swap_requests),
       0,
       (SELECT count(*) FROM shift_swap_requests WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'shift' AND revision = 1);
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

-- surveys
CREATE TABLE "_stage_surveys" AS SELECT * FROM surveys;
DROP TABLE surveys;
CREATE TABLE surveys (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  legacy_id TEXT UNIQUE,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  questions_json TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO surveys (id, title, status, questions_json, legacy_id, created_at)
SELECT map.new_id,
       source.title,
       source.status,
       source.questions_json,
       CAST(source.id AS TEXT),
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM "_stage_surveys" source
INNER JOIN _surveys_id_map map ON map.old_id = source.id;
INSERT INTO _business_uuid_primary_key_stage4_validation
SELECT 'surveys',
       (SELECT count(*) FROM "_stage_surveys"),
       (SELECT count(*) FROM surveys),
       0,
       (SELECT count(*) FROM surveys WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'survey' AND revision = 1);
DROP TABLE "_stage_surveys";
CREATE INDEX idx_surveys_status ON surveys (status);
CREATE TRIGGER surveys_source_freeze_delete BEFORE DELETE ON surveys
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='survey' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'survey_record_source_frozen'); END;
CREATE TRIGGER surveys_source_freeze_insert BEFORE INSERT ON surveys
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='survey' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'survey_record_source_frozen'); END;
CREATE TRIGGER surveys_source_freeze_update BEFORE UPDATE ON surveys
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='survey' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'survey_record_source_frozen'); END;
CREATE TRIGGER surveys_legacy_id_insert
BEFORE INSERT ON surveys
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER surveys_identity_update
BEFORE UPDATE OF id, legacy_id ON surveys
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- survey_responses
CREATE TABLE "_stage_survey_responses" AS SELECT * FROM survey_responses;
DROP TABLE survey_responses;
CREATE TABLE survey_responses (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  survey_id TEXT NOT NULL,
  respondent_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  answers_json TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO survey_responses (id, survey_id, respondent_id, answers_json, submitted_at, legacy_id)
SELECT map.new_id,
       CASE WHEN source.survey_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _surveys_id_map ref WHERE ref.old_id = source.survey_id), CAST(source.survey_id AS TEXT)) END,
       source.respondent_id,
       source.answers_json,
       source.submitted_at,
       CAST(source.id AS TEXT)
FROM "_stage_survey_responses" source
INNER JOIN _survey_responses_id_map map ON map.old_id = source.id;
INSERT INTO _business_uuid_primary_key_stage4_validation
SELECT 'survey_responses',
       (SELECT count(*) FROM "_stage_survey_responses"),
       (SELECT count(*) FROM survey_responses),
       0,
       (SELECT count(*) FROM survey_responses WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'survey' AND revision = 1);
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

-- thanks_rewards
CREATE TABLE "_stage_thanks_rewards" AS SELECT * FROM thanks_rewards;
DROP TABLE thanks_rewards;
CREATE TABLE thanks_rewards (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  name TEXT NOT NULL,
  point_cost INTEGER NOT NULL,
  is_active INTEGER NOT NULL,
  stock INTEGER,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO thanks_rewards (id, name, point_cost, is_active, stock, created_at, legacy_id)
SELECT map.new_id,
       source.name,
       source.point_cost,
       source.is_active,
       source.stock,
       source.created_at,
       CAST(source.id AS TEXT)
FROM "_stage_thanks_rewards" source
INNER JOIN _thanks_rewards_id_map map ON map.old_id = source.id;
INSERT INTO _business_uuid_primary_key_stage4_validation
SELECT 'thanks_rewards',
       (SELECT count(*) FROM "_stage_thanks_rewards"),
       (SELECT count(*) FROM thanks_rewards),
       0,
       (SELECT count(*) FROM thanks_rewards WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'thanks' AND revision = 1);
DROP TABLE "_stage_thanks_rewards";
CREATE TRIGGER thanks_rewards_source_freeze_delete BEFORE DELETE ON thanks_rewards
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='thanks' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'thanks_record_source_frozen'); END;
CREATE TRIGGER thanks_rewards_source_freeze_insert BEFORE INSERT ON thanks_rewards
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='thanks' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'thanks_record_source_frozen'); END;
CREATE TRIGGER thanks_rewards_source_freeze_update BEFORE UPDATE ON thanks_rewards
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='thanks' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'thanks_record_source_frozen'); END;
CREATE TRIGGER thanks_rewards_legacy_id_insert
BEFORE INSERT ON thanks_rewards
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER thanks_rewards_identity_update
BEFORE UPDATE OF id, legacy_id ON thanks_rewards
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- thanks_messages
CREATE TABLE "_stage_thanks_messages" AS SELECT * FROM thanks_messages;
DROP TABLE thanks_messages;
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
INSERT INTO thanks_messages (id, sender_employee_id, recipient_employee_id, message, points, created_at, legacy_id)
SELECT map.new_id,
       source.sender_employee_id,
       source.recipient_employee_id,
       source.message,
       source.points,
       source.created_at,
       CAST(source.id AS TEXT)
FROM "_stage_thanks_messages" source
INNER JOIN _thanks_messages_id_map map ON map.old_id = source.id;
INSERT INTO _business_uuid_primary_key_stage4_validation
SELECT 'thanks_messages',
       (SELECT count(*) FROM "_stage_thanks_messages"),
       (SELECT count(*) FROM thanks_messages),
       0,
       (SELECT count(*) FROM thanks_messages WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'thanks' AND revision = 1);
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
CREATE TABLE "_stage_thanks_point_budgets" AS SELECT * FROM thanks_point_budgets;
DROP TABLE thanks_point_budgets;
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
INSERT INTO thanks_point_budgets (id, employee_id, period, granted_points, consumed_points, created_at, legacy_id)
SELECT map.new_id,
       source.employee_id,
       source.period,
       source.granted_points,
       source.consumed_points,
       source.created_at,
       CAST(source.id AS TEXT)
FROM "_stage_thanks_point_budgets" source
INNER JOIN _thanks_point_budgets_id_map map ON map.old_id = source.id;
INSERT INTO _business_uuid_primary_key_stage4_validation
SELECT 'thanks_point_budgets',
       (SELECT count(*) FROM "_stage_thanks_point_budgets"),
       (SELECT count(*) FROM thanks_point_budgets),
       0,
       (SELECT count(*) FROM thanks_point_budgets WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'thanks' AND revision = 1);
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
CREATE TABLE "_stage_thanks_redemptions" AS SELECT * FROM thanks_redemptions;
DROP TABLE thanks_redemptions;
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
INSERT INTO thanks_redemptions (id, employee_id, reward_id, point_cost, status, created_at, decided_at, decider_id, legacy_id)
SELECT map.new_id,
       source.employee_id,
       CASE WHEN source.reward_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _thanks_rewards_id_map ref WHERE ref.old_id = source.reward_id), CAST(source.reward_id AS TEXT)) END,
       source.point_cost,
       source.status,
       source.created_at,
       source.decided_at,
       source.decider_id,
       CAST(source.id AS TEXT)
FROM "_stage_thanks_redemptions" source
INNER JOIN _thanks_redemptions_id_map map ON map.old_id = source.id;
INSERT INTO _business_uuid_primary_key_stage4_validation
SELECT 'thanks_redemptions',
       (SELECT count(*) FROM "_stage_thanks_redemptions"),
       (SELECT count(*) FROM thanks_redemptions),
       0,
       (SELECT count(*) FROM thanks_redemptions WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'thanks' AND revision = 1);
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

-- training_courses
CREATE TABLE "_stage_training_courses" AS SELECT * FROM training_courses;
DROP TABLE training_courses;
CREATE TABLE training_courses (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  legacy_id TEXT UNIQUE,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER,
  category TEXT NOT NULL,
  is_required INTEGER NOT NULL,
  status TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO training_courses (id, code, title, description, duration_minutes, category, is_required, status, legacy_id, created_at)
SELECT map.new_id,
       source.code,
       source.title,
       source.description,
       source.duration_minutes,
       source.category,
       source.is_required,
       source.status,
       CAST(source.id AS TEXT),
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM "_stage_training_courses" source
INNER JOIN _training_courses_id_map map ON map.old_id = source.id;
INSERT INTO _business_uuid_primary_key_stage4_validation
SELECT 'training_courses',
       (SELECT count(*) FROM "_stage_training_courses"),
       (SELECT count(*) FROM training_courses),
       0,
       (SELECT count(*) FROM training_courses WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'training' AND revision = 1);
DROP TABLE "_stage_training_courses";
CREATE INDEX idx_training_courses_category ON training_courses (category);
CREATE INDEX idx_training_courses_code ON training_courses (code);
CREATE TRIGGER training_courses_source_freeze_delete BEFORE DELETE ON training_courses
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='training' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'training_record_source_frozen'); END;
CREATE TRIGGER training_courses_source_freeze_insert BEFORE INSERT ON training_courses
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='training' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'training_record_source_frozen'); END;
CREATE TRIGGER training_courses_source_freeze_update BEFORE UPDATE ON training_courses
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='training' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'training_record_source_frozen'); END;
CREATE TRIGGER training_courses_legacy_id_insert
BEFORE INSERT ON training_courses
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER training_courses_identity_update
BEFORE UPDATE OF id, legacy_id ON training_courses
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- training_enrollments
CREATE TABLE "_stage_training_enrollments" AS SELECT * FROM training_enrollments;
DROP TABLE training_enrollments;
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
INSERT INTO training_enrollments (id, course_id, employee_id, status, completed_at, score, due_date, legacy_id, created_at)
SELECT map.new_id,
       CASE WHEN source.course_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _training_courses_id_map ref WHERE ref.old_id = source.course_id), CAST(source.course_id AS TEXT)) END,
       source.employee_id,
       source.status,
       source.completed_at,
       source.score,
       source.due_date,
       CAST(source.id AS TEXT),
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM "_stage_training_enrollments" source
INNER JOIN _training_enrollments_id_map map ON map.old_id = source.id;
INSERT INTO _business_uuid_primary_key_stage4_validation
SELECT 'training_enrollments',
       (SELECT count(*) FROM "_stage_training_enrollments"),
       (SELECT count(*) FROM training_enrollments),
       0,
       (SELECT count(*) FROM training_enrollments WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'training' AND revision = 1);
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

-- job_openings
CREATE TABLE "_stage_job_openings" AS SELECT * FROM job_openings;
DROP TABLE job_openings;
CREATE TABLE job_openings (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  title TEXT NOT NULL,
  department_code TEXT,
  status TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO job_openings (id, title, department_code, status, note, created_at, legacy_id)
SELECT map.new_id,
       source.title,
       source.department_code,
       source.status,
       source.note,
       source.created_at,
       CAST(source.id AS TEXT)
FROM "_stage_job_openings" source
INNER JOIN _job_openings_id_map map ON map.old_id = source.id;
INSERT INTO _business_uuid_primary_key_stage4_validation
SELECT 'job_openings',
       (SELECT count(*) FROM "_stage_job_openings"),
       (SELECT count(*) FROM job_openings),
       0,
       (SELECT count(*) FROM job_openings WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'recruitment' AND revision = 1);
DROP TABLE "_stage_job_openings";
CREATE INDEX idx_recruitment_positions_status ON "job_openings" (status);
CREATE TRIGGER job_openings_source_freeze_delete BEFORE DELETE ON job_openings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'recruitment' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'recruitment_record_source_frozen'); END;
CREATE TRIGGER job_openings_source_freeze_insert BEFORE INSERT ON job_openings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'recruitment' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'recruitment_record_source_frozen'); END;
CREATE TRIGGER job_openings_source_freeze_update BEFORE UPDATE ON job_openings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'recruitment' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'recruitment_record_source_frozen'); END;
CREATE TRIGGER job_openings_legacy_id_insert
BEFORE INSERT ON job_openings
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER job_openings_identity_update
BEFORE UPDATE OF id, legacy_id ON job_openings
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- recruitment_candidates
CREATE TABLE "_stage_recruitment_candidates" AS SELECT * FROM recruitment_candidates;
DROP TABLE recruitment_candidates;
CREATE TABLE recruitment_candidates (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  position_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  source TEXT,
  stage TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO recruitment_candidates (id, position_id, name, email, source, stage, note, created_at, legacy_id)
SELECT map.new_id,
       CASE WHEN source.position_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _job_openings_id_map ref WHERE ref.old_id = source.position_id), CAST(source.position_id AS TEXT)) END,
       source.name,
       source.email,
       source.source,
       source.stage,
       source.note,
       source.created_at,
       CAST(source.id AS TEXT)
FROM "_stage_recruitment_candidates" source
INNER JOIN _recruitment_candidates_id_map map ON map.old_id = source.id;
INSERT INTO _business_uuid_primary_key_stage4_validation
SELECT 'recruitment_candidates',
       (SELECT count(*) FROM "_stage_recruitment_candidates"),
       (SELECT count(*) FROM recruitment_candidates),
       0,
       (SELECT count(*) FROM recruitment_candidates WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'recruitment' AND revision = 1);
DROP TABLE "_stage_recruitment_candidates";
CREATE INDEX idx_recruitment_candidates_position ON recruitment_candidates (position_id);
CREATE TRIGGER recruitment_candidates_source_freeze_delete BEFORE DELETE ON recruitment_candidates
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'recruitment' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'recruitment_record_source_frozen'); END;
CREATE TRIGGER recruitment_candidates_source_freeze_insert BEFORE INSERT ON recruitment_candidates
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'recruitment' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'recruitment_record_source_frozen'); END;
CREATE TRIGGER recruitment_candidates_source_freeze_update BEFORE UPDATE ON recruitment_candidates
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'recruitment' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'recruitment_record_source_frozen'); END;
CREATE TRIGGER recruitment_candidates_legacy_id_insert
BEFORE INSERT ON recruitment_candidates
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER recruitment_candidates_identity_update
BEFORE UPDATE OF id, legacy_id ON recruitment_candidates
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

INSERT INTO _business_uuid_primary_key_stage4_validation
SELECT 'room_reservations.room_id', orphan_count, (SELECT count(*) FROM room_reservations child WHERE child.room_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM rooms parent WHERE parent.id = child.room_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'room_reservations.room_id';
INSERT INTO _business_uuid_primary_key_stage4_validation
SELECT 'shift_assignments.pattern_id', orphan_count, (SELECT count(*) FROM shift_assignments child WHERE child.pattern_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM shift_patterns parent WHERE parent.id = child.pattern_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'shift_assignments.pattern_id';
INSERT INTO _business_uuid_primary_key_stage4_validation
SELECT 'survey_responses.survey_id', orphan_count, (SELECT count(*) FROM survey_responses child WHERE child.survey_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM surveys parent WHERE parent.id = child.survey_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'survey_responses.survey_id';
INSERT INTO _business_uuid_primary_key_stage4_validation
SELECT 'thanks_redemptions.reward_id', orphan_count, (SELECT count(*) FROM thanks_redemptions child WHERE child.reward_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM thanks_rewards parent WHERE parent.id = child.reward_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'thanks_redemptions.reward_id';
INSERT INTO _business_uuid_primary_key_stage4_validation
SELECT 'training_enrollments.course_id', orphan_count, (SELECT count(*) FROM training_enrollments child WHERE child.course_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM training_courses parent WHERE parent.id = child.course_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'training_enrollments.course_id';
INSERT INTO _business_uuid_primary_key_stage4_validation
SELECT 'recruitment_candidates.position_id', orphan_count, (SELECT count(*) FROM recruitment_candidates child WHERE child.position_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM job_openings parent WHERE parent.id = child.position_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'recruitment_candidates.position_id';
DROP TABLE _uuid_reference_orphans;
DROP TABLE _rooms_id_map;
DROP TABLE _room_reservations_id_map;
DROP TABLE _shift_patterns_id_map;
DROP TABLE _shift_assignments_id_map;
DROP TABLE _shift_swap_requests_id_map;
DROP TABLE _surveys_id_map;
DROP TABLE _survey_responses_id_map;
DROP TABLE _thanks_rewards_id_map;
DROP TABLE _thanks_messages_id_map;
DROP TABLE _thanks_point_budgets_id_map;
DROP TABLE _thanks_redemptions_id_map;
DROP TABLE _training_courses_id_map;
DROP TABLE _training_enrollments_id_map;
DROP TABLE _job_openings_id_map;
DROP TABLE _recruitment_candidates_id_map;
DROP TABLE _business_uuid_primary_key_stage4_validation;
