-- 会議室業務の撤去準備中は会議室と予約の全書込みを停止する。
CREATE TRIGGER rooms_source_freeze_insert BEFORE INSERT ON rooms
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'room' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'room_record_source_frozen'); END;
CREATE TRIGGER rooms_source_freeze_update BEFORE UPDATE ON rooms
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'room' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'room_record_source_frozen'); END;
CREATE TRIGGER rooms_source_freeze_delete BEFORE DELETE ON rooms
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'room' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'room_record_source_frozen'); END;

CREATE TRIGGER room_reservations_source_freeze_insert BEFORE INSERT ON room_reservations
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'room' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'room_record_source_frozen'); END;
CREATE TRIGGER room_reservations_source_freeze_update BEFORE UPDATE ON room_reservations
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'room' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'room_record_source_frozen'); END;
CREATE TRIGGER room_reservations_source_freeze_delete BEFORE DELETE ON room_reservations
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'room' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'room_record_source_frozen'); END;
