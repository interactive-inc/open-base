-- 業務contextに残った社員参照を、canonical Company Employee IDのTEXTへ無損失で統一する。

PRAGMA foreign_keys = OFF;

CREATE TABLE _remaining_product_employee_id_cutover_validation (
  resource TEXT PRIMARY KEY NOT NULL,
  source_count INTEGER NOT NULL,
  target_count INTEGER NOT NULL,
  non_text_count INTEGER NOT NULL,
  orphan_count INTEGER NOT NULL,
  CHECK (source_count = target_count AND non_text_count = 0 AND orphan_count = 0)
);

CREATE TABLE "__new_leave_requests" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  leave_type TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  days INTEGER NOT NULL,
  reason TEXT,
  status TEXT NOT NULL,
  approver_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT,
  decided_comment TEXT,
  created_at TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'full_day',
  hours REAL,
  consumed_days REAL
);
INSERT INTO "__new_leave_requests"
  (id, employee_id, leave_type, start_date, end_date, days, reason, status,
   approver_id, decided_comment, created_at, unit, hours, consumed_days)
SELECT id, employee_id, leave_type, start_date, end_date, days, reason, status,
       CAST(approver_id AS TEXT), decided_comment, created_at, unit, hours, consumed_days
FROM leave_requests;
INSERT INTO _remaining_product_employee_id_cutover_validation
SELECT 'leave_requests.rows', count(*), (SELECT count(*) FROM "__new_leave_requests"), 0, 0
FROM leave_requests;
INSERT INTO _remaining_product_employee_id_cutover_validation
SELECT 'leave_requests.approver_id', count(approver_id),
       (SELECT count(approver_id) FROM "__new_leave_requests"),
       (SELECT count(*) FROM "__new_leave_requests"
        WHERE approver_id IS NOT NULL AND typeof(approver_id) != 'text'),
       (SELECT count(*) FROM "__new_leave_requests" child
        LEFT JOIN company_employees employee ON employee.id = child.approver_id
        WHERE child.approver_id IS NOT NULL AND employee.id IS NULL)
FROM leave_requests;
DROP TABLE leave_requests;
ALTER TABLE "__new_leave_requests" RENAME TO leave_requests;
CREATE INDEX idx_leave_requests_employee ON leave_requests (employee_id);
CREATE INDEX idx_leave_requests_status ON leave_requests (status);

CREATE TABLE "__new_ringi_requests" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  applicant_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  approver_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  title TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL,
  decided_at TEXT,
  decision_comment TEXT,
  created_at TEXT NOT NULL
);
INSERT INTO "__new_ringi_requests"
  (id, applicant_id, approver_id, title, amount, reason, status, decided_at,
   decision_comment, created_at)
SELECT id, CAST(applicant_id AS TEXT), CAST(approver_id AS TEXT), title, amount,
       reason, status, decided_at, decision_comment, created_at
FROM ringi_requests;
INSERT INTO _remaining_product_employee_id_cutover_validation
SELECT 'ringi_requests.rows', count(*), (SELECT count(*) FROM "__new_ringi_requests"), 0, 0
FROM ringi_requests;
INSERT INTO _remaining_product_employee_id_cutover_validation
SELECT 'ringi_requests.applicant_id', count(applicant_id),
       (SELECT count(applicant_id) FROM "__new_ringi_requests"),
       (SELECT count(*) FROM "__new_ringi_requests" WHERE typeof(applicant_id) != 'text'),
       (SELECT count(*) FROM "__new_ringi_requests" child
        LEFT JOIN company_employees employee ON employee.id = child.applicant_id
        WHERE employee.id IS NULL)
FROM ringi_requests;
INSERT INTO _remaining_product_employee_id_cutover_validation
SELECT 'ringi_requests.approver_id', count(approver_id),
       (SELECT count(approver_id) FROM "__new_ringi_requests"),
       (SELECT count(*) FROM "__new_ringi_requests" WHERE typeof(approver_id) != 'text'),
       (SELECT count(*) FROM "__new_ringi_requests" child
        LEFT JOIN company_employees employee ON employee.id = child.approver_id
        WHERE employee.id IS NULL)
FROM ringi_requests;
DROP TABLE ringi_requests;
ALTER TABLE "__new_ringi_requests" RENAME TO ringi_requests;
CREATE INDEX idx_ringi_requests_applicant ON ringi_requests (applicant_id);
CREATE INDEX idx_ringi_requests_approver ON ringi_requests (approver_id);
CREATE INDEX idx_ringi_requests_status ON ringi_requests (status);

