-- void:allow-destructive
-- browser / CLI login codeを発行時のtoken versionへ束縛し、browser codeは発行元のSession familyへも束縛する。
-- token versionの更新やSession familyの失効の後に、失効前に発行したcodeで新しいSessionを得られないようにする。
-- codeは60秒で失効する一時credentialなので、既存の未使用codeは破棄して再作成する。
DROP TABLE system_browser_login_codes;
--> statement-breakpoint
CREATE TABLE system_browser_login_codes (
  code_hash TEXT PRIMARY KEY NOT NULL
    CHECK (length(code_hash) BETWEEN 32 AND 512),
  account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE CASCADE,
  token_version INTEGER NOT NULL
    CHECK (token_version >= 0),
  session_family_id TEXT
    CHECK (session_family_id IS NULL OR length(session_family_id) BETWEEN 1 AND 255),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  CHECK (expires_at > created_at)
);
--> statement-breakpoint
CREATE INDEX system_browser_login_codes_expires_idx
  ON system_browser_login_codes (expires_at);
--> statement-breakpoint
DROP TABLE system_cli_login_codes;
--> statement-breakpoint
CREATE TABLE system_cli_login_codes (
  code_hash TEXT PRIMARY KEY NOT NULL
    CHECK (length(code_hash) BETWEEN 32 AND 512),
  account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE CASCADE,
  token_version INTEGER NOT NULL
    CHECK (token_version >= 0),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  CHECK (expires_at > created_at)
);
--> statement-breakpoint
CREATE INDEX system_cli_login_codes_expires_idx
  ON system_cli_login_codes (expires_at);
