-- Company組織期間の旧table参照をcanonical Company tableへ無損失で付け替える。

PRAGMA foreign_keys = OFF;

DROP TRIGGER IF EXISTS company_organization_unit_period_versions_immutable_delete;
DROP TRIGGER IF EXISTS company_organization_unit_period_versions_immutable_update;
DROP TRIGGER IF EXISTS company_organization_unit_period_versions_revision_guard;
DROP TRIGGER IF EXISTS company_organization_unit_period_versions_revision_state;
DROP TRIGGER IF EXISTS company_organization_assignment_period_versions_guard;
DROP TRIGGER IF EXISTS company_organization_assignment_period_versions_immutable_delete;
DROP TRIGGER IF EXISTS company_organization_assignment_period_versions_immutable_update;
DROP TRIGGER IF EXISTS company_organization_assignment_period_versions_revision_state;
DROP TRIGGER IF EXISTS company_organization_responsibility_period_versions_guard;
DROP TRIGGER IF EXISTS company_organization_responsibility_period_versions_immutable_delete;
DROP TRIGGER IF EXISTS company_organization_responsibility_period_versions_immutable_update;
DROP TRIGGER IF EXISTS company_organization_responsibility_period_versions_revision_state;
DROP TRIGGER IF EXISTS company_organization_change_operations_completion_guard;
DROP TRIGGER IF EXISTS company_employments_organization_period_guard;

CREATE TABLE _company_organization_foreign_key_validation (
  resource TEXT PRIMARY KEY NOT NULL,
  source_count INTEGER NOT NULL,
  target_count INTEGER NOT NULL,
  orphan_count INTEGER NOT NULL,
  CHECK (source_count = target_count AND orphan_count = 0)
);

CREATE TABLE __new_company_organization_unit_period_versions (
  period_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  organization_unit_id TEXT NOT NULL
    REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  code TEXT NOT NULL
    CHECK (length(code) BETWEEN 1 AND 64 AND trim(code) = code),
  official_name TEXT NOT NULL
    CHECK (length(official_name) BETWEEN 1 AND 200 AND trim(official_name) = official_name),
  kind TEXT NOT NULL
    CHECK (kind IN ('COMPANY', 'DIVISION', 'DEPARTMENT', 'TEAM', 'OTHER')),
  parent_organization_unit_id TEXT
    REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  is_void INTEGER NOT NULL DEFAULT 0 CHECK (is_void IN (0, 1)),
  recorded_by_action_id TEXT NOT NULL
    REFERENCES company_organization_change_operations(id) ON DELETE RESTRICT,
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  PRIMARY KEY (period_id, revision),
  CHECK (
    length(starts_on) = 10 AND date(starts_on) IS starts_on
    AND (ends_on IS NULL OR (length(ends_on) = 10 AND date(ends_on) IS ends_on))
    AND (ends_on IS NULL OR starts_on < ends_on)
  ),
  CHECK (
    parent_organization_unit_id IS NULL
    OR parent_organization_unit_id != organization_unit_id
  )
) WITHOUT ROWID;

INSERT INTO __new_company_organization_unit_period_versions
SELECT * FROM company_organization_unit_period_versions;

INSERT INTO _company_organization_foreign_key_validation
SELECT
  'company_organization_unit_period_versions',
  (SELECT count(*) FROM company_organization_unit_period_versions),
  (SELECT count(*) FROM __new_company_organization_unit_period_versions),
  (SELECT count(*)
   FROM __new_company_organization_unit_period_versions period
   LEFT JOIN company_organization_units unit
     ON unit.id = period.organization_unit_id
   LEFT JOIN company_organization_units parent
     ON parent.id = period.parent_organization_unit_id
   LEFT JOIN company_organization_change_operations operation
     ON operation.id = period.recorded_by_action_id
   WHERE unit.id IS NULL
      OR (period.parent_organization_unit_id IS NOT NULL AND parent.id IS NULL)
      OR operation.id IS NULL);

