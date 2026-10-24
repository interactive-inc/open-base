-- Old revisions have no verified correction relation; do not infer one.
ALTER TABLE company_resource_revisions
  ADD COLUMN corrects_revision INTEGER
  CHECK (corrects_revision IS NULL OR (corrects_revision >= 1 AND corrects_revision < revision));
