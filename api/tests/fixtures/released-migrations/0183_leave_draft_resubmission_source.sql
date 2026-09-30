ALTER TABLE leave_requests ADD COLUMN previous_leave_request_id INTEGER
  REFERENCES leave_requests(id) ON DELETE RESTRICT;

CREATE TRIGGER leave_draft_source_valid
BEFORE INSERT ON leave_requests
WHEN NEW.previous_leave_request_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM leave_requests original
  JOIN leave_procedure_bindings binding ON binding.leave_request_id = original.id
  JOIN system_cases workflow_case ON workflow_case.id = binding.case_id
  WHERE original.id = NEW.previous_leave_request_id
    AND original.employee_id = NEW.employee_id AND workflow_case.status = 'returned'
    AND NOT EXISTS (SELECT 1 FROM leave_procedure_bindings next WHERE next.previous_leave_request_id = original.id)
)
BEGIN
  SELECT RAISE(ABORT, 'leave_draft_source_invalid');
END;

CREATE TRIGGER leave_draft_source_immutable
BEFORE UPDATE OF previous_leave_request_id ON leave_requests
WHEN NEW.previous_leave_request_id IS NOT OLD.previous_leave_request_id
BEGIN
  SELECT RAISE(ABORT, 'leave_draft_source_immutable');
END;

CREATE TRIGGER leave_procedure_source_matches_draft
BEFORE INSERT ON leave_procedure_bindings
WHEN NOT EXISTS (
  SELECT 1 FROM leave_requests request WHERE request.id = NEW.leave_request_id
    AND request.previous_leave_request_id IS NEW.previous_leave_request_id
)
BEGIN
  SELECT RAISE(ABORT, 'leave_procedure_source_mismatch');
END;
