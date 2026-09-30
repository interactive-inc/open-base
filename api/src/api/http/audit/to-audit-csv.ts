import type { AuditEventDetail } from "@/contexts/company/domain/definitions/company-audit-event.definition"
import { PayloadTooLargeError } from "@/lib/errors"
import {
  AUDIT_CSV_HEADER,
  AUDIT_CSV_MAX_BYTES,
  toAuditCsvRow,
} from "@/contexts/company/domain/definitions/to-audit-csv-row.definition"

const UTF8_ENCODER = new TextEncoder()

/** Renders an RFC 4180 audit export with a fixed header and a fail-closed UTF-8 byte cap. */
export function toAuditCsv(rows: ReadonlyArray<AuditEventDetail>): string {
  const chunks = [AUDIT_CSV_HEADER]
  let byteLength = UTF8_ENCODER.encode(AUDIT_CSV_HEADER).byteLength

  for (const row of rows) {
    const encoded = toAuditCsvRow(row)
    byteLength += UTF8_ENCODER.encode(encoded).byteLength
    if (byteLength > AUDIT_CSV_MAX_BYTES) {
      throw new PayloadTooLargeError("audit export is too large", "audit_export_too_large")
    }
    chunks.push(encoded)
  }

  return chunks.join("")
}
