-- 整数の主キーを持つ業務 table と、同じ業務内でその主キーを外部キーなしで参照する table を UUID の主キーへ移す (Issue )。
--
-- 対象: announcements, asset_lendings, attendance_records, career_postings, career_applications,
-- certification_definitions, employee_certifications, decision_records, meetings,
-- meeting_minutes_records, partners, partner_contracts, regulations, regulation_versions
--
-- 各行に v4 の UUID を割り当て、旧来の整数の主キーは同じ行の legacy_id（TEXT、UNIQUE）に残す。
-- 保全・撤去・監査の証跡は書き換えず、証跡が指す旧 ID は legacy_id で現在の行へ辿る。
--
-- 外部キーの無い同じ業務内の参照（career_applications.posting_id、employee_certifications.certification_id、
-- decision_records.superseded_by_id、meeting_minutes_records.meeting_id、partner_contracts.partner_id、
-- regulation_versions.regulation_id）は、参照先の新しい UUID へ書き換える。移行前から参照先を持たない値は
-- 旧 ID の文字列のまま残し、参照先を持たない行が移行で増えないことを検証表で確かめる。
--
-- career_postings と career_applications は作成日時を持たず、整数の主キーの順を作成順として並べていた。
-- UUID は順序を持たないため created_at を足す。既存行の作成日時は不明なので移行時刻を入れ、
-- 同じ時刻の行は legacy_id の数値順で旧来の並びを保つ。
--
-- 所有業務が撤去の停止中なら検証表の CHECK で止める。index と trigger は作り直す前の定義から復元する。

CREATE TABLE _business_parent_uuid_primary_key_validation (
  resource TEXT PRIMARY KEY NOT NULL,
  source_count INTEGER NOT NULL,
  target_count INTEGER NOT NULL,
  orphan_count INTEGER NOT NULL,
  non_uuid_count INTEGER NOT NULL,
  blocked_count INTEGER NOT NULL,
  CHECK (source_count = target_count AND orphan_count = 0 AND non_uuid_count = 0 AND blocked_count = 0)
);

-- announcements
CREATE TABLE _announcements_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _announcements_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM announcements;

-- asset_lendings
CREATE TABLE _asset_lendings_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _asset_lendings_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM asset_lendings;

-- attendance_records
CREATE TABLE _attendance_records_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _attendance_records_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM attendance_records;

-- career_postings
CREATE TABLE _career_postings_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _career_postings_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM career_postings;

-- career_applications
CREATE TABLE _career_applications_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _career_applications_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM career_applications;

-- certification_definitions
CREATE TABLE _certification_definitions_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _certification_definitions_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM certification_definitions;

-- employee_certifications
CREATE TABLE _employee_certifications_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _employee_certifications_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM employee_certifications;

-- decision_records
CREATE TABLE _decision_records_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _decision_records_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM decision_records;

-- meetings
CREATE TABLE _meetings_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _meetings_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM meetings;

-- meeting_minutes_records
CREATE TABLE _meeting_minutes_records_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _meeting_minutes_records_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM meeting_minutes_records;

-- partners
CREATE TABLE _partners_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _partners_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM partners;

-- partner_contracts
CREATE TABLE _partner_contracts_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _partner_contracts_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM partner_contracts;

-- regulations
CREATE TABLE _regulations_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _regulations_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM regulations;

-- regulation_versions
CREATE TABLE _regulation_versions_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _regulation_versions_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM regulation_versions;

