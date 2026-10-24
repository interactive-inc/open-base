import { NotFoundError } from "@/lib/errors"

/** The canonical audit not-found error that never reflects the requested identifier. */
export function auditEventNotFound(): NotFoundError {
  return new NotFoundError("audit event was not found", "audit_event_not_found")
}
