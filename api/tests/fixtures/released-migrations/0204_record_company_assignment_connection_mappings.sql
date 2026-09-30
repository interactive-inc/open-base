ALTER TABLE company_assignment_resource_adoptions
ADD COLUMN mappings_json TEXT CHECK (mappings_json IS NULL OR (json_valid(mappings_json) AND json_type(mappings_json) = 'array'));
