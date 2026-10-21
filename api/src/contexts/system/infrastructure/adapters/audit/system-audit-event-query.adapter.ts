import type { SystemAuditOutcome } from "@system/domain/entities/system-audit-event.entity"
import {
  systemAuditDisclosedEventSchema,
  type SystemAuditDisclosedEvent,
} from "@system/domain/schemas/audit/system-audit-disclosed-event.schema"
import { SystemAuditPageBoundaryValue } from "@system/domain/values/audit/system-audit-page-boundary.value"
import { SystemAuditDisclosureSqlAdapter } from "@system/infrastructure/adapters/audit/system-audit-disclosure-sql.adapter"
import type { PreparedSystemAuditDisclosure } from "@system/infrastructure/adapters/audit/system-audit-disclosure-read.adapter"
import type { SystemD1Context } from "@system/configuration/system-context"
import { systemAuditEvents } from "@system/infrastructure/schema/system-core"
import { and, sql, type SQL } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"

export type SystemAuditEventPage = Readonly<{
  events: ReadonlyArray<SystemAuditDisclosedEvent>
  total: number
  /** 続きのページに渡す境界。条件に合う行が無ければ null。 */
  boundary: SystemAuditPageBoundaryValue | null
}>
type ListQuery = Readonly<{
  action: string | null
  actorAccountId: string | null
  outcome: SystemAuditOutcome | null
  targetType: string | null
  targetId: string | null
  occurredFrom: Date | null
  occurredTo: Date | null
  limit: number
  offset: number
  /** 渡すと、並び順でこの境界より後の行を返さず件数にも含めない。 */
  boundary: SystemAuditPageBoundaryValue | null
}>
type Context = SystemD1Context

/**
 * 開示条件を射影・検索・件数に適用し、同じtransactionで資格と設定版を再検査する。
 * 境界を渡さない取得は、同じ条件で最も新しい行を続きのページ用の境界として返す。
 */
