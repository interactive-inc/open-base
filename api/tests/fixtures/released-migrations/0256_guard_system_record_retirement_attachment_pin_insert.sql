CREATE TRIGGER system_record_retirement_attachment_pins_insert BEFORE INSERT ON system_record_retirement_attachment_pins
BEGIN
  SELECT RAISE(ABORT,'record_retirement_attachment_pin_duplicate') WHERE EXISTS (
    SELECT 1 FROM system_record_retirement_attachment_pins WHERE receipt_id=NEW.receipt_id AND attachment_id=NEW.attachment_id
  );
  SELECT RAISE(ABORT,'record_retirement_attachment_pin_invalid') WHERE NOT EXISTS (
    SELECT 1 FROM system_record_retirement_receipts receipt
    JOIN system_record_retirement_plans plan ON plan.id=receipt.plan_id
    JOIN system_record_source_freezes freeze ON freeze.id=plan.freeze_id AND freeze.revision=1
    JOIN system_record_coverage_pages page ON page.id=receipt.coverage_page_id
    JOIN json_each(page.snapshot_json,'$.records') item
    JOIN system_attachments attachment ON attachment.id=NEW.attachment_id
    WHERE receipt.id=NEW.receipt_id
      AND json_extract(item.value,'$.source.recordId') IS NEW.attachment_id
      AND json_extract(item.value,'$.source.formatId')='system-attachment-record'
      AND json_extract(item.value,'$.source.formatVersion') IS 1
      AND attachment.status='linked' AND attachment.erased_at IS NULL
      AND attachment.wrapped_dek IS NOT NULL AND attachment.wrapped_dek_iv IS NOT NULL
      AND attachment.linked_at IS NOT NULL AND attachment.created_at<=attachment.linked_at
      AND attachment.linked_at<=round((julianday(json_extract(receipt.snapshot_json,'$.checkedAt'))-2440587.5)*86400000)
  );
END;
