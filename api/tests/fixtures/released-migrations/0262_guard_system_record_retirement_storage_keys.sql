CREATE TRIGGER system_record_retirement_receipts_storage_keys BEFORE INSERT ON system_record_retirement_receipts
BEGIN
  SELECT RAISE(ABORT,'record_retirement_storage_keys_invalid') WHERE
    json_type(NEW.snapshot_json,'$.storageKeys') IS NOT 'array'
    OR json_array_length(NEW.snapshot_json,'$.storageKeys')>200
    OR (SELECT count(DISTINCT json_extract(value,'$.version')) FROM json_each(NEW.snapshot_json,'$.storageKeys'))
      <>json_array_length(NEW.snapshot_json,'$.storageKeys')
    OR EXISTS (SELECT 1 FROM json_each(NEW.snapshot_json,'$.storageKeys') key
      WHERE json_type(key.value,'$.version') IS NOT 'integer' OR json_extract(key.value,'$.version')<=0
        OR length(json_extract(key.value,'$.digest')) IS NOT 64
        OR json_extract(key.value,'$.digest') GLOB '*[^0-9a-f]*');
  SELECT RAISE(ABORT,'record_retirement_storage_keys_incomplete') WHERE
    EXISTS (SELECT 1 FROM (SELECT attachment.kek_version AS version FROM system_record_coverage_pages page
      JOIN json_each(page.snapshot_json,'$.records') item
      JOIN system_preserved_records record ON record.id=json_extract(item.value,'$.preservedRecordId')
      JOIN system_attachments attachment ON attachment.id=record.attachment_id WHERE page.id=NEW.coverage_page_id
      UNION SELECT attachment.kek_version AS version FROM system_record_coverage_pages page
      JOIN json_each(page.snapshot_json,'$.records') item
      JOIN system_attachments attachment ON attachment.id=json_extract(item.value,'$.source.recordId')
      WHERE page.id=NEW.coverage_page_id AND json_extract(item.value,'$.source.formatId')='system-attachment-record' ) expected WHERE NOT EXISTS (
      SELECT 1 FROM json_each(NEW.snapshot_json,'$.storageKeys') key WHERE json_extract(key.value,'$.version') IS expected.version
    )) OR EXISTS (SELECT 1 FROM json_each(NEW.snapshot_json,'$.storageKeys') key WHERE NOT EXISTS (
      SELECT 1 FROM (SELECT attachment.kek_version AS version FROM system_record_coverage_pages page
      JOIN json_each(page.snapshot_json,'$.records') item
      JOIN system_preserved_records record ON record.id=json_extract(item.value,'$.preservedRecordId')
      JOIN system_attachments attachment ON attachment.id=record.attachment_id WHERE page.id=NEW.coverage_page_id
      UNION SELECT attachment.kek_version AS version FROM system_record_coverage_pages page
      JOIN json_each(page.snapshot_json,'$.records') item
      JOIN system_attachments attachment ON attachment.id=json_extract(item.value,'$.source.recordId')
      WHERE page.id=NEW.coverage_page_id AND json_extract(item.value,'$.source.formatId')='system-attachment-record' ) expected WHERE expected.version IS json_extract(key.value,'$.version')
    ));
END;
