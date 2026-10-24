-- 規程（governance）とナレッジ（knowledge）の table を UUID の主キーへ移す (Issue )。
--
-- 対象:
-- - 整数の主キー: governance_org_role_assignments, knowledge_articles
-- - 主キーが既に TEXT の UUID: governance_documents, governance_document_versions
-- - 業務コードや複合の主キー: governance_capabilities, governance_org_roles, governance_acknowledgements,
--   governance_document_references, governance_publication_approvals, knowledge_article_revisions
--
-- 整数の主キーは v4 の UUID に置き換え、旧来の整数の主キーを同じ行の legacy_id（TEXT、UNIQUE）に残す。
-- System の監査の対象 ID（ナレッジ記事）や保全の証跡は書き換えず、旧 ID は legacy_id で現在の行へ辿る。
-- TEXT の主キーは UUID の検査を通ればそのまま残し、通らない値だけを置き換える。置き換える値が
-- 監査・保全・撤去・案件の証跡に現れる場合は止める。
--
-- 業務コード（capability と org role の code）と複合の主キーは主キーから外し、一意な属性として残したまま、
-- 新しい UUID の id を主キーにする。業務コードによる参照は書き換えない。
--
-- 外部キーの無い参照 governance_documents.current_version_id、governance_document_versions.document_id、
-- 各版を指す version_id は新しい主キーへ追従させる。knowledge_article_revisions.article_id（外部キーあり）は
-- 記事の新しい UUID へ書き換える。版の snapshot_json は変更不能な履歴なので書き換えず、旧 ID を含んだまま残す。
--
-- 退避と削除は参照元から、作り直しは参照先から行う。所有業務が撤去の停止中なら検証表の CHECK で止める。
--
-- ALTER TABLE RENAME は trigger を含む全 schema を解析し直し、table ごとに数十 ms かかる。
-- 名前を変えずに行を退避し、同じ名前で作り直してから戻す。

CREATE TABLE _governance_knowledge_uuid_primary_key_validation (
  resource TEXT PRIMARY KEY NOT NULL,
  source_count INTEGER NOT NULL,
  target_count INTEGER NOT NULL,
  orphan_count INTEGER NOT NULL,
  non_uuid_count INTEGER NOT NULL,
  blocked_count INTEGER NOT NULL,
  CHECK (source_count = target_count AND orphan_count = 0 AND non_uuid_count = 0 AND blocked_count = 0)
);

-- governance_org_role_assignments
CREATE TABLE _governance_org_role_assignments_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _governance_org_role_assignments_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM governance_org_role_assignments;

-- governance_documents
CREATE TABLE _governance_documents_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _governance_documents_id_map (old_id, new_id)
SELECT id, CASE WHEN length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]' THEN id ELSE lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) END
FROM governance_documents;

-- governance_document_versions
CREATE TABLE _governance_document_versions_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _governance_document_versions_id_map (old_id, new_id)
SELECT id, CASE WHEN length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]' THEN id ELSE lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) END
FROM governance_document_versions;

-- knowledge_articles
CREATE TABLE _knowledge_articles_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _knowledge_articles_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM knowledge_articles;

-- 外部キーの無い参照が移行前から指す先を持たない行の数。移行で増えないことを最後に確かめる。
CREATE TABLE _uuid_reference_orphans (
  resource TEXT PRIMARY KEY NOT NULL,
  orphan_count INTEGER NOT NULL
);
INSERT INTO _uuid_reference_orphans VALUES ('governance_documents.current_version_id', (SELECT count(*) FROM governance_documents child WHERE child.current_version_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM governance_document_versions parent WHERE parent.id = child.current_version_id)));
INSERT INTO _uuid_reference_orphans VALUES ('governance_document_versions.document_id', (SELECT count(*) FROM governance_document_versions child WHERE child.document_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM governance_documents parent WHERE parent.id = child.document_id)));
INSERT INTO _uuid_reference_orphans VALUES ('governance_acknowledgements.version_id', (SELECT count(*) FROM governance_acknowledgements child WHERE child.version_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM governance_document_versions parent WHERE parent.id = child.version_id)));
INSERT INTO _uuid_reference_orphans VALUES ('governance_document_references.version_id', (SELECT count(*) FROM governance_document_references child WHERE child.version_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM governance_document_versions parent WHERE parent.id = child.version_id)));
INSERT INTO _uuid_reference_orphans VALUES ('governance_publication_approvals.version_id', (SELECT count(*) FROM governance_publication_approvals child WHERE child.version_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM governance_document_versions parent WHERE parent.id = child.version_id)));
INSERT INTO _uuid_reference_orphans VALUES ('knowledge_article_revisions.article_id', (SELECT count(*) FROM knowledge_article_revisions child WHERE child.article_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM knowledge_articles parent WHERE parent.id = child.article_id)));

