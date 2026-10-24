import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import type {
  AuditEventDetail,
  AuditEventRecord,
  AuditEventSummary,
} from "@/contexts/company/domain/definitions/company-audit-event.definition"
import {
  auditClientNameSchema,
  auditOutcomeSchema,
} from "@/contexts/company/domain/definitions/company-audit-record.definition"
import type { AuditOutcome } from "@/contexts/company/domain/definitions/company-audit-record.definition"
import { AuditCursor } from "@/contexts/company/domain/definitions/audit-cursor.definition"
import type {
  AuditCursorAnchor,
  AuditCursorPosition,
} from "@/contexts/company/domain/definitions/audit-cursor.definition"
import { AuditCsvByteCounter } from "@/contexts/company/domain/definitions/audit-csv-byte-counter.definition"
import { AUDIT_CSV_MAX_BYTES } from "@/contexts/company/domain/definitions/to-audit-csv-row.definition"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"
import {
  CompanyPayloadTooLargeError,
  CompanyUnavailableError,
  CompanyValidationError,
} from "@/contexts/company/domain/errors"
import { z } from "zod"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"

/**
 * 監査イベントの読取り元。公開する識別子は event_id であり、主キーの id は UUID である。
 * 一覧の keyset と snapshot には追記順を表す整数が要るため、追記専用で削除も更新もしない
 * company_audit_events の rowid を内部の id として使う。rowid は外へ出さない。
 */
const AUDIT_EVENT_RELATION = `SELECT event.rowid AS id, event.event_id, event.request_id,
  event.actor_account_id, employee_context.employee_id AS actor_employee_id, event.action,
  event.target_type, event.target_id, event.outcome, event.reason_code, event.authorization_json,
  event.before_json, event.after_json, event.metadata_json, event.client_ip, event.client_name,
  event.created_at
FROM company_audit_events event
LEFT JOIN company_audit_event_employee_contexts employee_context
  ON employee_context.audit_event_id = event.id`
const AUDIT_EVENT_SOURCE = `(${AUDIT_EVENT_RELATION}) company_audit_event_details`

const SEARCH_MAX_LIMIT = 100
const SEARCH_SUMMARY_WIRE_BUDGET_BYTES = 4 * 1024 * 1024
const EXPORT_MAX_ROWS = 50_000
const EXPORT_CHUNK_SIZE = 5_000
const EXPORT_DETAIL_WIRE_CHUNK_BYTES = 4 * 1024 * 1024
const D1_MAX_HEX_SOURCE_BYTES = 999_000
const D1_MAX_RESULT_VALUE_BYTES = 2_000_000
const D1_SEGMENT_QUERY_SOURCE_BYTES = D1_MAX_HEX_SOURCE_BYTES * 2
const EXPORT_MAX_SEGMENT_QUERIES = Math.ceil(AUDIT_CSV_MAX_BYTES / D1_SEGMENT_QUERY_SOURCE_BYTES)

export type AuditDecisionCase<TDecision extends string> = Readonly<{
  decision: TDecision
  record: AuditEventRecord
}>

export type AuditDecisionAppendFragment<TDecision extends string> = Readonly<{
  decisionId: string
  decisions: readonly TDecision[]
  statements: readonly [D1PreparedStatement, ...D1PreparedStatement[]]
}>

const SUMMARY_TEXT_COLUMNS = [
  "event_id",
  "request_id",
  "action",
  "target_type",
  "target_id",
  "outcome",
  "reason_code",
  "client_name",
] as const

function byteProjectionFixedBytes(columns: ReadonlyArray<string>): number {
  const properties = [
    "id",
    "actor_account_id",
    "actor_employee_id",
    "created_at",
    ...columns.flatMap((column) => [`${column}_type`, `${column}_value`]),
  ]
  const objectBytes =
    2 +
    Math.max(0, properties.length - 1) +
    properties.reduce((total, property) => total + property.length + 3, 0)
  // typeof values serialize as six-byte JSON strings; nullable byte values need up to four bytes.
  const textValueBytes = columns.length * (6 + 4)
  // Array framing and a transport margin keep the SQL estimate conservative.
  return objectBytes + textValueBytes + 64
}

const SUMMARY_ROW_WIRE_FIXED_BYTES = byteProjectionFixedBytes(SUMMARY_TEXT_COLUMNS)

const SUMMARY_TEXT_RAW_BYTES_SQL = SUMMARY_TEXT_COLUMNS.map(
  (column) => `CASE WHEN ${column} IS NULL THEN 0 ELSE length(CAST(${column} AS BLOB)) END`,
).join(" +\n  ")

const SUMMARY_MAX_TEXT_BYTES_SQL = `max(${SUMMARY_TEXT_COLUMNS.map(
  (column) => `CASE WHEN ${column} IS NULL THEN 0 ELSE length(CAST(${column} AS BLOB)) END`,
).join(", ")})`

const SUMMARY_STORAGE_OK_SQL = `
  typeof(id) = 'integer' AND
  ${SUMMARY_TEXT_COLUMNS.map(
    (column) => `(typeof(${column}) = 'text' OR typeof(${column}) = 'null')`,
  ).join(" AND\n  ")} AND
  (typeof(actor_account_id) = 'text' OR typeof(actor_account_id) = 'null') AND
  (typeof(actor_employee_id) = 'text' OR typeof(actor_employee_id) = 'null') AND
  typeof(created_at) = 'integer'
`

/**
 * Exact summary reads return uppercase hex strings, so twice the stored text bytes plus a
 * conservative fixed envelope is a byte-faithful upper bound without invoking json_quote.
 */
const SUMMARY_WIRE_BYTES_SQL = `
  ${SUMMARY_ROW_WIRE_FIXED_BYTES} + 2 * (${SUMMARY_TEXT_RAW_BYTES_SQL}) +
  length(CAST(id AS BLOB)) +
  CASE WHEN actor_account_id IS NULL THEN 4
       ELSE length(CAST(actor_account_id AS BLOB)) END +
  CASE WHEN actor_employee_id IS NULL THEN 4
       ELSE length(CAST(actor_employee_id AS BLOB)) END +
  length(CAST(created_at AS BLOB))
`

const DETAIL_TEXT_COLUMNS = [
  "event_id",
  "request_id",
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
] as const

const DETAIL_ROW_WIRE_FIXED_BYTES = byteProjectionFixedBytes(DETAIL_TEXT_COLUMNS)

type DetailTextColumn = (typeof DETAIL_TEXT_COLUMNS)[number]
type SummaryTextColumn = (typeof SUMMARY_TEXT_COLUMNS)[number]

const SUMMARY_DESCRIPTOR_LAYOUT_COLUMNS = [
  "actor_account_id",
  "actor_employee_id",
  ...SUMMARY_TEXT_COLUMNS.map(
    (column) =>
      `CASE WHEN ${column} IS NULL THEN NULL ` +
      `ELSE length(CAST(${column} AS BLOB)) END AS ${column}_bytes`,
  ),
  ...SUMMARY_TEXT_COLUMNS.map((column) => `typeof(${column}) AS ${column}_type`),
].join(", ")

const DETAIL_DESCRIPTOR_LAYOUT_COLUMNS = [
  "actor_account_id",
  "actor_employee_id",
  ...DETAIL_TEXT_COLUMNS.map(
    (column) =>
      `CASE WHEN ${column} IS NULL THEN NULL ` +
      `ELSE length(CAST(${column} AS BLOB)) END AS ${column}_bytes`,
  ),
  ...DETAIL_TEXT_COLUMNS.map((column) => `typeof(${column}) AS ${column}_type`),
].join(", ")

const DETAIL_TEXT_RAW_BYTES_SQL = DETAIL_TEXT_COLUMNS.map(
  (column) => `CASE WHEN ${column} IS NULL THEN 0 ELSE length(CAST(${column} AS BLOB)) END`,
).join(" +\n  ")

const DETAIL_MAX_TEXT_BYTES_SQL = `max(${DETAIL_TEXT_COLUMNS.map(
  (column) => `CASE WHEN ${column} IS NULL THEN 0 ELSE length(CAST(${column} AS BLOB)) END`,
).join(", ")})`

const DETAIL_STORAGE_OK_SQL = `
  typeof(id) = 'integer' AND
  ${DETAIL_TEXT_COLUMNS.map(
    (column) => `(typeof(${column}) = 'text' OR typeof(${column}) = 'null')`,
  ).join(" AND\n  ")} AND
  (typeof(actor_account_id) = 'text' OR typeof(actor_account_id) = 'null') AND
  (typeof(actor_employee_id) = 'text' OR typeof(actor_employee_id) = 'null') AND
  typeof(created_at) = 'integer'
`

const DETAIL_RAW_BYTES_SQL = `
  (${DETAIL_TEXT_RAW_BYTES_SQL}) +
  CASE WHEN actor_account_id IS NULL THEN 0
       ELSE length(CAST(actor_account_id AS BLOB)) END +
  CASE WHEN actor_employee_id IS NULL THEN 0
       ELSE length(CAST(actor_employee_id AS BLOB)) END +
  length(CAST(created_at AS BLOB))
`

/** Normal detail reads return hex, whose payload is exactly two ASCII bytes per stored text byte. */
const DETAIL_WIRE_BYTES_SQL = `
  ${DETAIL_ROW_WIRE_FIXED_BYTES} + 2 * (${DETAIL_TEXT_RAW_BYTES_SQL}) +
  length(CAST(id AS BLOB)) +
  CASE WHEN actor_account_id IS NULL THEN 4
       ELSE length(CAST(actor_account_id AS BLOB)) END +
  CASE WHEN actor_employee_id IS NULL THEN 4
       ELSE length(CAST(actor_employee_id AS BLOB)) END +
  length(CAST(created_at AS BLOB))
`

function compactLayoutLengthSql(column: DetailTextColumn): string {
  return (
    `CASE typeof(${column}) WHEN 'text' THEN length(CAST(${column} AS BLOB)) ` +
    `WHEN 'null' THEN -1 ELSE -2 END`
  )
}

