import type { AuditEventDetail } from "@/contexts/company/domain/definitions/company-audit-event.definition"

export const AUDIT_CSV_MAX_BYTES = 16 * 1024 * 1024

const COLUMNS = [
  "event_id",
  "request_id",
  "actor_account_id",
  "actor_employee_id",
  "action",
  "target_type",
  "target_id",
  "outcome",
  "reason_code",
  "authorization_json",
  "before_json",
  "after_json",
  "metadata_json",
  "client_ip",
  "client_name",
  "created_at",
] as const

export const AUDIT_CSV_HEADER = `${COLUMNS.join(",")}\r\n`

const FORMULA_PREFIX = /^[ \t\r\n]*[=+\-@]/u
const NEEDS_RFC4180_QUOTES = /[",\r\n]/u

function encodeField(value: string | number | null): string {
  let text = value === null ? "" : String(value)
  if (FORMULA_PREFIX.test(text)) text = `'${text}`

  if (NEEDS_RFC4180_QUOTES.test(text)) {
    return `"${text.replaceAll('"', '""')}"`
  }

  return text
}

/** Encodes one audit detail as an RFC 4180 CSV record with a formula-injection guard. */
export function toAuditCsvRow(row: AuditEventDetail): string {
  const fields: ReadonlyArray<string | number | null> = [
    row.eventId,
    row.requestId,
    row.actorAccountId,
    row.actorEmployeeId,
    row.action,
    row.targetType,
    row.targetId,
    row.outcome,
    row.reasonCode,
    row.authorizationJson,
    row.beforeJson,
    row.afterJson,
    row.metadataJson,
    row.clientIp,
    row.clientName,
    new Date(row.createdAt * 1_000).toISOString(),
  ]

  return `${fields.map(encodeField).join(",")}\r\n`
}