-- 参照元から順に行を退避して table を削除する。
CREATE TABLE "_stage_knowledge_article_revisions" AS SELECT * FROM knowledge_article_revisions;
DROP TABLE knowledge_article_revisions;
CREATE TABLE "_stage_knowledge_articles" AS SELECT * FROM knowledge_articles;
DROP TABLE knowledge_articles;
CREATE TABLE "_stage_governance_publication_approvals" AS SELECT * FROM governance_publication_approvals;
DROP TABLE governance_publication_approvals;
CREATE TABLE "_stage_governance_document_references" AS SELECT * FROM governance_document_references;
DROP TABLE governance_document_references;
CREATE TABLE "_stage_governance_acknowledgements" AS SELECT * FROM governance_acknowledgements;
DROP TABLE governance_acknowledgements;
CREATE TABLE "_stage_governance_document_versions" AS SELECT * FROM governance_document_versions;
DROP TABLE governance_document_versions;
CREATE TABLE "_stage_governance_documents" AS SELECT * FROM governance_documents;
DROP TABLE governance_documents;
CREATE TABLE "_stage_governance_org_role_assignments" AS SELECT * FROM governance_org_role_assignments;
DROP TABLE governance_org_role_assignments;
CREATE TABLE "_stage_governance_org_roles" AS SELECT * FROM governance_org_roles;
DROP TABLE governance_org_roles;
CREATE TABLE "_stage_governance_capabilities" AS SELECT * FROM governance_capabilities;
DROP TABLE governance_capabilities;

