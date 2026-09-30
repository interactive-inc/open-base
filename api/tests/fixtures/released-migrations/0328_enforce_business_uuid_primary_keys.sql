-- 業務の記録で、主キーが既にTEXTのUUIDである table に UUID の CHECK を課す (Issue )。
--
-- 対象: antisocial_checks, business_trips, certificate_requests, family_care_leaves, life_events,
-- rental_reservations, resignations, room_reservations, one_on_ones, stocktakes
--
-- 新規の主キーは crypto.randomUUID() で採番済みなので、既存行の主キーはそのまま残す。
-- 旧 seed の version 0 の疑似 UUID のように UUID の検査を通らない主キーだけを v4 の UUID へ置き換え、
-- stocktake_items.stocktake_id の参照も同じ対応で書き換える。
--
-- 置き換える主キーが保全・撤去・案件・監査の証跡に現れる場合と、所有業務が撤去の停止中の場合は、
-- 検証表の CHECK で migration を止める。証跡は変更不能なので書き換えず、先に運用者が解消する。
-- 保全の取得は UUID でない主キーを受け付けないため、通常はこの条件に当たらない。
--
-- table を作り直すと消える index と trigger は、作り直す前の定義から復元する。

CREATE TABLE _business_uuid_primary_key_check_validation (
  resource TEXT PRIMARY KEY NOT NULL,
  source_count INTEGER NOT NULL,
  target_count INTEGER NOT NULL,
  orphan_count INTEGER NOT NULL,
  non_uuid_count INTEGER NOT NULL,
  blocked_count INTEGER NOT NULL,
  CHECK (source_count = target_count AND orphan_count = 0 AND non_uuid_count = 0 AND blocked_count = 0)
);

-- antisocial_checks
CREATE TABLE _antisocial_checks_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _antisocial_checks_id_map (old_id, new_id)
SELECT id, CASE WHEN length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]' THEN id ELSE lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) END
FROM antisocial_checks;

-- business_trips
CREATE TABLE _business_trips_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _business_trips_id_map (old_id, new_id)
SELECT id, CASE WHEN length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]' THEN id ELSE lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) END
FROM business_trips;

-- certificate_requests
CREATE TABLE _certificate_requests_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _certificate_requests_id_map (old_id, new_id)
SELECT id, CASE WHEN length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]' THEN id ELSE lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) END
FROM certificate_requests;

-- family_care_leaves
CREATE TABLE _family_care_leaves_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _family_care_leaves_id_map (old_id, new_id)
SELECT id, CASE WHEN length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]' THEN id ELSE lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) END
FROM family_care_leaves;

-- life_events
CREATE TABLE _life_events_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _life_events_id_map (old_id, new_id)
SELECT id, CASE WHEN length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]' THEN id ELSE lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) END
FROM life_events;

-- rental_reservations
CREATE TABLE _rental_reservations_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _rental_reservations_id_map (old_id, new_id)
SELECT id, CASE WHEN length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]' THEN id ELSE lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) END
FROM rental_reservations;

-- resignations
CREATE TABLE _resignations_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _resignations_id_map (old_id, new_id)
SELECT id, CASE WHEN length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]' THEN id ELSE lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) END
FROM resignations;

-- room_reservations
CREATE TABLE _room_reservations_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _room_reservations_id_map (old_id, new_id)
SELECT id, CASE WHEN length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]' THEN id ELSE lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) END
FROM room_reservations;

-- one_on_ones
CREATE TABLE _one_on_ones_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _one_on_ones_id_map (old_id, new_id)
SELECT id, CASE WHEN length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]' THEN id ELSE lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) END
FROM one_on_ones;

-- stocktakes
CREATE TABLE _stocktakes_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _stocktakes_id_map (old_id, new_id)
SELECT id, CASE WHEN length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]' THEN id ELSE lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) END
FROM stocktakes;