const DETAIL_COMPACT_LAYOUT_COLUMNS = DETAIL_TEXT_COLUMNS.map(
  (column) => `${compactLayoutLengthSql(column)} AS ${column}_layout_bytes`,
).join(", ")

const DETAIL_COMPACT_TEXT_BYTES_SQL = DETAIL_TEXT_COLUMNS.map(
  (column) => `CASE WHEN ${column}_layout_bytes >= 0 THEN ${column}_layout_bytes ELSE 0 END`,
).join(" + ")

const DETAIL_COMPACT_MAX_TEXT_BYTES_SQL = `max(0, ${DETAIL_TEXT_COLUMNS.map(
  (column) => `${column}_layout_bytes`,
).join(", ")})`

const DETAIL_COMPACT_STORAGE_OK_SQL = `
  typeof(id) = 'integer' AND
  typeof(created_at) = 'integer' AND
  (typeof(actor_account_id) = 'text' OR typeof(actor_account_id) = 'null') AND
  (typeof(actor_employee_id) = 'text' OR typeof(actor_employee_id) = 'null') AND
  ${DETAIL_TEXT_COLUMNS.map((column) => `${column}_layout_bytes >= -1`).join(" AND\n  ")}
`

/**
 * One compact raw row has 32 positional fields. This expression counts JSON array framing,
 * decimal integers, length sentinels and a transport margin; exact HEX bytes are added below.
 */
const DETAIL_COMPACT_BASE_WIRE_BYTES_SQL = `
  ${2 + 31 + 4 + 1 + 64} +
  length(CAST(id AS BLOB)) +
  length(CAST(created_at AS BLOB)) +
  CASE WHEN actor_account_id IS NULL THEN 4
       ELSE length(CAST(actor_account_id AS BLOB)) END +
  CASE WHEN actor_employee_id IS NULL THEN 4
       ELSE length(CAST(actor_employee_id AS BLOB)) END +
  ${DETAIL_TEXT_COLUMNS.map((column) => `length(CAST(${column}_layout_bytes AS BLOB))`).join(
    " +\n  ",
  )}
`

const DETAIL_COMPACT_EXACT_VALUE_BYTES_SQL = DETAIL_TEXT_COLUMNS.map(
  (column) =>
    `CASE WHEN ${column}_layout_bytes < 0 THEN 4 ` + `ELSE 2 + 2 * ${column}_layout_bytes END`,
).join(" +\n  ")

const DETAIL_COMPACT_DESCRIPTOR_VALUE_BYTES = DETAIL_TEXT_COLUMNS.length * 4

const validIsoEpochSchema = z
  .number()
  .int()
  .safe()
  .refine((value) => Number.isFinite(new Date(value * 1_000).getTime()))

const actorAccountIdSchema = zAccountId.nullable()
const actorEmployeeIdSchema = zEmployeeId.nullable()

const auditSummaryDatabaseRowSchema = z.strictObject({
  id: z.number().int().safe(),
  event_id: z.string(),
  request_id: z.string(),
  actor_account_id: actorAccountIdSchema,
  actor_employee_id: actorEmployeeIdSchema,
  action: z.string(),
  target_type: z.string().nullable(),
  target_id: z.string().nullable(),
  outcome: auditOutcomeSchema,
  reason_code: z.string().nullable(),
  client_name: auditClientNameSchema,
  created_at: validIsoEpochSchema,
})

const auditDetailDatabaseRowSchema = auditSummaryDatabaseRowSchema.extend({
  authorization_json: z.string().nullable(),
  before_json: z.string().nullable(),
  after_json: z.string().nullable(),
  metadata_json: z.string().nullable(),
  client_ip: z.string().nullable(),
})

type AuditSummaryDatabaseRow = z.infer<typeof auditSummaryDatabaseRowSchema>
type AuditDetailDatabaseRow = z.infer<typeof auditDetailDatabaseRowSchema>

const auditSummaryDescriptorRowSchema = z.strictObject({
  id: z.number().int().safe(),
  created_at: validIsoEpochSchema,
  actor_account_id: actorAccountIdSchema,
  actor_employee_id: actorEmployeeIdSchema,
  wire_bytes: z.number().int().safe().nonnegative(),
  raw_bytes: z.number().int().safe().nonnegative(),
  max_text_bytes: z.number().int().safe().nonnegative(),
  storage_ok: z.number().int().min(0).max(1),
  snapshot_max_id: z.number().int().safe(),
  ...Object.fromEntries(
    SUMMARY_TEXT_COLUMNS.map((column) => [
      `${column}_bytes`,
      z.number().int().safe().nonnegative().nullable(),
    ]),
  ),
  ...Object.fromEntries(
    SUMMARY_TEXT_COLUMNS.map((column) => [`${column}_type`, z.enum(["text", "null"])]),
  ),
})

type AuditSummaryDescriptorRow = z.infer<typeof auditSummaryDescriptorRowSchema> &
  Record<`${SummaryTextColumn}_bytes`, number | null> &
  Record<`${SummaryTextColumn}_type`, "text" | "null">

const auditExportDescriptorRowSchema = z.strictObject({
  id: z.number().int().safe(),
  created_at: validIsoEpochSchema,
  actor_account_id: actorAccountIdSchema,
  actor_employee_id: actorEmployeeIdSchema,
  raw_bytes: z.number().int().safe().nonnegative(),
  wire_bytes: z.number().int().safe().nonnegative(),
  max_text_bytes: z.number().int().safe().nonnegative(),
  storage_ok: z.number().int().min(0).max(1),
  ...Object.fromEntries(
    DETAIL_TEXT_COLUMNS.map((column) => [
      `${column}_bytes`,
      z.number().int().safe().nonnegative().nullable(),
    ]),
  ),
  ...Object.fromEntries(
    DETAIL_TEXT_COLUMNS.map((column) => [`${column}_type`, z.enum(["text", "null"])]),
  ),
})

type AuditExportDescriptorRow = z.infer<typeof auditExportDescriptorRowSchema> &
  Record<`${DetailTextColumn}_bytes`, number | null> &
  Record<`${DetailTextColumn}_type`, "text" | "null">

type AuditExportReadDescriptor = {
  ordinal: number
  id: number
  createdAt: number
  actorAccountId: AccountId | null
  actorEmployeeId: EmployeeId | null
  byteLengths: ReadonlyArray<number | null>
  exactHex: ReadonlyArray<string | null> | null
  rawBytes: number
}

type AuditExportSegmentPlanItem = {
  planOrdinal: number
  descriptorOrdinal: number
  id: number
  createdAt: number
  actorAccountId: AccountId | null
  actorEmployeeId: EmployeeId | null
  columnIndex: number
  offset: number
  expectedBytes: number
  columnBytes: number
}

const UPPER_HEX = /^(?:[0-9A-F]{2})*$/u
const FATAL_UTF8_DECODER = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })

function textHexReadSelect(columns: ReadonlyArray<string>): string {
  return columns
    .flatMap((column) => [
      `typeof(${column}) AS ${column}_type`,
      `CASE WHEN ${column} IS NULL THEN NULL ` +
        `ELSE hex(CAST(${column} AS BLOB)) END AS ${column}_value`,
    ])
    .join(", ")
}

const SUMMARY_HEX_SELECT_COLUMNS = [
  "id",
  "actor_account_id",
  "actor_employee_id",
  "created_at",
  textHexReadSelect(SUMMARY_TEXT_COLUMNS),
].join(", ")

const DETAIL_HEX_SELECT_COLUMNS = [
  "id",
  "actor_account_id",
  "actor_employee_id",
  "created_at",
  textHexReadSelect(DETAIL_TEXT_COLUMNS),
].join(", ")

const auditFiltersSchema = z.strictObject({
  actorAccountId: zAccountId.optional(),
  action: z.string().optional(),
  targetType: z.string().optional(),
  targetId: z.string().optional(),
  outcome: auditOutcomeSchema.optional(),
  fromEpoch: z.number().int().safe().optional(),
  toEpoch: z.number().int().safe().optional(),
})

const auditSearchQuerySchema = z.strictObject({
  limit: z.number().int().min(1).max(SEARCH_MAX_LIMIT),
  cursor: z.string().nullable(),
  filters: auditFiltersSchema,
})

const auditExportQuerySchema = z.strictObject({ filters: auditFiltersSchema })

export type AuditEventFilters = {
  actorAccountId?: AccountId
  action?: string
  targetType?: string
  targetId?: string
  outcome?: AuditOutcome
  fromEpoch?: number
  toEpoch?: number
}

export type AuditEventSearchQuery = {
  limit: number
  cursor: string | null
  filters: AuditEventFilters
}

export type AuditEventExportQuery = { filters: AuditEventFilters }

export type AuditEventPage = {
  items: ReadonlyArray<AuditEventSummary>
  nextCursor: string | null
  previousCursor: string | null
}

type KeysetPosition = {
  direction: "next" | "previous"
  createdAt: number
  id: number
}

type PageRange = {
  first: AuditCursorAnchor
  last: AuditCursorAnchor
  hasPrevious: boolean
  hasNext: boolean
}

function unavailable(cause: unknown): CompanyUnavailableError {
  return new CompanyUnavailableError("audit events are unavailable", "audit_unavailable", { cause })
}

function exportTooLarge(): CompanyPayloadTooLargeError {
  return new CompanyPayloadTooLargeError("audit export is too large", "audit_export_too_large")
}

function invalidQuery(cause: unknown): CompanyValidationError {
  return new CompanyValidationError("audit query is invalid", "audit_invalid_query", { cause })
}

function invalidCursorBinding(cause?: unknown): CompanyValidationError {
  return new CompanyValidationError("audit cursor is invalid", "invalid_audit_cursor", { cause })
}

function parseQuery<T>(schema: z.ZodType<T>, value: unknown): T {
  try {
    const parsed = schema.safeParse(value)
    if (!parsed.success) throw invalidQuery(parsed.error)

    return parsed.data
  } catch (error) {
    if (error instanceof CompanyValidationError) throw error
    throw invalidQuery(error)
  }
}

