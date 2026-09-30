-- System の手続きと権限の table を UUID の主キーへ揃える (Issue )。
--
-- 対象: 手続きの定義と版、提案の系列と提案、案件、提案と案件の対応、判断の課題と候補と除外、委任と
-- 委任の手続き範囲、実行の許可、本人の確認、IAM の role と role の権限、role の割当。
--
-- 形を変える table:
-- - 業務コードを主キーにする手続きの定義と、複合の主キーの table（手続きの版、判断の課題・候補・除外、
--   role の権限）は、新しい UUID の id を主キーにし、旧来の主キーは一意な属性として残す。外部キーは
--   一意な属性をそのまま指す
-- - 提案と案件の対応、委任の手続き範囲は、親（提案、委任）の主キーをそのまま主キーにしており、同じ値に
--   UUID の CHECK を課す
-- - 案件・提案・提案の系列・委任・実行の許可・本人の確認は値を変えずに UUID の CHECK を課す。UUID でない
--   主キーが残っていれば作り直した table の CHECK で migration が止まる
-- - role と role の割当は、UUID でない主キーを新しい UUID に置き換えて旧来の値を legacy_id に残し、
--   role の権限・role の割当・招待・初期化の記録の参照を新しい値へ移す
--
-- 退避と削除は参照元から、作り直しは参照先から行う。外部キーは D1 の migration の transaction の終わりに検査する。
--
-- ALTER TABLE RENAME は trigger を含む全 schema を解析し直し、table ごとに数十 ms かかる。
-- 名前を変えずに行を退避し、同じ名前で作り直してから戻す。

PRAGMA defer_foreign_keys = true;

CREATE TABLE _system_workflow_uuid_primary_key_validation (
  resource TEXT PRIMARY KEY NOT NULL,
  source_count INTEGER NOT NULL,
  target_count INTEGER NOT NULL,
  orphan_count INTEGER NOT NULL,
  non_uuid_count INTEGER NOT NULL,
  blocked_count INTEGER NOT NULL,
  CHECK (source_count = target_count AND orphan_count = 0 AND non_uuid_count = 0 AND blocked_count = 0)
);

-- system_iam_roles
CREATE TABLE _system_iam_roles_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _system_iam_roles_id_map (old_id, new_id)
SELECT id, CASE WHEN length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]' THEN id ELSE lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) END
FROM system_iam_roles;

-- system_role_bindings
CREATE TABLE _system_role_bindings_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _system_role_bindings_id_map (old_id, new_id)
SELECT id, CASE WHEN length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]' THEN id ELSE lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) END
FROM system_role_bindings;

-- 外部キーの無い参照が移行前から指す先を持たない行の数。移行で増えないことを最後に確かめる。
CREATE TABLE _uuid_reference_orphans (
  resource TEXT PRIMARY KEY NOT NULL,
  orphan_count INTEGER NOT NULL
);
INSERT INTO _uuid_reference_orphans VALUES ('system_iam_role_permissions.role_id', (SELECT count(*) FROM system_iam_role_permissions child WHERE child.role_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM system_iam_roles parent WHERE parent.id = child.role_id)));
INSERT INTO _uuid_reference_orphans VALUES ('system_role_bindings.role_id', (SELECT count(*) FROM system_role_bindings child WHERE child.role_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM system_iam_roles parent WHERE parent.id = child.role_id)));
INSERT INTO _uuid_reference_orphans VALUES ('system_account_invitations.role_id', (SELECT count(*) FROM system_account_invitations child WHERE child.role_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM system_iam_roles parent WHERE parent.id = child.role_id)));
INSERT INTO _uuid_reference_orphans VALUES ('system_bootstrap_state.root_binding_id', (SELECT count(*) FROM system_bootstrap_state child WHERE child.root_binding_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM system_role_bindings parent WHERE parent.id = child.root_binding_id)));

-- 参照元から順に行を退避して table を削除する。
CREATE TABLE "_stage_system_bootstrap_state" AS SELECT * FROM system_bootstrap_state;
DROP TABLE system_bootstrap_state;
CREATE TABLE "_stage_system_account_invitations" AS SELECT * FROM system_account_invitations;
DROP TABLE system_account_invitations;
CREATE TABLE "_stage_system_role_bindings" AS SELECT * FROM system_role_bindings;
DROP TABLE system_role_bindings;
CREATE TABLE "_stage_system_iam_role_permissions" AS SELECT * FROM system_iam_role_permissions;
DROP TABLE system_iam_role_permissions;
CREATE TABLE "_stage_system_iam_roles" AS SELECT * FROM system_iam_roles;
DROP TABLE system_iam_roles;
CREATE TABLE "_stage_system_human_attestations" AS SELECT * FROM system_human_attestations;
DROP TABLE system_human_attestations;
CREATE TABLE "_stage_system_execution_authorizations" AS SELECT * FROM system_execution_authorizations;
DROP TABLE system_execution_authorizations;
CREATE TABLE "_stage_system_delegation_procedure_scopes" AS SELECT * FROM system_delegation_procedure_scopes;
DROP TABLE system_delegation_procedure_scopes;
CREATE TABLE "_stage_system_delegations" AS SELECT * FROM system_delegations;
DROP TABLE system_delegations;
CREATE TABLE "_stage_system_decision_task_exclusions" AS SELECT * FROM system_decision_task_exclusions;
DROP TABLE system_decision_task_exclusions;
CREATE TABLE "_stage_system_decision_task_candidates" AS SELECT * FROM system_decision_task_candidates;
DROP TABLE system_decision_task_candidates;
CREATE TABLE "_stage_system_decision_tasks" AS SELECT * FROM system_decision_tasks;
DROP TABLE system_decision_tasks;
CREATE TABLE "_stage_system_proposal_cases" AS SELECT * FROM system_proposal_cases;
DROP TABLE system_proposal_cases;
CREATE TABLE "_stage_system_cases" AS SELECT * FROM system_cases;
DROP TABLE system_cases;
CREATE TABLE "_stage_system_proposals" AS SELECT * FROM system_proposals;
DROP TABLE system_proposals;
CREATE TABLE "_stage_system_proposal_series" AS SELECT * FROM system_proposal_series;
DROP TABLE system_proposal_series;
CREATE TABLE "_stage_system_procedure_definition_revisions" AS SELECT * FROM system_procedure_definition_revisions;
DROP TABLE system_procedure_definition_revisions;
CREATE TABLE "_stage_system_procedure_definitions" AS SELECT * FROM system_procedure_definitions;
DROP TABLE system_procedure_definitions;

