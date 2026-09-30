CREATE TABLE system_record_retirement_attachment_pins (
  receipt_id TEXT NOT NULL REFERENCES system_record_retirement_receipts(id),
  attachment_id TEXT NOT NULL,
  PRIMARY KEY(receipt_id,attachment_id)
);
CREATE INDEX system_record_retirement_attachment_pins_attachment_idx
  ON system_record_retirement_attachment_pins(attachment_id,receipt_id);