-- 外部キーの無い参照が移行前から指す先を持たない行の数。移行で増えないことを最後に確かめる。
CREATE TABLE _uuid_reference_orphans (
  resource TEXT PRIMARY KEY NOT NULL,
  orphan_count INTEGER NOT NULL
);
INSERT INTO _uuid_reference_orphans VALUES ('career_applications.posting_id', (SELECT count(*) FROM career_applications child WHERE child.posting_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM career_postings parent WHERE parent.id = child.posting_id)));
INSERT INTO _uuid_reference_orphans VALUES ('employee_certifications.certification_id', (SELECT count(*) FROM employee_certifications child WHERE child.certification_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM certification_definitions parent WHERE parent.id = child.certification_id)));
INSERT INTO _uuid_reference_orphans VALUES ('decision_records.superseded_by_id', (SELECT count(*) FROM decision_records child WHERE child.superseded_by_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM decision_records parent WHERE parent.id = child.superseded_by_id)));
INSERT INTO _uuid_reference_orphans VALUES ('meeting_minutes_records.meeting_id', (SELECT count(*) FROM meeting_minutes_records child WHERE child.meeting_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM meetings parent WHERE parent.id = child.meeting_id)));
INSERT INTO _uuid_reference_orphans VALUES ('partner_contracts.partner_id', (SELECT count(*) FROM partner_contracts child WHERE child.partner_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM partners parent WHERE parent.id = child.partner_id)));
INSERT INTO _uuid_reference_orphans VALUES ('regulation_versions.regulation_id', (SELECT count(*) FROM regulation_versions child WHERE child.regulation_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM regulations parent WHERE parent.id = child.regulation_id)));

-- announcements
CREATE TABLE "__new_announcements" (
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
INSERT INTO "__new_announcements" (id, title, body_md, published_on, author_employee_id, status, created_at, legacy_id)
SELECT map.new_id,
       source.title,
       source.body_md,
       source.published_on,
       source.author_employee_id,
       source.status,
       source.created_at,
       CAST(source.id AS TEXT)
FROM announcements source
INNER JOIN _announcements_id_map map ON map.old_id = source.id;
INSERT INTO _business_parent_uuid_primary_key_validation
SELECT 'announcements',
       (SELECT count(*) FROM announcements),
       (SELECT count(*) FROM "__new_announcements"),
       0,
       (SELECT count(*) FROM "__new_announcements" WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'announcement' AND revision = 1);
DROP TABLE announcements;
ALTER TABLE "__new_announcements" RENAME TO announcements;
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

-- asset_lendings
CREATE TABLE "__new_asset_lendings" (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  asset_code TEXT NOT NULL,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  lent_at TEXT NOT NULL,
  returned_at TEXT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO "__new_asset_lendings" (id, asset_code, employee_id, lent_at, returned_at, legacy_id)
SELECT map.new_id,
       source.asset_code,
       source.employee_id,
       source.lent_at,
       source.returned_at,
       CAST(source.id AS TEXT)
FROM asset_lendings source
INNER JOIN _asset_lendings_id_map map ON map.old_id = source.id;
INSERT INTO _business_parent_uuid_primary_key_validation
SELECT 'asset_lendings',
       (SELECT count(*) FROM asset_lendings),
       (SELECT count(*) FROM "__new_asset_lendings"),
       0,
       (SELECT count(*) FROM "__new_asset_lendings" WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'asset' AND revision = 1);
DROP TABLE asset_lendings;
ALTER TABLE "__new_asset_lendings" RENAME TO asset_lendings;
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

-- attendance_records
CREATE TABLE "__new_attendance_records" (
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
INSERT INTO "__new_attendance_records" (id, employee_id, work_date, clock_in_at, clock_out_at, work_minutes, note, status, legacy_id)
SELECT map.new_id,
       source.employee_id,
       source.work_date,
       source.clock_in_at,
       source.clock_out_at,
       source.work_minutes,
       source.note,
       source.status,
       CAST(source.id AS TEXT)
FROM attendance_records source
INNER JOIN _attendance_records_id_map map ON map.old_id = source.id;
INSERT INTO _business_parent_uuid_primary_key_validation
SELECT 'attendance_records',
       (SELECT count(*) FROM attendance_records),
       (SELECT count(*) FROM "__new_attendance_records"),
       0,
       (SELECT count(*) FROM "__new_attendance_records" WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'attendance' AND revision = 1);
DROP TABLE attendance_records;
ALTER TABLE "__new_attendance_records" RENAME TO attendance_records;
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

-- career_postings
CREATE TABLE "__new_career_postings" (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  legacy_id TEXT UNIQUE,
  title TEXT NOT NULL,
  dept_id INTEGER,
  dept_name TEXT,
  required_skills TEXT,
  status TEXT NOT NULL
, organization_unit_id TEXT REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO "__new_career_postings" (id, title, dept_id, dept_name, required_skills, status, organization_unit_id, legacy_id, created_at)
SELECT map.new_id,
       source.title,
       source.dept_id,
       source.dept_name,
       source.required_skills,
       source.status,
       source.organization_unit_id,
       CAST(source.id AS TEXT),
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM career_postings source
INNER JOIN _career_postings_id_map map ON map.old_id = source.id;
INSERT INTO _business_parent_uuid_primary_key_validation
SELECT 'career_postings',
       (SELECT count(*) FROM career_postings),
       (SELECT count(*) FROM "__new_career_postings"),
       0,
       (SELECT count(*) FROM "__new_career_postings" WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'career' AND revision = 1);
DROP TABLE career_postings;
ALTER TABLE "__new_career_postings" RENAME TO career_postings;
CREATE INDEX idx_career_postings_organization_unit ON career_postings (organization_unit_id);
CREATE INDEX idx_career_postings_status ON career_postings (status);
CREATE TRIGGER career_postings_source_freeze_delete BEFORE DELETE ON career_postings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='career' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'career_record_source_frozen'); END;
CREATE TRIGGER career_postings_source_freeze_insert BEFORE INSERT ON career_postings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='career' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'career_record_source_frozen'); END;
CREATE TRIGGER career_postings_source_freeze_update BEFORE UPDATE ON career_postings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='career' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'career_record_source_frozen'); END;
CREATE TRIGGER career_postings_legacy_id_insert
BEFORE INSERT ON career_postings
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER career_postings_identity_update
BEFORE UPDATE OF id, legacy_id ON career_postings
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- career_applications
CREATE TABLE "__new_career_applications" (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  legacy_id TEXT UNIQUE,
  posting_id TEXT NOT NULL,
  applicant_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  message TEXT,
  status TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO "__new_career_applications" (id, posting_id, applicant_id, message, status, legacy_id, created_at)
SELECT map.new_id,
       CASE WHEN source.posting_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _career_postings_id_map ref WHERE ref.old_id = source.posting_id), CAST(source.posting_id AS TEXT)) END,
       source.applicant_id,
       source.message,
       source.status,
       CAST(source.id AS TEXT),
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM career_applications source
INNER JOIN _career_applications_id_map map ON map.old_id = source.id;
INSERT INTO _business_parent_uuid_primary_key_validation
SELECT 'career_applications',
       (SELECT count(*) FROM career_applications),
       (SELECT count(*) FROM "__new_career_applications"),
       0,
       (SELECT count(*) FROM "__new_career_applications" WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'career' AND revision = 1);