-- governance_capabilities
CREATE TABLE governance_capabilities (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  owner_org_role_code TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO governance_capabilities (id, code, name, description, owner_org_role_code, status, created_at, updated_at)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.code,
       source.name,
       source.description,
       source.owner_org_role_code,
       source.status,
       source.created_at,
       source.updated_at
FROM "_stage_governance_capabilities" source;
INSERT INTO _governance_knowledge_uuid_primary_key_validation
SELECT 'governance_capabilities',
       (SELECT count(*) FROM "_stage_governance_capabilities"),
       (SELECT count(*) FROM governance_capabilities),
       0,
       (SELECT count(*) FROM governance_capabilities WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1);
DROP TABLE "_stage_governance_capabilities";
CREATE TRIGGER governance_capabilities_source_freeze_delete BEFORE DELETE ON governance_capabilities
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;
CREATE TRIGGER governance_capabilities_source_freeze_insert BEFORE INSERT ON governance_capabilities
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;
CREATE TRIGGER governance_capabilities_source_freeze_update BEFORE UPDATE ON governance_capabilities
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;
CREATE TRIGGER governance_capabilities_identity_update
BEFORE UPDATE OF id ON governance_capabilities
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- governance_org_roles
CREATE TABLE governance_org_roles (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  assignment_mode TEXT NOT NULL DEFAULT 'manual'
    CHECK (assignment_mode IN ('manual', 'department_manager')),
  cardinality TEXT NOT NULL DEFAULT 'one'
    CHECK (cardinality IN ('one', 'per_department', 'many')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO governance_org_roles (id, code, name, description, assignment_mode, cardinality, created_at, updated_at)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.code,
       source.name,
       source.description,
       source.assignment_mode,
       source.cardinality,
       source.created_at,
       source.updated_at
FROM "_stage_governance_org_roles" source;
INSERT INTO _governance_knowledge_uuid_primary_key_validation
SELECT 'governance_org_roles',
       (SELECT count(*) FROM "_stage_governance_org_roles"),
       (SELECT count(*) FROM governance_org_roles),
       0,
       (SELECT count(*) FROM governance_org_roles WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1);
DROP TABLE "_stage_governance_org_roles";
CREATE TRIGGER governance_org_roles_source_freeze_delete BEFORE DELETE ON governance_org_roles
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;
CREATE TRIGGER governance_org_roles_source_freeze_insert BEFORE INSERT ON governance_org_roles
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;
CREATE TRIGGER governance_org_roles_source_freeze_update BEFORE UPDATE ON governance_org_roles
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;
CREATE TRIGGER governance_org_roles_identity_update
BEFORE UPDATE OF id ON governance_org_roles
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- governance_org_role_assignments
CREATE TABLE governance_org_role_assignments (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
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
  CHECK (revoked_by_account_id IS NULL OR length(revoked_by_account_id) BETWEEN 1 AND 255),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO governance_org_role_assignments (id, org_role_code, employee_id, department_code, starts_on, ends_on, source_document_code, created_by_account_id, created_at, revoked_by_account_id, revoked_at, legacy_id)
SELECT map.new_id,
       source.org_role_code,
       source.employee_id,
       source.department_code,
       source.starts_on,
       source.ends_on,
       source.source_document_code,
       source.created_by_account_id,
       source.created_at,
       source.revoked_by_account_id,
       source.revoked_at,
       CAST(source.id AS TEXT)
FROM "_stage_governance_org_role_assignments" source
INNER JOIN _governance_org_role_assignments_id_map map ON map.old_id = source.id;
INSERT INTO _governance_knowledge_uuid_primary_key_validation
SELECT 'governance_org_role_assignments',
       (SELECT count(*) FROM "_stage_governance_org_role_assignments"),
       (SELECT count(*) FROM governance_org_role_assignments),
       0,
       (SELECT count(*) FROM governance_org_role_assignments WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1);
DROP TABLE "_stage_governance_org_role_assignments";
CREATE INDEX idx_governance_role_assignments_employee
  ON governance_org_role_assignments (employee_id);
CREATE INDEX idx_governance_role_assignments_role_period
  ON governance_org_role_assignments (org_role_code, starts_on, ends_on);
CREATE TRIGGER governance_org_role_assignments_source_freeze_delete_guard
BEFORE DELETE ON governance_org_role_assignments
WHEN EXISTS (
  SELECT 1 FROM system_record_source_freezes
  WHERE owner_context = 'governance' AND revision = 1
)
BEGIN
  SELECT RAISE(ABORT, 'governance_org_role_assignment_source_frozen');
END;
CREATE TRIGGER governance_org_role_assignments_source_freeze_insert_guard
BEFORE INSERT ON governance_org_role_assignments
WHEN EXISTS (
  SELECT 1 FROM system_record_source_freezes
  WHERE owner_context = 'governance' AND revision = 1
)
BEGIN
  SELECT RAISE(ABORT, 'governance_org_role_assignment_source_frozen');
END;
CREATE TRIGGER governance_org_role_assignments_source_freeze_update_guard
BEFORE UPDATE ON governance_org_role_assignments
WHEN EXISTS (
  SELECT 1 FROM system_record_source_freezes
  WHERE owner_context = 'governance' AND revision = 1
)
BEGIN
  SELECT RAISE(ABORT, 'governance_org_role_assignment_source_frozen');
END;
CREATE TRIGGER governance_org_role_assignments_legacy_id_insert
BEFORE INSERT ON governance_org_role_assignments
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER governance_org_role_assignments_identity_update
BEFORE UPDATE OF id, legacy_id ON governance_org_role_assignments
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- governance_documents
CREATE TABLE governance_documents (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('policy', 'procedure', 'guideline', 'control')),
  classification TEXT NOT NULL
    CHECK (classification IN ('public', 'internal', 'confidential', 'restricted')),
  owner_capability_code TEXT NOT NULL,
  steward_org_role_code TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'retired')),
  current_version_id TEXT,
  source_path TEXT NOT NULL UNIQUE,
  created_by_account_id TEXT NOT NULL CHECK (length(created_by_account_id) BETWEEN 1 AND 255),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO governance_documents (id, code, title, kind, classification, owner_capability_code, steward_org_role_code, status, current_version_id, source_path, created_by_account_id, created_at, updated_at)
SELECT map.new_id,
       source.code,
       source.title,
       source.kind,
       source.classification,
       source.owner_capability_code,
       source.steward_org_role_code,
       source.status,
       CASE WHEN source.current_version_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _governance_document_versions_id_map ref WHERE ref.old_id = source.current_version_id), CAST(source.current_version_id AS TEXT)) END,
       source.source_path,
       source.created_by_account_id,
       source.created_at,
       source.updated_at
