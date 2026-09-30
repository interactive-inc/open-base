CREATE TRIGGER announcements_source_freeze_insert
BEFORE INSERT ON announcements
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'announcement' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'announcement_record_source_frozen'); END;

CREATE TRIGGER announcements_source_freeze_update
BEFORE UPDATE ON announcements
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'announcement' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'announcement_record_source_frozen'); END;

CREATE TRIGGER announcements_source_freeze_delete
BEFORE DELETE ON announcements
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'announcement' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'announcement_record_source_frozen'); END;
