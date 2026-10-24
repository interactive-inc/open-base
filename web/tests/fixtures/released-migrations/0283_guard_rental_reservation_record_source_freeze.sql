CREATE TRIGGER rental_reservations_source_freeze_insert
BEFORE INSERT ON rental_reservations
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'rental' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'rental_reservation_record_source_frozen'); END;

CREATE TRIGGER rental_reservations_source_freeze_update
BEFORE UPDATE ON rental_reservations
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'rental' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'rental_reservation_record_source_frozen'); END;

CREATE TRIGGER rental_reservations_source_freeze_delete
BEFORE DELETE ON rental_reservations
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'rental' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'rental_reservation_record_source_frozen'); END;
