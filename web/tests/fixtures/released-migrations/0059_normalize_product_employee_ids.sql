-- 業務contextに残ったINTEGER社員参照を、canonical Company Employee IDのTEXTへ無損失で統一する。

PRAGMA foreign_keys = OFF;

CREATE TABLE _product_employee_id_cutover_validation (
  resource TEXT PRIMARY KEY NOT NULL,
  source_count INTEGER NOT NULL,
  target_count INTEGER NOT NULL,
  non_text_count INTEGER NOT NULL,
  orphan_count INTEGER NOT NULL,
  CHECK (source_count = target_count AND non_text_count = 0 AND orphan_count = 0)
);

CREATE TABLE "__new_announcements" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body_md TEXT NOT NULL,
  published_on TEXT,
  author_employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
INSERT INTO "__new_announcements" ("id", "title", "body_md", "published_on", "author_employee_id", "status", "created_at")
SELECT "id", "title", "body_md", "published_on", CAST("author_employee_id" AS TEXT), "status", "created_at" FROM "announcements";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'announcements.rows',
       (SELECT count(*) FROM "announcements"),
       (SELECT count(*) FROM "__new_announcements"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'announcements.author_employee_id',
       (SELECT count("author_employee_id") FROM "announcements"),
       (SELECT count("author_employee_id") FROM "__new_announcements"),
       (SELECT count(*) FROM "__new_announcements"
        WHERE "author_employee_id" IS NOT NULL AND typeof("author_employee_id") != 'text'),
       (SELECT count(*) FROM "__new_announcements" child
        LEFT JOIN company_employees employee ON employee.id = child."author_employee_id"
        WHERE child."author_employee_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "announcements";
ALTER TABLE "__new_announcements" RENAME TO "announcements";
CREATE INDEX idx_announcements_status ON announcements (status);

CREATE TABLE "__new_antisocial_checks" (
  id TEXT PRIMARY KEY,
  requester_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  partner_name TEXT NOT NULL,
  partner_address TEXT,
  representative_name TEXT,
  result TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
INSERT INTO "__new_antisocial_checks" ("id", "requester_id", "partner_name", "partner_address", "representative_name", "result", "status", "created_at")
SELECT "id", CAST("requester_id" AS TEXT), "partner_name", "partner_address", "representative_name", "result", "status", "created_at" FROM "antisocial_checks";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'antisocial_checks.rows',
       (SELECT count(*) FROM "antisocial_checks"),
       (SELECT count(*) FROM "__new_antisocial_checks"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'antisocial_checks.requester_id',
       (SELECT count("requester_id") FROM "antisocial_checks"),
       (SELECT count("requester_id") FROM "__new_antisocial_checks"),
       (SELECT count(*) FROM "__new_antisocial_checks"
        WHERE "requester_id" IS NOT NULL AND typeof("requester_id") != 'text'),
       (SELECT count(*) FROM "__new_antisocial_checks" child
        LEFT JOIN company_employees employee ON employee.id = child."requester_id"
        WHERE child."requester_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "antisocial_checks";
ALTER TABLE "__new_antisocial_checks" RENAME TO "antisocial_checks";
CREATE INDEX idx_antisocial_checks_requester ON antisocial_checks (requester_id);

CREATE TABLE "__new_asset_lendings" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_code TEXT NOT NULL,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  lent_at TEXT NOT NULL,
  returned_at TEXT
);
INSERT INTO "__new_asset_lendings" ("id", "asset_code", "employee_id", "lent_at", "returned_at")
SELECT "id", "asset_code", CAST("employee_id" AS TEXT), "lent_at", "returned_at" FROM "asset_lendings";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'asset_lendings.rows',
       (SELECT count(*) FROM "asset_lendings"),
       (SELECT count(*) FROM "__new_asset_lendings"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'asset_lendings.employee_id',
       (SELECT count("employee_id") FROM "asset_lendings"),
       (SELECT count("employee_id") FROM "__new_asset_lendings"),
       (SELECT count(*) FROM "__new_asset_lendings"
        WHERE "employee_id" IS NOT NULL AND typeof("employee_id") != 'text'),
       (SELECT count(*) FROM "__new_asset_lendings" child
        LEFT JOIN company_employees employee ON employee.id = child."employee_id"
        WHERE child."employee_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "asset_lendings";
ALTER TABLE "__new_asset_lendings" RENAME TO "asset_lendings";
CREATE INDEX idx_asset_lendings_asset ON asset_lendings (asset_code);
CREATE INDEX idx_asset_lendings_employee ON asset_lendings (employee_id);

CREATE TABLE "__new_assets" (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  serial TEXT,
  purchased_on TEXT,
  status TEXT NOT NULL,
  holder_employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT
, disposed_on TEXT, disposal_reason TEXT);
INSERT INTO "__new_assets" ("code", "name", "kind", "serial", "purchased_on", "status", "holder_employee_id", "disposed_on", "disposal_reason")
SELECT "code", "name", "kind", "serial", "purchased_on", "status", CAST("holder_employee_id" AS TEXT), "disposed_on", "disposal_reason" FROM "assets";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'assets.rows',
       (SELECT count(*) FROM "assets"),
       (SELECT count(*) FROM "__new_assets"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'assets.holder_employee_id',
       (SELECT count("holder_employee_id") FROM "assets"),
       (SELECT count("holder_employee_id") FROM "__new_assets"),
       (SELECT count(*) FROM "__new_assets"
        WHERE "holder_employee_id" IS NOT NULL AND typeof("holder_employee_id") != 'text'),
       (SELECT count(*) FROM "__new_assets" child
        LEFT JOIN company_employees employee ON employee.id = child."holder_employee_id"
        WHERE child."holder_employee_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "assets";
ALTER TABLE "__new_assets" RENAME TO "assets";
CREATE INDEX idx_assets_holder ON assets (holder_employee_id);
CREATE INDEX idx_assets_kind ON assets (kind);
CREATE INDEX idx_assets_status ON assets (status);

CREATE TABLE "__new_attendance_records" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  work_date TEXT NOT NULL,
  clock_in_at TEXT,
  clock_out_at TEXT,
  work_minutes INTEGER,
  note TEXT,
  status TEXT NOT NULL
);
INSERT INTO "__new_attendance_records" ("id", "employee_id", "work_date", "clock_in_at", "clock_out_at", "work_minutes", "note", "status")
SELECT "id", CAST("employee_id" AS TEXT), "work_date", "clock_in_at", "clock_out_at", "work_minutes", "note", "status" FROM "attendance_records";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'attendance_records.rows',
       (SELECT count(*) FROM "attendance_records"),
       (SELECT count(*) FROM "__new_attendance_records"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'attendance_records.employee_id',
       (SELECT count("employee_id") FROM "attendance_records"),
       (SELECT count("employee_id") FROM "__new_attendance_records"),
       (SELECT count(*) FROM "__new_attendance_records"
        WHERE "employee_id" IS NOT NULL AND typeof("employee_id") != 'text'),
       (SELECT count(*) FROM "__new_attendance_records" child
        LEFT JOIN company_employees employee ON employee.id = child."employee_id"
        WHERE child."employee_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "attendance_records";
ALTER TABLE "__new_attendance_records" RENAME TO "attendance_records";
CREATE INDEX idx_attendance_records_employee ON attendance_records (employee_id);
CREATE INDEX idx_attendance_records_employee_open ON attendance_records (employee_id, status);
CREATE UNIQUE INDEX idx_attendance_records_employee_open_unique
  ON attendance_records (employee_id) WHERE status = 'open';
CREATE INDEX idx_attendance_records_work_date ON attendance_records (work_date);

CREATE TABLE "__new_career_sheets" (
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT PRIMARY KEY,
  goals_text TEXT,
  strengths_text TEXT,
  updated_at TEXT NOT NULL
);
INSERT INTO "__new_career_sheets" ("employee_id", "goals_text", "strengths_text", "updated_at")
SELECT CAST("employee_id" AS TEXT), "goals_text", "strengths_text", "updated_at" FROM "career_sheets";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'career_sheets.rows',
       (SELECT count(*) FROM "career_sheets"),
       (SELECT count(*) FROM "__new_career_sheets"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'career_sheets.employee_id',
       (SELECT count("employee_id") FROM "career_sheets"),
       (SELECT count("employee_id") FROM "__new_career_sheets"),
       (SELECT count(*) FROM "__new_career_sheets"
        WHERE "employee_id" IS NOT NULL AND typeof("employee_id") != 'text'),
       (SELECT count(*) FROM "__new_career_sheets" child
        LEFT JOIN company_employees employee ON employee.id = child."employee_id"
        WHERE child."employee_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "career_sheets";
ALTER TABLE "__new_career_sheets" RENAME TO "career_sheets";

CREATE TABLE "__new_certificate_requests" (
  id TEXT PRIMARY KEY,
  requester_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  certificate_type TEXT NOT NULL,
  submit_to TEXT,
  needed_by TEXT,
  note TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
INSERT INTO "__new_certificate_requests" ("id", "requester_id", "certificate_type", "submit_to", "needed_by", "note", "status", "created_at")
SELECT "id", CAST("requester_id" AS TEXT), "certificate_type", "submit_to", "needed_by", "note", "status", "created_at" FROM "certificate_requests";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'certificate_requests.rows',
       (SELECT count(*) FROM "certificate_requests"),
       (SELECT count(*) FROM "__new_certificate_requests"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'certificate_requests.requester_id',
       (SELECT count("requester_id") FROM "certificate_requests"),
       (SELECT count("requester_id") FROM "__new_certificate_requests"),
       (SELECT count(*) FROM "__new_certificate_requests"
        WHERE "requester_id" IS NOT NULL AND typeof("requester_id") != 'text'),
       (SELECT count(*) FROM "__new_certificate_requests" child
        LEFT JOIN company_employees employee ON employee.id = child."requester_id"
        WHERE child."requester_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "certificate_requests";
ALTER TABLE "__new_certificate_requests" RENAME TO "certificate_requests";
CREATE INDEX idx_certificate_requests_requester ON certificate_requests (requester_id);

CREATE TABLE "__new_commendations" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  title TEXT NOT NULL,
  reason TEXT NOT NULL,
  awarded_on TEXT NOT NULL,
  created_at TEXT NOT NULL
);
INSERT INTO "__new_commendations" ("id", "employee_id", "title", "reason", "awarded_on", "created_at")
SELECT "id", CAST("employee_id" AS TEXT), "title", "reason", "awarded_on", "created_at" FROM "commendations";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'commendations.rows',
       (SELECT count(*) FROM "commendations"),
       (SELECT count(*) FROM "__new_commendations"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'commendations.employee_id',
       (SELECT count("employee_id") FROM "commendations"),
       (SELECT count("employee_id") FROM "__new_commendations"),
       (SELECT count(*) FROM "__new_commendations"
        WHERE "employee_id" IS NOT NULL AND typeof("employee_id") != 'text'),
       (SELECT count(*) FROM "__new_commendations" child
        LEFT JOIN company_employees employee ON employee.id = child."employee_id"
        WHERE child."employee_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "commendations";
ALTER TABLE "__new_commendations" RENAME TO "commendations";
CREATE INDEX idx_commendations_employee ON commendations (employee_id);

CREATE TABLE "__new_disciplinary_actions" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  kind TEXT NOT NULL,
  summary TEXT NOT NULL,
  decided_on TEXT NOT NULL,
  created_at TEXT NOT NULL
);
INSERT INTO "__new_disciplinary_actions" ("id", "employee_id", "kind", "summary", "decided_on", "created_at")
SELECT "id", CAST("employee_id" AS TEXT), "kind", "summary", "decided_on", "created_at" FROM "disciplinary_actions";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'disciplinary_actions.rows',
       (SELECT count(*) FROM "disciplinary_actions"),
       (SELECT count(*) FROM "__new_disciplinary_actions"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'disciplinary_actions.employee_id',
       (SELECT count("employee_id") FROM "disciplinary_actions"),
       (SELECT count("employee_id") FROM "__new_disciplinary_actions"),
       (SELECT count(*) FROM "__new_disciplinary_actions"
        WHERE "employee_id" IS NOT NULL AND typeof("employee_id") != 'text'),
       (SELECT count(*) FROM "__new_disciplinary_actions" child
        LEFT JOIN company_employees employee ON employee.id = child."employee_id"
        WHERE child."employee_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "disciplinary_actions";
ALTER TABLE "__new_disciplinary_actions" RENAME TO "disciplinary_actions";
CREATE INDEX idx_disciplinary_actions_employee ON disciplinary_actions (employee_id);

CREATE TABLE "__new_employee_certifications" (
  id INTEGER PRIMARY KEY,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  certification_id INTEGER NOT NULL,
  acquired_on TEXT NOT NULL,
  expires_on TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);
INSERT INTO "__new_employee_certifications" ("id", "employee_id", "certification_id", "acquired_on", "expires_on", "note", "created_at")
SELECT "id", CAST("employee_id" AS TEXT), "certification_id", "acquired_on", "expires_on", "note", "created_at" FROM "employee_certifications";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'employee_certifications.rows',
       (SELECT count(*) FROM "employee_certifications"),
       (SELECT count(*) FROM "__new_employee_certifications"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'employee_certifications.employee_id',
       (SELECT count("employee_id") FROM "employee_certifications"),
       (SELECT count("employee_id") FROM "__new_employee_certifications"),
       (SELECT count(*) FROM "__new_employee_certifications"
        WHERE "employee_id" IS NOT NULL AND typeof("employee_id") != 'text'),
       (SELECT count(*) FROM "__new_employee_certifications" child
        LEFT JOIN company_employees employee ON employee.id = child."employee_id"
        WHERE child."employee_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "employee_certifications";
ALTER TABLE "__new_employee_certifications" RENAME TO "employee_certifications";
CREATE INDEX idx_employee_certifications_certification ON employee_certifications (certification_id);
CREATE INDEX idx_employee_certifications_employee ON employee_certifications (employee_id);
CREATE UNIQUE INDEX idx_employee_certifications_unique
  ON employee_certifications (employee_id, certification_id, acquired_on);

CREATE TABLE "__new_employee_skills" (
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  skill_code TEXT NOT NULL,
  level INTEGER NOT NULL,
  years INTEGER,
  note TEXT,
  PRIMARY KEY (employee_id, skill_code)
);
INSERT INTO "__new_employee_skills" ("employee_id", "skill_code", "level", "years", "note")
SELECT CAST("employee_id" AS TEXT), "skill_code", "level", "years", "note" FROM "employee_skills";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'employee_skills.rows',
       (SELECT count(*) FROM "employee_skills"),
       (SELECT count(*) FROM "__new_employee_skills"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'employee_skills.employee_id',
       (SELECT count("employee_id") FROM "employee_skills"),
       (SELECT count("employee_id") FROM "__new_employee_skills"),
       (SELECT count(*) FROM "__new_employee_skills"
        WHERE "employee_id" IS NOT NULL AND typeof("employee_id") != 'text'),
       (SELECT count(*) FROM "__new_employee_skills" child
        LEFT JOIN company_employees employee ON employee.id = child."employee_id"
        WHERE child."employee_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "employee_skills";
ALTER TABLE "__new_employee_skills" RENAME TO "employee_skills";
CREATE INDEX idx_employee_skills_employee ON employee_skills (employee_id);

CREATE TABLE "__new_employee_work_styles" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  style TEXT NOT NULL,
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);
INSERT INTO "__new_employee_work_styles" ("id", "employee_id", "style", "starts_on", "ends_on", "note", "created_at")
SELECT "id", CAST("employee_id" AS TEXT), "style", "starts_on", "ends_on", "note", "created_at" FROM "employee_work_styles";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'employee_work_styles.rows',
       (SELECT count(*) FROM "employee_work_styles"),
       (SELECT count(*) FROM "__new_employee_work_styles"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'employee_work_styles.employee_id',
       (SELECT count("employee_id") FROM "employee_work_styles"),
       (SELECT count("employee_id") FROM "__new_employee_work_styles"),
       (SELECT count(*) FROM "__new_employee_work_styles"
        WHERE "employee_id" IS NOT NULL AND typeof("employee_id") != 'text'),
       (SELECT count(*) FROM "__new_employee_work_styles" child
        LEFT JOIN company_employees employee ON employee.id = child."employee_id"
        WHERE child."employee_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "employee_work_styles";
ALTER TABLE "__new_employee_work_styles" RENAME TO "employee_work_styles";
CREATE INDEX idx_employee_work_styles_employee ON employee_work_styles (employee_id);

CREATE TABLE "__new_evaluation_sheets" (
  id INTEGER PRIMARY KEY,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  template_id INTEGER,
  period TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  primary_evaluator_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  secondary_evaluator_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT,
  submitted_at TEXT,
  approved_at TEXT,
  finalized_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
, revision INTEGER NOT NULL DEFAULT 1);
INSERT INTO "__new_evaluation_sheets" ("id", "employee_id", "template_id", "period", "status", "primary_evaluator_id", "secondary_evaluator_id", "submitted_at", "approved_at", "finalized_at", "created_at", "updated_at", "revision")
SELECT "id", CAST("employee_id" AS TEXT), "template_id", "period", "status", CAST("primary_evaluator_id" AS TEXT), CAST("secondary_evaluator_id" AS TEXT), "submitted_at", "approved_at", "finalized_at", "created_at", "updated_at", "revision" FROM "evaluation_sheets";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'evaluation_sheets.rows',
       (SELECT count(*) FROM "evaluation_sheets"),
       (SELECT count(*) FROM "__new_evaluation_sheets"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'evaluation_sheets.employee_id',
       (SELECT count("employee_id") FROM "evaluation_sheets"),
       (SELECT count("employee_id") FROM "__new_evaluation_sheets"),
       (SELECT count(*) FROM "__new_evaluation_sheets"
        WHERE "employee_id" IS NOT NULL AND typeof("employee_id") != 'text'),
       (SELECT count(*) FROM "__new_evaluation_sheets" child
        LEFT JOIN company_employees employee ON employee.id = child."employee_id"
        WHERE child."employee_id" IS NOT NULL AND employee.id IS NULL);
INSERT INTO _product_employee_id_cutover_validation
SELECT 'evaluation_sheets.primary_evaluator_id',
       (SELECT count("primary_evaluator_id") FROM "evaluation_sheets"),
       (SELECT count("primary_evaluator_id") FROM "__new_evaluation_sheets"),
       (SELECT count(*) FROM "__new_evaluation_sheets"
        WHERE "primary_evaluator_id" IS NOT NULL AND typeof("primary_evaluator_id") != 'text'),
       (SELECT count(*) FROM "__new_evaluation_sheets" child
        LEFT JOIN company_employees employee ON employee.id = child."primary_evaluator_id"
        WHERE child."primary_evaluator_id" IS NOT NULL AND employee.id IS NULL);
INSERT INTO _product_employee_id_cutover_validation
SELECT 'evaluation_sheets.secondary_evaluator_id',
       (SELECT count("secondary_evaluator_id") FROM "evaluation_sheets"),
       (SELECT count("secondary_evaluator_id") FROM "__new_evaluation_sheets"),
       (SELECT count(*) FROM "__new_evaluation_sheets"
        WHERE "secondary_evaluator_id" IS NOT NULL AND typeof("secondary_evaluator_id") != 'text'),
       (SELECT count(*) FROM "__new_evaluation_sheets" child
        LEFT JOIN company_employees employee ON employee.id = child."secondary_evaluator_id"
        WHERE child."secondary_evaluator_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "evaluation_sheets";
ALTER TABLE "__new_evaluation_sheets" RENAME TO "evaluation_sheets";
CREATE INDEX idx_evaluation_sheets_employee
ON evaluation_sheets (employee_id);
CREATE INDEX idx_evaluation_sheets_period
ON evaluation_sheets (period);
CREATE INDEX idx_evaluation_sheets_status
ON evaluation_sheets (status);
CREATE UNIQUE INDEX uq_evaluation_sheets_employee_period
ON evaluation_sheets (employee_id, period);

CREATE TABLE "__new_expenses" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  organization_unit_id TEXT REFERENCES company_organization_units(id) ON DELETE RESTRICT NOT NULL,
  category TEXT NOT NULL,
  amount INTEGER NOT NULL,
  spent_at TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
INSERT INTO "__new_expenses" (
  "id", "employee_id", "organization_unit_id", "category", "amount", "spent_at",
  "note", "status", "created_at"
)
SELECT
  expense."id",
  CAST(expense."employee_id" AS TEXT),
  (
    SELECT assignment.organization_unit_id
    FROM company_organization_assignment_period_versions assignment
    WHERE assignment.employee_id = CAST(expense."employee_id" AS TEXT)
      AND assignment.assignment_type = 'PRIMARY'
      AND assignment.revision = (
        SELECT max(latest.revision)
        FROM company_organization_assignment_period_versions latest
        WHERE latest.period_id = assignment.period_id
      )
      AND assignment.is_void = 0
      AND assignment.starts_on <= expense.spent_at
      AND (assignment.ends_on IS NULL OR expense.spent_at < assignment.ends_on)
    ORDER BY assignment.starts_on DESC, assignment.period_id, assignment.revision DESC
    LIMIT 1
  ),
  expense."category",
  expense."amount",
  expense."spent_at",
  expense."note",
  expense."status",
  expense."created_at"
FROM "expenses" expense;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'expenses.rows',
       (SELECT count(*) FROM "expenses"),
       (SELECT count(*) FROM "__new_expenses"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'expenses.employee_id',
       (SELECT count("employee_id") FROM "expenses"),
       (SELECT count("employee_id") FROM "__new_expenses"),
       (SELECT count(*) FROM "__new_expenses"
        WHERE "employee_id" IS NOT NULL AND typeof("employee_id") != 'text'),
       (SELECT count(*) FROM "__new_expenses" child
        LEFT JOIN company_employees employee ON employee.id = child."employee_id"
        WHERE child."employee_id" IS NOT NULL AND employee.id IS NULL);
INSERT INTO _product_employee_id_cutover_validation
SELECT 'expenses.organization_unit_id',
       (SELECT count(*) FROM "expenses"),
       (SELECT count("organization_unit_id") FROM "__new_expenses"),
       (SELECT count(*) FROM "__new_expenses"
        WHERE typeof("organization_unit_id") != 'text'),
       (SELECT count(*) FROM "__new_expenses" child
        LEFT JOIN company_organization_units unit ON unit.id = child."organization_unit_id"
        WHERE unit.id IS NULL);
DROP TABLE "expenses";
ALTER TABLE "__new_expenses" RENAME TO "expenses";
CREATE INDEX idx_expenses_employee ON expenses (employee_id);
CREATE INDEX idx_expenses_organization_unit ON expenses (organization_unit_id);
CREATE INDEX idx_expenses_status ON expenses (status);

CREATE TABLE "__new_family_care_leaves" (
  id TEXT PRIMARY KEY,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  leave_kind TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
INSERT INTO "__new_family_care_leaves" ("id", "employee_id", "leave_kind", "start_date", "end_date", "note", "status", "created_at")
SELECT "id", CAST("employee_id" AS TEXT), "leave_kind", "start_date", "end_date", "note", "status", "created_at" FROM "family_care_leaves";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'family_care_leaves.rows',
       (SELECT count(*) FROM "family_care_leaves"),
       (SELECT count(*) FROM "__new_family_care_leaves"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'family_care_leaves.employee_id',
       (SELECT count("employee_id") FROM "family_care_leaves"),
       (SELECT count("employee_id") FROM "__new_family_care_leaves"),
       (SELECT count(*) FROM "__new_family_care_leaves"
        WHERE "employee_id" IS NOT NULL AND typeof("employee_id") != 'text'),
       (SELECT count(*) FROM "__new_family_care_leaves" child
        LEFT JOIN company_employees employee ON employee.id = child."employee_id"
        WHERE child."employee_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "family_care_leaves";
ALTER TABLE "__new_family_care_leaves" RENAME TO "family_care_leaves";
CREATE INDEX idx_family_care_leaves_employee ON family_care_leaves (employee_id);

CREATE TABLE "__new_goal_evaluations" (
  id INTEGER PRIMARY KEY,
  goal_id INTEGER NOT NULL,
  evaluator_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  kind TEXT NOT NULL,
  score INTEGER,
  comment TEXT,
  created_at TEXT NOT NULL
);
INSERT INTO "__new_goal_evaluations" ("id", "goal_id", "evaluator_id", "kind", "score", "comment", "created_at")
SELECT "id", "goal_id", CAST("evaluator_id" AS TEXT), "kind", "score", "comment", "created_at" FROM "goal_evaluations";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'goal_evaluations.rows',
       (SELECT count(*) FROM "goal_evaluations"),
       (SELECT count(*) FROM "__new_goal_evaluations"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'goal_evaluations.evaluator_id',
       (SELECT count("evaluator_id") FROM "goal_evaluations"),
       (SELECT count("evaluator_id") FROM "__new_goal_evaluations"),
       (SELECT count(*) FROM "__new_goal_evaluations"
        WHERE "evaluator_id" IS NOT NULL AND typeof("evaluator_id") != 'text'),
       (SELECT count(*) FROM "__new_goal_evaluations" child
        LEFT JOIN company_employees employee ON employee.id = child."evaluator_id"
        WHERE child."evaluator_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "goal_evaluations";
ALTER TABLE "__new_goal_evaluations" RENAME TO "goal_evaluations";
CREATE UNIQUE INDEX idx_goal_evaluations_evaluator_kind
ON goal_evaluations (goal_id, evaluator_id, kind)
WHERE kind IN ('self', 'manager');
CREATE INDEX idx_goal_evaluations_goal ON goal_evaluations (goal_id);
CREATE UNIQUE INDEX idx_goal_evaluations_goal_final
ON goal_evaluations (goal_id)
WHERE kind = 'final';

CREATE TABLE "__new_governance_acknowledgements" (
  version_id TEXT NOT NULL,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  content_hash TEXT NOT NULL,
  acknowledged_at TEXT NOT NULL,
  PRIMARY KEY (version_id, employee_id)
);
INSERT INTO "__new_governance_acknowledgements" ("version_id", "employee_id", "content_hash", "acknowledged_at")
SELECT "version_id", CAST("employee_id" AS TEXT), "content_hash", "acknowledged_at" FROM "governance_acknowledgements";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'governance_acknowledgements.rows',
       (SELECT count(*) FROM "governance_acknowledgements"),
       (SELECT count(*) FROM "__new_governance_acknowledgements"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'governance_acknowledgements.employee_id',
       (SELECT count("employee_id") FROM "governance_acknowledgements"),
       (SELECT count("employee_id") FROM "__new_governance_acknowledgements"),
       (SELECT count(*) FROM "__new_governance_acknowledgements"
        WHERE "employee_id" IS NOT NULL AND typeof("employee_id") != 'text'),
       (SELECT count(*) FROM "__new_governance_acknowledgements" child
        LEFT JOIN company_employees employee ON employee.id = child."employee_id"
        WHERE child."employee_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "governance_acknowledgements";
ALTER TABLE "__new_governance_acknowledgements" RENAME TO "governance_acknowledgements";

CREATE TABLE "__new_governance_org_role_assignments" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_role_code TEXT NOT NULL,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  department_code TEXT,
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  source_document_code TEXT,
  created_by_account_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_by_account_id TEXT,
  revoked_at TEXT,
  CHECK (ends_on IS NULL OR starts_on < ends_on),
  CHECK (length(created_by_account_id) BETWEEN 1 AND 255),
  CHECK (revoked_by_account_id IS NULL OR length(revoked_by_account_id) BETWEEN 1 AND 255)
);
INSERT INTO "__new_governance_org_role_assignments" ("id", "org_role_code", "employee_id", "department_code", "starts_on", "ends_on", "source_document_code", "created_by_account_id", "created_at", "revoked_by_account_id", "revoked_at")
SELECT "id", "org_role_code", CAST("employee_id" AS TEXT), "department_code", "starts_on", "ends_on", "source_document_code", "created_by_account_id", "created_at", "revoked_by_account_id", "revoked_at" FROM "governance_org_role_assignments";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'governance_org_role_assignments.rows',
       (SELECT count(*) FROM "governance_org_role_assignments"),
       (SELECT count(*) FROM "__new_governance_org_role_assignments"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'governance_org_role_assignments.employee_id',
       (SELECT count("employee_id") FROM "governance_org_role_assignments"),
       (SELECT count("employee_id") FROM "__new_governance_org_role_assignments"),
       (SELECT count(*) FROM "__new_governance_org_role_assignments"
        WHERE "employee_id" IS NOT NULL AND typeof("employee_id") != 'text'),
       (SELECT count(*) FROM "__new_governance_org_role_assignments" child
        LEFT JOIN company_employees employee ON employee.id = child."employee_id"
        WHERE child."employee_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "governance_org_role_assignments";
ALTER TABLE "__new_governance_org_role_assignments" RENAME TO "governance_org_role_assignments";
CREATE INDEX idx_governance_role_assignments_employee
  ON governance_org_role_assignments (employee_id);
CREATE INDEX idx_governance_role_assignments_role_period
  ON governance_org_role_assignments (org_role_code, starts_on, ends_on);

CREATE TABLE "__new_governance_publication_approvals" (
  version_id TEXT NOT NULL,
  org_role_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by_employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT,
  decided_at TEXT,
  comment TEXT,
  PRIMARY KEY (version_id, org_role_code)
);
INSERT INTO "__new_governance_publication_approvals" ("version_id", "org_role_code", "status", "decided_by_employee_id", "decided_at", "comment")
SELECT "version_id", "org_role_code", "status", CAST("decided_by_employee_id" AS TEXT), "decided_at", "comment" FROM "governance_publication_approvals";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'governance_publication_approvals.rows',
       (SELECT count(*) FROM "governance_publication_approvals"),
       (SELECT count(*) FROM "__new_governance_publication_approvals"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'governance_publication_approvals.decided_by_employee_id',
       (SELECT count("decided_by_employee_id") FROM "governance_publication_approvals"),
       (SELECT count("decided_by_employee_id") FROM "__new_governance_publication_approvals"),
       (SELECT count(*) FROM "__new_governance_publication_approvals"
        WHERE "decided_by_employee_id" IS NOT NULL AND typeof("decided_by_employee_id") != 'text'),
       (SELECT count(*) FROM "__new_governance_publication_approvals" child
        LEFT JOIN company_employees employee ON employee.id = child."decided_by_employee_id"
        WHERE child."decided_by_employee_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "governance_publication_approvals";
ALTER TABLE "__new_governance_publication_approvals" RENAME TO "governance_publication_approvals";

CREATE TABLE "__new_health_checkups" (
  id INTEGER PRIMARY KEY,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  fiscal_year INTEGER NOT NULL,
  checkup_kind TEXT NOT NULL,
  conducted_on TEXT,
  status TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);
INSERT INTO "__new_health_checkups" ("id", "employee_id", "fiscal_year", "checkup_kind", "conducted_on", "status", "note", "created_at")
SELECT "id", CAST("employee_id" AS TEXT), "fiscal_year", "checkup_kind", "conducted_on", "status", "note", "created_at" FROM "health_checkups";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'health_checkups.rows',
       (SELECT count(*) FROM "health_checkups"),
       (SELECT count(*) FROM "__new_health_checkups"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'health_checkups.employee_id',
       (SELECT count("employee_id") FROM "health_checkups"),
       (SELECT count("employee_id") FROM "__new_health_checkups"),
       (SELECT count(*) FROM "__new_health_checkups"
        WHERE "employee_id" IS NOT NULL AND typeof("employee_id") != 'text'),
       (SELECT count(*) FROM "__new_health_checkups" child
        LEFT JOIN company_employees employee ON employee.id = child."employee_id"
        WHERE child."employee_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "health_checkups";
ALTER TABLE "__new_health_checkups" RENAME TO "health_checkups";
CREATE INDEX idx_health_checkups_employee ON health_checkups (employee_id);
CREATE INDEX idx_health_checkups_fiscal_year ON health_checkups (fiscal_year);

CREATE TABLE "__new_leave_balances" (
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  fiscal_year TEXT NOT NULL,
  leave_type TEXT NOT NULL,
  granted_days REAL NOT NULL,
  used_days REAL NOT NULL,
  remaining_days REAL NOT NULL,
  PRIMARY KEY (employee_id, fiscal_year, leave_type)
);
INSERT INTO "__new_leave_balances" ("employee_id", "fiscal_year", "leave_type", "granted_days", "used_days", "remaining_days")
SELECT CAST("employee_id" AS TEXT), "fiscal_year", "leave_type", "granted_days", "used_days", "remaining_days" FROM "leave_balances";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'leave_balances.rows',
       (SELECT count(*) FROM "leave_balances"),
       (SELECT count(*) FROM "__new_leave_balances"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'leave_balances.employee_id',
       (SELECT count("employee_id") FROM "leave_balances"),
       (SELECT count("employee_id") FROM "__new_leave_balances"),
       (SELECT count(*) FROM "__new_leave_balances"
        WHERE "employee_id" IS NOT NULL AND typeof("employee_id") != 'text'),
       (SELECT count(*) FROM "__new_leave_balances" child
        LEFT JOIN company_employees employee ON employee.id = child."employee_id"
        WHERE child."employee_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "leave_balances";
ALTER TABLE "__new_leave_balances" RENAME TO "leave_balances";
CREATE INDEX idx_leave_balances_employee ON leave_balances (employee_id, fiscal_year);

CREATE TABLE "__new_leave_requests" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  leave_type TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  days INTEGER NOT NULL,
  reason TEXT,
  status TEXT NOT NULL,
  approver_id INTEGER,
  decided_comment TEXT,
  created_at TEXT NOT NULL
, unit TEXT NOT NULL DEFAULT 'full_day', hours REAL, consumed_days REAL);
INSERT INTO "__new_leave_requests" ("id", "employee_id", "leave_type", "start_date", "end_date", "days", "reason", "status", "approver_id", "decided_comment", "created_at", "unit", "hours", "consumed_days")
SELECT "id", CAST("employee_id" AS TEXT), "leave_type", "start_date", "end_date", "days", "reason", "status", "approver_id", "decided_comment", "created_at", "unit", "hours", "consumed_days" FROM "leave_requests";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'leave_requests.rows',
       (SELECT count(*) FROM "leave_requests"),
       (SELECT count(*) FROM "__new_leave_requests"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'leave_requests.employee_id',
       (SELECT count("employee_id") FROM "leave_requests"),
       (SELECT count("employee_id") FROM "__new_leave_requests"),
       (SELECT count(*) FROM "__new_leave_requests"
        WHERE "employee_id" IS NOT NULL AND typeof("employee_id") != 'text'),
       (SELECT count(*) FROM "__new_leave_requests" child
        LEFT JOIN company_employees employee ON employee.id = child."employee_id"
        WHERE child."employee_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "leave_requests";
ALTER TABLE "__new_leave_requests" RENAME TO "leave_requests";
CREATE INDEX idx_leave_requests_employee ON leave_requests (employee_id);
CREATE INDEX idx_leave_requests_status ON leave_requests (status);

CREATE TABLE "__new_life_events" (
  id TEXT PRIMARY KEY,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  event_type TEXT NOT NULL,
  event_date TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
INSERT INTO "__new_life_events" ("id", "employee_id", "event_type", "event_date", "detail", "status", "created_at")
SELECT "id", CAST("employee_id" AS TEXT), "event_type", "event_date", "detail", "status", "created_at" FROM "life_events";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'life_events.rows',
       (SELECT count(*) FROM "life_events"),
       (SELECT count(*) FROM "__new_life_events"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'life_events.employee_id',
       (SELECT count("employee_id") FROM "life_events"),
       (SELECT count("employee_id") FROM "__new_life_events"),
       (SELECT count(*) FROM "__new_life_events"
        WHERE "employee_id" IS NOT NULL AND typeof("employee_id") != 'text'),
       (SELECT count(*) FROM "__new_life_events" child
        LEFT JOIN company_employees employee ON employee.id = child."employee_id"
        WHERE child."employee_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "life_events";
ALTER TABLE "__new_life_events" RENAME TO "life_events";
CREATE INDEX idx_life_events_employee ON life_events (employee_id);

CREATE TABLE "__new_meeting_minutes_records" (
  id INTEGER PRIMARY KEY,
  meeting_id INTEGER NOT NULL,
  held_on TEXT NOT NULL,
  title TEXT NOT NULL,
  attendees TEXT,
  body_md TEXT NOT NULL,
  author_employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  created_at TEXT NOT NULL
);
INSERT INTO "__new_meeting_minutes_records" ("id", "meeting_id", "held_on", "title", "attendees", "body_md", "author_employee_id", "created_at")
SELECT "id", "meeting_id", "held_on", "title", "attendees", "body_md", CAST("author_employee_id" AS TEXT), "created_at" FROM "meeting_minutes_records";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'meeting_minutes_records.rows',
       (SELECT count(*) FROM "meeting_minutes_records"),
       (SELECT count(*) FROM "__new_meeting_minutes_records"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'meeting_minutes_records.author_employee_id',
       (SELECT count("author_employee_id") FROM "meeting_minutes_records"),
       (SELECT count("author_employee_id") FROM "__new_meeting_minutes_records"),
       (SELECT count(*) FROM "__new_meeting_minutes_records"
        WHERE "author_employee_id" IS NOT NULL AND typeof("author_employee_id") != 'text'),
       (SELECT count(*) FROM "__new_meeting_minutes_records" child
        LEFT JOIN company_employees employee ON employee.id = child."author_employee_id"
        WHERE child."author_employee_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "meeting_minutes_records";
ALTER TABLE "__new_meeting_minutes_records" RENAME TO "meeting_minutes_records";
CREATE INDEX idx_meeting_minutes_meeting ON "meeting_minutes_records" (meeting_id);

CREATE TABLE "__new_onboarding_assignments" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  template_code TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  assigned_at TEXT NOT NULL
);
INSERT INTO "__new_onboarding_assignments" ("id", "employee_id", "template_code", "kind", "status", "assigned_at")
SELECT "id", CAST("employee_id" AS TEXT), "template_code", "kind", "status", "assigned_at" FROM "onboarding_assignments";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'onboarding_assignments.rows',
       (SELECT count(*) FROM "onboarding_assignments"),
       (SELECT count(*) FROM "__new_onboarding_assignments"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'onboarding_assignments.employee_id',
       (SELECT count("employee_id") FROM "onboarding_assignments"),
       (SELECT count("employee_id") FROM "__new_onboarding_assignments"),
       (SELECT count(*) FROM "__new_onboarding_assignments"
        WHERE "employee_id" IS NOT NULL AND typeof("employee_id") != 'text'),
       (SELECT count(*) FROM "__new_onboarding_assignments" child
        LEFT JOIN company_employees employee ON employee.id = child."employee_id"
        WHERE child."employee_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "onboarding_assignments";
ALTER TABLE "__new_onboarding_assignments" RENAME TO "onboarding_assignments";
CREATE INDEX idx_onboarding_assignments_employee ON onboarding_assignments (employee_id);
CREATE UNIQUE INDEX uq_onboarding_assignments_employee_template
ON onboarding_assignments (employee_id, template_code)
WHERE status != 'completed';

CREATE TABLE "__new_performance_goals" (
  id INTEGER PRIMARY KEY,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  period TEXT NOT NULL,
  title TEXT NOT NULL,
  kpi TEXT,
  weight INTEGER NOT NULL,
  status TEXT NOT NULL
, owner_type TEXT NOT NULL DEFAULT 'individual', parent_goal_id INTEGER, department_code TEXT, evaluation_sheet_id INTEGER);
INSERT INTO "__new_performance_goals" ("id", "employee_id", "period", "title", "kpi", "weight", "status", "owner_type", "parent_goal_id", "department_code", "evaluation_sheet_id")
SELECT "id", CAST("employee_id" AS TEXT), "period", "title", "kpi", "weight", "status", "owner_type", "parent_goal_id", "department_code", "evaluation_sheet_id" FROM "performance_goals";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'performance_goals.rows',
       (SELECT count(*) FROM "performance_goals"),
       (SELECT count(*) FROM "__new_performance_goals"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'performance_goals.employee_id',
       (SELECT count("employee_id") FROM "performance_goals"),
       (SELECT count("employee_id") FROM "__new_performance_goals"),
       (SELECT count(*) FROM "__new_performance_goals"
        WHERE "employee_id" IS NOT NULL AND typeof("employee_id") != 'text'),
       (SELECT count(*) FROM "__new_performance_goals" child
        LEFT JOIN company_employees employee ON employee.id = child."employee_id"
        WHERE child."employee_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "performance_goals";
ALTER TABLE "__new_performance_goals" RENAME TO "performance_goals";
CREATE INDEX idx_goals_department ON "performance_goals" (department_code);
CREATE INDEX idx_goals_employee ON "performance_goals" (employee_id);
CREATE INDEX idx_goals_owner_type ON "performance_goals" (owner_type);
CREATE INDEX idx_goals_parent ON "performance_goals" (parent_goal_id);
CREATE INDEX idx_goals_period ON "performance_goals" (period);
CREATE INDEX idx_performance_goals_evaluation_sheet
ON performance_goals (evaluation_sheet_id);

CREATE TABLE "__new_rental_reservations" (
  id TEXT PRIMARY KEY,
  requester_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  item_name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  purpose TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
INSERT INTO "__new_rental_reservations" ("id", "requester_id", "item_name", "start_date", "end_date", "purpose", "status", "created_at")
SELECT "id", CAST("requester_id" AS TEXT), "item_name", "start_date", "end_date", "purpose", "status", "created_at" FROM "rental_reservations";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'rental_reservations.rows',
       (SELECT count(*) FROM "rental_reservations"),
       (SELECT count(*) FROM "__new_rental_reservations"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'rental_reservations.requester_id',
       (SELECT count("requester_id") FROM "rental_reservations"),
       (SELECT count("requester_id") FROM "__new_rental_reservations"),
       (SELECT count(*) FROM "__new_rental_reservations"
        WHERE "requester_id" IS NOT NULL AND typeof("requester_id") != 'text'),
       (SELECT count(*) FROM "__new_rental_reservations" child
        LEFT JOIN company_employees employee ON employee.id = child."requester_id"
        WHERE child."requester_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "rental_reservations";
ALTER TABLE "__new_rental_reservations" RENAME TO "rental_reservations";
CREATE INDEX idx_rental_reservations_requester ON rental_reservations (requester_id);

CREATE TABLE "__new_resignations" (
  id TEXT PRIMARY KEY,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  resignation_date TEXT NOT NULL,
  last_working_date TEXT,
  reason TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
INSERT INTO "__new_resignations" ("id", "employee_id", "resignation_date", "last_working_date", "reason", "status", "created_at")
SELECT "id", CAST("employee_id" AS TEXT), "resignation_date", "last_working_date", "reason", "status", "created_at" FROM "resignations";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'resignations.rows',
       (SELECT count(*) FROM "resignations"),
       (SELECT count(*) FROM "__new_resignations"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'resignations.employee_id',
       (SELECT count("employee_id") FROM "resignations"),
       (SELECT count("employee_id") FROM "__new_resignations"),
       (SELECT count(*) FROM "__new_resignations"
        WHERE "employee_id" IS NOT NULL AND typeof("employee_id") != 'text'),
       (SELECT count(*) FROM "__new_resignations" child
        LEFT JOIN company_employees employee ON employee.id = child."employee_id"
        WHERE child."employee_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "resignations";
ALTER TABLE "__new_resignations" RENAME TO "resignations";
CREATE INDEX idx_resignations_employee ON resignations (employee_id);
CREATE UNIQUE INDEX idx_resignations_employee_requested
ON resignations (employee_id)
WHERE status = 'requested';

CREATE TABLE "__new_review_forms" (
  id INTEGER PRIMARY KEY,
  cycle_id INTEGER NOT NULL,
  subject_employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  reviewer_employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  reviewer_type TEXT NOT NULL,
  answers TEXT NOT NULL,
  score INTEGER,
  status TEXT NOT NULL,
  submitted_at TEXT
, comment TEXT, visibility TEXT NOT NULL DEFAULT 'disclosed');
INSERT INTO "__new_review_forms" ("id", "cycle_id", "subject_employee_id", "reviewer_employee_id", "reviewer_type", "answers", "score", "status", "submitted_at", "comment", "visibility")
SELECT "id", "cycle_id", CAST("subject_employee_id" AS TEXT), CAST("reviewer_employee_id" AS TEXT), "reviewer_type", "answers", "score", "status", "submitted_at", "comment", "visibility" FROM "review_forms";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'review_forms.rows',
       (SELECT count(*) FROM "review_forms"),
       (SELECT count(*) FROM "__new_review_forms"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'review_forms.subject_employee_id',
       (SELECT count("subject_employee_id") FROM "review_forms"),
       (SELECT count("subject_employee_id") FROM "__new_review_forms"),
       (SELECT count(*) FROM "__new_review_forms"
        WHERE "subject_employee_id" IS NOT NULL AND typeof("subject_employee_id") != 'text'),
       (SELECT count(*) FROM "__new_review_forms" child
        LEFT JOIN company_employees employee ON employee.id = child."subject_employee_id"
        WHERE child."subject_employee_id" IS NOT NULL AND employee.id IS NULL);
INSERT INTO _product_employee_id_cutover_validation
SELECT 'review_forms.reviewer_employee_id',
       (SELECT count("reviewer_employee_id") FROM "review_forms"),
       (SELECT count("reviewer_employee_id") FROM "__new_review_forms"),
       (SELECT count(*) FROM "__new_review_forms"
        WHERE "reviewer_employee_id" IS NOT NULL AND typeof("reviewer_employee_id") != 'text'),
       (SELECT count(*) FROM "__new_review_forms" child
        LEFT JOIN company_employees employee ON employee.id = child."reviewer_employee_id"
        WHERE child."reviewer_employee_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "review_forms";
ALTER TABLE "__new_review_forms" RENAME TO "review_forms";
CREATE INDEX idx_review_forms_cycle_subject ON review_forms (cycle_id, subject_employee_id);
CREATE INDEX idx_review_forms_reviewer ON review_forms (reviewer_employee_id);
CREATE UNIQUE INDEX uq_review_form_assignment
  ON review_forms (cycle_id, subject_employee_id, reviewer_employee_id, reviewer_type);

CREATE TABLE "__new_room_reservations" (
  id TEXT PRIMARY KEY,
  room_id INTEGER NOT NULL,
  reserver_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  purpose TEXT
);
INSERT INTO "__new_room_reservations" ("id", "room_id", "reserver_id", "start_at", "end_at", "purpose")
SELECT "id", "room_id", CAST("reserver_id" AS TEXT), "start_at", "end_at", "purpose" FROM "room_reservations";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'room_reservations.rows',
       (SELECT count(*) FROM "room_reservations"),
       (SELECT count(*) FROM "__new_room_reservations"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'room_reservations.reserver_id',
       (SELECT count("reserver_id") FROM "room_reservations"),
       (SELECT count("reserver_id") FROM "__new_room_reservations"),
       (SELECT count(*) FROM "__new_room_reservations"
        WHERE "reserver_id" IS NOT NULL AND typeof("reserver_id") != 'text'),
       (SELECT count(*) FROM "__new_room_reservations" child
        LEFT JOIN company_employees employee ON employee.id = child."reserver_id"
        WHERE child."reserver_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "room_reservations";
ALTER TABLE "__new_room_reservations" RENAME TO "room_reservations";
CREATE INDEX idx_room_reservations_reserver ON room_reservations (reserver_id);
CREATE INDEX idx_room_reservations_room ON room_reservations (room_id);
CREATE INDEX idx_room_reservations_room_time ON room_reservations (room_id, start_at, end_at);

CREATE TABLE "__new_salary_revisions" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  effective_date TEXT NOT NULL,
  previous_base_salary INTEGER NOT NULL,
  new_base_salary INTEGER NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL
);
INSERT INTO "__new_salary_revisions" ("id", "employee_id", "effective_date", "previous_base_salary", "new_base_salary", "reason", "created_at")
SELECT "id", CAST("employee_id" AS TEXT), "effective_date", "previous_base_salary", "new_base_salary", "reason", "created_at" FROM "salary_revisions";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'salary_revisions.rows',
       (SELECT count(*) FROM "salary_revisions"),
       (SELECT count(*) FROM "__new_salary_revisions"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'salary_revisions.employee_id',
       (SELECT count("employee_id") FROM "salary_revisions"),
       (SELECT count("employee_id") FROM "__new_salary_revisions"),
       (SELECT count(*) FROM "__new_salary_revisions"
        WHERE "employee_id" IS NOT NULL AND typeof("employee_id") != 'text'),
       (SELECT count(*) FROM "__new_salary_revisions" child
        LEFT JOIN company_employees employee ON employee.id = child."employee_id"
        WHERE child."employee_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "salary_revisions";
ALTER TABLE "__new_salary_revisions" RENAME TO "salary_revisions";
CREATE INDEX idx_salary_revisions_employee ON salary_revisions (employee_id);
CREATE UNIQUE INDEX uq_salary_revisions_employee_date ON salary_revisions (employee_id, effective_date);

CREATE TABLE "__new_shift_assignments" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  pattern_id INTEGER,
  date TEXT NOT NULL,
  note TEXT,
  published_at TEXT
);
INSERT INTO "__new_shift_assignments" ("id", "employee_id", "pattern_id", "date", "note", "published_at")
SELECT "id", CAST("employee_id" AS TEXT), "pattern_id", "date", "note", "published_at" FROM "shift_assignments";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'shift_assignments.rows',
       (SELECT count(*) FROM "shift_assignments"),
       (SELECT count(*) FROM "__new_shift_assignments"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'shift_assignments.employee_id',
       (SELECT count("employee_id") FROM "shift_assignments"),
       (SELECT count("employee_id") FROM "__new_shift_assignments"),
       (SELECT count(*) FROM "__new_shift_assignments"
        WHERE "employee_id" IS NOT NULL AND typeof("employee_id") != 'text'),
       (SELECT count(*) FROM "__new_shift_assignments" child
        LEFT JOIN company_employees employee ON employee.id = child."employee_id"
        WHERE child."employee_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "shift_assignments";
ALTER TABLE "__new_shift_assignments" RENAME TO "shift_assignments";
CREATE INDEX idx_shift_assignments_date ON shift_assignments (date);
CREATE INDEX idx_shift_assignments_employee ON shift_assignments (employee_id);
CREATE INDEX idx_shift_assignments_pattern ON shift_assignments (pattern_id);
CREATE UNIQUE INDEX uq_shift_assignment_employee_date
  ON shift_assignments (employee_id, date);

CREATE TABLE "__new_shift_swap_requests" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requester_employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  target_employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  date TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL,
  approved_at TEXT
);
INSERT INTO "__new_shift_swap_requests" ("id", "requester_employee_id", "target_employee_id", "date", "note", "status", "approved_at")
SELECT "id", CAST("requester_employee_id" AS TEXT), CAST("target_employee_id" AS TEXT), "date", "note", "status", "approved_at" FROM "shift_swap_requests";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'shift_swap_requests.rows',
       (SELECT count(*) FROM "shift_swap_requests"),
       (SELECT count(*) FROM "__new_shift_swap_requests"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'shift_swap_requests.requester_employee_id',
       (SELECT count("requester_employee_id") FROM "shift_swap_requests"),
       (SELECT count("requester_employee_id") FROM "__new_shift_swap_requests"),
       (SELECT count(*) FROM "__new_shift_swap_requests"
        WHERE "requester_employee_id" IS NOT NULL AND typeof("requester_employee_id") != 'text'),
       (SELECT count(*) FROM "__new_shift_swap_requests" child
        LEFT JOIN company_employees employee ON employee.id = child."requester_employee_id"
        WHERE child."requester_employee_id" IS NOT NULL AND employee.id IS NULL);
INSERT INTO _product_employee_id_cutover_validation
SELECT 'shift_swap_requests.target_employee_id',
       (SELECT count("target_employee_id") FROM "shift_swap_requests"),
       (SELECT count("target_employee_id") FROM "__new_shift_swap_requests"),
       (SELECT count(*) FROM "__new_shift_swap_requests"
        WHERE "target_employee_id" IS NOT NULL AND typeof("target_employee_id") != 'text'),
       (SELECT count(*) FROM "__new_shift_swap_requests" child
        LEFT JOIN company_employees employee ON employee.id = child."target_employee_id"
        WHERE child."target_employee_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "shift_swap_requests";
ALTER TABLE "__new_shift_swap_requests" RENAME TO "shift_swap_requests";
CREATE UNIQUE INDEX idx_shift_swap_requests_pending
ON shift_swap_requests (requester_employee_id, target_employee_id, date)
WHERE status = 'pending';
CREATE INDEX idx_shift_swap_requests_requester ON shift_swap_requests (requester_employee_id);

CREATE TABLE "__new_software_licenses" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  vendor TEXT,
  category TEXT,
  seats INTEGER,
  renewal_deadline TEXT,
  owner_employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT,
  note TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
INSERT INTO "__new_software_licenses" ("id", "name", "vendor", "category", "seats", "renewal_deadline", "owner_employee_id", "note", "status", "created_at")
SELECT "id", "name", "vendor", "category", "seats", "renewal_deadline", CAST("owner_employee_id" AS TEXT), "note", "status", "created_at" FROM "software_licenses";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'software_licenses.rows',
       (SELECT count(*) FROM "software_licenses"),
       (SELECT count(*) FROM "__new_software_licenses"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'software_licenses.owner_employee_id',
       (SELECT count("owner_employee_id") FROM "software_licenses"),
       (SELECT count("owner_employee_id") FROM "__new_software_licenses"),
       (SELECT count(*) FROM "__new_software_licenses"
        WHERE "owner_employee_id" IS NOT NULL AND typeof("owner_employee_id") != 'text'),
       (SELECT count(*) FROM "__new_software_licenses" child
        LEFT JOIN company_employees employee ON employee.id = child."owner_employee_id"
        WHERE child."owner_employee_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "software_licenses";
ALTER TABLE "__new_software_licenses" RENAME TO "software_licenses";
CREATE INDEX idx_licenses_renewal_deadline ON "software_licenses" (renewal_deadline);

CREATE TABLE "__new_stocktake_items" (
  stocktake_id TEXT NOT NULL,
  asset_code TEXT NOT NULL,
  checked_at TEXT,
  checker_employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT,
  location_note TEXT,
  PRIMARY KEY (stocktake_id, asset_code)
);
INSERT INTO "__new_stocktake_items" ("stocktake_id", "asset_code", "checked_at", "checker_employee_id", "location_note")
SELECT "stocktake_id", "asset_code", "checked_at", CAST("checker_employee_id" AS TEXT), "location_note" FROM "stocktake_items";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'stocktake_items.rows',
       (SELECT count(*) FROM "stocktake_items"),
       (SELECT count(*) FROM "__new_stocktake_items"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'stocktake_items.checker_employee_id',
       (SELECT count("checker_employee_id") FROM "stocktake_items"),
       (SELECT count("checker_employee_id") FROM "__new_stocktake_items"),
       (SELECT count(*) FROM "__new_stocktake_items"
        WHERE "checker_employee_id" IS NOT NULL AND typeof("checker_employee_id") != 'text'),
       (SELECT count(*) FROM "__new_stocktake_items" child
        LEFT JOIN company_employees employee ON employee.id = child."checker_employee_id"
        WHERE child."checker_employee_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "stocktake_items";
ALTER TABLE "__new_stocktake_items" RENAME TO "stocktake_items";
CREATE INDEX idx_stocktake_items_asset ON stocktake_items (asset_code);

CREATE TABLE "__new_thanks_messages" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  recipient_employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  message TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
INSERT INTO "__new_thanks_messages" ("id", "sender_employee_id", "recipient_employee_id", "message", "points", "created_at")
SELECT "id", CAST("sender_employee_id" AS TEXT), CAST("recipient_employee_id" AS TEXT), "message", "points", "created_at" FROM "thanks_messages";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'thanks_messages.rows',
       (SELECT count(*) FROM "thanks_messages"),
       (SELECT count(*) FROM "__new_thanks_messages"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'thanks_messages.sender_employee_id',
       (SELECT count("sender_employee_id") FROM "thanks_messages"),
       (SELECT count("sender_employee_id") FROM "__new_thanks_messages"),
       (SELECT count(*) FROM "__new_thanks_messages"
        WHERE "sender_employee_id" IS NOT NULL AND typeof("sender_employee_id") != 'text'),
       (SELECT count(*) FROM "__new_thanks_messages" child
        LEFT JOIN company_employees employee ON employee.id = child."sender_employee_id"
        WHERE child."sender_employee_id" IS NOT NULL AND employee.id IS NULL);
INSERT INTO _product_employee_id_cutover_validation
SELECT 'thanks_messages.recipient_employee_id',
       (SELECT count("recipient_employee_id") FROM "thanks_messages"),
       (SELECT count("recipient_employee_id") FROM "__new_thanks_messages"),
       (SELECT count(*) FROM "__new_thanks_messages"
        WHERE "recipient_employee_id" IS NOT NULL AND typeof("recipient_employee_id") != 'text'),
       (SELECT count(*) FROM "__new_thanks_messages" child
        LEFT JOIN company_employees employee ON employee.id = child."recipient_employee_id"
        WHERE child."recipient_employee_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "thanks_messages";
ALTER TABLE "__new_thanks_messages" RENAME TO "thanks_messages";
CREATE INDEX idx_thanks_created_at ON "thanks_messages" (created_at);
CREATE INDEX idx_thanks_recipient ON "thanks_messages" (recipient_employee_id);

CREATE TABLE "__new_thanks_point_budgets" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  period TEXT NOT NULL,
  granted_points INTEGER NOT NULL,
  consumed_points INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
INSERT INTO "__new_thanks_point_budgets" ("id", "employee_id", "period", "granted_points", "consumed_points", "created_at")
SELECT "id", CAST("employee_id" AS TEXT), "period", "granted_points", "consumed_points", "created_at" FROM "thanks_point_budgets";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'thanks_point_budgets.rows',
       (SELECT count(*) FROM "thanks_point_budgets"),
       (SELECT count(*) FROM "__new_thanks_point_budgets"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'thanks_point_budgets.employee_id',
       (SELECT count("employee_id") FROM "thanks_point_budgets"),
       (SELECT count("employee_id") FROM "__new_thanks_point_budgets"),
       (SELECT count(*) FROM "__new_thanks_point_budgets"
        WHERE "employee_id" IS NOT NULL AND typeof("employee_id") != 'text'),
       (SELECT count(*) FROM "__new_thanks_point_budgets" child
        LEFT JOIN company_employees employee ON employee.id = child."employee_id"
        WHERE child."employee_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "thanks_point_budgets";
ALTER TABLE "__new_thanks_point_budgets" RENAME TO "thanks_point_budgets";
CREATE UNIQUE INDEX uq_thanks_point_budgets_employee_period
  ON thanks_point_budgets (employee_id, period);

CREATE TABLE "__new_thanks_redemptions" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  reward_id INTEGER NOT NULL,
  point_cost INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  decided_at TEXT,
  decider_id INTEGER
);
INSERT INTO "__new_thanks_redemptions" ("id", "employee_id", "reward_id", "point_cost", "status", "created_at", "decided_at", "decider_id")
SELECT "id", CAST("employee_id" AS TEXT), "reward_id", "point_cost", "status", "created_at", "decided_at", "decider_id" FROM "thanks_redemptions";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'thanks_redemptions.rows',
       (SELECT count(*) FROM "thanks_redemptions"),
       (SELECT count(*) FROM "__new_thanks_redemptions"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'thanks_redemptions.employee_id',
       (SELECT count("employee_id") FROM "thanks_redemptions"),
       (SELECT count("employee_id") FROM "__new_thanks_redemptions"),
       (SELECT count(*) FROM "__new_thanks_redemptions"
        WHERE "employee_id" IS NOT NULL AND typeof("employee_id") != 'text'),
       (SELECT count(*) FROM "__new_thanks_redemptions" child
        LEFT JOIN company_employees employee ON employee.id = child."employee_id"
        WHERE child."employee_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "thanks_redemptions";
ALTER TABLE "__new_thanks_redemptions" RENAME TO "thanks_redemptions";
CREATE INDEX idx_thanks_redemptions_employee ON thanks_redemptions (employee_id);
CREATE UNIQUE INDEX idx_thanks_redemptions_employee_pending
  ON thanks_redemptions (employee_id) WHERE status = 'pending';
CREATE INDEX idx_thanks_redemptions_status ON thanks_redemptions (status);

CREATE TABLE "__new_training_enrollments" (
  id INTEGER PRIMARY KEY,
  course_id INTEGER NOT NULL,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  status TEXT NOT NULL,
  completed_at TEXT,
  score INTEGER,
  due_date TEXT
);
INSERT INTO "__new_training_enrollments" ("id", "course_id", "employee_id", "status", "completed_at", "score", "due_date")
SELECT "id", "course_id", CAST("employee_id" AS TEXT), "status", "completed_at", "score", "due_date" FROM "training_enrollments";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'training_enrollments.rows',
       (SELECT count(*) FROM "training_enrollments"),
       (SELECT count(*) FROM "__new_training_enrollments"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'training_enrollments.employee_id',
       (SELECT count("employee_id") FROM "training_enrollments"),
       (SELECT count("employee_id") FROM "__new_training_enrollments"),
       (SELECT count(*) FROM "__new_training_enrollments"
        WHERE "employee_id" IS NOT NULL AND typeof("employee_id") != 'text'),
       (SELECT count(*) FROM "__new_training_enrollments" child
        LEFT JOIN company_employees employee ON employee.id = child."employee_id"
        WHERE child."employee_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "training_enrollments";
ALTER TABLE "__new_training_enrollments" RENAME TO "training_enrollments";
CREATE INDEX idx_training_enrollments_course ON training_enrollments (course_id);
CREATE UNIQUE INDEX idx_training_enrollments_course_employee
  ON training_enrollments (course_id, employee_id);
CREATE INDEX idx_training_enrollments_employee ON training_enrollments (employee_id);

CREATE TABLE "__new_work_accidents" (
  id INTEGER PRIMARY KEY,
  occurred_on TEXT NOT NULL,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT,
  location TEXT,
  summary TEXT NOT NULL,
  severity TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
INSERT INTO "__new_work_accidents" ("id", "occurred_on", "employee_id", "location", "summary", "severity", "status", "created_at")
SELECT "id", "occurred_on", CAST("employee_id" AS TEXT), "location", "summary", "severity", "status", "created_at" FROM "work_accidents";
INSERT INTO _product_employee_id_cutover_validation
SELECT 'work_accidents.rows',
       (SELECT count(*) FROM "work_accidents"),
       (SELECT count(*) FROM "__new_work_accidents"),
       0,
       0;
INSERT INTO _product_employee_id_cutover_validation
SELECT 'work_accidents.employee_id',
       (SELECT count("employee_id") FROM "work_accidents"),
       (SELECT count("employee_id") FROM "__new_work_accidents"),
       (SELECT count(*) FROM "__new_work_accidents"
        WHERE "employee_id" IS NOT NULL AND typeof("employee_id") != 'text'),
       (SELECT count(*) FROM "__new_work_accidents" child
        LEFT JOIN company_employees employee ON employee.id = child."employee_id"
        WHERE child."employee_id" IS NOT NULL AND employee.id IS NULL);
DROP TABLE "work_accidents";
ALTER TABLE "__new_work_accidents" RENAME TO "work_accidents";
CREATE INDEX idx_work_accidents_employee ON work_accidents (employee_id);
CREATE INDEX idx_work_accidents_occurred_on ON work_accidents (occurred_on);

DROP TABLE _product_employee_id_cutover_validation;

PRAGMA foreign_keys = ON;
PRAGMA foreign_key_check;
