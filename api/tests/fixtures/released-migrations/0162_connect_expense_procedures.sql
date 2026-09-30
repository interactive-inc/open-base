CREATE TABLE expense_procedure_bindings (
  previous_expense_id INTEGER REFERENCES expenses(id) ON DELETE RESTRICT,
  request_key TEXT PRIMARY KEY NOT NULL CHECK (length(request_key) BETWEEN 1 AND 255),
  expense_id INTEGER NOT NULL UNIQUE REFERENCES expenses(id) ON DELETE RESTRICT,
  application_id INTEGER NOT NULL UNIQUE REFERENCES system_proposal_numbers(number) ON DELETE RESTRICT,
  series_id TEXT NOT NULL UNIQUE REFERENCES system_proposal_series(id) ON DELETE RESTRICT,
  case_id TEXT NOT NULL UNIQUE REFERENCES system_cases(id) ON DELETE RESTRICT,
  proposal_digest TEXT NOT NULL CHECK (length(proposal_digest) = 64),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  attachment_evidence_json TEXT NOT NULL CHECK (json_valid(attachment_evidence_json) AND json_type(attachment_evidence_json) = 'array' AND json_array_length(attachment_evidence_json) <= 10)
);

CREATE UNIQUE INDEX expense_resubmission_once ON expense_procedure_bindings(previous_expense_id) WHERE previous_expense_id IS NOT NULL;

CREATE TRIGGER expense_procedure_binding_matches_proposal
BEFORE INSERT ON expense_procedure_bindings
WHEN NOT EXISTS (
  SELECT 1 FROM expenses request
  JOIN system_proposal_numbers number ON number.number = NEW.application_id AND number.series_id = NEW.series_id
  JOIN system_proposals proposal ON proposal.series_id = NEW.series_id AND proposal.version = 1
  JOIN system_proposal_cases association ON association.proposal_id = proposal.id AND association.case_id = NEW.case_id
  JOIN system_cases workflow_case ON workflow_case.id = NEW.case_id
  JOIN system_procedure_definition_revisions definition
    ON definition.procedure_key = proposal.procedure_key AND definition.revision = proposal.procedure_revision
  WHERE request.id = NEW.expense_id AND request.status = 'pending'
    AND proposal.digest = NEW.proposal_digest AND proposal.created_at = NEW.created_at
    AND request.created_at <= strftime('%Y-%m-%dT%H:%M:%fZ', proposal.created_at / 1000.0, 'unixepoch')
    AND definition.completion_operation_key = 'expense.request.authorize'
    AND workflow_case.subject_context = 'expense' AND workflow_case.subject_kind = 'request'
    AND workflow_case.subject_id = NEW.request_key AND workflow_case.subject_version = '1'
    AND workflow_case.status = 'pending'
    AND json_extract(proposal.body_json, '$.employeeId') IS request.employee_id
    AND json_extract(proposal.body_json, '$.organizationUnitId') IS request.organization_unit_id
    AND json_extract(proposal.body_json, '$.category') IS request.category
    AND json_extract(proposal.body_json, '$.amount') IS request.amount
    AND json_extract(proposal.body_json, '$.spentAt') IS request.spent_at
    AND json_extract(proposal.body_json, '$.note') IS request.note
    AND json_extract(proposal.body_json, '$.attachments') IS json(NEW.attachment_evidence_json)
    AND json_array_length(NEW.attachment_evidence_json) = (
      SELECT count(DISTINCT json_extract(value, '$.id')) FROM json_each(NEW.attachment_evidence_json)
    )
    AND NOT EXISTS (
      SELECT 1 FROM json_each(NEW.attachment_evidence_json) evidence
      WHERE NOT EXISTS (
        SELECT 1 FROM system_attachments attachment
        WHERE attachment.id = json_extract(evidence.value, '$.id')
          AND attachment.owner_account_id = proposal.created_by_account_id
          AND attachment.status = 'linked' AND attachment.erased_at IS NULL
          AND attachment.plaintext_sha256 = json_extract(evidence.value, '$.sha256')
          AND attachment.file_name = json_extract(evidence.value, '$.fileName')
          AND attachment.content_type = json_extract(evidence.value, '$.contentType')
          AND attachment.byte_size = json_extract(evidence.value, '$.byteSize')
      )
    )
    AND (NEW.previous_expense_id IS NULL OR EXISTS (
      SELECT 1 FROM expense_procedure_bindings previous
      JOIN expenses original ON original.id = previous.expense_id
      JOIN system_cases previous_case ON previous_case.id = previous.case_id
      WHERE previous.expense_id = NEW.previous_expense_id AND previous.expense_id <> NEW.expense_id
        AND original.employee_id = request.employee_id AND previous_case.status = 'returned'
        AND previous_case.created_by_account_id = proposal.created_by_account_id
        AND previous_case.updated_at <= NEW.created_at
    ))
)
BEGIN
  SELECT RAISE(ABORT, 'expense_procedure_proposal_mismatch');
