-- Existing revisions have no verified source reference. Keep that absence explicit.
ALTER TABLE company_resource_revisions
  ADD COLUMN evidence_references_json TEXT NOT NULL DEFAULT '[]'
  CHECK (json_valid(evidence_references_json) AND json_type(evidence_references_json) = 'array');
