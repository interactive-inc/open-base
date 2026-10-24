import { auditOutcomeSchema } from "@/contexts/company/domain/definitions/company-audit-record.definition"
import type { CompanyAuditEventFilters as AuditEventFilters } from "@/contexts/company/interface/operations/open-company-audit-events"
import { parseExactSecond } from "@/api/http/audit/parse-exact-second"
import { ValidationError } from "@/lib/errors"
import { z } from "zod"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"

type Props = { filters: AuditEventFilters }

const EXPORT_BODY_MAX_BYTES = 16_384
const EXPORT_MAX_RANGE_SECONDS = 2_678_400

const exportRangeSchema = z.strictObject({
  actor_account_id: zAccountId.optional(),
  action: z.string().min(1).max(200).optional(),
  target_type: z.string().min(1).max(200).optional(),
  target_id: z.string().max(512).optional(),
  outcome: auditOutcomeSchema.optional(),
  from: z.string(),
  to: z.string(),
})

function invalidExportRange(cause?: unknown): ValidationError {
  return new ValidationError("audit export range is invalid", "audit_invalid_export_range", {
    cause,
  })
}

async function readBoundedExportJson(request: Request): Promise<unknown> {
  try {
    const reader = request.body?.getReader()
    if (reader === undefined) throw new Error("audit export body is missing")
    const chunks: Uint8Array[] = []
    let byteLength = 0

    while (true) {
      const part = await reader.read()
      if (part.done) break
      byteLength += part.value.byteLength
      if (byteLength > EXPORT_BODY_MAX_BYTES) {
        await reader.cancel().catch(() => undefined)
        throw new Error("audit export body is too large")
      }
      chunks.push(part.value)
    }

    const body = new Uint8Array(byteLength)
    let offset = 0
    for (const chunk of chunks) {
      body.set(chunk, offset)
      offset += chunk.byteLength
    }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(body)
    return JSON.parse(text)
  } catch (error) {
    throw invalidExportRange(error)
  }
}

/**
 * 監査エクスポートの厳格な JSON フィルタ。exact-second かつ half-open な 31 日範囲を強制する
 */
export class AuditExportRange {
  constructor(private readonly props: Props) {
    Object.freeze(this)
  }

  get filters(): AuditEventFilters {
    return this.props.filters
  }

  /** Parses the strict JSON filter and enforces the exact-second, half-open 31-day range. */
  static parse(input: unknown): AuditExportRange {
    try {
      const parsed = exportRangeSchema.parse(input)
      const fromEpoch = parseExactSecond(parsed.from)
      const toEpoch = parseExactSecond(parsed.to)
      if (fromEpoch >= toEpoch || toEpoch - fromEpoch > EXPORT_MAX_RANGE_SECONDS) {
        throw new Error("audit export range is empty, reversed, or too wide")
      }

      const filters: AuditEventFilters = { fromEpoch, toEpoch }
      if (parsed.actor_account_id !== undefined) filters.actorAccountId = parsed.actor_account_id
      if (parsed.action !== undefined) filters.action = parsed.action
      if (parsed.target_type !== undefined) filters.targetType = parsed.target_type
      if (parsed.target_id !== undefined) filters.targetId = parsed.target_id
      if (parsed.outcome !== undefined) filters.outcome = parsed.outcome
      return new AuditExportRange({ filters })
    } catch (error) {
      throw invalidExportRange(error)
    }
  }

  /** Reads and buffers no more than the route-local 16 KiB JSON body budget, then parses it. */
  static async fromRequest(request: Request): Promise<AuditExportRange> {
    const body = await readBoundedExportJson(request)
    return AuditExportRange.parse(body)
  }
}