DROP TABLE career_applications;
ALTER TABLE "__new_career_applications" RENAME TO career_applications;
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

-- certification_definitions
CREATE TABLE "__new_certification_definitions" (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  issuer TEXT,
  description TEXT,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO "__new_certification_definitions" (id, code, name, issuer, description, created_at, legacy_id)
SELECT map.new_id,
       source.code,
       source.name,
       source.issuer,
       source.description,
       source.created_at,
       CAST(source.id AS TEXT)
FROM certification_definitions source
INNER JOIN _certification_definitions_id_map map ON map.old_id = source.id;
INSERT INTO _business_parent_uuid_primary_key_validation
SELECT 'certification_definitions',
       (SELECT count(*) FROM certification_definitions),
       (SELECT count(*) FROM "__new_certification_definitions"),
       0,
       (SELECT count(*) FROM "__new_certification_definitions" WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'certification' AND revision = 1);
DROP TABLE certification_definitions;
ALTER TABLE "__new_certification_definitions" RENAME TO certification_definitions;
CREATE INDEX idx_certifications_code ON "certification_definitions" (code);
CREATE TRIGGER certification_definitions_source_freeze_delete BEFORE DELETE ON certification_definitions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='certification' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'certification_record_source_frozen'); END;
CREATE TRIGGER certification_definitions_source_freeze_insert BEFORE INSERT ON certification_definitions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='certification' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'certification_record_source_frozen'); END;
CREATE TRIGGER certification_definitions_source_freeze_update BEFORE UPDATE ON certification_definitions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='certification' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'certification_record_source_frozen'); END;
CREATE TRIGGER certification_definitions_legacy_id_insert
BEFORE INSERT ON certification_definitions
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER certification_definitions_identity_update
BEFORE UPDATE OF id, legacy_id ON certification_definitions
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- employee_certifications
CREATE TABLE "__new_employee_certifications" (
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
INSERT INTO "__new_employee_certifications" (id, employee_id, certification_id, acquired_on, expires_on, note, created_at, legacy_id)
SELECT map.new_id,
       source.employee_id,
       CASE WHEN source.certification_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _certification_definitions_id_map ref WHERE ref.old_id = source.certification_id), CAST(source.certification_id AS TEXT)) END,
       source.acquired_on,
       source.expires_on,
       source.note,
       source.created_at,
       CAST(source.id AS TEXT)