FROM "_stage_governance_documents" source
INNER JOIN _governance_documents_id_map map ON map.old_id = source.id;
INSERT INTO _governance_knowledge_uuid_primary_key_validation
SELECT 'governance_documents',
       (SELECT count(*) FROM "_stage_governance_documents"),
       (SELECT count(*) FROM governance_documents),
       0,
       (SELECT count(*) FROM governance_documents WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
         + (SELECT count(*) FROM _governance_documents_id_map WHERE old_id IS NOT new_id AND (
             EXISTS (SELECT 1 FROM system_record_coverage_entries entry WHERE entry.source_record_id = _governance_documents_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_preserved_records preserved WHERE json_extract(preserved.snapshot_json, '$.source.recordId') = _governance_documents_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_cases workflow_case WHERE workflow_case.subject_id = _governance_documents_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_audit_events audit WHERE audit.target_id = _governance_documents_id_map.old_id)));
DROP TABLE "_stage_governance_documents";
CREATE TRIGGER governance_documents_source_freeze_delete BEFORE DELETE ON governance_documents
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;
CREATE TRIGGER governance_documents_source_freeze_insert BEFORE INSERT ON governance_documents
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;
CREATE TRIGGER governance_documents_source_freeze_update BEFORE UPDATE ON governance_documents
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;

-- governance_document_versions
CREATE TABLE governance_document_versions (
  id TEXT PRIMARY KEY NOT NULL,
  document_id TEXT NOT NULL,
  version TEXT NOT NULL,
  body_md TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  procedure_json TEXT,
  content_hash TEXT NOT NULL,
  effective_from TEXT,
  effective_to TEXT,
  review_due_on TEXT,
  state TEXT NOT NULL DEFAULT 'draft'
    CHECK (state IN ('draft', 'in_review', 'published', 'superseded', 'rejected')),
  created_by_account_id TEXT NOT NULL CHECK (length(created_by_account_id) BETWEEN 1 AND 255),
  created_at TEXT NOT NULL,
  published_by_account_id TEXT,
  published_at TEXT,
  UNIQUE (document_id, version),
  CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_from < effective_to),
  CHECK (published_by_account_id IS NULL OR length(published_by_account_id) BETWEEN 1 AND 255),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO governance_document_versions (id, document_id, version, body_md, metadata_json, procedure_json, content_hash, effective_from, effective_to, review_due_on, state, created_by_account_id, created_at, published_by_account_id, published_at)
SELECT map.new_id,
       CASE WHEN source.document_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _governance_documents_id_map ref WHERE ref.old_id = source.document_id), CAST(source.document_id AS TEXT)) END,
       source.version,
       source.body_md,
       source.metadata_json,
       source.procedure_json,
       source.content_hash,
       source.effective_from,
       source.effective_to,
       source.review_due_on,
       source.state,
       source.created_by_account_id,
       source.created_at,
       source.published_by_account_id,
       source.published_at