function parseSummaryRows(results: ReadonlyArray<unknown>): ReadonlyArray<AuditSummaryDatabaseRow> {
  return results.map((row) => {
    const parsed = auditSummaryDatabaseRowSchema.safeParse(row)
    if (!parsed.success) throw unavailable(parsed.error)

    return parsed.data
  })
}

function parseDetailRows(results: ReadonlyArray<unknown>): ReadonlyArray<AuditDetailDatabaseRow> {
  return results.map((row) => {
    const parsed = auditDetailDatabaseRowSchema.safeParse(row)
    if (!parsed.success) throw unavailable(parsed.error)

    for (const json of [
      parsed.data.authorization_json,
      parsed.data.before_json,
      parsed.data.after_json,
      parsed.data.metadata_json,
    ]) {
      if (json === null) continue
      try {
        JSON.parse(json)
      } catch (error) {
        throw unavailable(error)
      }
    }

    return parsed.data
  })
}

function parseSummaryDescriptorRows(
  results: ReadonlyArray<unknown>,
): ReadonlyArray<AuditSummaryDescriptorRow> {
  return results.map((row) => {
    const parsed = auditSummaryDescriptorRowSchema.safeParse(row)
    if (!parsed.success) throw unavailable(parsed.error)
    if (parsed.data.storage_ok !== 1) {
      throw unavailable(new Error("audit summary storage class is invalid"))
    }
    const typed = parsed.data as typeof parsed.data &
      Record<`${SummaryTextColumn}_bytes`, number | null> &
      Record<`${SummaryTextColumn}_type`, "text" | "null">
    for (const column of SUMMARY_TEXT_COLUMNS) {
      if ((typed[`${column}_type`] === "null") !== (typed[`${column}_bytes`] === null)) {
        throw unavailable(new Error("audit summary text layout is inconsistent"))
      }
    }
    const byteLengths = SUMMARY_TEXT_COLUMNS.map((column) => typed[`${column}_bytes`] ?? 0)
    if (
      byteLengths.reduce((total, bytes) => total + bytes, 0) !== typed.raw_bytes ||
      Math.max(...byteLengths) !== typed.max_text_bytes
    ) {
      throw unavailable(new Error("audit summary text sizes are inconsistent"))
    }

    return parsed.data as AuditSummaryDescriptorRow
  })
}

function parseExportDescriptorRows(
  results: ReadonlyArray<unknown>,
): ReadonlyArray<AuditExportDescriptorRow> {
  return results.map((row) => {
    const parsed = auditExportDescriptorRowSchema.safeParse(row)
    if (!parsed.success) throw unavailable(parsed.error)
    if (parsed.data.storage_ok !== 1) {
      throw unavailable(new Error("audit detail storage class is invalid"))
    }
    const typed = parsed.data as typeof parsed.data &
      Record<`${DetailTextColumn}_bytes`, number | null> &
      Record<`${DetailTextColumn}_type`, "text" | "null">
    for (const column of DETAIL_TEXT_COLUMNS) {
      if ((typed[`${column}_type`] === "null") !== (typed[`${column}_bytes`] === null)) {
        throw unavailable(new Error("audit detail text layout is inconsistent"))
      }
    }
    const byteLengths = DETAIL_TEXT_COLUMNS.map((column) => typed[`${column}_bytes`] ?? 0)
    const expectedRawBytes =
      byteLengths.reduce((total, bytes) => total + bytes, 0) +
      (typed.actor_account_id === null ? 0 : String(typed.actor_account_id).length) +
      (typed.actor_employee_id === null ? 0 : String(typed.actor_employee_id).length) +
      String(typed.created_at).length
    if (expectedRawBytes !== typed.raw_bytes || Math.max(...byteLengths) !== typed.max_text_bytes) {
      throw unavailable(new Error("audit detail text sizes are inconsistent"))
    }

    return parsed.data as AuditExportDescriptorRow
  })
}

function parseExportReadRows(
  results: ReadonlyArray<unknown>,
): ReadonlyArray<AuditExportReadDescriptor> {
  const descriptors: AuditExportReadDescriptor[] = []
  const ids = new Set<number>()

  for (const [index, result] of results.entries()) {
    if (!Array.isArray(result) || result.length !== 6 + DETAIL_TEXT_COLUMNS.length * 2) {
      throw unavailable(new Error("audit compact export projection is invalid"))
    }

    const base = z
      .tuple([
        z.number().int().min(1).max(EXPORT_CHUNK_SIZE),
        z.number().int().safe(),
        validIsoEpochSchema,
        actorAccountIdSchema,
        actorEmployeeIdSchema,
        z.number().int().min(0).max(1),
      ])
      .safeParse(result.slice(0, 6))
    if (!base.success || base.data[0] !== index + 1) {
      throw unavailable(new Error("audit compact export order is invalid"))
    }

    const [ordinal, id, createdAt, actorAccountId, actorEmployeeId, exactFlag] = base.data
    if (ids.has(id)) throw unavailable(new Error("audit compact export id is duplicated"))
    ids.add(id)

    const byteLengths = result.slice(6, 6 + DETAIL_TEXT_COLUMNS.length).map((value) => {
      if (typeof value !== "number" || !Number.isSafeInteger(value) || value < -1) {
        throw unavailable(new Error("audit compact export text layout is invalid"))
      }
      return value === -1 ? null : value
    })
    const exactValues = result.slice(6 + DETAIL_TEXT_COLUMNS.length)
    const isExact = exactFlag === 1

    for (const [columnIndex, byteLength] of byteLengths.entries()) {
      const value = exactValues[columnIndex]
      if (!isExact) {
        if (value !== null) {
          throw unavailable(new Error("audit segmented export leaked an exact value"))
        }
        continue
      }
      if (byteLength === null) {
        if (value !== null) throw unavailable(new Error("audit compact null text changed"))
        continue
      }
      if (
        byteLength > D1_MAX_HEX_SOURCE_BYTES ||
        typeof value !== "string" ||
        value.length !== byteLength * 2 ||
        !UPPER_HEX.test(value)
      ) {
        throw unavailable(new Error("audit compact export hex is invalid"))
      }
    }

    // Compact rows contain only ASCII numbers, nulls and uppercase HEX, so string length is bytes.
    if (isExact && JSON.stringify(result).length >= D1_MAX_RESULT_VALUE_BYTES) {
      throw unavailable(new Error("audit compact export row exceeds the D1 result limit"))
    }

    const rawBytes =
      byteLengths.reduce<number>((total, byteLength) => total + (byteLength ?? 0), 0) +
      (actorAccountId === null ? 0 : String(actorAccountId).length) +
      (actorEmployeeId === null ? 0 : String(actorEmployeeId).length) +
      String(createdAt).length

    descriptors.push({
      ordinal,
      id,
      createdAt,
      actorAccountId,
      actorEmployeeId,
      byteLengths,
      exactHex: isExact ? (exactValues as ReadonlyArray<string | null>) : null,
      rawBytes,
    })
  }

  for (let index = 1; index < descriptors.length; index += 1) {
    const previous = descriptors[index - 1] as AuditExportReadDescriptor
    const current = descriptors[index] as AuditExportReadDescriptor
    if (
      current.createdAt > previous.createdAt ||
      (current.createdAt === previous.createdAt && current.id >= previous.id)
    ) {
      throw unavailable(new Error("audit compact export rows are not strictly ordered"))
    }
  }

  return descriptors
}

function decodeHexInto(
  chunkHex: string,
  expectedBytes: number,
  destination: Uint8Array,
  destinationOffset: number,
): void {
  if (chunkHex.length !== expectedBytes * 2 || !UPPER_HEX.test(chunkHex)) {
    throw unavailable(new Error("audit text segment is incomplete"))
  }

  for (let index = 0; index < expectedBytes; index += 1) {
    const byte = Number.parseInt(chunkHex.slice(index * 2, index * 2 + 2), 16)
    if (!Number.isInteger(byte)) throw unavailable(new Error("audit text segment is invalid"))
    destination[destinationOffset + index] = byte
  }
}

function decodeHexText(value: unknown): string {
  if (typeof value !== "string" || value.length % 2 !== 0 || !UPPER_HEX.test(value)) {
    throw unavailable(new Error("audit text hex is invalid"))
  }
  const bytes = new Uint8Array(value.length / 2)
  decodeHexInto(value, bytes.byteLength, bytes, 0)
  return FATAL_UTF8_DECODER.decode(bytes)
}

function validateExactProjectionLayout(
  results: ReadonlyArray<unknown>,
  descriptors: ReadonlyArray<{
    id: number
    created_at: number
    actor_account_id: AccountId | null
    actor_employee_id: EmployeeId | null
  }>,
  columns: ReadonlyArray<string>,
): void {
  if (results.length !== descriptors.length) {
    throw unavailable(new Error("audit exact projection row count changed"))
  }
  for (const [index, result] of results.entries()) {
    const descriptor = descriptors[index]
    if (
      descriptor === undefined ||
      typeof result !== "object" ||
      result === null ||
      Array.isArray(result)
    ) {
      throw unavailable(new Error("audit exact projection is invalid"))
    }
    const row = result as Record<string, unknown>
    const layout = descriptor as unknown as Record<string, unknown>
    if (
      row.id !== descriptor.id ||
      row.created_at !== descriptor.created_at ||
      row.actor_account_id !== descriptor.actor_account_id ||
      row.actor_employee_id !== descriptor.actor_employee_id
    ) {
      throw unavailable(new Error("audit exact projection identity changed"))
    }

    for (const column of columns) {
      const expectedType = layout[`${column}_type`]
      const expectedBytes = layout[`${column}_bytes`]
      const observedType = row[`${column}_type`]
      const value = row[`${column}_value`]
      if (observedType !== expectedType) {
        throw unavailable(new Error("audit exact projection storage changed"))
      }
      if (expectedType === "null") {
        if (expectedBytes !== null || value !== null) {
          throw unavailable(new Error("audit exact projection null layout changed"))
        }
      } else if (
        typeof expectedBytes !== "number" ||
        typeof value !== "string" ||
        value.length !== expectedBytes * 2 ||
        !UPPER_HEX.test(value)
      ) {
        throw unavailable(new Error("audit exact projection byte length changed"))
      }
    }
  }
}

