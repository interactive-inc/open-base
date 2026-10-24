CREATE TRIGGER business_trips_source_freeze_insert
BEFORE INSERT ON business_trips
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'business-trip' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'business_trip_record_source_frozen'); END;

CREATE TRIGGER business_trips_source_freeze_update
BEFORE UPDATE ON business_trips
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'business-trip' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'business_trip_record_source_frozen'); END;

CREATE TRIGGER business_trips_source_freeze_delete
BEFORE DELETE ON business_trips
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'business-trip' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'business_trip_record_source_frozen'); END;
