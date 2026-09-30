CREATE TRIGGER leave_request_decision_requires_procedure
BEFORE UPDATE OF status ON leave_requests
WHEN OLD.status = 'pending' AND NEW.status <> 'pending'
 AND NOT EXISTS (SELECT 1 FROM leave_procedure_bindings WHERE leave_request_id = OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'leave_procedure_required');
END;
