import type { AuditEventDetail } from "@/contexts/company/domain/definitions/company-audit-event.definition"
import { CompanyPayloadTooLargeError } from "@/contexts/company/domain/errors"
import {
  AUDIT_CSV_HEADER,
  AUDIT_CSV_MAX_BYTES,
  toAuditCsvRow,
} from "@/contexts/company/domain/definitions/to-audit-csv-row.definition"

const UTF8_ENCODER = new TextEncoder()

/** Incremental byte guard used by chunked repository export without retaining a second CSV copy. */
export class AuditCsvByteCounter {
  private byteLength = UTF8_ENCODER.encode(AUDIT_CSV_HEADER).byteLength

  get remainingBytes(): number {
    return AUDIT_CSV_MAX_BYTES - this.byteLength
  }

  add(row: AuditEventDetail): void {
    this.byteLength += UTF8_ENCODER.encode(toAuditCsvRow(row)).byteLength
    if (this.byteLength > AUDIT_CSV_MAX_BYTES) {
      throw new CompanyPayloadTooLargeError("audit export is too large", "audit_export_too_large")
    }
  }
}