-- antisocial_checks
CREATE TABLE "__new_antisocial_checks" (
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
INSERT INTO "__new_antisocial_checks" (id, requester_id, partner_name, partner_address, representative_name, result, status, created_at)
SELECT map.new_id,
       source.requester_id,
       source.partner_name,
       source.partner_address,
       source.representative_name,
       source.result,
       source.status,
       source.created_at
FROM antisocial_checks source
INNER JOIN _antisocial_checks_id_map map ON map.old_id = source.id;
INSERT INTO _business_uuid_primary_key_check_validation
SELECT 'antisocial_checks',
       (SELECT count(*) FROM antisocial_checks),
       (SELECT count(*) FROM "__new_antisocial_checks"),
       0,
       (SELECT count(*) FROM "__new_antisocial_checks" WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'antisocial-check' AND revision = 1)
         + (SELECT count(*) FROM _antisocial_checks_id_map WHERE old_id IS NOT new_id AND (
             EXISTS (SELECT 1 FROM system_record_coverage_entries entry WHERE entry.source_record_id = _antisocial_checks_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_preserved_records preserved WHERE json_extract(preserved.snapshot_json, '$.source.recordId') = _antisocial_checks_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_cases workflow_case WHERE workflow_case.subject_id = _antisocial_checks_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_audit_events audit WHERE audit.target_id = _antisocial_checks_id_map.old_id)));
DROP TABLE antisocial_checks;
ALTER TABLE "__new_antisocial_checks" RENAME TO antisocial_checks;
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

-- business_trips
CREATE TABLE "__new_business_trips" (
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
INSERT INTO "__new_business_trips" (id, traveler_id, destination, start_date, end_date, purpose, estimated_cost, status, created_at)
SELECT map.new_id,
       source.traveler_id,
       source.destination,
       source.start_date,
       source.end_date,
       source.purpose,
       source.estimated_cost,
       source.status,
       source.created_at
FROM business_trips source
INNER JOIN _business_trips_id_map map ON map.old_id = source.id;
INSERT INTO _business_uuid_primary_key_check_validation
SELECT 'business_trips',
       (SELECT count(*) FROM business_trips),
       (SELECT count(*) FROM "__new_business_trips"),
       0,
       (SELECT count(*) FROM "__new_business_trips" WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'business-trip' AND revision = 1)
         + (SELECT count(*) FROM _business_trips_id_map WHERE old_id IS NOT new_id AND (
             EXISTS (SELECT 1 FROM system_record_coverage_entries entry WHERE entry.source_record_id = _business_trips_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_preserved_records preserved WHERE json_extract(preserved.snapshot_json, '$.source.recordId') = _business_trips_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_cases workflow_case WHERE workflow_case.subject_id = _business_trips_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_audit_events audit WHERE audit.target_id = _business_trips_id_map.old_id)));
DROP TABLE business_trips;
ALTER TABLE "__new_business_trips" RENAME TO business_trips;
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

-- certificate_requests
CREATE TABLE "__new_certificate_requests" (
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
INSERT INTO "__new_certificate_requests" (id, requester_id, certificate_type, submit_to, needed_by, note, status, created_at)
SELECT map.new_id,
       source.requester_id,
       source.certificate_type,
       source.submit_to,
       source.needed_by,
       source.note,
       source.status,
       source.created_at
FROM certificate_requests source
INNER JOIN _certificate_requests_id_map map ON map.old_id = source.id;
INSERT INTO _business_uuid_primary_key_check_validation
SELECT 'certificate_requests',
       (SELECT count(*) FROM certificate_requests),
       (SELECT count(*) FROM "__new_certificate_requests"),
       0,
       (SELECT count(*) FROM "__new_certificate_requests" WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'certificate-request' AND revision = 1)
         + (SELECT count(*) FROM _certificate_requests_id_map WHERE old_id IS NOT new_id AND (
             EXISTS (SELECT 1 FROM system_record_coverage_entries entry WHERE entry.source_record_id = _certificate_requests_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_preserved_records preserved WHERE json_extract(preserved.snapshot_json, '$.source.recordId') = _certificate_requests_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_cases workflow_case WHERE workflow_case.subject_id = _certificate_requests_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_audit_events audit WHERE audit.target_id = _certificate_requests_id_map.old_id)));
DROP TABLE certificate_requests;
ALTER TABLE "__new_certificate_requests" RENAME TO certificate_requests;
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

-- family_care_leaves
CREATE TABLE "__new_family_care_leaves" (
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
INSERT INTO "__new_family_care_leaves" (id, employee_id, leave_kind, start_date, end_date, note, status, created_at)
SELECT map.new_id,
       source.employee_id,
       source.leave_kind,
       source.start_date,
       source.end_date,
       source.note,
       source.status,
       source.created_at
FROM family_care_leaves source
INNER JOIN _family_care_leaves_id_map map ON map.old_id = source.id;
INSERT INTO _business_uuid_primary_key_check_validation
SELECT 'family_care_leaves',
       (SELECT count(*) FROM family_care_leaves),
       (SELECT count(*) FROM "__new_family_care_leaves"),
       0,
       (SELECT count(*) FROM "__new_family_care_leaves" WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'family-care-leave' AND revision = 1)
         + (SELECT count(*) FROM _family_care_leaves_id_map WHERE old_id IS NOT new_id AND (
             EXISTS (SELECT 1 FROM system_record_coverage_entries entry WHERE entry.source_record_id = _family_care_leaves_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_preserved_records preserved WHERE json_extract(preserved.snapshot_json, '$.source.recordId') = _family_care_leaves_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_cases workflow_case WHERE workflow_case.subject_id = _family_care_leaves_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_audit_events audit WHERE audit.target_id = _family_care_leaves_id_map.old_id)));
DROP TABLE family_care_leaves;
ALTER TABLE "__new_family_care_leaves" RENAME TO family_care_leaves;
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

-- life_events
CREATE TABLE "__new_life_events" (
  id TEXT PRIMARY KEY NOT NULL,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  event_type TEXT NOT NULL,
  event_date TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO "__new_life_events" (id, employee_id, event_type, event_date, detail, status, created_at)
SELECT map.new_id,
       source.employee_id,
       source.event_type,
       source.event_date,
       source.detail,
       source.status,
       source.created_at
FROM life_events source
INNER JOIN _life_events_id_map map ON map.old_id = source.id;
INSERT INTO _business_uuid_primary_key_check_validation
SELECT 'life_events',
       (SELECT count(*) FROM life_events),
       (SELECT count(*) FROM "__new_life_events"),
       0,
       (SELECT count(*) FROM "__new_life_events" WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'life-event' AND revision = 1)
         + (SELECT count(*) FROM _life_events_id_map WHERE old_id IS NOT new_id AND (
             EXISTS (SELECT 1 FROM system_record_coverage_entries entry WHERE entry.source_record_id = _life_events_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_preserved_records preserved WHERE json_extract(preserved.snapshot_json, '$.source.recordId') = _life_events_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_cases workflow_case WHERE workflow_case.subject_id = _life_events_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_audit_events audit WHERE audit.target_id = _life_events_id_map.old_id)));
DROP TABLE life_events;
ALTER TABLE "__new_life_events" RENAME TO life_events;
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

-- rental_reservations
CREATE TABLE "__new_rental_reservations" (
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
INSERT INTO "__new_rental_reservations" (id, requester_id, item_name, start_date, end_date, purpose, status, created_at)
SELECT map.new_id,
       source.requester_id,
       source.item_name,
       source.start_date,
       source.end_date,
       source.purpose,
       source.status,
       source.created_at
FROM rental_reservations source
INNER JOIN _rental_reservations_id_map map ON map.old_id = source.id;
INSERT INTO _business_uuid_primary_key_check_validation
SELECT 'rental_reservations',
       (SELECT count(*) FROM rental_reservations),
       (SELECT count(*) FROM "__new_rental_reservations"),
       0,
       (SELECT count(*) FROM "__new_rental_reservations" WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'rental' AND revision = 1)
         + (SELECT count(*) FROM _rental_reservations_id_map WHERE old_id IS NOT new_id AND (
             EXISTS (SELECT 1 FROM system_record_coverage_entries entry WHERE entry.source_record_id = _rental_reservations_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_preserved_records preserved WHERE json_extract(preserved.snapshot_json, '$.source.recordId') = _rental_reservations_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_cases workflow_case WHERE workflow_case.subject_id = _rental_reservations_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_audit_events audit WHERE audit.target_id = _rental_reservations_id_map.old_id)));
DROP TABLE rental_reservations;
ALTER TABLE "__new_rental_reservations" RENAME TO rental_reservations;
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
CREATE TABLE "__new_resignations" (
  id TEXT PRIMARY KEY NOT NULL,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  resignation_date TEXT NOT NULL,
  last_working_date TEXT,
  reason TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO "__new_resignations" (id, employee_id, resignation_date, last_working_date, reason, status, created_at)
SELECT map.new_id,
       source.employee_id,
       source.resignation_date,
       source.last_working_date,
       source.reason,
       source.status,
       source.created_at
FROM resignations source
INNER JOIN _resignations_id_map map ON map.old_id = source.id;
INSERT INTO _business_uuid_primary_key_check_validation
SELECT 'resignations',
       (SELECT count(*) FROM resignations),
       (SELECT count(*) FROM "__new_resignations"),
       0,
       (SELECT count(*) FROM "__new_resignations" WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'resignation' AND revision = 1)
         + (SELECT count(*) FROM _resignations_id_map WHERE old_id IS NOT new_id AND (
             EXISTS (SELECT 1 FROM system_record_coverage_entries entry WHERE entry.source_record_id = _resignations_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_preserved_records preserved WHERE json_extract(preserved.snapshot_json, '$.source.recordId') = _resignations_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_cases workflow_case WHERE workflow_case.subject_id = _resignations_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_audit_events audit WHERE audit.target_id = _resignations_id_map.old_id)));
DROP TABLE resignations;
ALTER TABLE "__new_resignations" RENAME TO resignations;
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

-- room_reservations
CREATE TABLE "__new_room_reservations" (
  id TEXT PRIMARY KEY NOT NULL,
  room_id INTEGER NOT NULL,
  reserver_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  purpose TEXT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO "__new_room_reservations" (id, room_id, reserver_id, start_at, end_at, purpose)
SELECT map.new_id,
       source.room_id,
       source.reserver_id,
       source.start_at,
       source.end_at,
       source.purpose
FROM room_reservations source
INNER JOIN _room_reservations_id_map map ON map.old_id = source.id;
INSERT INTO _business_uuid_primary_key_check_validation
SELECT 'room_reservations',
       (SELECT count(*) FROM room_reservations),
       (SELECT count(*) FROM "__new_room_reservations"),
       0,
       (SELECT count(*) FROM "__new_room_reservations" WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'room' AND revision = 1)
         + (SELECT count(*) FROM _room_reservations_id_map WHERE old_id IS NOT new_id AND (
             EXISTS (SELECT 1 FROM system_record_coverage_entries entry WHERE entry.source_record_id = _room_reservations_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_preserved_records preserved WHERE json_extract(preserved.snapshot_json, '$.source.recordId') = _room_reservations_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_cases workflow_case WHERE workflow_case.subject_id = _room_reservations_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_audit_events audit WHERE audit.target_id = _room_reservations_id_map.old_id)));
DROP TABLE room_reservations;
ALTER TABLE "__new_room_reservations" RENAME TO room_reservations;
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

-- one_on_ones
CREATE TABLE "__new_one_on_ones" (
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
INSERT INTO "__new_one_on_ones" (id, member_id, manager_id, held_at, topics, manager_note, next_action, external_reference)
SELECT map.new_id,
       source.member_id,
       source.manager_id,
       source.held_at,
       source.topics,
       source.manager_note,
       source.next_action,
       source.external_reference
FROM one_on_ones source
INNER JOIN _one_on_ones_id_map map ON map.old_id = source.id;
INSERT INTO _business_uuid_primary_key_check_validation
SELECT 'one_on_ones',
       (SELECT count(*) FROM one_on_ones),
       (SELECT count(*) FROM "__new_one_on_ones"),
       0,
       (SELECT count(*) FROM "__new_one_on_ones" WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'one-on-one' AND revision = 1)
         + (SELECT count(*) FROM _one_on_ones_id_map WHERE old_id IS NOT new_id AND (
             EXISTS (SELECT 1 FROM system_record_coverage_entries entry WHERE entry.source_record_id = _one_on_ones_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_preserved_records preserved WHERE json_extract(preserved.snapshot_json, '$.source.recordId') = _one_on_ones_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_cases workflow_case WHERE workflow_case.subject_id = _one_on_ones_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_audit_events audit WHERE audit.target_id = _one_on_ones_id_map.old_id)));
DROP TABLE one_on_ones;
ALTER TABLE "__new_one_on_ones" RENAME TO one_on_ones;
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

-- stocktakes
CREATE TABLE "__new_stocktakes" (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  target_date TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  closed_at TEXT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO "__new_stocktakes" (id, name, target_date, status, created_at, closed_at)
SELECT map.new_id,
       source.name,
       source.target_date,
       source.status,
       source.created_at,
       source.closed_at
FROM stocktakes source
INNER JOIN _stocktakes_id_map map ON map.old_id = source.id;
INSERT INTO _business_uuid_primary_key_check_validation
SELECT 'stocktakes',
       (SELECT count(*) FROM stocktakes),
       (SELECT count(*) FROM "__new_stocktakes"),
       0,
       (SELECT count(*) FROM "__new_stocktakes" WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'asset' AND revision = 1)
         + (SELECT count(*) FROM _stocktakes_id_map WHERE old_id IS NOT new_id AND (
             EXISTS (SELECT 1 FROM system_record_coverage_entries entry WHERE entry.source_record_id = _stocktakes_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_preserved_records preserved WHERE json_extract(preserved.snapshot_json, '$.source.recordId') = _stocktakes_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_cases workflow_case WHERE workflow_case.subject_id = _stocktakes_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_audit_events audit WHERE audit.target_id = _stocktakes_id_map.old_id)));
DROP TABLE stocktakes;
ALTER TABLE "__new_stocktakes" RENAME TO stocktakes;
CREATE INDEX idx_stocktakes_status ON stocktakes (status);
CREATE TRIGGER stocktakes_source_freeze_delete BEFORE DELETE ON stocktakes
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='asset' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'asset_record_source_frozen'); END;
CREATE TRIGGER stocktakes_source_freeze_insert BEFORE INSERT ON stocktakes
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='asset' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'asset_record_source_frozen'); END;
CREATE TRIGGER stocktakes_source_freeze_update BEFORE UPDATE ON stocktakes
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='asset' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'asset_record_source_frozen'); END;

-- stocktake_items は外部キーを持たない同じ業務内の参照で、置き換えた棚卸しの主キーへ追従させる。
UPDATE stocktake_items
SET stocktake_id = (SELECT map.new_id FROM _stocktakes_id_map map WHERE map.old_id = stocktake_items.stocktake_id)
WHERE stocktake_id IN (SELECT old_id FROM _stocktakes_id_map WHERE old_id IS NOT new_id);
INSERT INTO _business_uuid_primary_key_check_validation
SELECT 'stocktake_items.stocktake_id', 0, 0,
       (SELECT count(*) FROM stocktake_items item
        INNER JOIN _stocktakes_id_map map ON map.old_id = item.stocktake_id
        WHERE map.old_id IS NOT map.new_id),
       0, 0;

DROP TABLE _antisocial_checks_id_map;
DROP TABLE _business_trips_id_map;
DROP TABLE _certificate_requests_id_map;
DROP TABLE _family_care_leaves_id_map;
DROP TABLE _life_events_id_map;
DROP TABLE _rental_reservations_id_map;
DROP TABLE _resignations_id_map;
DROP TABLE _room_reservations_id_map;
DROP TABLE _one_on_ones_id_map;
DROP TABLE _stocktakes_id_map;
DROP TABLE _business_uuid_primary_key_check_validation;
