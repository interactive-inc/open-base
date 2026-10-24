CREATE TABLE system_notification_resource_scopes (
  message_id TEXT PRIMARY KEY NOT NULL
    REFERENCES system_notification_messages(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL
    CHECK (length(resource_type) BETWEEN 3 AND 100),
  resource_id TEXT NOT NULL
    CHECK (length(resource_id) BETWEEN 1 AND 512)
);

CREATE INDEX system_notification_resource_scopes_resource_idx
  ON system_notification_resource_scopes (resource_type, resource_id, message_id);
