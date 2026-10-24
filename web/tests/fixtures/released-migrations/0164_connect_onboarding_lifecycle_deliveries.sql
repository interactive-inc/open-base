ALTER TABLE onboarding_assignments ADD COLUMN lifecycle_action_id TEXT REFERENCES company_personnel_actions(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX onboarding_assignments_lifecycle_action_uniq ON onboarding_assignments(lifecycle_action_id);

CREATE TABLE onboarding_lifecycle_deliveries (
  job_id TEXT PRIMARY KEY NOT NULL REFERENCES system_jobs(id) ON DELETE RESTRICT,
  action_id TEXT NOT NULL REFERENCES company_personnel_actions(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  outcome TEXT CHECK (outcome IN ('assigned', 'superseded', 'obsolete')),
  assignment_id INTEGER REFERENCES onboarding_assignments(id) ON DELETE RESTRICT,
  processed_at INTEGER CHECK (processed_at IS NULL OR processed_at >= created_at),
  CHECK ((outcome IS NULL AND processed_at IS NULL AND assignment_id IS NULL)
    OR (outcome IS NOT NULL AND outcome = 'assigned' AND processed_at IS NOT NULL AND assignment_id IS NOT NULL)
    OR (outcome IS NOT NULL AND outcome IN ('superseded', 'obsolete') AND processed_at IS NOT NULL AND assignment_id IS NULL))
);
CREATE INDEX onboarding_lifecycle_deliveries_action_idx ON onboarding_lifecycle_deliveries(action_id, created_at);

DROP TRIGGER IF EXISTS onboarding_lifecycle_deliveries_monotonic_update;
CREATE TRIGGER onboarding_lifecycle_deliveries_monotonic_update
BEFORE UPDATE ON onboarding_lifecycle_deliveries
WHEN NEW.job_id <> OLD.job_id OR NEW.action_id <> OLD.action_id OR NEW.created_at <> OLD.created_at
  OR OLD.processed_at IS NOT NULL OR NEW.processed_at IS NULL
BEGIN
  SELECT RAISE(ABORT, 'onboarding_lifecycle_delivery_update_invalid');
END;

DROP TRIGGER IF EXISTS onboarding_lifecycle_deliveries_no_delete;
CREATE TRIGGER onboarding_lifecycle_deliveries_no_delete
BEFORE DELETE ON onboarding_lifecycle_deliveries
BEGIN
  SELECT RAISE(ABORT, 'onboarding_lifecycle_deliveries_are_retained');
END;

DROP TRIGGER IF EXISTS onboarding_assignments_lifecycle_immutable;
CREATE TRIGGER onboarding_assignments_lifecycle_immutable
BEFORE UPDATE ON onboarding_assignments
WHEN NEW.lifecycle_action_id IS NOT OLD.lifecycle_action_id
BEGIN
  SELECT RAISE(ABORT, 'onboarding_assignment_lifecycle_immutable');
END;
