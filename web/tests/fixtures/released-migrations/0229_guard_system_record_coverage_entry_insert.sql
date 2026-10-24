DROP TRIGGER IF EXISTS system_record_coverage_entries_insert;
CREATE TRIGGER system_record_coverage_entries_insert BEFORE INSERT ON system_record_coverage_entries
BEGIN
  SELECT RAISE(ABORT,'record_coverage_entry_duplicate') WHERE EXISTS (
    SELECT 1 FROM system_record_coverage_entries WHERE freeze_id=NEW.freeze_id
      AND ((record_kind=NEW.record_kind AND source_record_id=NEW.source_record_id) OR preserved_record_id=NEW.preserved_record_id)
  );
  SELECT RAISE(ABORT,'record_coverage_source_mismatch') WHERE NOT EXISTS (
    SELECT 1 FROM system_record_coverage_pages p, json_each(p.snapshot_json,'$.records') item
    JOIN system_preserved_records r ON r.id=NEW.preserved_record_id
    WHERE p.id=NEW.page_id AND p.freeze_id=NEW.freeze_id AND p.record_kind=NEW.record_kind
      AND json_extract(item.value,'$.preservedRecordId') IS NEW.preserved_record_id
      AND json_extract(item.value,'$.source.recordId') IS NEW.source_record_id
      AND json_extract(item.value,'$.source.sourceNamespace') IS json_extract(p.snapshot_json,'$.sourceNamespace')
      AND json_extract(item.value,'$.source.ownerContext') IS json_extract(p.snapshot_json,'$.ownerContext')
      AND json_extract(item.value,'$.source.recordKind') IS NEW.record_kind
      AND json_extract(item.value,'$.source') IS json_extract(r.snapshot_json,'$.source')
  );
END;