-- system_procedure_definitions
CREATE TABLE system_procedure_definitions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  key TEXT NOT NULL UNIQUE
    CHECK (
      length(key) BETWEEN 1 AND 100
      AND key NOT GLOB '*[^a-z0-9_-]*'
      AND substr(key, 1, 1) GLOB '[a-z]'
    ),
  current_revision INTEGER NOT NULL CHECK (current_revision > 0),
  status TEXT NOT NULL CHECK (status IN ('active', 'retired')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_procedure_definitions (id, key, current_revision, status, created_at, updated_at)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.key,
       source.current_revision,
       source.status,
       source.created_at,
       source.updated_at
FROM "_stage_system_procedure_definitions" source;
INSERT INTO _system_workflow_uuid_primary_key_validation
SELECT 'system_procedure_definitions',
       (SELECT count(*) FROM "_stage_system_procedure_definitions"),
       (SELECT count(*) FROM system_procedure_definitions),
       0,
       (SELECT count(*) FROM system_procedure_definitions WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_procedure_definitions";
CREATE INDEX system_procedure_definitions_status_idx
  ON system_procedure_definitions (status, updated_at);
CREATE TRIGGER system_procedure_definitions_monotonic_lifecycle
BEFORE UPDATE ON system_procedure_definitions
WHEN
  NEW.key IS NOT OLD.key
  OR NEW.created_at IS NOT OLD.created_at
  OR NEW.updated_at < OLD.updated_at
  OR NEW.current_revision NOT IN (OLD.current_revision, OLD.current_revision + 1)
  OR (OLD.status = 'retired' AND NEW.status IS NOT OLD.status)
  OR (
    NEW.current_revision IS OLD.current_revision
    AND NEW.status IS OLD.status
    AND NEW.updated_at IS NOT OLD.updated_at
  )
  OR (
    NEW.current_revision = OLD.current_revision + 1
    AND NOT EXISTS (
      SELECT 1 FROM system_procedure_definition_revisions
      WHERE procedure_key = OLD.key AND revision = NEW.current_revision
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'system procedure lifecycle is not monotonic');
END;
CREATE TRIGGER system_procedure_definitions_prevent_delete
BEFORE DELETE ON system_procedure_definitions
BEGIN
  SELECT RAISE(ABORT, 'system procedure is immutable');
END;
CREATE TRIGGER system_procedure_definitions_identity_update
BEFORE UPDATE OF id ON system_procedure_definitions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- system_procedure_definition_revisions
CREATE TABLE system_procedure_definition_revisions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  procedure_key TEXT NOT NULL
    REFERENCES system_procedure_definitions(key) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision > 0),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 500),
  category TEXT NOT NULL CHECK (length(category) BETWEEN 1 AND 200),
  description TEXT CHECK (description IS NULL OR length(description) <= 3000),
  input_schema_json TEXT NOT NULL
    CHECK (json_valid(input_schema_json) AND length(input_schema_json) BETWEEN 1 AND 1000000),
  decision_policy_json TEXT NOT NULL
    CHECK (json_valid(decision_policy_json) AND length(decision_policy_json) BETWEEN 1 AND 1000000),
  completion_operation_key TEXT
    CHECK (completion_operation_key IS NULL OR length(completion_operation_key) BETWEEN 1 AND 100),
  created_by_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  UNIQUE (procedure_key, revision),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_procedure_definition_revisions (id, procedure_key, revision, title, category, description, input_schema_json, decision_policy_json, completion_operation_key, created_by_account_id, created_at)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.procedure_key,
       source.revision,
       source.title,
       source.category,
       source.description,
       source.input_schema_json,
       source.decision_policy_json,
       source.completion_operation_key,
       source.created_by_account_id,
       source.created_at
FROM "_stage_system_procedure_definition_revisions" source;
INSERT INTO _system_workflow_uuid_primary_key_validation
SELECT 'system_procedure_definition_revisions',
       (SELECT count(*) FROM "_stage_system_procedure_definition_revisions"),
       (SELECT count(*) FROM system_procedure_definition_revisions),
       0,
       (SELECT count(*) FROM system_procedure_definition_revisions WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_procedure_definition_revisions";
CREATE INDEX system_procedure_definition_revisions_creator_idx
  ON system_procedure_definition_revisions (created_by_account_id, created_at);
CREATE TRIGGER system_procedure_definition_revisions_valid_insert
BEFORE INSERT ON system_procedure_definition_revisions
WHEN NOT EXISTS (
  SELECT 1 FROM system_procedure_definitions
  WHERE key = NEW.procedure_key
    AND NEW.revision IN (current_revision, current_revision + 1)
)
BEGIN
  SELECT RAISE(ABORT, 'invalid system procedure revision');
END;
CREATE TRIGGER system_procedure_definition_revisions_prevent_update
BEFORE UPDATE ON system_procedure_definition_revisions
BEGIN
  SELECT RAISE(ABORT, 'system procedure revision is immutable');
END;
CREATE TRIGGER system_procedure_definition_revisions_prevent_delete
BEFORE DELETE ON system_procedure_definition_revisions
BEGIN
  SELECT RAISE(ABORT, 'system procedure revision is immutable');
END;
CREATE TRIGGER system_procedure_definition_revisions_identity_update
BEFORE UPDATE OF id ON system_procedure_definition_revisions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- system_proposal_series
CREATE TABLE system_proposal_series (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 255),
  procedure_key TEXT NOT NULL
    REFERENCES system_procedure_definitions(key) ON DELETE RESTRICT,
  created_by_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_proposal_series (id, procedure_key, created_by_account_id, created_at)
SELECT source.id,
       source.procedure_key,
       source.created_by_account_id,
       source.created_at
FROM "_stage_system_proposal_series" source;
INSERT INTO _system_workflow_uuid_primary_key_validation
SELECT 'system_proposal_series',
       (SELECT count(*) FROM "_stage_system_proposal_series"),
       (SELECT count(*) FROM system_proposal_series),
       0,
       (SELECT count(*) FROM system_proposal_series WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_proposal_series";
CREATE INDEX system_proposal_series_definition_idx
  ON system_proposal_series (procedure_key, created_at);
CREATE INDEX system_proposal_series_creator_idx
  ON system_proposal_series (created_by_account_id, created_at);
CREATE TRIGGER system_proposal_series_prevent_update
BEFORE UPDATE ON system_proposal_series
BEGIN
  SELECT RAISE(ABORT, 'system proposal series is immutable');
END;
CREATE TRIGGER system_proposal_series_prevent_delete
BEFORE DELETE ON system_proposal_series
BEGIN
  SELECT RAISE(ABORT, 'system proposal series is immutable');
END;

-- system_proposals
CREATE TABLE system_proposals (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 255),
  series_id TEXT NOT NULL
    REFERENCES system_proposal_series(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version > 0),
  procedure_key TEXT NOT NULL,
  procedure_revision INTEGER NOT NULL,
  body_json TEXT NOT NULL
    CHECK (json_valid(body_json) AND length(body_json) BETWEEN 1 AND 1000000),
  digest TEXT NOT NULL
    CHECK (length(digest) = 64 AND digest NOT GLOB '*[^0-9a-f]*'),
  created_by_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  supersedes_proposal_id TEXT
    REFERENCES system_proposals(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  CHECK (
    (version = 1 AND supersedes_proposal_id IS NULL)
    OR (version > 1 AND supersedes_proposal_id IS NOT NULL)
  ),
  FOREIGN KEY (procedure_key, procedure_revision)
    REFERENCES system_procedure_definition_revisions(procedure_key, revision) ON DELETE RESTRICT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_proposals (id, series_id, version, procedure_key, procedure_revision, body_json, digest, created_by_account_id, supersedes_proposal_id, created_at)
SELECT source.id,
       source.series_id,
       source.version,
       source.procedure_key,
       source.procedure_revision,
       source.body_json,
       source.digest,
       source.created_by_account_id,
       source.supersedes_proposal_id,
       source.created_at
FROM "_stage_system_proposals" source;
INSERT INTO _system_workflow_uuid_primary_key_validation
SELECT 'system_proposals',
       (SELECT count(*) FROM "_stage_system_proposals"),
       (SELECT count(*) FROM system_proposals),
       0,
       (SELECT count(*) FROM system_proposals WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_proposals";
CREATE UNIQUE INDEX system_proposals_series_version_uniq
  ON system_proposals (series_id, version);
CREATE INDEX system_proposals_definition_idx
  ON system_proposals (procedure_key, procedure_revision);
CREATE INDEX system_proposals_creator_idx
  ON system_proposals (created_by_account_id, created_at);
CREATE TRIGGER system_proposals_valid_insert
BEFORE INSERT ON system_proposals
WHEN
  NOT EXISTS (
    SELECT 1 FROM system_procedure_definitions
    WHERE key = NEW.procedure_key
      AND status = 'active'
      AND current_revision = NEW.procedure_revision
  )
  OR NOT EXISTS (
    SELECT 1 FROM system_proposal_series AS series
    WHERE series.id = NEW.series_id
      AND series.procedure_key = NEW.procedure_key
      AND series.created_by_account_id = NEW.created_by_account_id
      AND series.created_at <= NEW.created_at
  )
  OR (
    NEW.version > 1
    AND NOT EXISTS (
      SELECT 1 FROM system_proposals AS previous
      WHERE previous.id = NEW.supersedes_proposal_id
        AND previous.series_id = NEW.series_id
        AND previous.version = NEW.version - 1
        AND previous.procedure_key = NEW.procedure_key
        AND previous.created_by_account_id = NEW.created_by_account_id
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid system proposal');
END;
CREATE TRIGGER system_proposals_prevent_update
BEFORE UPDATE ON system_proposals
BEGIN
  SELECT RAISE(ABORT, 'system proposal is immutable');
END;
CREATE TRIGGER system_proposals_prevent_delete
BEFORE DELETE ON system_proposals
BEGIN
  SELECT RAISE(ABORT, 'system proposal is immutable');
END;

-- system_cases
CREATE TABLE system_cases (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) BETWEEN 1 AND 255),
  subject_context TEXT NOT NULL
    CHECK (length(subject_context) BETWEEN 1 AND 100),
  subject_kind TEXT NOT NULL
    CHECK (length(subject_kind) BETWEEN 1 AND 100),
  subject_id TEXT NOT NULL
    CHECK (length(subject_id) BETWEEN 1 AND 512),
  subject_version TEXT NOT NULL
    CHECK (length(subject_version) BETWEEN 1 AND 255),
  proposal_digest TEXT NOT NULL
    CHECK (
      length(proposal_digest) = 64
      AND proposal_digest NOT GLOB '*[^0-9a-f]*'
    ),
  created_by_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  status TEXT NOT NULL
    CHECK (status IN ('pending', 'approved', 'rejected', 'returned', 'cancelled', 'executed')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
    CHECK (updated_at >= created_at),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_cases (id, subject_context, subject_kind, subject_id, subject_version, proposal_digest, created_by_account_id, status, created_at, updated_at)
SELECT source.id,
       source.subject_context,
       source.subject_kind,
       source.subject_id,
       source.subject_version,
       source.proposal_digest,
       source.created_by_account_id,
       source.status,
       source.created_at,
       source.updated_at
FROM "_stage_system_cases" source;
INSERT INTO _system_workflow_uuid_primary_key_validation
SELECT 'system_cases',
       (SELECT count(*) FROM "_stage_system_cases"),
       (SELECT count(*) FROM system_cases),
       0,
       (SELECT count(*) FROM system_cases WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_cases";
CREATE INDEX system_cases_subject_idx
  ON system_cases (subject_context, subject_kind, subject_id, subject_version);
CREATE INDEX system_cases_creator_idx
  ON system_cases (created_by_account_id, created_at);
CREATE INDEX system_cases_status_idx
  ON system_cases (status, updated_at);
CREATE TRIGGER system_cases_monotonic_lifecycle
BEFORE UPDATE ON system_cases
WHEN
  NEW.id IS NOT OLD.id
  OR NEW.subject_context IS NOT OLD.subject_context
  OR NEW.subject_kind IS NOT OLD.subject_kind
  OR NEW.subject_id IS NOT OLD.subject_id
  OR NEW.subject_version IS NOT OLD.subject_version
  OR NEW.proposal_digest IS NOT OLD.proposal_digest
  OR NEW.created_by_account_id IS NOT OLD.created_by_account_id
  OR NEW.created_at IS NOT OLD.created_at
  OR NEW.updated_at < OLD.updated_at
  OR (NEW.status IS OLD.status AND NEW.updated_at IS NOT OLD.updated_at)
  OR (
    NEW.status IS NOT OLD.status
    AND NOT (
      (OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected', 'returned', 'cancelled'))
      OR (OLD.status = 'approved' AND NEW.status = 'executed')
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'system case lifecycle is not monotonic');
END;
CREATE TRIGGER system_cases_approved_tasks
BEFORE UPDATE OF status ON system_cases
WHEN NEW.status = 'approved' AND (
  NOT EXISTS (
    SELECT 1 FROM system_decision_tasks
    WHERE case_id = NEW.id
  )
  OR EXISTS (
    SELECT 1 FROM system_decision_tasks
    WHERE case_id = NEW.id AND outcome IS NOT 'approved'
  )
)
BEGIN
  SELECT RAISE(ABORT, 'system case approval requires approved tasks');
END;
CREATE TRIGGER system_cases_negative_decision_evidence
BEFORE UPDATE OF status ON system_cases
WHEN NEW.status IN ('rejected', 'returned') AND (
  NOT EXISTS (
    SELECT 1 FROM system_decision_tasks
    WHERE case_id = NEW.id AND outcome = NEW.status
  )
  OR EXISTS (
    SELECT 1 FROM system_decision_tasks
    WHERE case_id = NEW.id AND outcome IS NULL
  )
  OR (
    NEW.status = 'returned'
    AND EXISTS (
      SELECT 1 FROM system_decision_tasks
      WHERE case_id = NEW.id AND outcome = 'rejected'
    )
  )
)
BEGIN
  SELECT RAISE(ABORT, 'system case decision requires matching task evidence');
END;
CREATE TRIGGER system_cases_cancelled_tasks
BEFORE UPDATE OF status ON system_cases
WHEN NEW.status = 'cancelled' AND EXISTS (
  SELECT 1 FROM system_decision_tasks
  WHERE case_id = NEW.id AND outcome IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'system case cancellation requires closed tasks');
END;
CREATE TRIGGER system_cases_execution_evidence
BEFORE UPDATE OF status ON system_cases
WHEN NEW.status = 'executed' AND (
  NOT EXISTS (
    SELECT 1 FROM system_execution_authorizations
    WHERE case_id = NEW.id
  )
  OR EXISTS (
    SELECT 1 FROM system_execution_authorizations
    WHERE case_id = NEW.id AND used_at IS NULL
  )
)
BEGIN
  SELECT RAISE(ABORT, 'system case execution requires consumed authorizations');
END;
CREATE TRIGGER system_cases_prevent_delete
BEFORE DELETE ON system_cases
BEGIN
  SELECT RAISE(ABORT, 'system case is immutable');
END;

-- system_proposal_cases
CREATE TABLE system_proposal_cases (
  proposal_id TEXT PRIMARY KEY NOT NULL
    REFERENCES system_proposals(id) ON DELETE RESTRICT,
  case_id TEXT NOT NULL
    REFERENCES system_cases(id) ON DELETE RESTRICT,
  linked_at INTEGER NOT NULL,
  CHECK (length(proposal_id) = 36 AND proposal_id NOT GLOB '*[^0-9a-f-]*' AND substr(proposal_id, 9, 1) = '-' AND substr(proposal_id, 14, 1) = '-' AND substr(proposal_id, 19, 1) = '-' AND substr(proposal_id, 24, 1) = '-' AND length(replace(proposal_id, '-', '')) = 32 AND substr(proposal_id, 15, 1) GLOB '[1-8]' AND substr(proposal_id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_proposal_cases (proposal_id, case_id, linked_at)
SELECT source.proposal_id,
       source.case_id,
       source.linked_at
FROM "_stage_system_proposal_cases" source;
INSERT INTO _system_workflow_uuid_primary_key_validation
SELECT 'system_proposal_cases',
       (SELECT count(*) FROM "_stage_system_proposal_cases"),
       (SELECT count(*) FROM system_proposal_cases),
       0,
       (SELECT count(*) FROM system_proposal_cases WHERE NOT (length(proposal_id) = 36 AND proposal_id NOT GLOB '*[^0-9a-f-]*' AND substr(proposal_id, 9, 1) = '-' AND substr(proposal_id, 14, 1) = '-' AND substr(proposal_id, 19, 1) = '-' AND substr(proposal_id, 24, 1) = '-' AND length(replace(proposal_id, '-', '')) = 32 AND substr(proposal_id, 15, 1) GLOB '[1-8]' AND substr(proposal_id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_proposal_cases";
CREATE UNIQUE INDEX system_proposal_cases_case_uniq
  ON system_proposal_cases (case_id);
CREATE TRIGGER system_proposal_cases_prevent_update
BEFORE UPDATE ON system_proposal_cases
BEGIN
  SELECT RAISE(ABORT, 'system proposal case is immutable');
END;
CREATE TRIGGER system_proposal_cases_prevent_delete
BEFORE DELETE ON system_proposal_cases
BEGIN
  SELECT RAISE(ABORT, 'system proposal case is immutable');
END;
CREATE TRIGGER system_proposal_cases_valid_insert
BEFORE INSERT ON system_proposal_cases
WHEN NOT EXISTS (
  SELECT 1
  FROM system_proposals AS proposal
  JOIN system_cases AS workflow_case ON workflow_case.id = NEW.case_id
  WHERE proposal.id = NEW.proposal_id
    AND (
      workflow_case.subject_context <> 'system'
      OR (
        workflow_case.subject_kind = 'proposal'
        AND workflow_case.subject_id = proposal.series_id
        AND workflow_case.subject_version = CAST(proposal.version AS TEXT)
      )
      OR (
        workflow_case.subject_context = 'system'
        AND workflow_case.subject_kind = 'record-preservation'
        AND workflow_case.subject_version = '1'
        AND json_extract(proposal.body_json, '$.operation') IS 'system.record.preserve'
        AND json_extract(proposal.body_json, '$.version') IS 1
        AND json_extract(proposal.body_json, '$.recordId') IS workflow_case.subject_id
      )
    )
    AND workflow_case.proposal_digest = proposal.digest
    AND workflow_case.created_by_account_id = proposal.created_by_account_id
    AND workflow_case.created_at = NEW.linked_at
)
BEGIN
  SELECT RAISE(ABORT, 'system proposal case does not match');
END;

-- system_decision_tasks
CREATE TABLE system_decision_tasks (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  case_id TEXT NOT NULL
    REFERENCES system_cases(id) ON DELETE RESTRICT,
  task_key TEXT NOT NULL
    CHECK (length(task_key) BETWEEN 1 AND 100),
  round INTEGER NOT NULL
    CHECK (round > 0),
  required_approvals INTEGER NOT NULL
    CHECK (required_approvals BETWEEN 1 AND 100),
  proposal_digest TEXT NOT NULL
    CHECK (
      length(proposal_digest) = 64
      AND proposal_digest NOT GLOB '*[^0-9a-f]*'
    ),
  opened_at INTEGER NOT NULL,
  due_at INTEGER
    CHECK (due_at IS NULL OR due_at >= opened_at),
  outcome TEXT
    CHECK (outcome IS NULL OR outcome IN ('approved', 'rejected', 'returned', 'cancelled')),
  closed_at INTEGER
    CHECK (closed_at IS NULL OR closed_at >= opened_at), required_participants INTEGER NOT NULL DEFAULT 1
  CHECK (required_participants BETWEEN 1 AND 100), negative_decision_rule TEXT NOT NULL DEFAULT 'any-reject'
  CHECK (negative_decision_rule IN ('any-reject', 'approval-impossible')), delegation_policy TEXT NOT NULL DEFAULT 'allowed'
  CHECK (delegation_policy IN ('allowed', 'forbidden')), return_policy TEXT NOT NULL DEFAULT 'allowed'
  CHECK (return_policy IN ('allowed', 'forbidden')),
  CHECK (
    (outcome IS NULL AND closed_at IS NULL)
    OR (outcome IS NOT NULL AND closed_at IS NOT NULL)
  ),
  UNIQUE (case_id, task_key, round),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_decision_tasks (id, case_id, task_key, round, required_approvals, proposal_digest, opened_at, due_at, outcome, closed_at, required_participants, negative_decision_rule, delegation_policy, return_policy)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.case_id,
       source.task_key,
       source.round,
       source.required_approvals,
       source.proposal_digest,
       source.opened_at,
       source.due_at,
       source.outcome,
       source.closed_at,
       source.required_participants,
       source.negative_decision_rule,
       source.delegation_policy,
       source.return_policy
FROM "_stage_system_decision_tasks" source;
INSERT INTO _system_workflow_uuid_primary_key_validation
SELECT 'system_decision_tasks',
       (SELECT count(*) FROM "_stage_system_decision_tasks"),
       (SELECT count(*) FROM system_decision_tasks),
       0,
       (SELECT count(*) FROM system_decision_tasks WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_decision_tasks";
CREATE INDEX system_decision_tasks_open_idx
  ON system_decision_tasks (due_at, opened_at)
  WHERE closed_at IS NULL;
CREATE TRIGGER system_decision_tasks_valid_insert
BEFORE INSERT ON system_decision_tasks
WHEN
  NOT EXISTS (
    SELECT 1 FROM system_cases
    WHERE
      id = NEW.case_id
      AND status = 'pending'
      AND proposal_digest = NEW.proposal_digest
  )
  OR EXISTS (
    SELECT 1 FROM system_decision_tasks
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND outcome IS NULL
  )
  OR (
    NEW.round > 1
    AND NOT EXISTS (
      SELECT 1 FROM system_decision_tasks
      WHERE
        case_id = NEW.case_id
        AND task_key = NEW.task_key
        AND round = NEW.round - 1
        AND outcome = 'cancelled'
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'decision task requires matching pending case');
END;
CREATE TRIGGER system_decision_tasks_prevent_delete
BEFORE DELETE ON system_decision_tasks
BEGIN
  SELECT RAISE(ABORT, 'decision task is immutable');
END;
CREATE TRIGGER system_decision_tasks_monotonic_lifecycle
BEFORE UPDATE ON system_decision_tasks
WHEN
  NEW.case_id IS NOT OLD.case_id
  OR NEW.task_key IS NOT OLD.task_key
  OR NEW.round IS NOT OLD.round
  OR NEW.required_approvals IS NOT OLD.required_approvals
  OR NEW.required_participants IS NOT OLD.required_participants
  OR NEW.negative_decision_rule IS NOT OLD.negative_decision_rule
  OR NEW.delegation_policy IS NOT OLD.delegation_policy
  OR NEW.return_policy IS NOT OLD.return_policy
  OR NEW.proposal_digest IS NOT OLD.proposal_digest
  OR NEW.opened_at IS NOT OLD.opened_at
  OR NEW.due_at IS NOT OLD.due_at
  OR OLD.outcome IS NOT NULL
  OR OLD.closed_at IS NOT NULL
  OR NEW.outcome IS NULL
  OR NEW.closed_at IS NULL
BEGIN
  SELECT RAISE(ABORT, 'decision task lifecycle is not monotonic');
END;
CREATE TRIGGER system_decision_tasks_approved_quorum
BEFORE UPDATE OF outcome ON system_decision_tasks
WHEN NEW.outcome = 'approved' AND (
  EXISTS (
    SELECT 1 FROM system_human_attestations
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND round = NEW.round
      AND action = 'return'
  )
  OR (
    NEW.negative_decision_rule = 'any-reject'
    AND EXISTS (
      SELECT 1 FROM system_human_attestations
      WHERE
        case_id = NEW.case_id
        AND task_key = NEW.task_key
        AND round = NEW.round
        AND action = 'reject'
    )
  )
  OR (
    SELECT count(*) FROM system_human_attestations
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND round = NEW.round
      AND action = 'approve'
  ) < NEW.required_approvals
  OR (
    SELECT count(*) FROM system_human_attestations
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND round = NEW.round
  ) < NEW.required_participants
)
BEGIN
  SELECT RAISE(ABORT, 'decision task approval requires quorum');
END;
CREATE TRIGGER system_decision_tasks_negative_evidence
BEFORE UPDATE OF outcome ON system_decision_tasks
WHEN NEW.outcome IN ('rejected', 'returned') AND (
  (
    NEW.outcome = 'returned'
    AND NOT EXISTS (
      SELECT 1 FROM system_human_attestations
      WHERE
        case_id = NEW.case_id
        AND task_key = NEW.task_key
        AND round = NEW.round
        AND action = 'return'
    )
  )
  OR (
    NEW.outcome = 'rejected'
    AND (
      (
        NEW.negative_decision_rule = 'any-reject'
        AND NOT EXISTS (
          SELECT 1 FROM system_human_attestations
          WHERE
            case_id = NEW.case_id
            AND task_key = NEW.task_key
            AND round = NEW.round
            AND action = 'reject'
        )
      )
      OR (
        NEW.negative_decision_rule = 'approval-impossible'
        AND (
          SELECT count(*) FROM system_human_attestations
          WHERE
            case_id = NEW.case_id
            AND task_key = NEW.task_key
            AND round = NEW.round
            AND action = 'reject'
        ) <= (
          SELECT count(*) FROM system_decision_task_candidates
          WHERE
            case_id = NEW.case_id
            AND task_key = NEW.task_key
            AND round = NEW.round
        ) - NEW.required_approvals
      )
    )
  )
)
BEGIN
  SELECT RAISE(ABORT, 'decision task outcome requires matching attestation');
END;
CREATE TRIGGER system_decision_tasks_identity_update
BEFORE UPDATE OF id ON system_decision_tasks
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- system_decision_task_candidates
CREATE TABLE system_decision_task_candidates (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  case_id TEXT NOT NULL,
  task_key TEXT NOT NULL,
  round INTEGER NOT NULL,
  candidate_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  source TEXT NOT NULL
    CHECK (source IN ('primary', 'escalation')),
  evidence_context TEXT NOT NULL
    CHECK (length(evidence_context) BETWEEN 1 AND 100),
  evidence_kind TEXT NOT NULL
    CHECK (length(evidence_kind) BETWEEN 1 AND 100),
  evidence_id TEXT NOT NULL
    CHECK (length(evidence_id) BETWEEN 1 AND 512),
  evidence_version TEXT NOT NULL
    CHECK (length(evidence_version) BETWEEN 1 AND 255),
  eligibility_digest TEXT NOT NULL
    CHECK (
      length(eligibility_digest) = 64
      AND eligibility_digest NOT GLOB '*[^0-9a-f]*'
    ),
  eligible_from INTEGER,
  resolved_at INTEGER NOT NULL,
  CHECK (eligible_from IS NULL OR eligible_from >= resolved_at),
  CHECK (
    (source = 'primary' AND eligible_from IS NULL)
    OR (source = 'escalation' AND eligible_from IS NOT NULL)
  ),
  UNIQUE (case_id, task_key, round, candidate_account_id, source),
  FOREIGN KEY (case_id, task_key, round)
    REFERENCES system_decision_tasks(case_id, task_key, round) ON DELETE RESTRICT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_decision_task_candidates (id, case_id, task_key, round, candidate_account_id, source, evidence_context, evidence_kind, evidence_id, evidence_version, eligibility_digest, eligible_from, resolved_at)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.case_id,
       source.task_key,
       source.round,
       source.candidate_account_id,
       source.source,
       source.evidence_context,
       source.evidence_kind,
       source.evidence_id,
       source.evidence_version,
       source.eligibility_digest,
       source.eligible_from,
       source.resolved_at
FROM "_stage_system_decision_task_candidates" source;
INSERT INTO _system_workflow_uuid_primary_key_validation
SELECT 'system_decision_task_candidates',
       (SELECT count(*) FROM "_stage_system_decision_task_candidates"),
       (SELECT count(*) FROM system_decision_task_candidates),
       0,
       (SELECT count(*) FROM system_decision_task_candidates WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_decision_task_candidates";
CREATE UNIQUE INDEX system_decision_task_candidates_account_uniq
  ON system_decision_task_candidates (case_id, task_key, round, candidate_account_id);
CREATE INDEX system_decision_task_candidates_account_idx
  ON system_decision_task_candidates (candidate_account_id, resolved_at);
CREATE TRIGGER system_decision_task_candidates_valid_insert
BEFORE INSERT ON system_decision_task_candidates
WHEN
  NOT EXISTS (
    SELECT 1 FROM system_decision_tasks
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND round = NEW.round
      AND closed_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM system_human_attestations
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND round = NEW.round
  )
  OR EXISTS (
    SELECT 1 FROM system_cases
    WHERE id = NEW.case_id AND created_by_account_id = NEW.candidate_account_id
  )
  OR EXISTS (
    SELECT 1 FROM system_decision_task_exclusions
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND round = NEW.round
      AND excluded_account_id = NEW.candidate_account_id
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid decision task candidate');
END;
CREATE TRIGGER system_decision_task_candidates_prevent_update
BEFORE UPDATE ON system_decision_task_candidates
BEGIN
  SELECT RAISE(ABORT, 'decision task candidate is immutable');
END;
CREATE TRIGGER system_decision_task_candidates_prevent_delete
BEFORE DELETE ON system_decision_task_candidates
BEGIN
  SELECT RAISE(ABORT, 'decision task candidate is immutable');
END;
CREATE TRIGGER system_decision_candidate_requires_human
BEFORE INSERT ON system_decision_task_candidates
WHEN NOT EXISTS (
  SELECT 1 FROM system_accounts account
  JOIN system_principals principal ON principal.account_id = account.id
  WHERE account.id = NEW.candidate_account_id AND account.status = 'active' AND account.closed_at IS NULL
    AND account.created_at <= NEW.resolved_at AND principal.kind = 'human' AND principal.created_at <= NEW.resolved_at
)
BEGIN
  SELECT RAISE(ABORT, 'system_decision_candidate_requires_human');
END;
CREATE TRIGGER system_decision_task_candidates_identity_update
BEFORE UPDATE OF id ON system_decision_task_candidates
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- system_decision_task_exclusions
CREATE TABLE system_decision_task_exclusions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  case_id TEXT NOT NULL,
  task_key TEXT NOT NULL,
  round INTEGER NOT NULL,
  excluded_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL
    CHECK (reason IN ('creator', 'subject', 'policy')),
  UNIQUE (case_id, task_key, round, excluded_account_id),
  FOREIGN KEY (case_id, task_key, round)
    REFERENCES system_decision_tasks(case_id, task_key, round) ON DELETE RESTRICT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_decision_task_exclusions (id, case_id, task_key, round, excluded_account_id, reason)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.case_id,
       source.task_key,
       source.round,
       source.excluded_account_id,
       source.reason
FROM "_stage_system_decision_task_exclusions" source;
INSERT INTO _system_workflow_uuid_primary_key_validation
SELECT 'system_decision_task_exclusions',
       (SELECT count(*) FROM "_stage_system_decision_task_exclusions"),
       (SELECT count(*) FROM system_decision_task_exclusions),
       0,
       (SELECT count(*) FROM system_decision_task_exclusions WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_decision_task_exclusions";
CREATE INDEX system_decision_task_exclusions_account_idx
  ON system_decision_task_exclusions (excluded_account_id);
CREATE TRIGGER system_decision_task_exclusions_valid_insert
BEFORE INSERT ON system_decision_task_exclusions
WHEN
  NOT EXISTS (
    SELECT 1 FROM system_decision_tasks
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND round = NEW.round
      AND closed_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM system_human_attestations
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND round = NEW.round
  )
  OR EXISTS (
    SELECT 1 FROM system_decision_task_candidates
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND round = NEW.round
      AND candidate_account_id = NEW.excluded_account_id
  )
  OR (
    NEW.reason = 'creator'
    AND NOT EXISTS (
      SELECT 1 FROM system_cases
      WHERE id = NEW.case_id AND created_by_account_id = NEW.excluded_account_id
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid decision task exclusion');
END;
CREATE TRIGGER system_decision_task_exclusions_prevent_update
BEFORE UPDATE ON system_decision_task_exclusions
BEGIN
  SELECT RAISE(ABORT, 'decision task exclusion is immutable');
END;
CREATE TRIGGER system_decision_task_exclusions_prevent_delete
BEFORE DELETE ON system_decision_task_exclusions
BEGIN
  SELECT RAISE(ABORT, 'decision task exclusion is immutable');
END;
CREATE TRIGGER system_decision_task_exclusions_identity_update
BEFORE UPDATE OF id ON system_decision_task_exclusions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- system_delegations
CREATE TABLE system_delegations (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) BETWEEN 1 AND 255),
  delegator_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  delegate_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  scope_context TEXT,
  scope_kind TEXT,
  scope_id TEXT,
  scope_version TEXT,
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER,
  CHECK (delegator_account_id <> delegate_account_id),
  CHECK (
    (
      scope_context IS NULL
      AND scope_kind IS NULL
      AND scope_id IS NULL
      AND scope_version IS NULL
    )
    OR (
      length(scope_context) BETWEEN 1 AND 100
      AND length(scope_kind) BETWEEN 1 AND 100
      AND length(scope_id) BETWEEN 1 AND 512
      AND length(scope_version) BETWEEN 1 AND 255
    )
  ),
  CHECK (
    ends_at > starts_at
    AND created_at <= starts_at
    AND (
      revoked_at IS NULL
      OR (revoked_at >= created_at AND revoked_at <= ends_at)
    )
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_delegations (id, delegator_account_id, delegate_account_id, scope_context, scope_kind, scope_id, scope_version, starts_at, ends_at, created_at, revoked_at)
SELECT source.id,
       source.delegator_account_id,
       source.delegate_account_id,
       source.scope_context,
       source.scope_kind,
       source.scope_id,
       source.scope_version,
       source.starts_at,
       source.ends_at,
       source.created_at,
       source.revoked_at
FROM "_stage_system_delegations" source;
INSERT INTO _system_workflow_uuid_primary_key_validation
SELECT 'system_delegations',
       (SELECT count(*) FROM "_stage_system_delegations"),
       (SELECT count(*) FROM system_delegations),
       0,
       (SELECT count(*) FROM system_delegations WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_delegations";
CREATE INDEX system_delegations_delegator_idx
  ON system_delegations (delegator_account_id, starts_at);
CREATE INDEX system_delegations_delegate_idx
  ON system_delegations (delegate_account_id, starts_at);
CREATE TRIGGER system_delegations_monotonic_lifecycle
BEFORE UPDATE ON system_delegations
WHEN
  NEW.id IS NOT OLD.id
  OR NEW.delegator_account_id IS NOT OLD.delegator_account_id
  OR NEW.delegate_account_id IS NOT OLD.delegate_account_id
  OR NEW.scope_context IS NOT OLD.scope_context
  OR NEW.scope_kind IS NOT OLD.scope_kind
  OR NEW.scope_id IS NOT OLD.scope_id
  OR NEW.scope_version IS NOT OLD.scope_version
  OR NEW.starts_at IS NOT OLD.starts_at
  OR NEW.ends_at IS NOT OLD.ends_at
  OR NEW.created_at IS NOT OLD.created_at
  OR OLD.revoked_at IS NOT NULL
  OR NEW.revoked_at IS NULL
BEGIN
  SELECT RAISE(ABORT, 'delegation lifecycle is not monotonic');
END;
CREATE TRIGGER system_delegations_prevent_delete
BEFORE DELETE ON system_delegations
BEGIN
  SELECT RAISE(ABORT, 'delegation is immutable');
END;

-- system_delegation_procedure_scopes
CREATE TABLE system_delegation_procedure_scopes (
  delegation_id TEXT PRIMARY KEY NOT NULL
    REFERENCES system_delegations(id) ON DELETE RESTRICT,
  procedure_key TEXT NOT NULL
    REFERENCES system_procedure_definitions(key) ON DELETE RESTRICT,
  CHECK (length(delegation_id) = 36 AND delegation_id NOT GLOB '*[^0-9a-f-]*' AND substr(delegation_id, 9, 1) = '-' AND substr(delegation_id, 14, 1) = '-' AND substr(delegation_id, 19, 1) = '-' AND substr(delegation_id, 24, 1) = '-' AND length(replace(delegation_id, '-', '')) = 32 AND substr(delegation_id, 15, 1) GLOB '[1-8]' AND substr(delegation_id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_delegation_procedure_scopes (delegation_id, procedure_key)
SELECT source.delegation_id,
       source.procedure_key
FROM "_stage_system_delegation_procedure_scopes" source;
INSERT INTO _system_workflow_uuid_primary_key_validation
SELECT 'system_delegation_procedure_scopes',
       (SELECT count(*) FROM "_stage_system_delegation_procedure_scopes"),
       (SELECT count(*) FROM system_delegation_procedure_scopes),
       0,
       (SELECT count(*) FROM system_delegation_procedure_scopes WHERE NOT (length(delegation_id) = 36 AND delegation_id NOT GLOB '*[^0-9a-f-]*' AND substr(delegation_id, 9, 1) = '-' AND substr(delegation_id, 14, 1) = '-' AND substr(delegation_id, 19, 1) = '-' AND substr(delegation_id, 24, 1) = '-' AND length(replace(delegation_id, '-', '')) = 32 AND substr(delegation_id, 15, 1) GLOB '[1-8]' AND substr(delegation_id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_delegation_procedure_scopes";
CREATE UNIQUE INDEX system_delegation_procedure_scopes_pair_uniq
  ON system_delegation_procedure_scopes (delegation_id, procedure_key);
CREATE TRIGGER system_delegation_procedure_scopes_valid_insert
BEFORE INSERT ON system_delegation_procedure_scopes
WHEN NOT EXISTS (
  SELECT 1 FROM system_delegations
  WHERE id = NEW.delegation_id
    AND scope_context IS NULL
    AND scope_kind IS NULL
    AND scope_id IS NULL
    AND scope_version IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'procedure scope requires an otherwise global delegation');
END;
CREATE TRIGGER system_delegation_procedure_scopes_prevent_update
BEFORE UPDATE ON system_delegation_procedure_scopes
BEGIN
  SELECT RAISE(ABORT, 'delegation procedure scope is immutable');
END;
CREATE TRIGGER system_delegation_procedure_scopes_prevent_delete
BEFORE DELETE ON system_delegation_procedure_scopes
BEGIN
  SELECT RAISE(ABORT, 'delegation procedure scope is immutable');
END;

-- system_execution_authorizations
CREATE TABLE system_execution_authorizations (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) BETWEEN 1 AND 255),
  case_id TEXT NOT NULL
    REFERENCES system_cases(id) ON DELETE RESTRICT,
  operation_key TEXT NOT NULL
    CHECK (length(operation_key) BETWEEN 1 AND 100),
  proposal_digest TEXT NOT NULL
    CHECK (
      length(proposal_digest) = 64
      AND proposal_digest NOT GLOB '*[^0-9a-f]*'
    ),
  granted_to_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  granted_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  CHECK (
    expires_at > granted_at
    AND (
      used_at IS NULL
      OR (used_at >= granted_at AND used_at < expires_at)
    )
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_execution_authorizations (id, case_id, operation_key, proposal_digest, granted_to_account_id, granted_at, expires_at, used_at)
SELECT source.id,
       source.case_id,
       source.operation_key,
       source.proposal_digest,
       source.granted_to_account_id,
       source.granted_at,
       source.expires_at,
       source.used_at
FROM "_stage_system_execution_authorizations" source;
INSERT INTO _system_workflow_uuid_primary_key_validation
SELECT 'system_execution_authorizations',
       (SELECT count(*) FROM "_stage_system_execution_authorizations"),
       (SELECT count(*) FROM system_execution_authorizations),
       0,
       (SELECT count(*) FROM system_execution_authorizations WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_execution_authorizations";
CREATE UNIQUE INDEX system_execution_authorizations_case_operation_uniq
  ON system_execution_authorizations (case_id, operation_key);
CREATE INDEX system_execution_authorizations_grantee_idx
  ON system_execution_authorizations (granted_to_account_id, granted_at);
CREATE TRIGGER system_execution_authorizations_valid_insert
BEFORE INSERT ON system_execution_authorizations
WHEN NOT EXISTS (
  SELECT 1 FROM system_cases
  WHERE
    id = NEW.case_id
    AND status = 'approved'
    AND proposal_digest = NEW.proposal_digest
)
BEGIN
  SELECT RAISE(ABORT, 'execution authorization requires approved case');
END;
CREATE TRIGGER system_execution_authorizations_single_use
BEFORE UPDATE ON system_execution_authorizations
WHEN
  NEW.id IS NOT OLD.id
  OR NEW.case_id IS NOT OLD.case_id
  OR NEW.operation_key IS NOT OLD.operation_key
  OR NEW.proposal_digest IS NOT OLD.proposal_digest
  OR NEW.granted_to_account_id IS NOT OLD.granted_to_account_id
  OR NEW.granted_at IS NOT OLD.granted_at
  OR NEW.expires_at IS NOT OLD.expires_at
  OR OLD.used_at IS NOT NULL
  OR NEW.used_at IS NULL
  OR NOT EXISTS (
    SELECT 1 FROM system_cases
    WHERE
      id = NEW.case_id
      AND status = 'approved'
      AND proposal_digest = NEW.proposal_digest
  )
BEGIN
  SELECT RAISE(ABORT, 'execution authorization is single use');
END;
CREATE TRIGGER system_execution_authorizations_prevent_delete
BEFORE DELETE ON system_execution_authorizations
BEGIN
  SELECT RAISE(ABORT, 'execution authorization is immutable');
END;

-- system_human_attestations
CREATE TABLE system_human_attestations (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) BETWEEN 1 AND 255),
  case_id TEXT NOT NULL,
  task_key TEXT NOT NULL,
  round INTEGER NOT NULL,
  actor_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  represented_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  delegation_id TEXT
    REFERENCES system_delegations(id) ON DELETE RESTRICT,
  action TEXT NOT NULL
    CHECK (action IN ('approve', 'reject', 'return')),
  proposal_digest TEXT NOT NULL
    CHECK (
      length(proposal_digest) = 64
      AND proposal_digest NOT GLOB '*[^0-9a-f]*'
    ),
  comment TEXT
    CHECK (comment IS NULL OR length(comment) <= 4000),
  decided_at INTEGER NOT NULL,
  CHECK (
    (actor_account_id = represented_account_id AND delegation_id IS NULL)
    OR (actor_account_id <> represented_account_id AND delegation_id IS NOT NULL)
  ),
  FOREIGN KEY (case_id, task_key, round)
    REFERENCES system_decision_tasks(case_id, task_key, round) ON DELETE RESTRICT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_human_attestations (id, case_id, task_key, round, actor_account_id, represented_account_id, delegation_id, action, proposal_digest, comment, decided_at)
SELECT source.id,
       source.case_id,
       source.task_key,
       source.round,
       source.actor_account_id,
       source.represented_account_id,
       source.delegation_id,
       source.action,
       source.proposal_digest,
       source.comment,
       source.decided_at
FROM "_stage_system_human_attestations" source;
INSERT INTO _system_workflow_uuid_primary_key_validation
SELECT 'system_human_attestations',
       (SELECT count(*) FROM "_stage_system_human_attestations"),
       (SELECT count(*) FROM system_human_attestations),
       0,
       (SELECT count(*) FROM system_human_attestations WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_human_attestations";
CREATE UNIQUE INDEX system_human_attestations_actor_uniq
  ON system_human_attestations (case_id, task_key, round, actor_account_id);
CREATE UNIQUE INDEX system_human_attestations_represented_uniq
  ON system_human_attestations (case_id, task_key, round, represented_account_id);
CREATE INDEX system_human_attestations_decided_idx
  ON system_human_attestations (decided_at);
CREATE TRIGGER system_human_attestations_valid_insert
BEFORE INSERT ON system_human_attestations
WHEN
  NOT EXISTS (
    SELECT 1
    FROM system_decision_tasks AS task
    JOIN system_cases AS workflow_case ON workflow_case.id = task.case_id
    WHERE
      task.case_id = NEW.case_id
      AND task.task_key = NEW.task_key
      AND task.round = NEW.round
      AND task.closed_at IS NULL
      AND task.proposal_digest = NEW.proposal_digest
      AND workflow_case.status = 'pending'
      AND workflow_case.proposal_digest = NEW.proposal_digest
      AND workflow_case.created_by_account_id <> NEW.actor_account_id
  )
  OR NOT EXISTS (
    SELECT 1 FROM system_decision_task_candidates
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND round = NEW.round
      AND candidate_account_id = NEW.represented_account_id
      AND (eligible_from IS NULL OR eligible_from <= NEW.decided_at)
  )
  OR EXISTS (
    SELECT 1 FROM system_decision_task_exclusions
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND round = NEW.round
      AND excluded_account_id = NEW.represented_account_id
  )
  OR (
    NEW.delegation_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM system_delegations AS delegation
      JOIN system_cases AS workflow_case ON workflow_case.id = NEW.case_id
      WHERE
        delegation.id = NEW.delegation_id
        AND delegation.delegator_account_id = NEW.represented_account_id
        AND delegation.delegate_account_id = NEW.actor_account_id
        AND delegation.starts_at <= NEW.decided_at
        AND delegation.ends_at > NEW.decided_at
        AND (delegation.revoked_at IS NULL OR delegation.revoked_at > NEW.decided_at)
        AND (
          delegation.scope_context IS NULL
          OR (
            delegation.scope_context = workflow_case.subject_context
            AND delegation.scope_kind = workflow_case.subject_kind
            AND delegation.scope_id = workflow_case.subject_id
            AND delegation.scope_version = workflow_case.subject_version
          )
        )
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid human attestation');
END;
CREATE TRIGGER system_human_attestations_prevent_update
BEFORE UPDATE ON system_human_attestations
BEGIN
  SELECT RAISE(ABORT, 'human attestation is immutable');
END;
CREATE TRIGGER system_human_attestations_prevent_delete
BEFORE DELETE ON system_human_attestations
BEGIN
  SELECT RAISE(ABORT, 'human attestation is immutable');
END;
CREATE TRIGGER system_human_attestations_procedure_delegation
BEFORE INSERT ON system_human_attestations
WHEN NEW.delegation_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM system_delegation_procedure_scopes
    WHERE delegation_id = NEW.delegation_id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM system_delegation_procedure_scopes AS procedure_scope
    JOIN system_proposal_cases AS proposal_case ON proposal_case.case_id = NEW.case_id
    JOIN system_proposals AS proposal ON proposal.id = proposal_case.proposal_id
    WHERE procedure_scope.delegation_id = NEW.delegation_id
      AND procedure_scope.procedure_key = proposal.procedure_key
  )
BEGIN
  SELECT RAISE(ABORT, 'delegation does not cover this procedure');
END;
CREATE TRIGGER system_human_attestations_task_policy
BEFORE INSERT ON system_human_attestations
WHEN EXISTS (
  SELECT 1 FROM system_decision_tasks
  WHERE
    case_id = NEW.case_id
    AND task_key = NEW.task_key
    AND round = NEW.round
    AND (
      (delegation_policy = 'forbidden' AND NEW.delegation_id IS NOT NULL)
      OR (return_policy = 'forbidden' AND NEW.action = 'return')
    )
)
BEGIN
  SELECT RAISE(ABORT, 'human attestation violates task policy');
END;
CREATE TRIGGER system_attestation_requires_human
BEFORE INSERT ON system_human_attestations
WHEN NOT EXISTS (
  SELECT 1 FROM system_accounts account
  JOIN system_principals principal ON principal.account_id = account.id
  WHERE account.id = NEW.actor_account_id AND account.status = 'active' AND account.closed_at IS NULL
    AND account.created_at <= NEW.decided_at AND principal.kind = 'human' AND principal.created_at <= NEW.decided_at
) OR NOT EXISTS (
  SELECT 1 FROM system_accounts account
  JOIN system_principals principal ON principal.account_id = account.id
  WHERE account.id = NEW.represented_account_id AND account.status = 'active' AND account.closed_at IS NULL
    AND account.created_at <= NEW.decided_at AND principal.kind = 'human' AND principal.created_at <= NEW.decided_at
)
BEGIN
  SELECT RAISE(ABORT, 'system_attestation_requires_human');
END;

-- system_iam_roles
CREATE TABLE system_iam_roles (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  key TEXT NOT NULL
    CHECK (length(key) BETWEEN 3 AND 100),
  kind TEXT NOT NULL
    CHECK (kind IN ('managed', 'custom')),
  name TEXT NOT NULL
    CHECK (length(name) BETWEEN 1 AND 100),
  description TEXT
    CHECK (description IS NULL OR length(description) BETWEEN 1 AND 1000),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
    CHECK (updated_at >= created_at)
, resource_type TEXT
  CHECK (resource_type IS NULL OR length(resource_type) BETWEEN 3 AND 100),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_iam_roles (id, key, kind, name, description, created_at, updated_at, resource_type, legacy_id)
SELECT map.new_id,
       source.key,
       source.kind,
       source.name,
       source.description,
       source.created_at,
       source.updated_at,
       source.resource_type,
       CASE WHEN map.old_id IS NOT map.new_id THEN source.id END
FROM "_stage_system_iam_roles" source
INNER JOIN _system_iam_roles_id_map map ON map.old_id = source.id;
INSERT INTO _system_workflow_uuid_primary_key_validation
SELECT 'system_iam_roles',
       (SELECT count(*) FROM "_stage_system_iam_roles"),
       (SELECT count(*) FROM system_iam_roles),
       0,
       (SELECT count(*) FROM system_iam_roles WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_iam_roles";
CREATE UNIQUE INDEX system_iam_roles_key_uniq
  ON system_iam_roles (key);
CREATE TRIGGER system_iam_roles_immutable_identity
BEFORE UPDATE OF id, key, kind, resource_type, created_at ON system_iam_roles
BEGIN
  SELECT RAISE(ABORT, 'IAM role identity is immutable');
END;
CREATE TRIGGER system_iam_roles_legacy_id_insert
BEFORE INSERT ON system_iam_roles
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER system_iam_roles_identity_update
BEFORE UPDATE OF id, legacy_id ON system_iam_roles
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- system_iam_role_permissions
CREATE TABLE system_iam_role_permissions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  role_id TEXT NOT NULL
    REFERENCES system_iam_roles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL
    CHECK (length(permission_key) BETWEEN 3 AND 100),
  UNIQUE (role_id, permission_key),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
) WITHOUT ROWID;
INSERT INTO system_iam_role_permissions (id, role_id, permission_key)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       CASE WHEN source.role_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _system_iam_roles_id_map ref WHERE ref.old_id = source.role_id), CAST(source.role_id AS TEXT)) END,
       source.permission_key
FROM "_stage_system_iam_role_permissions" source;
INSERT INTO _system_workflow_uuid_primary_key_validation
SELECT 'system_iam_role_permissions',
       (SELECT count(*) FROM "_stage_system_iam_role_permissions"),
       (SELECT count(*) FROM system_iam_role_permissions),
       0,
       (SELECT count(*) FROM system_iam_role_permissions WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_iam_role_permissions";
CREATE TRIGGER system_iam_role_permissions_identity_update
BEFORE UPDATE OF id ON system_iam_role_permissions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- system_role_bindings
CREATE TABLE system_role_bindings (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  role_id TEXT NOT NULL
    REFERENCES system_iam_roles(id) ON DELETE RESTRICT,
  resource_type TEXT,
  resource_id TEXT,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER
    CHECK (revoked_at IS NULL OR revoked_at >= created_at),
  CHECK (
    (resource_type IS NULL AND resource_id IS NULL) OR (
      resource_type IS NOT NULL AND resource_id IS NOT NULL
      AND length(resource_type) BETWEEN 3 AND 100
      AND length(resource_id) BETWEEN 1 AND 255
    )
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at, legacy_id)
SELECT map.new_id,
       source.account_id,
       CASE WHEN source.role_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _system_iam_roles_id_map ref WHERE ref.old_id = source.role_id), CAST(source.role_id AS TEXT)) END,
       source.resource_type,
       source.resource_id,
       source.created_at,
       source.revoked_at,
       CASE WHEN map.old_id IS NOT map.new_id THEN source.id END
FROM "_stage_system_role_bindings" source
INNER JOIN _system_role_bindings_id_map map ON map.old_id = source.id;
INSERT INTO _system_workflow_uuid_primary_key_validation
SELECT 'system_role_bindings',
       (SELECT count(*) FROM "_stage_system_role_bindings"),
       (SELECT count(*) FROM system_role_bindings),
       0,
       (SELECT count(*) FROM system_role_bindings WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_role_bindings";
CREATE UNIQUE INDEX system_role_bindings_active_uniq
  ON system_role_bindings (
    account_id,
    role_id,
    coalesce(resource_type, ''),
    coalesce(resource_id, '')
  )
  WHERE revoked_at IS NULL;
CREATE INDEX system_role_bindings_account_idx
  ON system_role_bindings (account_id, created_at);
CREATE INDEX system_role_bindings_role_idx
  ON system_role_bindings (role_id, created_at);
CREATE INDEX system_role_bindings_resource_idx
  ON system_role_bindings (resource_type, resource_id);
CREATE TRIGGER system_role_bindings_monotonic_lifecycle
BEFORE UPDATE ON system_role_bindings
WHEN
  NEW.id IS NOT OLD.id
  OR NEW.account_id IS NOT OLD.account_id
  OR NEW.role_id IS NOT OLD.role_id
  OR NEW.resource_type IS NOT OLD.resource_type
  OR NEW.resource_id IS NOT OLD.resource_id
  OR NEW.created_at IS NOT OLD.created_at
  OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NOT OLD.revoked_at)
BEGIN
  SELECT RAISE(ABORT, 'role binding lifecycle is not monotonic');
END;
CREATE TRIGGER system_role_bindings_closed_account_guard
BEFORE INSERT ON system_role_bindings
WHEN EXISTS (
  SELECT 1 FROM system_accounts
  WHERE id = NEW.account_id AND closed_at IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'closed account cannot receive a role binding');
END;
CREATE TRIGGER system_role_bindings_legacy_id_insert
BEFORE INSERT ON system_role_bindings
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER system_role_bindings_identity_update
BEFORE UPDATE OF id, legacy_id ON system_role_bindings
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- system_account_invitations
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
  updated_at INTEGER NOT NULL, resource_type TEXT, resource_id TEXT
  CHECK ((resource_type IS NULL AND resource_id IS NULL) OR (
    resource_type IS NOT NULL AND resource_id IS NOT NULL
    AND length(resource_type) BETWEEN 3 AND 100
    AND length(resource_id) BETWEEN 1 AND 255
  )), related_resource_id TEXT
  CHECK (related_resource_id IS NULL OR (
    resource_type IS NOT NULL AND resource_id IS NOT NULL
    AND length(related_resource_id) BETWEEN 1 AND 255
  )),
  CHECK (
    updated_at >= created_at
    AND expires_at >= created_at
    AND (revoked_at IS NULL OR revoked_at >= created_at)
  )
);
INSERT INTO system_account_invitations (id, token, subject, role_id, accepted_by_account_id, expires_at, revoked_at, created_at, updated_at, resource_type, resource_id, related_resource_id)
SELECT source.id,
       source.token,
       source.subject,
       CASE WHEN source.role_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _system_iam_roles_id_map ref WHERE ref.old_id = source.role_id), CAST(source.role_id AS TEXT)) END,
       source.accepted_by_account_id,
       source.expires_at,
       source.revoked_at,
       source.created_at,
       source.updated_at,
       source.resource_type,
       source.resource_id,
       source.related_resource_id
FROM "_stage_system_account_invitations" source;
INSERT INTO _system_workflow_uuid_primary_key_validation
SELECT 'system_account_invitations',
       (SELECT count(*) FROM "_stage_system_account_invitations"),
       (SELECT count(*) FROM system_account_invitations),
       0,
       0,
       0;
DROP TABLE "_stage_system_account_invitations";
CREATE UNIQUE INDEX system_account_invitations_token_uniq
  ON system_account_invitations(token);
CREATE INDEX system_account_invitations_role_idx
  ON system_account_invitations(role_id, created_at);
CREATE INDEX system_account_invitations_subject_idx
  ON system_account_invitations(subject, created_at);
CREATE INDEX system_account_invitations_resource_idx
  ON system_account_invitations (resource_type, resource_id);

-- system_bootstrap_state
CREATE TABLE system_bootstrap_state (
  singleton INTEGER PRIMARY KEY NOT NULL
    CHECK (singleton = 1),
  completed_by_account_id TEXT NOT NULL UNIQUE
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  root_binding_id TEXT NOT NULL UNIQUE
    REFERENCES system_role_bindings(id) ON DELETE RESTRICT,
  completed_at INTEGER NOT NULL
);
INSERT INTO system_bootstrap_state (singleton, completed_by_account_id, root_binding_id, completed_at)
SELECT source.singleton,
       source.completed_by_account_id,
       CASE WHEN source.root_binding_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _system_role_bindings_id_map ref WHERE ref.old_id = source.root_binding_id), CAST(source.root_binding_id AS TEXT)) END,
       source.completed_at
FROM "_stage_system_bootstrap_state" source;
INSERT INTO _system_workflow_uuid_primary_key_validation
SELECT 'system_bootstrap_state',
       (SELECT count(*) FROM "_stage_system_bootstrap_state"),
       (SELECT count(*) FROM system_bootstrap_state),
       0,
       0,
       0;
DROP TABLE "_stage_system_bootstrap_state";
CREATE TRIGGER system_bootstrap_state_validate_root
BEFORE INSERT ON system_bootstrap_state
WHEN NOT EXISTS (
  SELECT 1
  FROM system_role_bindings binding
  INNER JOIN system_accounts account
    ON account.id = binding.account_id
  INNER JOIN system_iam_role_permissions permission
    ON permission.role_id = binding.role_id
  WHERE binding.id = NEW.root_binding_id
    AND binding.account_id = NEW.completed_by_account_id
    AND binding.resource_type IS NULL
    AND binding.resource_id IS NULL
    AND binding.revoked_at IS NULL
    AND account.status = 'active'
    AND permission.permission_key = 'system:admin'
)
BEGIN
  SELECT RAISE(ABORT, 'bootstrap requires an active global System root binding');
END;
CREATE TRIGGER system_bootstrap_state_prevent_update
BEFORE UPDATE ON system_bootstrap_state
BEGIN
  SELECT RAISE(ABORT, 'bootstrap state is immutable');
END;
CREATE TRIGGER system_bootstrap_state_prevent_delete
BEFORE DELETE ON system_bootstrap_state
BEGIN
  SELECT RAISE(ABORT, 'bootstrap state is immutable');
END;

INSERT INTO _system_workflow_uuid_primary_key_validation
SELECT 'system_iam_role_permissions.role_id', orphan_count, (SELECT count(*) FROM system_iam_role_permissions child WHERE child.role_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM system_iam_roles parent WHERE parent.id = child.role_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'system_iam_role_permissions.role_id';
INSERT INTO _system_workflow_uuid_primary_key_validation
SELECT 'system_role_bindings.role_id', orphan_count, (SELECT count(*) FROM system_role_bindings child WHERE child.role_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM system_iam_roles parent WHERE parent.id = child.role_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'system_role_bindings.role_id';
INSERT INTO _system_workflow_uuid_primary_key_validation
SELECT 'system_account_invitations.role_id', orphan_count, (SELECT count(*) FROM system_account_invitations child WHERE child.role_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM system_iam_roles parent WHERE parent.id = child.role_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'system_account_invitations.role_id';
INSERT INTO _system_workflow_uuid_primary_key_validation
SELECT 'system_bootstrap_state.root_binding_id', orphan_count, (SELECT count(*) FROM system_bootstrap_state child WHERE child.root_binding_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM system_role_bindings parent WHERE parent.id = child.root_binding_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'system_bootstrap_state.root_binding_id';
DROP TABLE _uuid_reference_orphans;
DROP TABLE _system_iam_roles_id_map;
DROP TABLE _system_role_bindings_id_map;
DROP TABLE _system_workflow_uuid_primary_key_validation;
