-- 評価期間、評価シート、変更不能な操作履歴。承認の正本はSystemへ参照する。
CREATE TABLE performance_review_cycles (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  created_by_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) = 36),
  command_digest TEXT NOT NULL CHECK (length(command_digest) = 64),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 3000),
  created_at TEXT NOT NULL,
  UNIQUE (created_by_account_id, idempotency_key),
  CHECK (json_extract(snapshot_json, '$.id') IS id AND json_extract(snapshot_json, '$.created_by_account_id') IS created_by_account_id),
  CHECK (json_extract(snapshot_json, '$.starts_on') <= json_extract(snapshot_json, '$.ends_on'))
);
--> statement-breakpoint
CREATE TABLE performance_review_sheets (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
  cycle_id TEXT NOT NULL REFERENCES performance_review_cycles(id) ON DELETE RESTRICT,
  owner_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  employee_id TEXT NOT NULL REFERENCES company_employees(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision > 0),
  status TEXT NOT NULL CHECK (status IN ('draft','goals_pending','goals_returned','goals_rejected','goals_approved','evaluation_pending','evaluation_returned','evaluation_rejected','finalized','cancelled')),
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL CHECK (updated_at >= created_at),
  UNIQUE (cycle_id, owner_account_id),
  UNIQUE (cycle_id, employee_id),
  CHECK (json_extract(snapshot_json, '$.id') IS id AND json_extract(snapshot_json, '$.cycle_id') IS cycle_id AND json_extract(snapshot_json, '$.owner_account_id') IS owner_account_id AND json_extract(snapshot_json, '$.employee_id') IS employee_id AND json_extract(snapshot_json, '$.revision') IS revision AND json_extract(snapshot_json, '$.status') IS status AND json_extract(snapshot_json, '$.created_at') IS created_at AND json_extract(snapshot_json, '$.updated_at') IS updated_at)
);
--> statement-breakpoint
CREATE TABLE performance_review_sheet_revisions (
  sheet_id TEXT NOT NULL REFERENCES performance_review_sheets(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision > 0),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  operation TEXT NOT NULL CHECK (operation IN ('create_sheet','revise_goals','reopen_goals','self_evaluate','submit_goals','submit_evaluation','decide','cancel')),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 3000),
  detail_json TEXT NOT NULL CHECK (json_valid(detail_json)),
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  command_digest TEXT NOT NULL CHECK (length(command_digest) = 64),
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) = 36),
  request_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (sheet_id, revision),
  UNIQUE (actor_account_id, idempotency_key),
  CHECK (json_extract(snapshot_json, '$.id') IS sheet_id AND json_extract(snapshot_json, '$.revision') IS revision)
);
--> statement-breakpoint
CREATE INDEX performance_review_sheets_owner ON performance_review_sheets(owner_account_id, updated_at DESC);
--> statement-breakpoint
CREATE TRIGGER performance_review_cycles_no_update BEFORE UPDATE ON performance_review_cycles BEGIN SELECT RAISE(ABORT, 'review_cycle_is_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER performance_review_cycles_no_delete BEFORE DELETE ON performance_review_cycles BEGIN SELECT RAISE(ABORT, 'review_cycle_is_retained'); END;
--> statement-breakpoint
CREATE TRIGGER performance_review_sheets_no_delete BEFORE DELETE ON performance_review_sheets BEGIN SELECT RAISE(ABORT, 'review_sheet_is_retained'); END;
--> statement-breakpoint
CREATE TRIGGER performance_review_sheet_revision_guard BEFORE UPDATE ON performance_review_sheets
WHEN NEW.id IS NOT OLD.id OR NEW.cycle_id IS NOT OLD.cycle_id OR NEW.owner_account_id IS NOT OLD.owner_account_id OR NEW.employee_id IS NOT OLD.employee_id OR NEW.created_at IS NOT OLD.created_at OR json_extract(NEW.snapshot_json, '$.evaluation_policy') IS NOT json_extract(OLD.snapshot_json, '$.evaluation_policy') OR NEW.revision != OLD.revision + 1 OR OLD.status IN ('finalized','cancelled')
BEGIN SELECT RAISE(ABORT, 'review_sheet_revision_conflict'); END;
--> statement-breakpoint
CREATE TRIGGER performance_review_sheet_goal_lock BEFORE UPDATE ON performance_review_sheets
WHEN OLD.status NOT IN ('draft','goals_returned','goals_rejected') AND json_extract(OLD.snapshot_json, '$.goals') IS NOT json_extract(NEW.snapshot_json, '$.goals')
BEGIN SELECT RAISE(ABORT, 'approved_goals_are_locked'); END;
--> statement-breakpoint
CREATE TRIGGER performance_review_sheet_history_guard BEFORE INSERT ON performance_review_sheet_revisions
WHEN NOT EXISTS (SELECT 1 FROM performance_review_sheets WHERE id = NEW.sheet_id AND revision = NEW.revision AND snapshot_json = NEW.snapshot_json)
BEGIN SELECT RAISE(ABORT, 'review_history_snapshot_mismatch'); END;
--> statement-breakpoint
CREATE TRIGGER performance_review_sheet_history_no_update BEFORE UPDATE ON performance_review_sheet_revisions BEGIN SELECT RAISE(ABORT, 'review_history_is_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER performance_review_sheet_history_no_delete BEFORE DELETE ON performance_review_sheet_revisions BEGIN SELECT RAISE(ABORT, 'review_history_is_retained'); END;
--> statement-breakpoint
CREATE TRIGGER performance_review_sheet_transition_guard BEFORE UPDATE ON performance_review_sheets
WHEN NOT (
 (OLD.status IN ('draft','goals_returned','goals_rejected') AND NEW.status IN ('draft','goals_pending','cancelled')) OR
 (OLD.status = 'goals_pending' AND NEW.status IN ('goals_pending','goals_approved','goals_returned','goals_rejected','cancelled')) OR
 (OLD.status IN ('goals_approved','evaluation_returned','evaluation_rejected') AND NEW.status IN ('goals_approved','evaluation_pending','cancelled')) OR
 (OLD.status = 'goals_approved' AND NEW.status = 'draft') OR
 (OLD.status = 'evaluation_pending' AND NEW.status IN ('evaluation_pending','finalized','evaluation_returned','evaluation_rejected','cancelled'))
) BEGIN SELECT RAISE(ABORT, 'review_transition_invalid'); END;
--> statement-breakpoint
CREATE TRIGGER performance_review_sheet_submission_guard BEFORE UPDATE ON performance_review_sheets
WHEN NEW.status = 'goals_pending' AND (
  json_array_length(json_extract(NEW.snapshot_json, '$.goals')) NOT BETWEEN 1 AND 20 OR
  EXISTS (SELECT 1 FROM json_each(NEW.snapshot_json, '$.evaluation_policy.sections') section WHERE
    (SELECT coalesce(sum(json_extract(goal.value, '$.weight')), 0) FROM json_each(NEW.snapshot_json, '$.goals') goal WHERE json_extract(goal.value, '$.section_key') = json_extract(section.value, '$.key')) != 100) OR
  EXISTS (SELECT 1 FROM json_each(NEW.snapshot_json, '$.goals') goal WHERE NOT EXISTS
    (SELECT 1 FROM json_each(NEW.snapshot_json, '$.evaluation_policy.sections') section WHERE json_extract(goal.value, '$.section_key') = json_extract(section.value, '$.key'))) OR
  (SELECT count(DISTINCT json_extract(value, '$.id')) FROM json_each(NEW.snapshot_json, '$.goals')) != json_array_length(json_extract(NEW.snapshot_json, '$.goals'))
) BEGIN SELECT RAISE(ABORT, 'review_goals_invalid'); END;
--> statement-breakpoint
CREATE TRIGGER performance_review_sheet_insert_guard BEFORE INSERT ON performance_review_sheets
WHEN NEW.revision != 1 OR NEW.status != 'draft' OR json_extract(NEW.snapshot_json, '$.evaluation_policy') IS NOT (SELECT json_extract(snapshot_json, '$.evaluation_policy') FROM performance_review_cycles WHERE id = NEW.cycle_id)
BEGIN SELECT RAISE(ABORT, 'review_initial_state_invalid'); END;