FROM "_stage_governance_document_versions" source
INNER JOIN _governance_document_versions_id_map map ON map.old_id = source.id;
INSERT INTO _governance_knowledge_uuid_primary_key_validation
SELECT 'governance_document_versions',
       (SELECT count(*) FROM "_stage_governance_document_versions"),
       (SELECT count(*) FROM governance_document_versions),
       0,
       (SELECT count(*) FROM governance_document_versions WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
         + (SELECT count(*) FROM _governance_document_versions_id_map WHERE old_id IS NOT new_id AND (
             EXISTS (SELECT 1 FROM system_record_coverage_entries entry WHERE entry.source_record_id = _governance_document_versions_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_preserved_records preserved WHERE json_extract(preserved.snapshot_json, '$.source.recordId') = _governance_document_versions_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_cases workflow_case WHERE workflow_case.subject_id = _governance_document_versions_id_map.old_id)
             OR EXISTS (SELECT 1 FROM system_audit_events audit WHERE audit.target_id = _governance_document_versions_id_map.old_id)));
DROP TABLE "_stage_governance_document_versions";
CREATE INDEX idx_governance_versions_document_state
  ON governance_document_versions (document_id, state);
CREATE TRIGGER governance_document_versions_source_freeze_delete BEFORE DELETE ON governance_document_versions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;
CREATE TRIGGER governance_document_versions_source_freeze_insert BEFORE INSERT ON governance_document_versions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;
CREATE TRIGGER governance_document_versions_source_freeze_update BEFORE UPDATE ON governance_document_versions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;

-- governance_acknowledgements
CREATE TABLE governance_acknowledgements (
  id TEXT PRIMARY KEY NOT NULL,
  version_id TEXT NOT NULL,
  employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  content_hash TEXT NOT NULL,
  acknowledged_at TEXT NOT NULL,
  UNIQUE (version_id, employee_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO governance_acknowledgements (id, version_id, employee_id, content_hash, acknowledged_at)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       CASE WHEN source.version_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _governance_document_versions_id_map ref WHERE ref.old_id = source.version_id), CAST(source.version_id AS TEXT)) END,
       source.employee_id,
       source.content_hash,
       source.acknowledged_at
FROM "_stage_governance_acknowledgements" source;
INSERT INTO _governance_knowledge_uuid_primary_key_validation
SELECT 'governance_acknowledgements',
       (SELECT count(*) FROM "_stage_governance_acknowledgements"),
       (SELECT count(*) FROM governance_acknowledgements),
       0,
       (SELECT count(*) FROM governance_acknowledgements WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1);
DROP TABLE "_stage_governance_acknowledgements";
CREATE TRIGGER governance_acknowledgements_source_freeze_delete BEFORE DELETE ON governance_acknowledgements
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;
CREATE TRIGGER governance_acknowledgements_source_freeze_insert BEFORE INSERT ON governance_acknowledgements
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;
CREATE TRIGGER governance_acknowledgements_source_freeze_update BEFORE UPDATE ON governance_acknowledgements
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;
CREATE TRIGGER governance_acknowledgements_identity_update
BEFORE UPDATE OF id ON governance_acknowledgements
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- governance_document_references
CREATE TABLE governance_document_references (
  id TEXT PRIMARY KEY NOT NULL,
  version_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (
    kind IN ('capability', 'org_role', 'policy', 'procedure', 'guideline', 'control', 'permission', 'training')
  ),
  code TEXT NOT NULL,
  UNIQUE (version_id, kind, code),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO governance_document_references (id, version_id, kind, code)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       CASE WHEN source.version_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _governance_document_versions_id_map ref WHERE ref.old_id = source.version_id), CAST(source.version_id AS TEXT)) END,
       source.kind,
       source.code
FROM "_stage_governance_document_references" source;
INSERT INTO _governance_knowledge_uuid_primary_key_validation
SELECT 'governance_document_references',
       (SELECT count(*) FROM "_stage_governance_document_references"),
       (SELECT count(*) FROM governance_document_references),
       0,
       (SELECT count(*) FROM governance_document_references WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1);
DROP TABLE "_stage_governance_document_references";
CREATE TRIGGER governance_document_references_source_freeze_delete BEFORE DELETE ON governance_document_references
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;
CREATE TRIGGER governance_document_references_source_freeze_insert BEFORE INSERT ON governance_document_references
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;
CREATE TRIGGER governance_document_references_source_freeze_update BEFORE UPDATE ON governance_document_references
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;
CREATE TRIGGER governance_document_references_identity_update
BEFORE UPDATE OF id ON governance_document_references
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- governance_publication_approvals
CREATE TABLE governance_publication_approvals (
  id TEXT PRIMARY KEY NOT NULL,
  version_id TEXT NOT NULL,
  org_role_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by_employee_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT,
  decided_at TEXT,
  comment TEXT,
  UNIQUE (version_id, org_role_code),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO governance_publication_approvals (id, version_id, org_role_code, status, decided_by_employee_id, decided_at, comment)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       CASE WHEN source.version_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _governance_document_versions_id_map ref WHERE ref.old_id = source.version_id), CAST(source.version_id AS TEXT)) END,
       source.org_role_code,
       source.status,
       source.decided_by_employee_id,
       source.decided_at,
       source.comment
