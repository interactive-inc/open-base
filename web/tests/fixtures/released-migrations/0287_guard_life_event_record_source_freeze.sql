DROP TRIGGER IF EXISTS life_events_source_freeze_insert;
CREATE TRIGGER life_events_source_freeze_insert
BEFORE INSERT ON life_events
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'life-event' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'life_event_record_source_frozen');
END;

DROP TRIGGER IF EXISTS life_events_source_freeze_update;
CREATE TRIGGER life_events_source_freeze_update
BEFORE UPDATE ON life_events
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'life-event' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'life_event_record_source_frozen');
END;

DROP TRIGGER IF EXISTS life_events_source_freeze_delete;
CREATE TRIGGER life_events_source_freeze_delete
BEFORE DELETE ON life_events
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'life-event' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'life_event_record_source_frozen');
END;