CREATE TABLE "__new_survey_responses" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  survey_id INTEGER NOT NULL,
  respondent_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  answers_json TEXT NOT NULL,
  submitted_at TEXT NOT NULL
);
INSERT INTO "__new_survey_responses" (id, survey_id, respondent_id, answers_json, submitted_at)
SELECT id, survey_id, CAST(respondent_id AS TEXT), answers_json, submitted_at
FROM survey_responses;
INSERT INTO _remaining_product_employee_id_cutover_validation
SELECT 'survey_responses.rows', count(*), (SELECT count(*) FROM "__new_survey_responses"), 0, 0
FROM survey_responses;
INSERT INTO _remaining_product_employee_id_cutover_validation
SELECT 'survey_responses.respondent_id', count(respondent_id),
       (SELECT count(respondent_id) FROM "__new_survey_responses"),
       (SELECT count(*) FROM "__new_survey_responses" WHERE typeof(respondent_id) != 'text'),
       (SELECT count(*) FROM "__new_survey_responses" child
        LEFT JOIN company_employees employee ON employee.id = child.respondent_id
        WHERE employee.id IS NULL)
FROM survey_responses;
DROP TABLE survey_responses;
ALTER TABLE "__new_survey_responses" RENAME TO survey_responses;
CREATE INDEX idx_survey_responses_respondent ON survey_responses (respondent_id);
CREATE INDEX idx_survey_responses_survey ON survey_responses (survey_id);
CREATE UNIQUE INDEX idx_survey_responses_survey_respondent
  ON survey_responses (survey_id, respondent_id);

CREATE TABLE "__new_one_on_ones" (
  id TEXT PRIMARY KEY,
  member_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  manager_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  held_at TEXT NOT NULL,
  topics TEXT,
  manager_note TEXT,
  next_action TEXT,
  evaluation_sheet_id INTEGER
);
INSERT INTO "__new_one_on_ones"
  (id, member_id, manager_id, held_at, topics, manager_note, next_action, evaluation_sheet_id)
SELECT id, CAST(member_id AS TEXT), CAST(manager_id AS TEXT), held_at, topics,
       manager_note, next_action, evaluation_sheet_id
FROM one_on_ones;
INSERT INTO _remaining_product_employee_id_cutover_validation
SELECT 'one_on_ones.rows', count(*), (SELECT count(*) FROM "__new_one_on_ones"), 0, 0
FROM one_on_ones;
INSERT INTO _remaining_product_employee_id_cutover_validation
SELECT 'one_on_ones.member_id', count(member_id),
       (SELECT count(member_id) FROM "__new_one_on_ones"),
       (SELECT count(*) FROM "__new_one_on_ones" WHERE typeof(member_id) != 'text'),
       (SELECT count(*) FROM "__new_one_on_ones" child
        LEFT JOIN company_employees employee ON employee.id = child.member_id
        WHERE employee.id IS NULL)
FROM one_on_ones;
INSERT INTO _remaining_product_employee_id_cutover_validation
SELECT 'one_on_ones.manager_id', count(manager_id),
       (SELECT count(manager_id) FROM "__new_one_on_ones"),
       (SELECT count(*) FROM "__new_one_on_ones" WHERE typeof(manager_id) != 'text'),
       (SELECT count(*) FROM "__new_one_on_ones" child
        LEFT JOIN company_employees employee ON employee.id = child.manager_id
        WHERE employee.id IS NULL)
FROM one_on_ones;
DROP TABLE one_on_ones;
ALTER TABLE "__new_one_on_ones" RENAME TO one_on_ones;
CREATE INDEX idx_one_on_ones_evaluation_sheet ON one_on_ones (evaluation_sheet_id);
CREATE INDEX idx_one_on_ones_manager ON one_on_ones (manager_id);
CREATE INDEX idx_one_on_ones_member ON one_on_ones (member_id);

CREATE TABLE "__new_thanks_redemptions" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  reward_id INTEGER NOT NULL,
  point_cost INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  decided_at TEXT,
  decider_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT
);
INSERT INTO "__new_thanks_redemptions"
  (id, employee_id, reward_id, point_cost, status, created_at, decided_at, decider_id)
SELECT id, employee_id, reward_id, point_cost, status, created_at, decided_at,
       CAST(decider_id AS TEXT)
FROM thanks_redemptions;
INSERT INTO _remaining_product_employee_id_cutover_validation
SELECT 'thanks_redemptions.rows', count(*), (SELECT count(*) FROM "__new_thanks_redemptions"), 0, 0
FROM thanks_redemptions;
INSERT INTO _remaining_product_employee_id_cutover_validation
SELECT 'thanks_redemptions.decider_id', count(decider_id),
       (SELECT count(decider_id) FROM "__new_thanks_redemptions"),
       (SELECT count(*) FROM "__new_thanks_redemptions"
        WHERE decider_id IS NOT NULL AND typeof(decider_id) != 'text'),
       (SELECT count(*) FROM "__new_thanks_redemptions" child
        LEFT JOIN company_employees employee ON employee.id = child.decider_id
        WHERE child.decider_id IS NOT NULL AND employee.id IS NULL)