FROM "_stage_governance_publication_approvals" source;
INSERT INTO _governance_knowledge_uuid_primary_key_validation
SELECT 'governance_publication_approvals',
       (SELECT count(*) FROM "_stage_governance_publication_approvals"),
       (SELECT count(*) FROM governance_publication_approvals),
       0,
       (SELECT count(*) FROM governance_publication_approvals WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1);
DROP TABLE "_stage_governance_publication_approvals";
CREATE TRIGGER governance_publication_approvals_source_freeze_delete BEFORE DELETE ON governance_publication_approvals
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;
CREATE TRIGGER governance_publication_approvals_source_freeze_insert BEFORE INSERT ON governance_publication_approvals
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;
CREATE TRIGGER governance_publication_approvals_source_freeze_update BEFORE UPDATE ON governance_publication_approvals
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;
CREATE TRIGGER governance_publication_approvals_identity_update
BEFORE UPDATE OF id ON governance_publication_approvals
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- knowledge_articles
CREATE TABLE knowledge_articles (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT,
  body_md TEXT NOT NULL,
  author_id TEXT REFERENCES company_employees(id) ON DELETE RESTRICT NOT NULL,
  created_at TEXT NOT NULL
, revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1), status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'withdrawn')),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO knowledge_articles (id, title, category, tags, body_md, author_id, created_at, revision, status, legacy_id)
SELECT map.new_id,
       source.title,
       source.category,
       source.tags,
       source.body_md,
       source.author_id,
       source.created_at,
       source.revision,
       source.status,
       CAST(source.id AS TEXT)
FROM "_stage_knowledge_articles" source
INNER JOIN _knowledge_articles_id_map map ON map.old_id = source.id;
INSERT INTO _governance_knowledge_uuid_primary_key_validation
SELECT 'knowledge_articles',
       (SELECT count(*) FROM "_stage_knowledge_articles"),
       (SELECT count(*) FROM knowledge_articles),
       0,
       (SELECT count(*) FROM knowledge_articles WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'knowledge' AND revision = 1);
DROP TABLE "_stage_knowledge_articles";
CREATE INDEX idx_knowledge_articles_category ON knowledge_articles (category);
CREATE TRIGGER knowledge_article_no_delete
BEFORE DELETE ON knowledge_articles
BEGIN
  SELECT RAISE(ABORT, 'knowledge_article_withdrawal_required');