function decodeTextProjection(
  row: Record<string, unknown>,
  columns: ReadonlyArray<string>,
): Record<string, string | null> {
  const decoded: Record<string, string | null> = {}
  for (const column of columns) {
    const storageType = row[`${column}_type`]
    const value = row[`${column}_value`]
    if (storageType === "null") {
      if (value !== null) throw unavailable(new Error("audit null text projection changed"))
      decoded[column] = null
      continue
    }
    if (storageType !== "text") throw unavailable(new Error("audit text storage is invalid"))
    decoded[column] = decodeHexText(value)
  }
  return decoded
}

function parseEncodedSummaryRows(
  results: ReadonlyArray<unknown>,
): ReadonlyArray<AuditSummaryDatabaseRow> {
  return results.map((result) => {
    if (typeof result !== "object" || result === null || Array.isArray(result)) {
      throw unavailable(new Error("audit summary projection is invalid"))
    }
    const row = result as Record<string, unknown>
    const decoded = decodeTextProjection(row, SUMMARY_TEXT_COLUMNS)
    const parsed = auditSummaryDatabaseRowSchema.safeParse({
      id: row.id,
      actor_account_id: row.actor_account_id,
      actor_employee_id: row.actor_employee_id,
      created_at: row.created_at,
      ...decoded,
    })
    if (!parsed.success) throw unavailable(parsed.error)
    return parsed.data
  })
}

function parseEncodedDetailRows(
  results: ReadonlyArray<unknown>,
): ReadonlyArray<AuditDetailDatabaseRow> {
  return results.map((result) => {
    if (typeof result !== "object" || result === null || Array.isArray(result)) {
      throw unavailable(new Error("audit detail projection is invalid"))
    }
    const row = result as Record<string, unknown>
    const decoded = decodeTextProjection(row, DETAIL_TEXT_COLUMNS)
    return parseDetailRows([
      {
        id: row.id,
        actor_account_id: row.actor_account_id,
        actor_employee_id: row.actor_employee_id,
        created_at: row.created_at,
        ...decoded,
      },
    ])[0] as AuditDetailDatabaseRow
  })
}

function parseExactExportDescriptor(descriptor: AuditExportReadDescriptor): AuditDetailDatabaseRow {
  if (descriptor.exactHex === null) {
    throw unavailable(new Error("audit compact exact payload is missing"))
  }
  const projection: Record<string, unknown> = {
    id: descriptor.id,
    actor_account_id: descriptor.actorAccountId,
    actor_employee_id: descriptor.actorEmployeeId,
    created_at: descriptor.createdAt,
  }
  for (const [columnIndex, column] of DETAIL_TEXT_COLUMNS.entries()) {
    const byteLength = descriptor.byteLengths[columnIndex]
    projection[`${column}_type`] = byteLength === null ? "null" : "text"
    projection[`${column}_value`] = descriptor.exactHex[columnIndex]
  }
  const parsed = parseEncodedDetailRows([projection])[0]
  if (parsed === undefined) throw unavailable(new Error("audit compact detail row is missing"))
  return parsed
}

function toSummary(row: AuditSummaryDatabaseRow): AuditEventSummary {
  return {
    eventId: row.event_id,
    requestId: row.request_id,
    actorAccountId: row.actor_account_id,
    actorEmployeeId: row.actor_employee_id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    outcome: row.outcome,
    reasonCode: row.reason_code,
    clientName: row.client_name,
    createdAt: row.created_at,
  }
}

function toDetail(row: AuditDetailDatabaseRow): AuditEventDetail {
  return {
    ...toSummary(row),
    authorizationJson: row.authorization_json,
    beforeJson: row.before_json,
    afterJson: row.after_json,
    metadataJson: row.metadata_json,
    clientIp: row.client_ip,
  }
}

function anchorOf(row: Pick<AuditSummaryDatabaseRow, "created_at" | "id">): AuditCursorAnchor {
  return [row.created_at, row.id]
}

function pageRange(
  rows: ReadonlyArray<Pick<AuditSummaryDatabaseRow, "created_at" | "id">>,
  hasPrevious: boolean,
  hasNext: boolean,
): PageRange {
  const first = rows.at(0)
  const last = rows.at(-1)
  if (first === undefined || last === undefined) {
    throw unavailable(new Error("audit page range is empty"))
  }

  return { first: anchorOf(first), last: anchorOf(last), hasPrevious, hasNext }
}

function cursorForRange(
  direction: AuditCursorPosition["direction"],
  snapshotMaxId: number,
  limit: number,
  filterFingerprint: string,
  source: PageRange,
  target: PageRange | null = null,
): string {
  return AuditCursor.encode({
    version: 2,
    direction,
    snapshotMaxId,
    limit,
    filterFingerprint,
    sourceFirst: source.first,
    sourceLast: source.last,
    sourceHasPrevious: source.hasPrevious,
    sourceHasNext: source.hasNext,
    targetFirst: target?.first ?? null,
    targetLast: target?.last ?? null,
    targetHasPrevious: target?.hasPrevious ?? null,
    targetHasNext: target?.hasNext ?? null,
  })
}

function rangeFromCursor(cursor: AuditCursorPosition, target: boolean): PageRange {
  if (target) {
    if (
      cursor.targetFirst === null ||
      cursor.targetLast === null ||
      cursor.targetHasPrevious === null ||
      cursor.targetHasNext === null
    ) {
      throw invalidCursorBinding()
    }
    return {
      first: cursor.targetFirst,
      last: cursor.targetLast,
      hasPrevious: cursor.targetHasPrevious,
      hasNext: cursor.targetHasNext,
    }
  }

  return {
    first: cursor.sourceFirst,
    last: cursor.sourceLast,
    hasPrevious: cursor.sourceHasPrevious,
    hasNext: cursor.sourceHasNext,
  }
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "")
}

async function auditFilterFingerprint(filters: AuditEventFilters): Promise<string> {
  const canonical = JSON.stringify({
    actorAccountId: filters.actorAccountId ?? null,
    action: filters.action ?? null,
    targetType: filters.targetType ?? null,
    targetId: filters.targetId ?? null,
    outcome: filters.outcome ?? null,
    fromEpoch: filters.fromEpoch ?? null,
    toEpoch: filters.toEpoch ?? null,
  })
  const digest = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`open-base:audit:cursor-filters:v2\0${canonical}`),
    ),
  )
  return bytesToBase64Url(digest.slice(0, 16))
}

type SqlParts = { clauses: string[]; bindings: Array<string | number> }

function addBoundClause(parts: SqlParts, column: string, operator: string, value: string | number) {
  parts.bindings.push(value)
  parts.clauses.push(`${column} ${operator} ?${parts.bindings.length}`)
}

function filterSql(filters: AuditEventFilters): SqlParts {
  const parts: SqlParts = { clauses: [], bindings: [] }

  if (filters.actorAccountId !== undefined) {
    addBoundClause(parts, "actor_account_id", "=", filters.actorAccountId)
  }
  if (filters.action !== undefined) addBoundClause(parts, "action", "=", filters.action)
  if (filters.targetType !== undefined) {
    addBoundClause(parts, "target_type", "=", filters.targetType)
  }
  if (filters.targetId !== undefined) addBoundClause(parts, "target_id", "=", filters.targetId)
  if (filters.outcome !== undefined) addBoundClause(parts, "outcome", "=", filters.outcome)
  if (filters.fromEpoch !== undefined) {
    addBoundClause(parts, "created_at", ">=", filters.fromEpoch)
  }
  if (filters.toEpoch !== undefined) addBoundClause(parts, "created_at", "<", filters.toEpoch)

  return parts
}

function addCursorClause(parts: SqlParts, cursor: KeysetPosition): void {
  const comparison = cursor.direction === "next" ? "<" : ">"
  const createdAtFirst = parts.bindings.push(cursor.createdAt)
  const createdAtSecond = parts.bindings.push(cursor.createdAt)
  const id = parts.bindings.push(cursor.id)
  parts.clauses.push(
    `(created_at ${comparison} ?${createdAtFirst} OR ` +
      `(created_at = ?${createdAtSecond} AND id ${comparison} ?${id}))`,
  )
}

function addSnapshotClause(parts: SqlParts, snapshotMaxId: number): void {
  addBoundClause(parts, "id", "<=", snapshotMaxId)
}

function addInclusiveRangeClause(
  parts: SqlParts,
  first: AuditCursorAnchor,
  last: AuditCursorAnchor,
): void {
  const firstCreatedAt = parts.bindings.push(first[0])
  const firstCreatedAtAgain = parts.bindings.push(first[0])
  const firstId = parts.bindings.push(first[1])
  const lastCreatedAt = parts.bindings.push(last[0])
  const lastCreatedAtAgain = parts.bindings.push(last[0])
  const lastId = parts.bindings.push(last[1])
  parts.clauses.push(
    `(created_at < ?${firstCreatedAt} OR ` +
      `(created_at = ?${firstCreatedAtAgain} AND id <= ?${firstId}))`,
  )
  parts.clauses.push(
    `(created_at > ?${lastCreatedAt} OR ` +
      `(created_at = ?${lastCreatedAtAgain} AND id >= ?${lastId}))`,
  )
}