FROM employee_certifications source
INNER JOIN _employee_certifications_id_map map ON map.old_id = source.id;
INSERT INTO _business_parent_uuid_primary_key_validation
SELECT 'employee_certifications',
       (SELECT count(*) FROM employee_certifications),
       (SELECT count(*) FROM "__new_employee_certifications"),
       0,
       (SELECT count(*) FROM "__new_employee_certifications" WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'certification' AND revision = 1);
DROP TABLE employee_certifications;
ALTER TABLE "__new_employee_certifications" RENAME TO employee_certifications;
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

-- decision_records
CREATE TABLE "__new_decision_records" (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  title TEXT NOT NULL,
  decided_on TEXT NOT NULL,
  context TEXT NOT NULL,
  decision TEXT NOT NULL,
  consequences TEXT,
  status TEXT NOT NULL,
  superseded_by_id TEXT,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO "__new_decision_records" (id, title, decided_on, context, decision, consequences, status, superseded_by_id, created_at, legacy_id)
SELECT map.new_id,
       source.title,
       source.decided_on,
       source.context,
       source.decision,
       source.consequences,
       source.status,
       CASE WHEN source.superseded_by_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _decision_records_id_map ref WHERE ref.old_id = source.superseded_by_id), CAST(source.superseded_by_id AS TEXT)) END,
       source.created_at,
       CAST(source.id AS TEXT)
FROM decision_records source
INNER JOIN _decision_records_id_map map ON map.old_id = source.id;
INSERT INTO _business_parent_uuid_primary_key_validation
SELECT 'decision_records',
       (SELECT count(*) FROM decision_records),
       (SELECT count(*) FROM "__new_decision_records"),
       0,
       (SELECT count(*) FROM "__new_decision_records" WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'meeting' AND revision = 1);
