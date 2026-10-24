import { createCompanySystemAuditEvent as createAuditEvent } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/lib/create-company-system-audit-event"

/** 会社の変更を System の監査 event として記録する値を作る公開境界。 */
export function createCompanySystemAuditEvent(
  ...input: Parameters<typeof createAuditEvent>
): ReturnType<typeof createAuditEvent> {
  return createAuditEvent(...input)
}