function summaryDescriptorSql(
  parts: SqlParts,
  ascending: boolean,
  limit: number,
  snapshotMaxId: number | null,
): {
  sql: string
  bindings: ReadonlyArray<string | number>
} {
  const limitIndex = parts.bindings.push(limit)
  const snapshotSql =
    snapshotMaxId === null
      ? "(SELECT MAX(rowid) FROM company_audit_events)"
      : `?${parts.bindings.push(snapshotMaxId)}`
  const where = parts.clauses.length === 0 ? "" : `WHERE ${parts.clauses.join(" AND ")}`
  const order = ascending ? "ASC" : "DESC"

  return {
    sql: `SELECT id, created_at, ${SUMMARY_DESCRIPTOR_LAYOUT_COLUMNS},
                 (${SUMMARY_WIRE_BYTES_SQL}) AS wire_bytes,
                 (${SUMMARY_TEXT_RAW_BYTES_SQL}) AS raw_bytes,
                 (${SUMMARY_MAX_TEXT_BYTES_SQL}) AS max_text_bytes,
                 (${SUMMARY_STORAGE_OK_SQL}) AS storage_ok,
                 ${snapshotSql} AS snapshot_max_id
          FROM ${AUDIT_EVENT_SOURCE} ${where}
          ORDER BY created_at ${order}, id ${order} LIMIT ?${limitIndex}`,
    bindings: parts.bindings,
  }
}

function admitSummaryDescriptors(
  descriptors: ReadonlyArray<AuditSummaryDescriptorRow>,
  limit: number,
): ReadonlyArray<AuditSummaryDescriptorRow> {
  const first = descriptors[0]
  if (first !== undefined && first.wire_bytes + 2 > SEARCH_SUMMARY_WIRE_BUDGET_BYTES) {
    throw unavailable(new Error("audit summary row exceeds the response budget"))
  }

  const admitted: AuditSummaryDescriptorRow[] = []
  let estimatedArrayBytes = 2
  for (const descriptor of descriptors) {
    if (admitted.length >= limit) break

    const separatorBytes = admitted.length === 0 ? 0 : 1
    if (
      estimatedArrayBytes + separatorBytes + descriptor.wire_bytes >
      SEARCH_SUMMARY_WIRE_BUDGET_BYTES
    ) {
      break
    }

    admitted.push(descriptor)
    estimatedArrayBytes += separatorBytes + descriptor.wire_bytes
  }

  return admitted
}

function exportDescriptorSql(
  parts: SqlParts,
  limit: number,
  wireByteBudget: number,
): { sql: string; bindings: ReadonlyArray<string | number> } {
  const limitIndex = parts.bindings.push(limit)
  const wireBudgetIndex = parts.bindings.push(wireByteBudget - 2)
  const where = parts.clauses.length === 0 ? "" : `WHERE ${parts.clauses.join(" AND ")}`

  return {
    sql: `WITH layout AS (
            SELECT id, created_at, actor_account_id, actor_employee_id,
                   ${DETAIL_TEXT_COLUMNS.join(", ")}, ${DETAIL_COMPACT_LAYOUT_COLUMNS}
            FROM ${AUDIT_EVENT_SOURCE} ${where}
            ORDER BY created_at DESC, id DESC
            LIMIT ?${limitIndex}
          ), measured AS (
            SELECT *, (${DETAIL_COMPACT_TEXT_BYTES_SQL}) AS text_bytes,
                   (${DETAIL_COMPACT_MAX_TEXT_BYTES_SQL}) AS max_text_bytes,
                   (${DETAIL_COMPACT_STORAGE_OK_SQL}) AS storage_ok,
                   (${DETAIL_COMPACT_BASE_WIRE_BYTES_SQL}) AS compact_base_bytes
            FROM layout
          ), sized AS (
            SELECT *,
                   text_bytes +
                     CASE WHEN actor_account_id IS NULL THEN 0
                          ELSE length(CAST(actor_account_id AS BLOB)) END +
                     CASE WHEN actor_employee_id IS NULL THEN 0
                          ELSE length(CAST(actor_employee_id AS BLOB)) END +
                     length(CAST(created_at AS BLOB)) AS raw_bytes,
                   compact_base_bytes + (${DETAIL_COMPACT_EXACT_VALUE_BYTES_SQL})
                     AS exact_wire_bytes,
                   compact_base_bytes + ${DETAIL_COMPACT_DESCRIPTOR_VALUE_BYTES}
                     AS descriptor_wire_bytes
            FROM measured
          ), projected AS (
            SELECT *,
                   CASE WHEN storage_ok = 1
                              AND max_text_bytes <= ${D1_MAX_HEX_SOURCE_BYTES}
                              AND exact_wire_bytes < ${D1_MAX_RESULT_VALUE_BYTES}
                        THEN 1 ELSE 0 END AS is_exact
            FROM sized
          ), bounded AS (
            SELECT *,
                   SUM((CASE WHEN is_exact = 1 THEN exact_wire_bytes
                             ELSE descriptor_wire_bytes END) + 1) OVER (
                     ORDER BY created_at DESC, id DESC ROWS UNBOUNDED PRECEDING
                   ) AS cumulative_wire_bytes,
                   ROW_NUMBER() OVER (ORDER BY created_at DESC, id DESC) AS row_number
            FROM projected
          )
          SELECT row_number, id, created_at, actor_account_id, actor_employee_id, is_exact,
                 ${DETAIL_TEXT_COLUMNS.map((column) => `${column}_layout_bytes`).join(", ")},
                 ${DETAIL_TEXT_COLUMNS.map(
                   (column) =>
                     `CASE WHEN is_exact = 1 AND ${column}_layout_bytes >= 0 ` +
                     `THEN hex(CAST(${column} AS BLOB)) ELSE NULL END`,
                 ).join(", ")}
          FROM bounded
          WHERE cumulative_wire_bytes <= ?${wireBudgetIndex}
          ORDER BY created_at DESC, id DESC`,
    bindings: parts.bindings,
  }
}

function detailIdsJson(rows: ReadonlyArray<AuditExportDescriptorRow>): string {
  return JSON.stringify(rows.map((row) => row.id))
}

function summaryIdsJson(rows: ReadonlyArray<AuditSummaryDescriptorRow>): string {
  return JSON.stringify(rows.map((row) => row.id))
}

function canLoadExactHexProjection(descriptor: {
  max_text_bytes: number
  wire_bytes: number
}): boolean {
  // Each source slice stays at or below 999,000 bytes so its HEX value plus projection
  // metadata remains strictly below D1's 2,000,000-byte result-row limit. The descriptor's
  // wire_bytes is the conservative full exact-HEX row estimate, so it also bounds combined
  // medium-width columns that are individually safe but unsafe when projected together.
  return (
    descriptor.max_text_bytes <= D1_MAX_HEX_SOURCE_BYTES &&
    descriptor.wire_bytes < D1_MAX_RESULT_VALUE_BYTES
  )
}

function exportSegmentPlanGroups(
  descriptors: ReadonlyArray<AuditExportReadDescriptor>,
): ReadonlyArray<ReadonlyArray<AuditExportSegmentPlanItem>> {
  const groups: AuditExportSegmentPlanItem[][] = []
  let group: AuditExportSegmentPlanItem[] = []
  let groupRemaining = D1_SEGMENT_QUERY_SOURCE_BYTES
  let planOrdinal = 0
  let totalSourceBytes = 0

  for (const [descriptorOrdinal, descriptor] of descriptors.entries()) {
    if (descriptor.exactHex !== null) continue
    for (const [columnIndex, byteLength] of descriptor.byteLengths.entries()) {
      if (byteLength === null || byteLength === 0) continue
      totalSourceBytes += byteLength
      let offset = 0
      while (offset < byteLength) {
        const expectedBytes = Math.min(byteLength - offset, D1_MAX_HEX_SOURCE_BYTES, groupRemaining)
        if (expectedBytes <= 0) {
          throw unavailable(new Error("audit segment planner made no progress"))
        }
        group.push({
          planOrdinal,
          descriptorOrdinal,
          id: descriptor.id,
          createdAt: descriptor.createdAt,
          actorAccountId: descriptor.actorAccountId,
          actorEmployeeId: descriptor.actorEmployeeId,
          columnIndex,
          offset,
          expectedBytes,
          columnBytes: byteLength,
        })
        planOrdinal += 1
        offset += expectedBytes
        groupRemaining -= expectedBytes

        if (groupRemaining === 0) {
          groups.push(group)
          group = []
          groupRemaining = D1_SEGMENT_QUERY_SOURCE_BYTES
        }
      }
    }
  }
  if (group.length > 0) groups.push(group)

  // The planner fills each group exactly except the last. Since accepted exports have at most
  // 16 MiB of raw source text, ceil(16 MiB / 1,998,000) = 9 segment queries is a hard maximum.
  const exactGroupCount = Math.ceil(totalSourceBytes / D1_SEGMENT_QUERY_SOURCE_BYTES)
  if (groups.length !== exactGroupCount || groups.length > EXPORT_MAX_SEGMENT_QUERIES) {
    throw unavailable(new Error("audit segment query budget invariant failed"))
  }
  return groups
}

function exportSegmentPlanJson(group: ReadonlyArray<AuditExportSegmentPlanItem>): string {
  return JSON.stringify(
    group.map((item) => [
      item.planOrdinal,
      item.descriptorOrdinal,
      item.id,
      item.createdAt,
      item.actorAccountId,
      item.actorEmployeeId,
      item.columnIndex,
      item.offset,
      item.expectedBytes,
      item.columnBytes,
    ]),
  )
}

function segmentColumnCase(expression: (column: DetailTextColumn) => string): string {
  return (
    `CASE p.column_index ` +
    DETAIL_TEXT_COLUMNS.map((column, index) => `WHEN ${index} THEN ${expression(column)}`).join(
      " ",
    ) +
    ` ELSE NULL END`
  )
}