DROP TABLE decision_records;
ALTER TABLE "__new_decision_records" RENAME TO decision_records;
CREATE INDEX idx_decisions_status ON "decision_records" (status);
CREATE TRIGGER decision_records_source_freeze_delete BEFORE DELETE ON decision_records
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'meeting' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'meeting_record_source_frozen'); END;
CREATE TRIGGER decision_records_source_freeze_insert BEFORE INSERT ON decision_records
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'meeting' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'meeting_record_source_frozen'); END;
CREATE TRIGGER decision_records_source_freeze_update BEFORE UPDATE ON decision_records
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'meeting' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'meeting_record_source_frozen'); END;
CREATE TRIGGER decision_records_legacy_id_insert
BEFORE INSERT ON decision_records
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER decision_records_identity_update
BEFORE UPDATE OF id, legacy_id ON decision_records
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- meetings
CREATE TABLE "__new_meetings" (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  cadence TEXT,
  description TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO "__new_meetings" (id, code, name, cadence, description, status, created_at, legacy_id)
SELECT map.new_id,
       source.code,
       source.name,
       source.cadence,
       source.description,
       source.status,
       source.created_at,
       CAST(source.id AS TEXT)
FROM meetings source
INNER JOIN _meetings_id_map map ON map.old_id = source.id;
INSERT INTO _business_parent_uuid_primary_key_validation
SELECT 'meetings',
       (SELECT count(*) FROM meetings),
       (SELECT count(*) FROM "__new_meetings"),
       0,
       (SELECT count(*) FROM "__new_meetings" WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'meeting' AND revision = 1);
DROP TABLE meetings;
ALTER TABLE "__new_meetings" RENAME TO meetings;
CREATE INDEX idx_meetings_status ON meetings (status);
CREATE TRIGGER meetings_source_freeze_delete BEFORE DELETE ON meetings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'meeting' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'meeting_record_source_frozen'); END;
CREATE TRIGGER meetings_source_freeze_insert BEFORE INSERT ON meetings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'meeting' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'meeting_record_source_frozen'); END;
CREATE TRIGGER meetings_source_freeze_update BEFORE UPDATE ON meetings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'meeting' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'meeting_record_source_frozen'); END;
CREATE TRIGGER meetings_legacy_id_insert
BEFORE INSERT ON meetings
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER meetings_identity_update
BEFORE UPDATE OF id, legacy_id ON meetings
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- meeting_minutes_records
CREATE TABLE "__new_meeting_minutes_records" (
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
INSERT INTO "__new_meeting_minutes_records" (id, meeting_id, held_on, title, attendees, body_md, author_employee_id, created_at, legacy_id)
SELECT map.new_id,
       CASE WHEN source.meeting_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _meetings_id_map ref WHERE ref.old_id = source.meeting_id), CAST(source.meeting_id AS TEXT)) END,
       source.held_on,
       source.title,
       source.attendees,
       source.body_md,
       source.author_employee_id,
       source.created_at,
       CAST(source.id AS TEXT)
FROM meeting_minutes_records source
INNER JOIN _meeting_minutes_records_id_map map ON map.old_id = source.id;
INSERT INTO _business_parent_uuid_primary_key_validation
SELECT 'meeting_minutes_records',
       (SELECT count(*) FROM meeting_minutes_records),
       (SELECT count(*) FROM "__new_meeting_minutes_records"),
       0,
       (SELECT count(*) FROM "__new_meeting_minutes_records" WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'meeting' AND revision = 1);
DROP TABLE meeting_minutes_records;
ALTER TABLE "__new_meeting_minutes_records" RENAME TO meeting_minutes_records;
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

-- partners
CREATE TABLE "__new_partners" (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  corporate_number TEXT,
  note TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO "__new_partners" (id, code, name, category, corporate_number, note, status, created_at, legacy_id)
SELECT map.new_id,
       source.code,
       source.name,
       source.category,
       source.corporate_number,
       source.note,
       source.status,
       source.created_at,
       CAST(source.id AS TEXT)
FROM partners source
INNER JOIN _partners_id_map map ON map.old_id = source.id;
INSERT INTO _business_parent_uuid_primary_key_validation
SELECT 'partners',
       (SELECT count(*) FROM partners),
       (SELECT count(*) FROM "__new_partners"),
       0,
       (SELECT count(*) FROM "__new_partners" WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'partner' AND revision = 1);
DROP TABLE partners;
ALTER TABLE "__new_partners" RENAME TO partners;
CREATE INDEX idx_partners_status ON partners (status);
CREATE TRIGGER partners_source_freeze_delete BEFORE DELETE ON partners
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'partner' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'partner_record_source_frozen'); END;
CREATE TRIGGER partners_source_freeze_insert BEFORE INSERT ON partners
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'partner' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'partner_record_source_frozen'); END;
CREATE TRIGGER partners_source_freeze_update BEFORE UPDATE ON partners
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'partner' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'partner_record_source_frozen'); END;
CREATE TRIGGER partners_legacy_id_insert
BEFORE INSERT ON partners
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER partners_identity_update
BEFORE UPDATE OF id, legacy_id ON partners
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- partner_contracts
CREATE TABLE "__new_partner_contracts" (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  partner_id TEXT NOT NULL,
  title TEXT NOT NULL,
  contract_date TEXT NOT NULL,
  starts_on TEXT,
  ends_on TEXT,
  renewal_deadline TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO "__new_partner_contracts" (id, partner_id, title, contract_date, starts_on, ends_on, renewal_deadline, note, created_at, legacy_id)
SELECT map.new_id,
       CASE WHEN source.partner_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _partners_id_map ref WHERE ref.old_id = source.partner_id), CAST(source.partner_id AS TEXT)) END,
       source.title,
       source.contract_date,
       source.starts_on,
       source.ends_on,
       source.renewal_deadline,
       source.note,
       source.created_at,
       CAST(source.id AS TEXT)
