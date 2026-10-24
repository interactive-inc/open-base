import { auditOutcomeSchema } from "@/contexts/company/domain/definitions/company-audit-record.definition"
import type { CompanyAuditEventFilters as AuditEventFilters } from "@/contexts/company/interface/operations/open-company-audit-events"
import { parseExactSecond } from "@/api/http/audit/parse-exact-second"
import { AuditCursor } from "@/contexts/company/domain/definitions/audit-cursor.definition"
import { ValidationError } from "@/lib/errors"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"

type Props = {
  limit: number
  cursor: string | null
  filters: AuditEventFilters
}

const LIMIT_PATTERN = /^(?:[1-9]|[1-9][0-9]|100)$/u
const LIST_QUERY_KEYS = new Set([
  "actor_account_id",
  "action",
  "target_type",
  "target_id",
  "outcome",
  "from",
  "to",
  "limit",
  "cursor",
])

function invalidQuery(cause?: unknown): ValidationError {
  return new ValidationError("audit query is invalid", "audit_invalid_query", { cause })
}

function optionalBoundedString(
  values: ReadonlyMap<string, string>,
  key: string,
  maximum: number,
  allowEmpty: boolean,
): string | undefined {
  const value = values.get(key)
  if (value === undefined) return undefined
  if ((!allowEmpty && value.length === 0) || value.length > maximum) {
    throw new Error(`${key} is outside its length bound`)
  }
  return value
}

/**
 * 監査一覧の厳格な URL クエリ。重複・未知キー・非正準値を弾いた正準表現を保持する
 */
export class AuditListQuery {
  constructor(private readonly props: Props) {
    Object.freeze(this)
  }

  get limit(): number {
    return this.props.limit
  }

  get cursor(): string | null {
    return this.props.cursor
  }

  get filters(): AuditEventFilters {
    return this.props.filters
  }

  /** Parses one strict list URL without collapsing duplicate or decoded query names. */
  static parse(input: string): AuditListQuery {
    try {
      const url = new URL(input)
      const values = new Map<string, string>()
      for (const [key, value] of url.searchParams) {
        if (!LIST_QUERY_KEYS.has(key) || values.has(key)) {
          throw new Error("audit query contains an unknown or repeated key")
        }
        values.set(key, value)
      }

      const filters: AuditEventFilters = {}
      const actorAccountId = values.get("actor_account_id")
      if (actorAccountId !== undefined) {
        filters.actorAccountId = zAccountId.parse(actorAccountId)
      }
      const action = optionalBoundedString(values, "action", 200, false)
      if (action !== undefined) filters.action = action
      const targetType = optionalBoundedString(values, "target_type", 200, false)
      if (targetType !== undefined) filters.targetType = targetType
      const targetId = optionalBoundedString(values, "target_id", 512, true)
      if (targetId !== undefined) filters.targetId = targetId
      const outcome = values.get("outcome")
      if (outcome !== undefined) filters.outcome = auditOutcomeSchema.parse(outcome)
      const from = values.get("from")
      if (from !== undefined) filters.fromEpoch = parseExactSecond(from)
      const to = values.get("to")
      if (to !== undefined) filters.toEpoch = parseExactSecond(to)
      if (
        filters.fromEpoch !== undefined &&
        filters.toEpoch !== undefined &&
        filters.fromEpoch >= filters.toEpoch
      ) {
        throw new Error("audit range is empty or reversed")
      }

      const rawLimit = values.get("limit")
      if (rawLimit !== undefined && !LIMIT_PATTERN.test(rawLimit)) {
        throw new Error("audit limit is not canonical")
      }
      const limit = rawLimit === undefined ? 50 : Number(rawLimit)
      const cursor = values.get("cursor")
      if (cursor !== undefined && cursor.length > AuditCursor.MAX_LENGTH) {
        throw new Error("audit cursor is outside its length bound")
      }

      return new AuditListQuery({ limit, cursor: cursor ?? null, filters })
    } catch (error) {
      throw invalidQuery(error)
    }
  }
}