END;

CREATE TRIGGER expense_procedure_binding_immutable_update
BEFORE UPDATE ON expense_procedure_bindings
BEGIN
  SELECT RAISE(ABORT, 'expense_procedure_binding_immutable');
END;

CREATE TRIGGER expense_procedure_binding_immutable_delete
BEFORE DELETE ON expense_procedure_bindings
BEGIN
  SELECT RAISE(ABORT, 'expense_procedure_binding_immutable');
END;

CREATE TRIGGER expense_procedure_request_immutable
BEFORE UPDATE ON expenses
WHEN EXISTS (SELECT 1 FROM expense_procedure_bindings WHERE expense_id = OLD.id)
 AND (NEW.id IS NOT OLD.id OR NEW.employee_id IS NOT OLD.employee_id
   OR NEW.organization_unit_id IS NOT OLD.organization_unit_id OR NEW.category IS NOT OLD.category
   OR NEW.amount IS NOT OLD.amount OR NEW.spent_at IS NOT OLD.spent_at OR NEW.note IS NOT OLD.note
   OR NEW.created_at IS NOT OLD.created_at OR OLD.status <> 'pending'
   OR NEW.status NOT IN ('approved', 'rejected'))
BEGIN
  SELECT RAISE(ABORT, 'expense_procedure_request_immutable');
END;

CREATE TRIGGER expense_procedure_request_requires_execution
BEFORE UPDATE ON expenses
WHEN EXISTS (SELECT 1 FROM expense_procedure_bindings WHERE expense_id = OLD.id)
 AND NOT EXISTS (
   SELECT 1 FROM expense_procedure_bindings binding
   JOIN system_cases workflow_case ON workflow_case.id = binding.case_id
   WHERE binding.expense_id = OLD.id
     AND ((NEW.status = 'rejected' AND workflow_case.status = 'rejected')
       OR (NEW.status = 'approved' AND workflow_case.status = 'approved' AND EXISTS (
         SELECT 1 FROM system_execution_authorizations authorization
         WHERE authorization.case_id = binding.case_id
           AND authorization.operation_key = 'expense.request.authorize'
           AND authorization.proposal_digest = binding.proposal_digest
           AND authorization.used_at IS NULL
           AND authorization.granted_at >= binding.created_at
       )))
 )
BEGIN
  SELECT RAISE(ABORT, 'expense_procedure_execution_required');
END;

CREATE TRIGGER expense_procedure_attachment_matches_snapshot
BEFORE INSERT ON expense_attachments
WHEN EXISTS (SELECT 1 FROM expense_procedure_bindings WHERE expense_id = NEW.expense_id)
 AND NOT EXISTS (
   SELECT 1 FROM expense_procedure_bindings binding, json_each(binding.attachment_evidence_json) evidence
   WHERE binding.expense_id = NEW.expense_id AND json_extract(evidence.value, '$.id') = NEW.attachment_id
 )
BEGIN
  SELECT RAISE(ABORT, 'expense_procedure_attachment_mismatch');
END;

CREATE TRIGGER expense_procedure_attachment_immutable_update
BEFORE UPDATE ON expense_attachments
WHEN EXISTS (SELECT 1 FROM expense_procedure_bindings WHERE expense_id IN (OLD.expense_id, NEW.expense_id))
BEGIN
  SELECT RAISE(ABORT, 'expense_procedure_attachment_immutable');
END;

CREATE TRIGGER expense_procedure_attachment_immutable_delete
BEFORE DELETE ON expense_attachments
WHEN EXISTS (SELECT 1 FROM expense_procedure_bindings WHERE expense_id = OLD.expense_id)
BEGIN
  SELECT RAISE(ABORT, 'expense_procedure_attachment_immutable');
END;
