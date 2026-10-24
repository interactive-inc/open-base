-- 資産管理を撤去する間、4台帳のどの経路からも停止を迂回できないようにする。
DROP TRIGGER IF EXISTS assets_source_freeze_insert;
CREATE TRIGGER assets_source_freeze_insert BEFORE INSERT ON assets
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='asset' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'asset_record_source_frozen'); END;
DROP TRIGGER IF EXISTS assets_source_freeze_update;
CREATE TRIGGER assets_source_freeze_update BEFORE UPDATE ON assets
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='asset' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'asset_record_source_frozen'); END;
DROP TRIGGER IF EXISTS assets_source_freeze_delete;
CREATE TRIGGER assets_source_freeze_delete BEFORE DELETE ON assets
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='asset' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'asset_record_source_frozen'); END;

DROP TRIGGER IF EXISTS asset_lendings_source_freeze_insert;
CREATE TRIGGER asset_lendings_source_freeze_insert BEFORE INSERT ON asset_lendings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='asset' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'asset_record_source_frozen'); END;
DROP TRIGGER IF EXISTS asset_lendings_source_freeze_update;
CREATE TRIGGER asset_lendings_source_freeze_update BEFORE UPDATE ON asset_lendings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='asset' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'asset_record_source_frozen'); END;
DROP TRIGGER IF EXISTS asset_lendings_source_freeze_delete;
CREATE TRIGGER asset_lendings_source_freeze_delete BEFORE DELETE ON asset_lendings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='asset' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'asset_record_source_frozen'); END;

DROP TRIGGER IF EXISTS stocktakes_source_freeze_insert;
CREATE TRIGGER stocktakes_source_freeze_insert BEFORE INSERT ON stocktakes
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='asset' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'asset_record_source_frozen'); END;
DROP TRIGGER IF EXISTS stocktakes_source_freeze_update;
CREATE TRIGGER stocktakes_source_freeze_update BEFORE UPDATE ON stocktakes
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='asset' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'asset_record_source_frozen'); END;
DROP TRIGGER IF EXISTS stocktakes_source_freeze_delete;
CREATE TRIGGER stocktakes_source_freeze_delete BEFORE DELETE ON stocktakes
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='asset' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'asset_record_source_frozen'); END;

DROP TRIGGER IF EXISTS stocktake_items_source_freeze_insert;
CREATE TRIGGER stocktake_items_source_freeze_insert BEFORE INSERT ON stocktake_items
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='asset' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'asset_record_source_frozen'); END;
DROP TRIGGER IF EXISTS stocktake_items_source_freeze_update;
CREATE TRIGGER stocktake_items_source_freeze_update BEFORE UPDATE ON stocktake_items
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='asset' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'asset_record_source_frozen'); END;
DROP TRIGGER IF EXISTS stocktake_items_source_freeze_delete;
CREATE TRIGGER stocktake_items_source_freeze_delete BEFORE DELETE ON stocktake_items
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='asset' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'asset_record_source_frozen'); END;
