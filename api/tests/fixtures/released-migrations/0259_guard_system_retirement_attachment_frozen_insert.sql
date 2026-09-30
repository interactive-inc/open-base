CREATE TRIGGER system_attachments_retirement_frozen_insert BEFORE INSERT ON system_attachments
BEGIN
  SELECT RAISE(ABORT,'record_retirement_source_attachment_frozen') WHERE EXISTS (
    SELECT 1 FROM system_record_retirement_attachment_pins pin
    JOIN system_record_retirement_receipts receipt ON receipt.id=pin.receipt_id
    JOIN system_record_retirement_plans plan ON plan.id=receipt.plan_id
    JOIN system_record_source_freezes freeze ON freeze.id=plan.freeze_id AND freeze.revision=1
    JOIN system_attachments attachment ON attachment.id=pin.attachment_id
    WHERE attachment.id=NEW.id OR attachment.object_key=NEW.object_key
  );
END;