FROM partner_contracts source
INNER JOIN _partner_contracts_id_map map ON map.old_id = source.id;
INSERT INTO _business_parent_uuid_primary_key_validation
SELECT 'partner_contracts',
       (SELECT count(*) FROM partner_contracts),
       (SELECT count(*) FROM "__new_partner_contracts"),
       0,
       (SELECT count(*) FROM "__new_partner_contracts" WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'partner' AND revision = 1);
DROP TABLE partner_contracts;
ALTER TABLE "__new_partner_contracts" RENAME TO partner_contracts;
CREATE INDEX idx_contracts_partner ON "partner_contracts" (partner_id);
CREATE TRIGGER partner_contracts_source_freeze_delete BEFORE DELETE ON partner_contracts
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'partner' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'partner_record_source_frozen'); END;
CREATE TRIGGER partner_contracts_source_freeze_insert BEFORE INSERT ON partner_contracts
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'partner' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'partner_record_source_frozen'); END;
CREATE TRIGGER partner_contracts_source_freeze_update BEFORE UPDATE ON partner_contracts
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'partner' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'partner_record_source_frozen'); END;
CREATE TRIGGER partner_contracts_legacy_id_insert
BEFORE INSERT ON partner_contracts
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER partner_contracts_identity_update
BEFORE UPDATE OF id, legacy_id ON partner_contracts
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- regulations
CREATE TABLE "__new_regulations" (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO "__new_regulations" (id, code, title, category, status, created_at, legacy_id)
SELECT map.new_id,
       source.code,
       source.title,
       source.category,
       source.status,
       source.created_at,
       CAST(source.id AS TEXT)
FROM regulations source
INNER JOIN _regulations_id_map map ON map.old_id = source.id;
INSERT INTO _business_parent_uuid_primary_key_validation
SELECT 'regulations',
       (SELECT count(*) FROM regulations),
       (SELECT count(*) FROM "__new_regulations"),
       0,
       (SELECT count(*) FROM "__new_regulations" WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'regulation' AND revision = 1);
DROP TABLE regulations;
ALTER TABLE "__new_regulations" RENAME TO regulations;
CREATE INDEX idx_regulations_status ON regulations (status);
CREATE TRIGGER regulations_source_freeze_delete BEFORE DELETE ON regulations
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'regulation' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'regulation_record_source_frozen'); END;
CREATE TRIGGER regulations_source_freeze_insert BEFORE INSERT ON regulations
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'regulation' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'regulation_record_source_frozen'); END;
CREATE TRIGGER regulations_source_freeze_update BEFORE UPDATE ON regulations
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'regulation' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'regulation_record_source_frozen'); END;
CREATE TRIGGER regulations_legacy_id_insert
BEFORE INSERT ON regulations
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER regulations_identity_update
BEFORE UPDATE OF id, legacy_id ON regulations
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- regulation_versions
CREATE TABLE "__new_regulation_versions" (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  regulation_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  body_md TEXT NOT NULL,
  effective_on TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (regulation_id, version),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO "__new_regulation_versions" (id, regulation_id, version, body_md, effective_on, note, created_at, legacy_id)
SELECT map.new_id,
       CASE WHEN source.regulation_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _regulations_id_map ref WHERE ref.old_id = source.regulation_id), CAST(source.regulation_id AS TEXT)) END,
       source.version,
       source.body_md,
       source.effective_on,
       source.note,
       source.created_at,
       CAST(source.id AS TEXT)