FROM thanks_redemptions;
DROP TABLE thanks_redemptions;
ALTER TABLE "__new_thanks_redemptions" RENAME TO thanks_redemptions;
CREATE INDEX idx_thanks_redemptions_employee ON thanks_redemptions (employee_id);
CREATE UNIQUE INDEX idx_thanks_redemptions_employee_pending
  ON thanks_redemptions (employee_id) WHERE status = 'pending';
CREATE INDEX idx_thanks_redemptions_status ON thanks_redemptions (status);

CREATE TABLE "__new_knowledge_articles" (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT,
  body_md TEXT NOT NULL,
  author_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  created_at TEXT NOT NULL
);
INSERT INTO "__new_knowledge_articles"
  (id, title, category, tags, body_md, author_id, created_at)
SELECT id, title, category, tags, body_md, CAST(author_id AS TEXT), created_at
FROM knowledge_articles;
INSERT INTO _remaining_product_employee_id_cutover_validation
SELECT 'knowledge_articles.rows', count(*), (SELECT count(*) FROM "__new_knowledge_articles"), 0, 0
FROM knowledge_articles;
INSERT INTO _remaining_product_employee_id_cutover_validation
SELECT 'knowledge_articles.author_id', count(author_id),
       (SELECT count(author_id) FROM "__new_knowledge_articles"),
       (SELECT count(*) FROM "__new_knowledge_articles" WHERE typeof(author_id) != 'text'),
       (SELECT count(*) FROM "__new_knowledge_articles" child
        LEFT JOIN company_employees employee ON employee.id = child.author_id
        WHERE employee.id IS NULL)
FROM knowledge_articles;
DROP TABLE knowledge_articles;
ALTER TABLE "__new_knowledge_articles" RENAME TO knowledge_articles;
CREATE INDEX idx_knowledge_articles_category ON knowledge_articles (category);