DROP TABLE company_organization_unit_period_versions;
ALTER TABLE __new_company_organization_unit_period_versions
  RENAME TO company_organization_unit_period_versions;

CREATE INDEX company_organization_unit_period_versions_unit_idx
  ON company_organization_unit_period_versions(
    organization_unit_id, starts_on, ends_on, period_id, revision
  );
CREATE INDEX company_organization_unit_period_versions_code_idx
  ON company_organization_unit_period_versions(code, starts_on, ends_on, period_id, revision);
CREATE INDEX company_organization_unit_period_versions_parent_idx
  ON company_organization_unit_period_versions(parent_organization_unit_id, starts_on, ends_on);

CREATE TABLE __new_company_organization_assignment_period_versions (
  period_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  employment_id TEXT NOT NULL CHECK (length(employment_id) BETWEEN 1 AND 200),
  employee_id TEXT NOT NULL CHECK (length(employee_id) BETWEEN 1 AND 128),
  organization_unit_id TEXT NOT NULL
    REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('PRIMARY', 'CONCURRENT')),
  position_title TEXT CHECK (
    position_title IS NULL OR (
      length(position_title) BETWEEN 1 AND 200 AND trim(position_title) = position_title
    )
  ),
  manager_employee_id TEXT CHECK (
    manager_employee_id IS NULL OR manager_employee_id != employee_id
  ),
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  is_void INTEGER NOT NULL DEFAULT 0 CHECK (is_void IN (0, 1)),
  recorded_by_action_id TEXT NOT NULL
    REFERENCES company_organization_change_operations(id) ON DELETE RESTRICT,
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  PRIMARY KEY (period_id, revision),
  CHECK (
    length(starts_on) = 10 AND date(starts_on) IS starts_on
    AND (ends_on IS NULL OR (length(ends_on) = 10 AND date(ends_on) IS ends_on))
    AND (ends_on IS NULL OR starts_on < ends_on)
  )
) WITHOUT ROWID;

INSERT INTO __new_company_organization_assignment_period_versions
SELECT * FROM company_organization_assignment_period_versions;

INSERT INTO _company_organization_foreign_key_validation
SELECT
  'company_organization_assignment_period_versions',
  (SELECT count(*) FROM company_organization_assignment_period_versions),
  (SELECT count(*) FROM __new_company_organization_assignment_period_versions),
  (SELECT count(*)
   FROM __new_company_organization_assignment_period_versions period
   LEFT JOIN company_organization_units unit
     ON unit.id = period.organization_unit_id
   LEFT JOIN company_organization_change_operations operation
     ON operation.id = period.recorded_by_action_id
   WHERE unit.id IS NULL OR operation.id IS NULL);

DROP TABLE company_organization_assignment_period_versions;
ALTER TABLE __new_company_organization_assignment_period_versions
  RENAME TO company_organization_assignment_period_versions;

CREATE INDEX company_organization_assignment_period_versions_employee_idx
  ON company_organization_assignment_period_versions(
    employee_id, starts_on, ends_on, assignment_type, period_id, revision
  );
CREATE INDEX company_organization_assignment_period_versions_unit_idx
  ON company_organization_assignment_period_versions(
    organization_unit_id, starts_on, ends_on, period_id, revision
  );

CREATE TABLE __new_company_organization_responsibility_period_versions (
  period_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  employment_id TEXT NOT NULL CHECK (length(employment_id) BETWEEN 1 AND 200),
  employee_id TEXT NOT NULL CHECK (length(employee_id) BETWEEN 1 AND 128),
  organization_unit_id TEXT NOT NULL
    REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  responsibility_type TEXT NOT NULL CHECK (
    length(responsibility_type) BETWEEN 1 AND 64
    AND responsibility_type GLOB '[A-Z]*'
    AND responsibility_type NOT GLOB '*[^A-Z0-9_]*'
  ),
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  is_void INTEGER NOT NULL DEFAULT 0 CHECK (is_void IN (0, 1)),
  recorded_by_action_id TEXT NOT NULL
    REFERENCES company_organization_change_operations(id) ON DELETE RESTRICT,
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  PRIMARY KEY (period_id, revision),
  CHECK (
    length(starts_on) = 10 AND date(starts_on) IS starts_on
    AND (ends_on IS NULL OR (length(ends_on) = 10 AND date(ends_on) IS ends_on))
    AND (ends_on IS NULL OR starts_on < ends_on)
  )
) WITHOUT ROWID;

