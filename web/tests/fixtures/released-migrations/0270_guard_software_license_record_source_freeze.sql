CREATE TRIGGER software_licenses_source_freeze_insert
BEFORE INSERT ON software_licenses
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'software-license' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'software_license_record_source_frozen'); END;

CREATE TRIGGER software_licenses_source_freeze_update
BEFORE UPDATE ON software_licenses
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'software-license' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'software_license_record_source_frozen'); END;

CREATE TRIGGER software_licenses_source_freeze_delete
BEFORE DELETE ON software_licenses
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'software-license' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'software_license_record_source_frozen'); END;

CREATE TRIGGER software_license_assignments_source_freeze_insert
BEFORE INSERT ON software_license_assignments
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'software-license' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'software_license_record_source_frozen'); END;

CREATE TRIGGER software_license_assignments_source_freeze_update
BEFORE UPDATE ON software_license_assignments
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'software-license' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'software_license_record_source_frozen'); END;

CREATE TRIGGER software_license_assignments_source_freeze_delete
BEFORE DELETE ON software_license_assignments
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'software-license' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'software_license_record_source_frozen'); END;

CREATE TRIGGER software_license_changes_source_freeze_insert
BEFORE INSERT ON software_license_changes
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'software-license' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'software_license_record_source_frozen'); END;

CREATE TRIGGER software_license_changes_source_freeze_update
BEFORE UPDATE ON software_license_changes
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'software-license' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'software_license_record_source_frozen'); END;

CREATE TRIGGER software_license_changes_source_freeze_delete
BEFORE DELETE ON software_license_changes
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'software-license' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'software_license_record_source_frozen'); END;
