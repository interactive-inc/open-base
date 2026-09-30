ALTER TABLE knowledge_articles ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1);
ALTER TABLE knowledge_articles ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'withdrawn'));

CREATE TABLE knowledge_article_revisions (
  article_id INTEGER NOT NULL REFERENCES knowledge_articles(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  status TEXT NOT NULL CHECK (status IN ('active', 'withdrawn')),
  source TEXT NOT NULL CHECK (source IN ('existing_record', 'actor')),
  actor_account_id TEXT REFERENCES system_accounts(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 2000),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  command_id TEXT,
  request_json TEXT CHECK (request_json IS NULL OR json_valid(request_json)),
  PRIMARY KEY (article_id, revision),
  UNIQUE (actor_account_id, command_id),
  CHECK (
    (source = 'existing_record' AND actor_account_id IS NULL AND command_id IS NULL AND request_json IS NULL)
    OR (source = 'actor' AND actor_account_id IS NOT NULL AND command_id IS NOT NULL AND request_json IS NOT NULL)
  )
);

INSERT INTO knowledge_article_revisions
  (article_id, revision, snapshot_json, status, source, actor_account_id, reason, recorded_at, command_id, request_json)
SELECT id, 1, json_object('id', id, 'revision', 1, 'status', 'active', 'title', title, 'category', category, 'tags', tags,
    'bodyMd', body_md, 'authorId', author_id, 'createdAt', created_at),
  'active', 'existing_record', NULL, '既存記事の保存時点の本文。過去の編集者と改訂時刻は不明。',
  CAST(strftime('%s', 'now') AS INTEGER) * 1000, NULL, NULL
FROM knowledge_articles;

CREATE TRIGGER knowledge_article_revision_no_update
BEFORE UPDATE ON knowledge_article_revisions
BEGIN
  SELECT RAISE(ABORT, 'knowledge_revision_immutable');
END;

CREATE TRIGGER knowledge_article_revision_no_delete
BEFORE DELETE ON knowledge_article_revisions
BEGIN
  SELECT RAISE(ABORT, 'knowledge_revision_immutable');
END;

CREATE TRIGGER knowledge_article_no_delete
BEFORE DELETE ON knowledge_articles
BEGIN
  SELECT RAISE(ABORT, 'knowledge_article_withdrawal_required');
END;