INSERT INTO __new_company_organization_responsibility_period_versions
SELECT * FROM company_organization_responsibility_period_versions;

INSERT INTO _company_organization_foreign_key_validation
SELECT
  'company_organization_responsibility_period_versions',
  (SELECT count(*) FROM company_organization_responsibility_period_versions),
  (SELECT count(*) FROM __new_company_organization_responsibility_period_versions),
  (SELECT count(*)
   FROM __new_company_organization_responsibility_period_versions period
   LEFT JOIN company_organization_units unit
     ON unit.id = period.organization_unit_id
   LEFT JOIN company_organization_change_operations operation
     ON operation.id = period.recorded_by_action_id
   WHERE unit.id IS NULL OR operation.id IS NULL);

DROP TABLE company_organization_responsibility_period_versions;
ALTER TABLE __new_company_organization_responsibility_period_versions
  RENAME TO company_organization_responsibility_period_versions;

CREATE INDEX company_organization_responsibility_period_versions_employee_idx
  ON company_organization_responsibility_period_versions(
    employee_id, starts_on, ends_on, period_id, revision
  );
CREATE INDEX company_organization_responsibility_period_versions_unit_idx
  ON company_organization_responsibility_period_versions(
    organization_unit_id, responsibility_type, starts_on, ends_on, period_id, revision
  );

DROP TRIGGER IF EXISTS company_employments_organization_period_guard;
CREATE TRIGGER company_employments_organization_period_guard
BEFORE UPDATE OF hire_date, termination_date ON company_employments
BEGIN
  SELECT RAISE(ABORT, 'employment change would orphan an organization assignment')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_assignment_period_versions assignment
    WHERE assignment.employment_id = NEW.id
      AND assignment.is_void = 0
      AND assignment.revision = (
        SELECT max(latest.revision)
        FROM company_organization_assignment_period_versions latest
        WHERE latest.period_id = assignment.period_id
      )
      AND (
        NEW.hire_date > assignment.starts_on
        OR (
          NEW.termination_date IS NOT NULL
          AND (
            assignment.ends_on IS NULL
            OR assignment.ends_on > date(NEW.termination_date, '+1 day')
          )
        )
      )
  );

  SELECT RAISE(ABORT, 'employment change would orphan an organization responsibility')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_responsibility_period_versions responsibility
    WHERE responsibility.employment_id = NEW.id
      AND responsibility.is_void = 0
      AND responsibility.revision = (
        SELECT max(latest.revision)
        FROM company_organization_responsibility_period_versions latest
        WHERE latest.period_id = responsibility.period_id
      )
      AND (
        NEW.hire_date > responsibility.starts_on
        OR (
          NEW.termination_date IS NOT NULL
          AND (
            responsibility.ends_on IS NULL
            OR responsibility.ends_on > date(NEW.termination_date, '+1 day')
          )
        )
      )
  );

  SELECT RAISE(ABORT, 'employment change would leave an assigned employee without manager')
  WHERE NEW.termination_date IS NOT NULL AND EXISTS (
    SELECT 1 FROM company_organization_assignment_period_versions assignment
    WHERE assignment.manager_employee_id = NEW.employee_id
      AND assignment.is_void = 0
      AND assignment.revision = (
        SELECT max(latest.revision)
        FROM company_organization_assignment_period_versions latest
        WHERE latest.period_id = assignment.period_id
      )
      AND (
        assignment.ends_on IS NULL
        OR assignment.ends_on > date(NEW.termination_date, '+1 day')
      )
  );
END;

