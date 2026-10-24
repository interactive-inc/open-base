CREATE TRIGGER system_record_retirement_receipts_pin_attachments AFTER INSERT ON system_record_retirement_receipts
BEGIN
  SELECT RAISE(ABORT,'record_retirement_attachment_format_unsupported') WHERE EXISTS (
    SELECT 1 FROM system_record_coverage_pages page, json_each(page.snapshot_json,'$.records') item
    WHERE page.id=NEW.coverage_page_id
      AND json_extract(item.value,'$.source.formatId')='system-attachment-record'
      AND json_extract(item.value,'$.source.formatVersion') IS NOT 1
  );
  INSERT INTO system_record_retirement_attachment_pins(receipt_id,attachment_id)
    SELECT NEW.id,json_extract(item.value,'$.source.recordId')
    FROM system_record_coverage_pages page, json_each(page.snapshot_json,'$.records') item
    WHERE page.id=NEW.coverage_page_id AND json_extract(item.value,'$.source.formatId')='system-attachment-record';
END;
