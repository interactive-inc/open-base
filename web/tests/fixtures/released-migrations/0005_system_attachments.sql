-- 添付のメタデータと復号鍵。本体は object storage に暗号文で置く。
-- wrapped_dek を NULL にすると全バックアップ世代の暗号文が復号不能になる。
CREATE TABLE system_attachments (
  id TEXT PRIMARY KEY,
  owner_account_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  plaintext_sha256 TEXT NOT NULL,
  wrapped_dek TEXT,
  wrapped_dek_iv TEXT,
  content_iv TEXT NOT NULL,
  kek_version INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  linked_at INTEGER,
  erased_at INTEGER,
  CHECK (status IN ('uploading', 'pending', 'linked', 'erased')),
  CHECK (byte_size > 0),
  CHECK (kek_version > 0),
  CHECK (object_key LIKE 'att/%' AND length(object_key) <= 255),
  CHECK ((status = 'erased') = (wrapped_dek IS NULL))
);

CREATE INDEX idx_system_attachments_owner_status
  ON system_attachments (owner_account_id, status);

CREATE INDEX idx_system_attachments_created_at
  ON system_attachments (created_at);
