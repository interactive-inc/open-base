DROP TRIGGER IF EXISTS system_record_coverage_pages_index;
CREATE TRIGGER system_record_coverage_pages_index AFTER INSERT ON system_record_coverage_pages
BEGIN
  INSERT INTO system_record_coverage_entries(page_id,freeze_id,record_kind,source_record_id,preserved_record_id)
    SELECT NEW.id,NEW.freeze_id,NEW.record_kind,json_extract(item.value,'$.source.recordId'),json_extract(item.value,'$.preservedRecordId')
    FROM json_each(NEW.snapshot_json,'$.records') item;
END;
