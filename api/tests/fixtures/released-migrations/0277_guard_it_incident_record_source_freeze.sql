CREATE TRIGGER it_incidents_source_freeze_insert
BEFORE INSERT ON it_incidents
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'it-incident' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'it_incident_record_source_frozen'); END;

CREATE TRIGGER it_incidents_source_freeze_update
BEFORE UPDATE ON it_incidents
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'it-incident' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'it_incident_record_source_frozen'); END;

CREATE TRIGGER it_incidents_source_freeze_delete
BEFORE DELETE ON it_incidents
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'it-incident' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'it_incident_record_source_frozen'); END;
