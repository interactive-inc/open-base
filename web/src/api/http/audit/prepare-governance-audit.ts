import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { AuditJsonValue } from "@/contexts/company/domain/definitions/company-audit-record.definition"
import type {
  AuditAction,
  AuditTargetType,
} from "@/contexts/company/domain/definitions/company-audit-event.definition"
import type { Context } from "@/env"
import { prepareGovernanceAuditRecord } from "@/api/http/audit/prepare-governance-audit-record"

export function prepareGovernanceAudit(props: {
  c: Context
  session: CompanySessionValue
  action: AuditAction
  targetType: AuditTargetType
  targetId: string
  metadata?: AuditJsonValue
}): readonly [D1PreparedStatement, D1PreparedStatement] {
  return prepareGovernanceAuditRecord(props).statements
}
