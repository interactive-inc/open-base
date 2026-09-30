-- 社内公募の募集部署を Company の組織単位へ参照させる。
-- 旧 dept_id はどの組織単位も指さない数値のため、既存行の dept_id と dept_name は
-- 消さずに旧記録として残し、organization_unit_id は NULL（部署未設定）から始める。
ALTER TABLE career_postings ADD COLUMN organization_unit_id TEXT REFERENCES company_organization_units(id) ON DELETE RESTRICT;
CREATE INDEX idx_career_postings_organization_unit ON career_postings (organization_unit_id);