export class SystemAuditEventQueryAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async list(
    query: ListQuery,
    disclosure: PreparedSystemAuditDisclosure,
    additionalCondition?: SQL,
  ): Promise<SystemAuditEventPage | Error> {
    if (
      !Number.isSafeInteger(query.limit) ||
      query.limit < 1 ||
      query.limit > 10000 ||
      !Number.isSafeInteger(query.offset) ||
      query.offset < 0
    )
      return new Error("invalid audit pagination")
    const fields = new SystemAuditDisclosureSqlAdapter(disclosure)
    const conditions = [fields.condition(), additionalCondition]
    if (query.action !== null) conditions.push(sql`action = ${query.action}`)
    if (query.actorAccountId !== null)
      conditions.push(sql`${fields.field("actor_account_id")} = ${query.actorAccountId}`)
    if (query.outcome !== null) conditions.push(sql`outcome = ${query.outcome}`)
    if (query.targetType !== null) conditions.push(sql`target_type = ${query.targetType}`)
    if (query.targetId !== null)
      conditions.push(sql`${fields.field("target_id")} = ${query.targetId}`)
    if (query.occurredFrom !== null)
      conditions.push(sql`occurred_at >= ${query.occurredFrom.getTime()}`)
    if (query.occurredTo !== null) conditions.push(sql`occurred_at < ${query.occurredTo.getTime()}`)
    if (query.boundary !== null)
      conditions.push(
        sql`(occurred_at < ${query.boundary.occurredAtEpochMilliseconds} OR (occurred_at = ${query.boundary.occurredAtEpochMilliseconds} AND event_id <= ${query.boundary.eventId}))`,
      )
    return this.read(and(...conditions), query.limit, query.offset, disclosure, query.boundary)
  }

  async findById(
    eventId: string,
    disclosure: PreparedSystemAuditDisclosure,
  ): Promise<SystemAuditDisclosedEvent | null | Error> {
    const fields = new SystemAuditDisclosureSqlAdapter(disclosure)
    const page = await this.read(
      and(fields.condition(), sql`event_id = ${eventId}`),
      1,
      0,
      disclosure,
      null,
    )
    return page instanceof Error ? page : (page.events.at(0) ?? null)
  }

  private async read(
    condition: SQL | undefined,
    limit: number,
    offset: number,
    disclosure: PreparedSystemAuditDisclosure,
    boundary: SystemAuditPageBoundaryValue | null,
  ): Promise<SystemAuditEventPage | Error> {
    try {
      const readsNewest = boundary === null && offset > 0
      const database = drizzle(this.c.env.DB)
      const fields = new SystemAuditDisclosureSqlAdapter(disclosure)
      const select = database
        .select({ snapshot: fields.projection() })
        .from(systemAuditEvents)
        .where(condition)
        .orderBy(sql`occurred_at DESC`, sql`event_id DESC`)
        .limit(limit)
        .offset(offset)
        .toSQL()
      const count = database
        .select({ total: sql<number>`count(*)`.as("total") })
        .from(systemAuditEvents)
        .where(condition)
        .toSQL()
      const newest = database
        .select({
          occurredAt: sql<number>`occurred_at`.as("occurred_at"),
          eventId: sql<string>`event_id`.as("event_id"),
        })
        .from(systemAuditEvents)
        .where(condition)
        .orderBy(sql`occurred_at DESC`, sql`event_id DESC`)
        .limit(1)
        .toSQL()
      const results = await this.c.env.DB.batch<{
        snapshot_json?: string
        total?: number
        occurred_at?: number
        event_id?: string
      }>([
        ...disclosure.assertions,
        this.c.env.DB.prepare(select.sql).bind(...select.params),
        this.c.env.DB.prepare(count.sql).bind(...count.params),
        // 先頭から読むときは1行目が最新行なので、続きの位置から境界なしで読むときだけ最新行を別に読む。
        ...(readsNewest ? [this.c.env.DB.prepare(newest.sql).bind(...newest.params)] : []),
      ])
      const base = disclosure.assertions.length
      if (
        results.length !== base + (readsNewest ? 3 : 2) ||
        results.some((result) => !result.success)
      )
        return new Error("System audit query did not succeed")
      const events: SystemAuditDisclosedEvent[] = []
      for (const row of results.at(base)?.results ?? []) {
        if (typeof row.snapshot_json !== "string") return new Error("System audit row is invalid")
        const parsed = systemAuditDisclosedEventSchema.safeParse(JSON.parse(row.snapshot_json))
        if (!parsed.success)
          return new Error("System audit row is invalid", { cause: parsed.error })
        events.push(parsed.data)
      }
      const total = results.at(base + 1)?.results.at(0)?.total
      if (typeof total !== "number" || !Number.isSafeInteger(total) || total < 0)
        return new Error("System audit total is invalid")
      const effectiveBoundary =
        boundary ??
        this.toBoundary(readsNewest ? results.at(base + 2)?.results.at(0) : events.at(0))
      if (effectiveBoundary instanceof Error) return effectiveBoundary
      return Object.freeze({ events: Object.freeze(events), total, boundary: effectiveBoundary })
    } catch (cause) {
      return new Error("System audit query failed", { cause })
    }
  }

  private toBoundary(
    row:
      | Readonly<{ occurred_at?: number; event_id?: string }>
      | SystemAuditDisclosedEvent
      | undefined,
  ): SystemAuditPageBoundaryValue | null | Error {
    if (row === undefined) return null

    if ("eventId" in row)
      return SystemAuditPageBoundaryValue.from({
        occurredAtEpochMilliseconds: row.occurredAtEpochMilliseconds,
        eventId: row.eventId,
      })

    if (typeof row.occurred_at !== "number" || typeof row.event_id !== "string")
      return new Error("System audit boundary row is invalid")

    return SystemAuditPageBoundaryValue.from({
      occurredAtEpochMilliseconds: row.occurred_at,
      eventId: row.event_id,
    })
  }
}