const EXPORT_SEGMENT_SQL = `
  WITH plan AS (
    SELECT CAST(json_extract(value, '$[0]') AS INTEGER) AS plan_ordinal,
           CAST(json_extract(value, '$[1]') AS INTEGER) AS descriptor_ordinal,
           CAST(json_extract(value, '$[2]') AS INTEGER) AS id,
           CAST(json_extract(value, '$[3]') AS INTEGER) AS created_at,
           CAST(json_extract(value, '$[4]') AS TEXT) AS actor_account_id,
           CAST(json_extract(value, '$[5]') AS TEXT) AS actor_employee_id,
           CAST(json_extract(value, '$[6]') AS INTEGER) AS column_index,
           CAST(json_extract(value, '$[7]') AS INTEGER) AS byte_offset,
           CAST(json_extract(value, '$[8]') AS INTEGER) AS expected_bytes,
           CAST(json_extract(value, '$[9]') AS INTEGER) AS column_bytes
    FROM json_each(?1)
  )
  SELECT p.plan_ordinal, p.descriptor_ordinal,
         a.id, a.created_at, a.actor_account_id, a.actor_employee_id,
         p.column_index, p.byte_offset, p.expected_bytes,
         ${segmentColumnCase((column) => `typeof(a.${column})`)},
         ${segmentColumnCase(
           (column) =>
             `CASE WHEN a.${column} IS NULL THEN NULL ` +
             `ELSE length(CAST(a.${column} AS BLOB)) END`,
         )},
         ${segmentColumnCase(
           (column) =>
             `hex(substr(CAST(a.${column} AS BLOB), ` + `p.byte_offset + 1, p.expected_bytes))`,
         )}
  FROM plan p
  JOIN (${AUDIT_EVENT_RELATION}) a ON a.id = p.id
  ORDER BY p.plan_ordinal
`

function rethrowRepositoryError(error: unknown): never {
  if (
    error instanceof CompanyValidationError ||
    error instanceof CompanyPayloadTooLargeError ||
    error instanceof CompanyUnavailableError
  ) {
    throw error
  }

  throw unavailable(error)
}

/** 監査台帳の読み書きに必要な最小限のbinding。製品ごとのenv全体には依存しない。 */
type Context = Readonly<{ env: Readonly<{ DB: D1Database }> }>