DROP TRIGGER IF EXISTS company_organization_change_operations_completion_guard;
CREATE TRIGGER company_organization_change_operations_completion_guard
BEFORE UPDATE OF status ON company_organization_change_operations
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is incomplete')
  WHERE OLD.status != 'PENDING'
    OR NEW.status != 'COMPLETED'
    OR NEW.applied_count != NEW.change_count
    OR NOT EXISTS (
      SELECT 1 FROM company_organization_lifecycle_states state
      WHERE state.id = 1 AND state.revision = NEW.resulting_revision
    );

  SELECT RAISE(ABORT, 'organization change leaves an orphan organization unit')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_unit_period_versions child
    WHERE child.is_void = 0
      AND child.parent_organization_unit_id IS NOT NULL
      AND child.revision = (
        SELECT max(latest.revision)
        FROM company_organization_unit_period_versions latest
        WHERE latest.period_id = child.period_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM company_organization_unit_period_versions parent
        WHERE parent.organization_unit_id = child.parent_organization_unit_id
          AND parent.is_void = 0
          AND parent.revision = (
            SELECT max(latest.revision)
            FROM company_organization_unit_period_versions latest
            WHERE latest.period_id = parent.period_id
          )
          AND parent.starts_on <= child.starts_on
          AND (
            parent.ends_on IS NULL
            OR (child.ends_on IS NOT NULL AND child.ends_on <= parent.ends_on)
          )
      )
  );

  SELECT RAISE(ABORT, 'organization change leaves an orphan assignment')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_assignment_period_versions assignment
    WHERE assignment.is_void = 0
      AND assignment.revision = (
        SELECT max(latest.revision)
        FROM company_organization_assignment_period_versions latest
        WHERE latest.period_id = assignment.period_id
      )
      AND (
        NOT EXISTS (
          SELECT 1 FROM company_employments employment
          WHERE employment.id = assignment.employment_id
            AND employment.employee_id = assignment.employee_id
            AND employment.hire_date <= assignment.starts_on
            AND (
              employment.termination_date IS NULL
              OR (
                assignment.ends_on IS NOT NULL
                AND assignment.ends_on <= date(employment.termination_date, '+1 day')
              )
            )
        )
        OR NOT EXISTS (
          SELECT 1 FROM company_organization_unit_period_versions unit
          WHERE unit.organization_unit_id = assignment.organization_unit_id
            AND unit.is_void = 0
            AND unit.revision = (
              SELECT max(latest.revision)
              FROM company_organization_unit_period_versions latest
              WHERE latest.period_id = unit.period_id
            )
            AND unit.starts_on <= assignment.starts_on
            AND (
              unit.ends_on IS NULL
              OR (assignment.ends_on IS NOT NULL AND assignment.ends_on <= unit.ends_on)
            )
        )
      )
  );

  SELECT RAISE(ABORT, 'organization change leaves an orphan responsibility')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_responsibility_period_versions responsibility
    WHERE responsibility.is_void = 0
      AND responsibility.revision = (
        SELECT max(latest.revision)
        FROM company_organization_responsibility_period_versions latest
        WHERE latest.period_id = responsibility.period_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM company_organization_assignment_period_versions assignment
        WHERE assignment.employment_id = responsibility.employment_id
          AND assignment.employee_id = responsibility.employee_id
          AND assignment.organization_unit_id = responsibility.organization_unit_id
          AND assignment.is_void = 0
          AND assignment.revision = (
            SELECT max(latest.revision)
            FROM company_organization_assignment_period_versions latest
            WHERE latest.period_id = assignment.period_id
          )
          AND assignment.starts_on <= responsibility.starts_on
          AND (
            assignment.ends_on IS NULL
            OR (
              responsibility.ends_on IS NOT NULL
              AND responsibility.ends_on <= assignment.ends_on
            )
          )
      )
  );
END;

DROP TABLE _company_organization_foreign_key_validation;

PRAGMA foreign_keys = ON;
PRAGMA foreign_key_check;
