-- System の現行 persistence contract に、既存行を保持したまま不足列と招待を追加する。

ALTER TABLE system_accounts ADD COLUMN closed_at INTEGER
  CHECK (closed_at IS NULL OR closed_at >= created_at);

ALTER TABLE system_identity_profiles ADD COLUMN can_receive_email INTEGER NOT NULL DEFAULT 1
  CHECK (can_receive_email IN (0, 1));

ALTER TABLE system_iam_roles ADD COLUMN resource_type TEXT
  CHECK (resource_type IS NULL OR length(resource_type) BETWEEN 3 AND 100);

ALTER TABLE system_notification_messages ADD COLUMN action_url TEXT
  CHECK (action_url IS NULL OR length(action_url) BETWEEN 1 AND 2048);

ALTER TABLE system_notification_messages ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal'
  CHECK (priority IN ('low', 'normal', 'high', 'critical'));

ALTER TABLE system_notification_messages ADD COLUMN dedupe_key TEXT;

CREATE INDEX system_notification_messages_priority_idx
  ON system_notification_messages(priority, created_at);

CREATE UNIQUE INDEX system_notification_messages_dedupe_key_uniq
  ON system_notification_messages(dedupe_key);

CREATE TABLE system_account_invitations (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) BETWEEN 1 AND 255),
  token TEXT NOT NULL,
  subject TEXT,
  role_id TEXT NOT NULL
    REFERENCES system_iam_roles(id) ON DELETE RESTRICT,
  accepted_by_account_id TEXT
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (
    updated_at >= created_at
    AND expires_at >= created_at
    AND (revoked_at IS NULL OR revoked_at >= created_at)
  )
);

CREATE UNIQUE INDEX system_account_invitations_token_uniq
  ON system_account_invitations(token);

CREATE INDEX system_account_invitations_role_idx
  ON system_account_invitations(role_id, created_at);

CREATE INDEX system_account_invitations_subject_idx
  ON system_account_invitations(subject, created_at);