FROM regulation_versions source
INNER JOIN _regulation_versions_id_map map ON map.old_id = source.id;
INSERT INTO _business_parent_uuid_primary_key_validation
SELECT 'regulation_versions',
       (SELECT count(*) FROM regulation_versions),
       (SELECT count(*) FROM "__new_regulation_versions"),
       0,
       (SELECT count(*) FROM "__new_regulation_versions" WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'regulation' AND revision = 1);
DROP TABLE regulation_versions;
ALTER TABLE "__new_regulation_versions" RENAME TO regulation_versions;
CREATE INDEX idx_regulation_versions_regulation ON regulation_versions (regulation_id);
CREATE TRIGGER regulation_versions_source_freeze_delete BEFORE DELETE ON regulation_versions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'regulation' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'regulation_record_source_frozen'); END;
CREATE TRIGGER regulation_versions_source_freeze_insert BEFORE INSERT ON regulation_versions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'regulation' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'regulation_record_source_frozen'); END;
CREATE TRIGGER regulation_versions_source_freeze_update BEFORE UPDATE ON regulation_versions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'regulation' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'regulation_record_source_frozen'); END;
CREATE TRIGGER regulation_versions_legacy_id_insert
BEFORE INSERT ON regulation_versions
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER regulation_versions_identity_update
BEFORE UPDATE OF id, legacy_id ON regulation_versions
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

INSERT INTO _business_parent_uuid_primary_key_validation
SELECT 'career_applications.posting_id', orphan_count, (SELECT count(*) FROM career_applications child WHERE child.posting_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM career_postings parent WHERE parent.id = child.posting_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'career_applications.posting_id';
INSERT INTO _business_parent_uuid_primary_key_validation
SELECT 'employee_certifications.certification_id', orphan_count, (SELECT count(*) FROM employee_certifications child WHERE child.certification_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM certification_definitions parent WHERE parent.id = child.certification_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'employee_certifications.certification_id';
INSERT INTO _business_parent_uuid_primary_key_validation
SELECT 'decision_records.superseded_by_id', orphan_count, (SELECT count(*) FROM decision_records child WHERE child.superseded_by_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM decision_records parent WHERE parent.id = child.superseded_by_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'decision_records.superseded_by_id';
INSERT INTO _business_parent_uuid_primary_key_validation
SELECT 'meeting_minutes_records.meeting_id', orphan_count, (SELECT count(*) FROM meeting_minutes_records child WHERE child.meeting_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM meetings parent WHERE parent.id = child.meeting_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'meeting_minutes_records.meeting_id';
INSERT INTO _business_parent_uuid_primary_key_validation
SELECT 'partner_contracts.partner_id', orphan_count, (SELECT count(*) FROM partner_contracts child WHERE child.partner_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM partners parent WHERE parent.id = child.partner_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'partner_contracts.partner_id';
INSERT INTO _business_parent_uuid_primary_key_validation
SELECT 'regulation_versions.regulation_id', orphan_count, (SELECT count(*) FROM regulation_versions child WHERE child.regulation_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM regulations parent WHERE parent.id = child.regulation_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'regulation_versions.regulation_id';
DROP TABLE _uuid_reference_orphans;
DROP TABLE _announcements_id_map;
DROP TABLE _asset_lendings_id_map;
DROP TABLE _attendance_records_id_map;
DROP TABLE _career_postings_id_map;
DROP TABLE _career_applications_id_map;
DROP TABLE _certification_definitions_id_map;
DROP TABLE _employee_certifications_id_map;
DROP TABLE _decision_records_id_map;
DROP TABLE _meetings_id_map;
DROP TABLE _meeting_minutes_records_id_map;
DROP TABLE _partners_id_map;
DROP TABLE _partner_contracts_id_map;
DROP TABLE _regulations_id_map;
DROP TABLE _regulation_versions_id_map;
DROP TABLE _business_parent_uuid_primary_key_validation;
