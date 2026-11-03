CREATE TABLE work_execution_definitions (
  id TEXT NOT NULL,
  slug TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  agent_id TEXT NOT NULL REFERENCES system_principals(id),
  owner_employee_id TEXT NOT NULL REFERENCES company_employees(id),
  status TEXT NOT NULL CHECK (status IN ('active', 'retired')),
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id),
  recorded_at TEXT NOT NULL,
  PRIMARY KEY (slug, revision),
  UNIQUE (id, revision)
);
--> statement-breakpoint
CREATE TRIGGER work_execution_definition_append BEFORE INSERT ON work_execution_definitions
WHEN NEW.revision != coalesce((SELECT max(revision) FROM work_execution_definitions WHERE slug = NEW.slug), 0) + 1
 OR EXISTS (SELECT 1 FROM work_execution_definitions WHERE slug = NEW.slug AND (id != NEW.id OR status = 'retired'))
 OR EXISTS (SELECT 1 FROM work_execution_definitions WHERE agent_id = NEW.agent_id AND slug != NEW.slug)
 OR NOT EXISTS (SELECT 1 FROM system_principals WHERE id = NEW.agent_id AND kind = 'agent')
BEGIN SELECT raise(ABORT, 'work_execution_definition_conflict'); END;
--> statement-breakpoint
CREATE TRIGGER work_execution_definition_no_update BEFORE UPDATE ON work_execution_definitions
BEGIN SELECT raise(ABORT, 'work_execution_definition_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER work_execution_definition_no_delete BEFORE DELETE ON work_execution_definitions
BEGIN SELECT raise(ABORT, 'work_execution_definition_retained'); END;
--> statement-breakpoint
CREATE INDEX work_execution_definitions_agent ON work_execution_definitions(agent_id, slug);
--> statement-breakpoint
CREATE TABLE work_execution_runs (
  agent_id TEXT NOT NULL REFERENCES system_principals(id),
  id TEXT NOT NULL,
  definition_id TEXT NOT NULL,
  definition_revision INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  received_at TEXT NOT NULL,
  PRIMARY KEY (agent_id, id),
  FOREIGN KEY (definition_id, definition_revision) REFERENCES work_execution_definitions(id, revision)
);
--> statement-breakpoint
CREATE TRIGGER work_execution_run_no_update BEFORE UPDATE ON work_execution_runs
BEGIN SELECT raise(ABORT, 'work_execution_run_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER work_execution_run_no_delete BEFORE DELETE ON work_execution_runs
BEGIN SELECT raise(ABORT, 'work_execution_run_retained'); END;
--> statement-breakpoint
CREATE INDEX work_execution_runs_received ON work_execution_runs(received_at DESC, agent_id, id);
