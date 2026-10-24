CREATE TABLE system_operation_receipts (
  operation_key TEXT NOT NULL CHECK (length(operation_key) BETWEEN 1 AND 255),
  scope_key TEXT NOT NULL CHECK (length(scope_key) BETWEEN 1 AND 255),
  command_id TEXT NOT NULL CHECK (length(command_id) BETWEEN 1 AND 255),
  actor_account_id TEXT NOT NULL CHECK (length(actor_account_id) BETWEEN 1 AND 255),
  actor_principal_id TEXT NOT NULL CHECK (length(actor_principal_id) BETWEEN 1 AND 255),
  request_digest TEXT NOT NULL CHECK (length(request_digest) = 64 AND request_digest NOT GLOB '*[^0-9a-f]*'),
  result_json TEXT NOT NULL CHECK (json_valid(result_json) AND length(CAST(result_json AS BLOB)) <= 1000000),
  result_digest TEXT NOT NULL CHECK (length(result_digest) = 64 AND result_digest NOT GLOB '*[^0-9a-f]*'),
  recorded_at INTEGER NOT NULL CHECK (typeof(recorded_at) = 'integer' AND recorded_at >= 0 AND recorded_at <= 9007199254740991),
  PRIMARY KEY (operation_key, scope_key, command_id)
);

CREATE INDEX system_operation_receipts_actor_idx ON system_operation_receipts (actor_account_id, recorded_at);