CREATE TABLE "__new_evaluation_templates" (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  period TEXT NOT NULL,
  items TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO "__new_evaluation_templates"
  (id, title, period, items, status, created_by, created_at, updated_at)
SELECT id, title, period, items, status, CAST(created_by AS TEXT), created_at, updated_at
FROM evaluation_templates;
INSERT INTO _remaining_product_employee_id_cutover_validation
SELECT 'evaluation_templates.rows', count(*), (SELECT count(*) FROM "__new_evaluation_templates"), 0, 0
FROM evaluation_templates;
INSERT INTO _remaining_product_employee_id_cutover_validation
SELECT 'evaluation_templates.created_by', count(created_by),
       (SELECT count(created_by) FROM "__new_evaluation_templates"),
       (SELECT count(*) FROM "__new_evaluation_templates" WHERE typeof(created_by) != 'text'),
       (SELECT count(*) FROM "__new_evaluation_templates" child
        LEFT JOIN company_employees employee ON employee.id = child.created_by
        WHERE employee.id IS NULL)
FROM evaluation_templates;
DROP TABLE evaluation_templates;
ALTER TABLE "__new_evaluation_templates" RENAME TO evaluation_templates;
CREATE INDEX idx_evaluation_templates_period ON evaluation_templates (period);
CREATE INDEX idx_evaluation_templates_status ON evaluation_templates (status);

CREATE TABLE "__new_evaluation_sheet_audit_logs" (
  id INTEGER PRIMARY KEY,
  sheet_id INTEGER NOT NULL,
  actor_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  action TEXT NOT NULL,
  from_value TEXT,
  to_value TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);
INSERT INTO "__new_evaluation_sheet_audit_logs"
  (id, sheet_id, actor_id, action, from_value, to_value, note, created_at)
SELECT id, sheet_id, CAST(actor_id AS TEXT), action, from_value, to_value, note, created_at
FROM evaluation_sheet_audit_logs;
INSERT INTO _remaining_product_employee_id_cutover_validation
SELECT 'evaluation_sheet_audit_logs.rows', count(*),
       (SELECT count(*) FROM "__new_evaluation_sheet_audit_logs"), 0, 0
FROM evaluation_sheet_audit_logs;
INSERT INTO _remaining_product_employee_id_cutover_validation
SELECT 'evaluation_sheet_audit_logs.actor_id', count(actor_id),
       (SELECT count(actor_id) FROM "__new_evaluation_sheet_audit_logs"),
       (SELECT count(*) FROM "__new_evaluation_sheet_audit_logs" WHERE typeof(actor_id) != 'text'),
       (SELECT count(*) FROM "__new_evaluation_sheet_audit_logs" child
        LEFT JOIN company_employees employee ON employee.id = child.actor_id
        WHERE employee.id IS NULL)
FROM evaluation_sheet_audit_logs;
DROP TABLE evaluation_sheet_audit_logs;
ALTER TABLE "__new_evaluation_sheet_audit_logs" RENAME TO evaluation_sheet_audit_logs;
CREATE INDEX idx_evaluation_sheet_audit_logs_sheet ON evaluation_sheet_audit_logs (sheet_id);

CREATE TABLE "__new_business_trips" (
  id TEXT PRIMARY KEY,
  traveler_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  destination TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  purpose TEXT NOT NULL,
  estimated_cost INTEGER,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
INSERT INTO "__new_business_trips"
  (id, traveler_id, destination, start_date, end_date, purpose, estimated_cost, status, created_at)
SELECT id, CAST(traveler_id AS TEXT), destination, start_date, end_date, purpose,
       estimated_cost, status, created_at
FROM business_trips;
INSERT INTO _remaining_product_employee_id_cutover_validation
SELECT 'business_trips.rows', count(*), (SELECT count(*) FROM "__new_business_trips"), 0, 0
FROM business_trips;
INSERT INTO _remaining_product_employee_id_cutover_validation
SELECT 'business_trips.traveler_id', count(traveler_id),
       (SELECT count(traveler_id) FROM "__new_business_trips"),
       (SELECT count(*) FROM "__new_business_trips" WHERE typeof(traveler_id) != 'text'),
       (SELECT count(*) FROM "__new_business_trips" child
        LEFT JOIN company_employees employee ON employee.id = child.traveler_id
        WHERE employee.id IS NULL)
FROM business_trips;
DROP TABLE business_trips;
ALTER TABLE "__new_business_trips" RENAME TO business_trips;
CREATE INDEX idx_business_trips_traveler ON business_trips (traveler_id);

CREATE TABLE "__new_expense_approvals" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_id INTEGER NOT NULL,
  approver_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  action TEXT NOT NULL,
  comment TEXT,
  created_at TEXT NOT NULL
);
INSERT INTO "__new_expense_approvals"
  (id, expense_id, approver_id, action, comment, created_at)
SELECT id, expense_id, CAST(approver_id AS TEXT), action, comment, created_at
FROM expense_approvals;
INSERT INTO _remaining_product_employee_id_cutover_validation
SELECT 'expense_approvals.rows', count(*), (SELECT count(*) FROM "__new_expense_approvals"), 0, 0
FROM expense_approvals;
INSERT INTO _remaining_product_employee_id_cutover_validation
SELECT 'expense_approvals.approver_id', count(approver_id),
       (SELECT count(approver_id) FROM "__new_expense_approvals"),
       (SELECT count(*) FROM "__new_expense_approvals" WHERE typeof(approver_id) != 'text'),
       (SELECT count(*) FROM "__new_expense_approvals" child
        LEFT JOIN company_employees employee ON employee.id = child.approver_id
        WHERE employee.id IS NULL)
FROM expense_approvals;
DROP TABLE expense_approvals;
ALTER TABLE "__new_expense_approvals" RENAME TO expense_approvals;
CREATE INDEX idx_expense_approvals_expense ON expense_approvals (expense_id);

CREATE TABLE "__new_career_applications" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  posting_id INTEGER NOT NULL,
  applicant_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  message TEXT,
  status TEXT NOT NULL
);
INSERT INTO "__new_career_applications" (id, posting_id, applicant_id, message, status)
SELECT id, posting_id, CAST(applicant_id AS TEXT), message, status
FROM career_applications;
INSERT INTO _remaining_product_employee_id_cutover_validation
SELECT 'career_applications.rows', count(*), (SELECT count(*) FROM "__new_career_applications"), 0, 0
FROM career_applications;
INSERT INTO _remaining_product_employee_id_cutover_validation
SELECT 'career_applications.applicant_id', count(applicant_id),
       (SELECT count(applicant_id) FROM "__new_career_applications"),
       (SELECT count(*) FROM "__new_career_applications" WHERE typeof(applicant_id) != 'text'),
       (SELECT count(*) FROM "__new_career_applications" child
        LEFT JOIN company_employees employee ON employee.id = child.applicant_id
        WHERE employee.id IS NULL)
FROM career_applications;
DROP TABLE career_applications;
ALTER TABLE "__new_career_applications" RENAME TO career_applications;
CREATE INDEX idx_career_applications_applicant ON career_applications (applicant_id);
CREATE INDEX idx_career_applications_posting ON career_applications (posting_id);
CREATE UNIQUE INDEX idx_career_applications_posting_applicant
  ON career_applications (posting_id, applicant_id);

DROP TABLE _remaining_product_employee_id_cutover_validation;

PRAGMA foreign_keys = ON;
PRAGMA foreign_key_check;
