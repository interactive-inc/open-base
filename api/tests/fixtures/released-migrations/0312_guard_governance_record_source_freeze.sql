-- Extend the existing governance freeze to every owned source table.
CREATE TRIGGER governance_acknowledgements_source_freeze_insert BEFORE INSERT ON governance_acknowledgements
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;

CREATE TRIGGER governance_acknowledgements_source_freeze_update BEFORE UPDATE ON governance_acknowledgements
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;

CREATE TRIGGER governance_acknowledgements_source_freeze_delete BEFORE DELETE ON governance_acknowledgements
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;

CREATE TRIGGER governance_capabilities_source_freeze_insert BEFORE INSERT ON governance_capabilities
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;

CREATE TRIGGER governance_capabilities_source_freeze_update BEFORE UPDATE ON governance_capabilities
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;

CREATE TRIGGER governance_capabilities_source_freeze_delete BEFORE DELETE ON governance_capabilities
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;

CREATE TRIGGER governance_document_references_source_freeze_insert BEFORE INSERT ON governance_document_references
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;

CREATE TRIGGER governance_document_references_source_freeze_update BEFORE UPDATE ON governance_document_references
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;

CREATE TRIGGER governance_document_references_source_freeze_delete BEFORE DELETE ON governance_document_references
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;

CREATE TRIGGER governance_document_versions_source_freeze_insert BEFORE INSERT ON governance_document_versions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;

CREATE TRIGGER governance_document_versions_source_freeze_update BEFORE UPDATE ON governance_document_versions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;

CREATE TRIGGER governance_document_versions_source_freeze_delete BEFORE DELETE ON governance_document_versions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;

CREATE TRIGGER governance_documents_source_freeze_insert BEFORE INSERT ON governance_documents
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;

CREATE TRIGGER governance_documents_source_freeze_update BEFORE UPDATE ON governance_documents
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;

CREATE TRIGGER governance_documents_source_freeze_delete BEFORE DELETE ON governance_documents
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;

CREATE TRIGGER governance_org_roles_source_freeze_insert BEFORE INSERT ON governance_org_roles
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;

CREATE TRIGGER governance_org_roles_source_freeze_update BEFORE UPDATE ON governance_org_roles
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;

CREATE TRIGGER governance_org_roles_source_freeze_delete BEFORE DELETE ON governance_org_roles
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;

CREATE TRIGGER governance_publication_approvals_source_freeze_insert BEFORE INSERT ON governance_publication_approvals
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;

CREATE TRIGGER governance_publication_approvals_source_freeze_update BEFORE UPDATE ON governance_publication_approvals
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;

CREATE TRIGGER governance_publication_approvals_source_freeze_delete BEFORE DELETE ON governance_publication_approvals
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'governance' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'governance_record_source_frozen'); END;
