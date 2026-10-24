DROP TRIGGER IF EXISTS knowledge_articles_source_freeze_insert;
CREATE TRIGGER knowledge_articles_source_freeze_insert
BEFORE INSERT ON knowledge_articles
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'knowledge' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'knowledge_record_source_frozen');
END;

DROP TRIGGER IF EXISTS knowledge_articles_source_freeze_update;
CREATE TRIGGER knowledge_articles_source_freeze_update
BEFORE UPDATE ON knowledge_articles
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'knowledge' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'knowledge_record_source_frozen');
END;

DROP TRIGGER IF EXISTS knowledge_articles_source_freeze_delete;
CREATE TRIGGER knowledge_articles_source_freeze_delete
BEFORE DELETE ON knowledge_articles
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'knowledge' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'knowledge_record_source_frozen');
END;

DROP TRIGGER IF EXISTS knowledge_article_revisions_source_freeze_insert;
CREATE TRIGGER knowledge_article_revisions_source_freeze_insert
BEFORE INSERT ON knowledge_article_revisions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'knowledge' AND revision = 1)
BEGIN
  SELECT RAISE(ABORT, 'knowledge_record_source_frozen');
END;