END;
CREATE TRIGGER knowledge_articles_source_freeze_delete
BEFORE DELETE ON knowledge_articles
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'knowledge' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'knowledge_record_source_frozen');
END;
CREATE TRIGGER knowledge_articles_source_freeze_insert
BEFORE INSERT ON knowledge_articles
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'knowledge' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'knowledge_record_source_frozen');
END;
CREATE TRIGGER knowledge_articles_source_freeze_update
BEFORE UPDATE ON knowledge_articles
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'knowledge' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'knowledge_record_source_frozen');
END;
CREATE TRIGGER knowledge_articles_legacy_id_insert
BEFORE INSERT ON knowledge_articles
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER knowledge_articles_identity_update
BEFORE UPDATE OF id, legacy_id ON knowledge_articles
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- knowledge_article_revisions
CREATE TABLE knowledge_article_revisions (
  id TEXT PRIMARY KEY NOT NULL,
  article_id TEXT NOT NULL REFERENCES knowledge_articles(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  status TEXT NOT NULL CHECK (status IN ('active', 'withdrawn')),
  source TEXT NOT NULL CHECK (source IN ('existing_record', 'actor')),
  actor_account_id TEXT REFERENCES system_accounts(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 2000),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  command_id TEXT,
  request_json TEXT CHECK (request_json IS NULL OR json_valid(request_json)),
  UNIQUE (article_id, revision),
  UNIQUE (actor_account_id, command_id),
  CHECK (
    (source = 'existing_record' AND actor_account_id IS NULL AND command_id IS NULL AND request_json IS NULL)
    OR (source = 'actor' AND actor_account_id IS NOT NULL AND command_id IS NOT NULL AND request_json IS NOT NULL)
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO knowledge_article_revisions (id, article_id, revision, snapshot_json, status, source, actor_account_id, reason, recorded_at, command_id, request_json)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       CASE WHEN source.article_id IS NULL THEN NULL ELSE COALESCE((SELECT ref.new_id FROM _knowledge_articles_id_map ref WHERE ref.old_id = source.article_id), CAST(source.article_id AS TEXT)) END,
       source.revision,
       source.snapshot_json,
       source.status,
       source.source,
       source.actor_account_id,
       source.reason,
       source.recorded_at,
       source.command_id,
       source.request_json
FROM "_stage_knowledge_article_revisions" source;
INSERT INTO _governance_knowledge_uuid_primary_key_validation
SELECT 'knowledge_article_revisions',
       (SELECT count(*) FROM "_stage_knowledge_article_revisions"),
       (SELECT count(*) FROM knowledge_article_revisions),
       0,
       (SELECT count(*) FROM knowledge_article_revisions WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       (SELECT count(*) FROM system_record_source_freezes WHERE owner_context = 'knowledge' AND revision = 1);
DROP TABLE "_stage_knowledge_article_revisions";
CREATE TRIGGER knowledge_article_revision_no_delete
BEFORE DELETE ON knowledge_article_revisions
BEGIN
  SELECT RAISE(ABORT, 'knowledge_revision_immutable');
END;
CREATE TRIGGER knowledge_article_revision_no_update
BEFORE UPDATE ON knowledge_article_revisions
BEGIN
  SELECT RAISE(ABORT, 'knowledge_revision_immutable');
END;
CREATE TRIGGER knowledge_article_revisions_source_freeze_insert
BEFORE INSERT ON knowledge_article_revisions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'knowledge' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'knowledge_record_source_frozen');
END;
CREATE TRIGGER knowledge_article_revisions_identity_update
BEFORE UPDATE OF id ON knowledge_article_revisions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

INSERT INTO _governance_knowledge_uuid_primary_key_validation
SELECT 'governance_documents.current_version_id', orphan_count, (SELECT count(*) FROM governance_documents child WHERE child.current_version_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM governance_document_versions parent WHERE parent.id = child.current_version_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'governance_documents.current_version_id';
INSERT INTO _governance_knowledge_uuid_primary_key_validation
SELECT 'governance_document_versions.document_id', orphan_count, (SELECT count(*) FROM governance_document_versions child WHERE child.document_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM governance_documents parent WHERE parent.id = child.document_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'governance_document_versions.document_id';
INSERT INTO _governance_knowledge_uuid_primary_key_validation
SELECT 'governance_acknowledgements.version_id', orphan_count, (SELECT count(*) FROM governance_acknowledgements child WHERE child.version_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM governance_document_versions parent WHERE parent.id = child.version_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'governance_acknowledgements.version_id';
INSERT INTO _governance_knowledge_uuid_primary_key_validation
SELECT 'governance_document_references.version_id', orphan_count, (SELECT count(*) FROM governance_document_references child WHERE child.version_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM governance_document_versions parent WHERE parent.id = child.version_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'governance_document_references.version_id';
INSERT INTO _governance_knowledge_uuid_primary_key_validation
SELECT 'governance_publication_approvals.version_id', orphan_count, (SELECT count(*) FROM governance_publication_approvals child WHERE child.version_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM governance_document_versions parent WHERE parent.id = child.version_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'governance_publication_approvals.version_id';
INSERT INTO _governance_knowledge_uuid_primary_key_validation
SELECT 'knowledge_article_revisions.article_id', orphan_count, (SELECT count(*) FROM knowledge_article_revisions child WHERE child.article_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM knowledge_articles parent WHERE parent.id = child.article_id)), 0, 0, 0
FROM _uuid_reference_orphans WHERE resource = 'knowledge_article_revisions.article_id';
DROP TABLE _uuid_reference_orphans;
DROP TABLE _governance_org_role_assignments_id_map;
DROP TABLE _governance_documents_id_map;
DROP TABLE _governance_document_versions_id_map;
DROP TABLE _knowledge_articles_id_map;
DROP TABLE _governance_knowledge_uuid_primary_key_validation;
