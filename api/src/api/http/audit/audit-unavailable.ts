import { UnavailableError } from "@/lib/errors"

/** Wraps any audit failure as the fail-closed unavailable error without leaking the cause. */
export function auditUnavailable(cause?: unknown): UnavailableError {
  return new UnavailableError("audit events are unavailable", "audit_unavailable", { cause })
}