export class AuditEventAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  private async loadExactSummaries(
    descriptors: ReadonlyArray<AuditSummaryDescriptorRow>,
    ascending: boolean,
  ): Promise<ReadonlyArray<AuditSummaryDatabaseRow>> {
    const order = ascending ? "ASC" : "DESC"
    const hexDescriptors = descriptors.filter(canLoadExactHexProjection)
    const segmentedDescriptors = descriptors.filter(
      (descriptor) => !canLoadExactHexProjection(descriptor),
    )
    const rows: AuditSummaryDatabaseRow[] = []

    if (hexDescriptors.length > 0) {
      const summaryResult = await this.c.env.DB.prepare(
        `SELECT ${SUMMARY_HEX_SELECT_COLUMNS}
         FROM ${AUDIT_EVENT_SOURCE}
         WHERE id IN (SELECT value FROM json_each(?1))
         ORDER BY created_at ${order}, id ${order}`,
      )
        .bind(summaryIdsJson(hexDescriptors))
        .all()
      if (!summaryResult.success) throw new Error("audit summary query did not succeed")
      validateExactProjectionLayout(summaryResult.results, hexDescriptors, SUMMARY_TEXT_COLUMNS)
      rows.push(...parseEncodedSummaryRows(summaryResult.results))
    }

    for (const descriptor of segmentedDescriptors) {
      rows.push(await this.loadSegmentedSummary(descriptor))
    }

    const rowsById = new Map(rows.map((row) => [row.id, row]))
    const ordered = descriptors.map((descriptor) => rowsById.get(descriptor.id))
    if (
      ordered.some((row) => row === undefined) ||
      rows.length !== descriptors.length ||
      ordered.some(
        (row, index) =>
          row?.id !== descriptors[index]?.id || row?.created_at !== descriptors[index]?.created_at,
      )
    ) {
      throw new Error("audit summary rows changed during read")
    }

    return ordered as AuditSummaryDatabaseRow[]
  }

  private async loadExactDetails(
    descriptors: ReadonlyArray<AuditExportDescriptorRow>,
  ): Promise<ReadonlyArray<AuditDetailDatabaseRow>> {
    const detailResult = await this.c.env.DB.prepare(
      `SELECT ${DETAIL_HEX_SELECT_COLUMNS}
       FROM ${AUDIT_EVENT_SOURCE}
       WHERE id IN (SELECT value FROM json_each(?1))
       ORDER BY created_at DESC, id DESC`,
    )
      .bind(detailIdsJson(descriptors))
      .all()
    if (!detailResult.success) throw new Error("audit detail query did not succeed")

    validateExactProjectionLayout(detailResult.results, descriptors, DETAIL_TEXT_COLUMNS)
    const rows = parseEncodedDetailRows(detailResult.results)
    if (
      rows.length !== descriptors.length ||
      rows.some(
        (row, index) =>
          row.id !== descriptors[index]?.id || row.created_at !== descriptors[index]?.created_at,
      )
    ) {
      throw new Error("audit detail rows changed during read")
    }

    return rows
  }

  private async loadDescriptorDetails(
    descriptors: ReadonlyArray<AuditExportDescriptorRow>,
  ): Promise<ReadonlyArray<AuditDetailDatabaseRow>> {
    const hexDescriptors = descriptors.filter(canLoadExactHexProjection)
    const rows: AuditDetailDatabaseRow[] = []
    if (hexDescriptors.length > 0) rows.push(...(await this.loadExactDetails(hexDescriptors)))
    for (const descriptor of descriptors) {
      if (canLoadExactHexProjection(descriptor)) continue
      rows.push(await this.loadSegmentedDetail(descriptor))
    }

    const rowsById = new Map(rows.map((row) => [row.id, row]))
    const ordered = descriptors.map((descriptor) => rowsById.get(descriptor.id))
    if (
      rows.length !== descriptors.length ||
      ordered.some(
        (row, index) =>
          row?.id !== descriptors[index]?.id || row?.created_at !== descriptors[index]?.created_at,
      )
    ) {
      throw new Error("audit detail rows changed during bounded read")
    }
    return ordered as AuditDetailDatabaseRow[]
  }

  private async loadSegmentedExportDetails(
    descriptors: ReadonlyArray<AuditExportReadDescriptor>,
  ): Promise<ReadonlyArray<AuditDetailDatabaseRow>> {
    const rows: Array<AuditDetailDatabaseRow | undefined> = Array.from({
      length: descriptors.length,
    })
    const buffers: Array<ReadonlyArray<Uint8Array | null> | undefined> = Array.from({
      length: descriptors.length,
    })

    for (const [descriptorOrdinal, descriptor] of descriptors.entries()) {
      if (descriptor.exactHex !== null) {
        throw new Error("audit exact descriptor reached the segmented loader")
      }

      buffers[descriptorOrdinal] = descriptor.byteLengths.map((byteLength) =>
        byteLength === null ? null : new Uint8Array(byteLength),
      )
    }

    // The production no-update/no-delete triggers are the trust boundary between segment groups.
    // Identity/layout checks fail closed, but a same-length valid rewrite is intentionally not hashed.
    for (const group of exportSegmentPlanGroups(descriptors)) {
      const raw = (await this.c.env.DB.prepare(EXPORT_SEGMENT_SQL)
        .bind(exportSegmentPlanJson(group))
        .raw()) as ReadonlyArray<unknown>
      if (raw.length !== group.length) {
        throw new Error("audit segment query returned missing or duplicate rows")
      }

      for (const [index, result] of raw.entries()) {
        const expected = group[index]
        if (expected === undefined || !Array.isArray(result) || result.length !== 12) {
          throw new Error("audit segment projection is invalid")
        }
        const expectedPrefix: ReadonlyArray<unknown> = [
          expected.planOrdinal,
          expected.descriptorOrdinal,
          expected.id,
          expected.createdAt,
          expected.actorAccountId,
          expected.actorEmployeeId,
          expected.columnIndex,
          expected.offset,
          expected.expectedBytes,
        ]
        if (expectedPrefix.some((value, field) => result[field] !== value)) {
          throw new Error("audit segment identity or order changed during read")
        }
        if (result[9] !== "text" || result[10] !== expected.columnBytes) {
          throw new Error("audit segment storage or length changed during read")
        }

        const descriptorBuffers = buffers[expected.descriptorOrdinal]
        const destination = descriptorBuffers?.[expected.columnIndex]
        if (destination === undefined || destination === null || typeof result[11] !== "string") {
          throw new Error("audit segment buffer is missing")
        }
        decodeHexInto(result[11], expected.expectedBytes, destination, expected.offset)
      }
    }

    for (const [descriptorOrdinal, descriptor] of descriptors.entries()) {
      const descriptorBuffers = buffers[descriptorOrdinal]
      if (descriptorBuffers === undefined) throw new Error("audit segment buffers are missing")
      const text: Record<string, string | null> = {}
      for (const [columnIndex, column] of DETAIL_TEXT_COLUMNS.entries()) {
        const bytes = descriptorBuffers[columnIndex]
        text[column] = bytes === null ? null : FATAL_UTF8_DECODER.decode(bytes)
      }
      const parsed = parseDetailRows([
        {
          id: descriptor.id,
          actor_account_id: descriptor.actorAccountId,
          actor_employee_id: descriptor.actorEmployeeId,
          created_at: descriptor.createdAt,
          ...text,
        },
      ])[0]
      if (parsed === undefined) throw new Error("audit segmented export row is missing")
      rows[descriptorOrdinal] = parsed
    }

    if (rows.some((row) => row === undefined)) {
      throw new Error("audit export row reconstruction is incomplete")
    }
    return rows as AuditDetailDatabaseRow[]
  }

  private async loadSegmentedText(
    descriptor: {
      id: number
      actor_account_id: AccountId | null
      actor_employee_id: EmployeeId | null
      created_at: number
    } & Record<string, unknown>,
    columns: ReadonlyArray<string>,
  ): Promise<Record<string, string | null>> {
    // As above, immutable audit_logs triggers rule out same-length content changes between reads.
    const buffers = new Map<string, Uint8Array>()
    const offsets = new Map<string, number>()
    const text: Record<string, string | null> = {}
    for (const column of columns) {
      const byteLength = descriptor[`${column}_bytes`]
      const storageType = descriptor[`${column}_type`]
      if (storageType === "null" && byteLength === null) {
        text[column] = null
        continue
      }
      if (
        storageType !== "text" ||
        typeof byteLength !== "number" ||
        !Number.isSafeInteger(byteLength) ||
        byteLength < 0
      ) {
        throw new Error("audit segmented text layout is invalid")
      }
      buffers.set(column, new Uint8Array(byteLength))
      offsets.set(column, 0)
    }

    while ([...buffers].some(([column, bytes]) => (offsets.get(column) ?? 0) < bytes.length)) {
      let sourceBudget = D1_MAX_HEX_SOURCE_BYTES
      const bindings: number[] = [descriptor.id]
      const selections: Array<{
        column: string
        offset: number
        expectedBytes: number
      }> = []
      const projections: string[] = ["id", "created_at", "actor_account_id", "actor_employee_id"]
      for (const column of columns) {
        const bytes = buffers.get(column)
        if (bytes === undefined || sourceBudget === 0) continue
        const offset = offsets.get(column) ?? 0
        const expectedBytes = Math.min(bytes.length - offset, sourceBudget)
        if (expectedBytes <= 0) continue
        const offsetIndex = bindings.push(offset + 1)
        const lengthIndex = bindings.push(expectedBytes)
        projections.push(`typeof(${column}) AS ${column}_type`)
        projections.push(
          `CASE WHEN ${column} IS NULL THEN NULL ` +
            `ELSE length(CAST(${column} AS BLOB)) END AS ${column}_bytes`,
        )
        projections.push(
          `hex(substr(CAST(${column} AS BLOB), ?${offsetIndex}, ?${lengthIndex})) ` +
            `AS ${column}_chunk_hex`,
        )
        selections.push({ column, offset, expectedBytes })
        sourceBudget -= expectedBytes
      }
      if (selections.length === 0) throw new Error("audit segmented text read made no progress")

      const segmentResult = await this.c.env.DB.prepare(
        `SELECT ${projections.join(", ")} FROM ${AUDIT_EVENT_SOURCE} WHERE id = ?1 LIMIT 1`,
      )
        .bind(...bindings)
        .all()
      if (!segmentResult.success || segmentResult.results.length !== 1) {
        throw new Error("audit text segment query did not succeed")
      }
      const result = segmentResult.results[0]
      if (typeof result !== "object" || result === null || Array.isArray(result)) {
        throw new Error("audit text segment is invalid")
      }
      const row = result as Record<string, unknown>
      if (
        row.id !== descriptor.id ||
        row.created_at !== descriptor.created_at ||
        row.actor_account_id !== descriptor.actor_account_id ||
        row.actor_employee_id !== descriptor.actor_employee_id
      ) {
        throw new Error("audit text segment changed during read")
      }
      for (const selection of selections) {
        if (
          row[`${selection.column}_type`] !== "text" ||
          row[`${selection.column}_bytes`] !== descriptor[`${selection.column}_bytes`]
        ) {
          throw new Error("audit text segment storage changed during read")
        }
        const chunkHex = row[`${selection.column}_chunk_hex`]
        const bytes = buffers.get(selection.column)
        if (bytes === undefined) throw new Error("audit text segment buffer is missing")
        if (typeof chunkHex !== "string") throw new Error("audit text segment hex is missing")
        decodeHexInto(chunkHex, selection.expectedBytes, bytes, selection.offset)
        offsets.set(selection.column, selection.offset + selection.expectedBytes)
      }
    }

    for (const [column, bytes] of buffers) text[column] = FATAL_UTF8_DECODER.decode(bytes)
    return text
  }

  private async loadSegmentedSummary(
    descriptor: AuditSummaryDescriptorRow,
  ): Promise<AuditSummaryDatabaseRow> {
    const text = await this.loadSegmentedText(descriptor, SUMMARY_TEXT_COLUMNS)
    const rows = parseSummaryRows([
      {
        id: descriptor.id,
        actor_account_id: descriptor.actor_account_id,
        actor_employee_id: descriptor.actor_employee_id,
        created_at: descriptor.created_at,
        ...text,
      },
    ])
    const row = rows[0]
    if (row === undefined) throw new Error("audit segmented summary is missing")
    return row
  }

  private async loadSegmentedDetail(
    descriptor: AuditExportDescriptorRow,
  ): Promise<AuditDetailDatabaseRow> {
    const text = await this.loadSegmentedText(descriptor, DETAIL_TEXT_COLUMNS)

    const rows = parseDetailRows([
      {
        id: descriptor.id,
        actor_account_id: descriptor.actor_account_id,
        actor_employee_id: descriptor.actor_employee_id,
        created_at: descriptor.created_at,
        ...text,
      },
    ])
    const row = rows[0]
    if (row === undefined) throw new Error("audit segmented detail is missing")

    return row
  }

  private prepareInsert(record: AuditEventRecord): D1PreparedStatement {
    return this.c.env.DB.prepare(
      `INSERT INTO company_audit_event_appends
         (event_id, request_id, actor_account_id, actor_employee_id, action,
          target_type, target_id, outcome, reason_code, authorization_json,
          before_json, after_json, metadata_json, client_ip, client_name, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)`,
    ).bind(
      record.eventId,
      record.requestId,
      record.actorAccountId,
      record.actorEmployeeId,
      record.action,
      record.targetType,
      record.targetId,
      record.outcome,
      record.reasonCode,
      record.authorizationJson,
      record.beforeJson,
      record.afterJson,
      record.metadataJson,
      record.clientIp,
      record.clientName,
      record.createdAt,
    )
  }

  private prepareConditionalInsert<TDecision extends string>(
    decisionId: string,
    decisionCase: AuditDecisionCase<TDecision>,
  ): D1PreparedStatement {
    const { record } = decisionCase

    return this.c.env.DB.prepare(
      `INSERT INTO company_audit_event_appends
         (event_id, request_id, actor_account_id, actor_employee_id, action,
          target_type, target_id, outcome, reason_code, authorization_json,
          before_json, after_json, metadata_json, client_ip, client_name, created_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16
       FROM company_audit_batch_decisions
       WHERE decision_id = ?17 AND decision_value = ?18`,
    ).bind(
      record.eventId,
      record.requestId,
      record.actorAccountId,
      record.actorEmployeeId,
      record.action,
      record.targetType,
      record.targetId,
      record.outcome,
      record.reasonCode,
      record.authorizationJson,
      record.beforeJson,
      record.afterJson,
      record.metadataJson,
      record.clientIp,
      record.clientName,
      record.createdAt,
      decisionId,
      decisionCase.decision,
    )
  }

  prepareExclusiveAppend<TDecision extends string>(props: {
    decisionId: string
    cases: readonly [
      AuditDecisionCase<TDecision>,
      AuditDecisionCase<TDecision>,
      ...AuditDecisionCase<TDecision>[],
    ]
  }): AuditDecisionAppendFragment<TDecision> {
    const invalid = (cause?: unknown) =>
      new CompanyValidationError(
        "audit decision fragment is invalid",
        "audit_invalid_decision_fragment",
        cause === undefined ? undefined : { cause },
      )
    const decisionIdResult = z.string().uuid().safeParse(props.decisionId)
    if (!decisionIdResult.success) throw invalid(decisionIdResult.error)
    if (!Array.isArray(props.cases) || props.cases.length < 2 || props.cases.length > 8) {
      throw invalid()
    }

    const encoder = new TextEncoder()
    const decisions: TDecision[] = []
    const eventIds: string[] = []
    for (const decisionCase of props.cases) {
      if (
        typeof decisionCase.decision !== "string" ||
        encoder.encode(decisionCase.decision).byteLength < 1 ||
        encoder.encode(decisionCase.decision).byteLength > 64 ||
        typeof decisionCase.record?.eventId !== "string"
      ) {
        throw invalid()
      }
      decisions.push(decisionCase.decision)
      eventIds.push(decisionCase.record.eventId)
    }
    if (
      new Set(decisions).size !== decisions.length ||
      new Set(eventIds).size !== eventIds.length
    ) {
      throw invalid()
    }

    const decisionPlaceholders = decisions.map((_, index) => `?${index + 2}`)
    const eventIdPlaceholders = eventIds.map((_, index) => `?${decisions.length + index + 2}`)
    const invariant = this.c.env.DB.prepare(
      `SELECT CASE WHEN
         (SELECT COUNT(*)
            FROM company_audit_batch_decisions
           WHERE decision_id = ?1
             AND decision_value IN (${decisionPlaceholders.join(", ")})) = 1
         AND
         (SELECT COUNT(*)
            FROM ${AUDIT_EVENT_SOURCE}
           WHERE event_id IN (${eventIdPlaceholders.join(", ")})) = 1
       THEN 1 ELSE json_extract('', '$') END AS ok`,
    ).bind(props.decisionId, ...decisions, ...eventIds)
    const deleteMarker = this.c.env.DB.prepare(
      "DELETE FROM company_audit_batch_decisions WHERE decision_id = ?1",
    ).bind(props.decisionId)
    const [firstCase, ...remainingCases] = props.cases
    const statements: [D1PreparedStatement, ...D1PreparedStatement[]] = [
      this.prepareConditionalInsert(props.decisionId, firstCase),
      ...remainingCases.map((decisionCase) =>
        this.prepareConditionalInsert(props.decisionId, decisionCase),
      ),
      invariant,
      deleteMarker,
      abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
    ]

    return Object.freeze({
      decisionId: props.decisionId,
      decisions: Object.freeze(decisions),
      statements: Object.freeze(statements),
    })
  }

  /** Returns the Company dispatch and its persisted base/context invariant as one batch fragment. */
  prepareAppend(record: AuditEventRecord): readonly [D1PreparedStatement, D1PreparedStatement] {
    const invariant = this.c.env.DB.prepare(
      `SELECT CASE WHEN
         EXISTS (SELECT 1 FROM company_audit_events WHERE event_id = ?1)
         AND NOT EXISTS (SELECT 1 FROM company_audit_event_appends WHERE event_id = ?1)
         AND (
           (?2 IS NULL AND NOT EXISTS (
             SELECT 1
             FROM company_audit_event_employee_contexts employee_context
             JOIN company_audit_events event ON event.id = employee_context.audit_event_id
             WHERE event.event_id = ?1
           ))
           OR EXISTS (
             SELECT 1
             FROM company_audit_event_employee_contexts employee_context
             JOIN company_audit_events event ON event.id = employee_context.audit_event_id
             WHERE event.event_id = ?1 AND employee_context.employee_id = ?2
           )
         )
       THEN 1 ELSE json_extract('', '$') END AS ok`,
    ).bind(record.eventId, record.actorEmployeeId)

    return Object.freeze([this.prepareInsert(record), invariant] as const)
  }

  async append(record: AuditEventRecord): Promise<void> {
    try {
      const results = await this.c.env.DB.batch([...this.prepareAppend(record)])
      if (results.length !== 2 || results.some((result) => !result.success)) {
        throw new Error("audit append did not succeed")
      }
    } catch (error) {
      rethrowRepositoryError(error)
    }
  }

  async search(query: AuditEventSearchQuery): Promise<AuditEventPage> {
    const parsed = parseQuery(auditSearchQuerySchema, query)
    const cursor = parsed.cursor === null ? null : AuditCursor.decode(parsed.cursor)

    try {
      const filterFingerprint = await auditFilterFingerprint(parsed.filters)
      if (
        cursor !== null &&
        (cursor.limit !== parsed.limit || cursor.filterFingerprint !== filterFingerprint)
      ) {
        throw invalidCursorBinding()
      }

      const parts = filterSql(parsed.filters)
      const isExactRestore = cursor?.targetFirst !== null && cursor?.targetFirst !== undefined
      if (cursor !== null) {
        addSnapshotClause(parts, cursor.snapshotMaxId)
        if (isExactRestore) {
          const target = rangeFromCursor(cursor, true)
          addInclusiveRangeClause(parts, target.first, target.last)
        } else {
          const source = rangeFromCursor(cursor, false)
          const boundary = cursor.direction === "next" ? source.last : source.first
          addCursorClause(parts, {
            direction: cursor.direction,
            createdAt: boundary[0],
            id: boundary[1],
          })
        }
      }
      const ascending = !isExactRestore && cursor?.direction === "previous"
      const descriptorStatement = summaryDescriptorSql(
        parts,
        ascending,
        parsed.limit + 1,
        cursor?.snapshotMaxId ?? null,
      )
      const descriptorResult = await this.c.env.DB.prepare(descriptorStatement.sql)
        .bind(...descriptorStatement.bindings)
        .all()
      if (!descriptorResult.success)
        throw new Error("audit summary descriptor query did not succeed")

      const descriptors = parseSummaryDescriptorRows(descriptorResult.results)
      const snapshotMaxId = cursor?.snapshotMaxId ?? descriptors[0]?.snapshot_max_id
      if (
        snapshotMaxId === undefined ||
        descriptors.some((descriptor) => descriptor.snapshot_max_id !== snapshotMaxId)
      ) {
        if (descriptors.length === 0) {
          return { items: [], nextCursor: null, previousCursor: null }
        }
        throw new Error("audit snapshot changed during read")
      }

      const admitted = admitSummaryDescriptors(descriptors, parsed.limit)
      if (admitted.length === 0) {
        return { items: [], nextCursor: null, previousCursor: null }
      }

      if (isExactRestore) {
        const target = rangeFromCursor(cursor as AuditCursorPosition, true)
        const first = descriptors.at(0)
        const last = descriptors.at(-1)
        if (
          descriptors.length > parsed.limit ||
          admitted.length !== descriptors.length ||
          first?.created_at !== target.first[0] ||
          first.id !== target.first[1] ||
          last?.created_at !== target.last[0] ||
          last.id !== target.last[1]
        ) {
          throw invalidCursorBinding()
        }
      }

      const queried = await this.loadExactSummaries(admitted, ascending)
      const hasMore = !isExactRestore && descriptors.length > admitted.length
      const pageRows = ascending ? [...queried].reverse() : queried
      const first = pageRows.at(0)
      const last = pageRows.at(-1)

      if (first === undefined || last === undefined) {
        return { items: [], nextCursor: null, previousCursor: null }
      }

      let current: PageRange
      if (isExactRestore && cursor !== null) {
        current = rangeFromCursor(cursor, true)
      } else if (cursor?.direction === "next") {
        current = pageRange(pageRows, true, hasMore)
      } else if (cursor?.direction === "previous") {
        current = pageRange(pageRows, hasMore, true)
      } else {
        current = pageRange(pageRows, false, hasMore)
      }

      let nextCursor: string | null = null
      let previousCursor: string | null = null
      if (isExactRestore && cursor !== null) {
        const source = rangeFromCursor(cursor, false)
        if (cursor.direction === "next") {
          previousCursor = cursorForRange(
            "previous",
            snapshotMaxId,
            parsed.limit,
            filterFingerprint,
            current,
            source,
          )
          if (current.hasNext) {
            nextCursor = cursorForRange(
              "next",
              snapshotMaxId,
              parsed.limit,
              filterFingerprint,
              current,
            )
          }
        } else {
          nextCursor = cursorForRange(
            "next",
            snapshotMaxId,
            parsed.limit,
            filterFingerprint,
            current,
            source,
          )
          if (current.hasPrevious) {
            previousCursor = cursorForRange(
              "previous",
              snapshotMaxId,
              parsed.limit,
              filterFingerprint,
              current,
            )
          }
        }
      } else {
        if (current.hasNext) {
          nextCursor = cursorForRange(
            "next",
            snapshotMaxId,
            parsed.limit,
            filterFingerprint,
            current,
            cursor?.direction === "previous" ? rangeFromCursor(cursor, false) : null,
          )
        }
        if (current.hasPrevious) {
          previousCursor = cursorForRange(
            "previous",
            snapshotMaxId,
            parsed.limit,
            filterFingerprint,
            current,
            cursor?.direction === "next" ? rangeFromCursor(cursor, false) : null,
          )
        }
      }

      return { items: pageRows.map(toSummary), nextCursor, previousCursor }
    } catch (error) {
      rethrowRepositoryError(error)
    }
  }

  async findByEventId(eventId: string): Promise<AuditEventDetail | null> {
    try {
      const result = await this.c.env.DB.prepare(
        `SELECT id, created_at, ${DETAIL_DESCRIPTOR_LAYOUT_COLUMNS},
                (${DETAIL_RAW_BYTES_SQL}) AS raw_bytes,
                (${DETAIL_WIRE_BYTES_SQL}) AS wire_bytes,
                (${DETAIL_MAX_TEXT_BYTES_SQL}) AS max_text_bytes,
                (${DETAIL_STORAGE_OK_SQL}) AS storage_ok
         FROM ${AUDIT_EVENT_SOURCE} WHERE event_id = ?1 LIMIT 1`,
      )
        .bind(eventId)
        .all()
      if (!result.success) throw new Error("audit detail query did not succeed")

      const descriptor = parseExportDescriptorRows(result.results).at(0)
      if (descriptor === undefined) return null

      const row = (await this.loadDescriptorDetails([descriptor]))[0]
      if (row === undefined) throw new Error("audit detail row is missing")

      return toDetail(row)
    } catch (error) {
      rethrowRepositoryError(error)
    }
  }

  async export(query: AuditEventExportQuery): Promise<ReadonlyArray<AuditEventDetail>> {
    const parsed = parseQuery(auditExportQuerySchema, query)

    try {
      const exported: Array<AuditEventDetail | undefined> = []
      const segmentedDescriptors: AuditExportReadDescriptor[] = []
      const segmentedSlots: number[] = []
      const sizeGuard = new AuditCsvByteCounter()
      let position: KeysetPosition | null = null
      let cumulativeRawBytes = 0
      let previous: Pick<AuditExportReadDescriptor, "createdAt" | "id"> | undefined

      while (true) {
        const remainingRows = EXPORT_MAX_ROWS - exported.length
        const parts = filterSql(parsed.filters)
        if (position !== null) addCursorClause(parts, position)
        const descriptorStatement = exportDescriptorSql(
          parts,
          Math.min(EXPORT_CHUNK_SIZE, remainingRows + 1),
          EXPORT_DETAIL_WIRE_CHUNK_BYTES,
        )
        const raw = (await this.c.env.DB.prepare(descriptorStatement.sql)
          .bind(...descriptorStatement.bindings)
          .raw()) as ReadonlyArray<unknown>

        const page = parseExportReadRows(raw)
        if (page.length === 0) break
        if (page.length > remainingRows) throw exportTooLarge()
        const first = page[0]
        if (
          previous !== undefined &&
          first !== undefined &&
          (first.createdAt > previous.createdAt ||
            (first.createdAt === previous.createdAt && first.id >= previous.id))
        ) {
          throw new Error("audit export pages are not strictly ordered")
        }
        for (const descriptor of page) {
          cumulativeRawBytes += descriptor.rawBytes
          if (cumulativeRawBytes > sizeGuard.remainingBytes) throw exportTooLarge()
          const slot = exported.length
          if (descriptor.exactHex === null) {
            segmentedDescriptors.push(descriptor)
            segmentedSlots.push(slot)
            exported.push(undefined)
          } else {
            exported.push(toDetail(parseExactExportDescriptor(descriptor)))
          }
          previous = descriptor
        }

        const last = page.at(-1)
        if (last === undefined) break
        position = { direction: "next", createdAt: last.createdAt, id: last.id }
      }

      const segmentedRows = await this.loadSegmentedExportDetails(segmentedDescriptors)
      for (const [index, row] of segmentedRows.entries()) {
        const slot = segmentedSlots[index]
        if (slot === undefined || exported[slot] !== undefined) {
          throw new Error("audit segmented export slot is invalid")
        }
        exported[slot] = toDetail(row)
      }
      if (exported.some((detail) => detail === undefined)) {
        throw new Error("audit export result is incomplete")
      }
      for (const detail of exported) sizeGuard.add(detail as AuditEventDetail)
      return exported as AuditEventDetail[]
    } catch (error) {
      rethrowRepositoryError(error)
    }
  }
}
