import { z } from "zod"
import type { SystemD1Context } from "@system/configuration/system-context"
import { RecordSourceFreezeRepository } from "@system/infrastructure/repositories/records/record-source-freeze.repository"
import { RecordCoveragePageEntity } from "@system/domain/entities/record-coverage-page.entity"

type Context = SystemD1Context & Readonly<{ assertions: ReadonlyArray<D1PreparedStatement> }>
const chainSql = `WITH pages AS (
  SELECT * FROM system_record_coverage_pages WHERE freeze_id=?1 AND record_kind=?2
), entry_counts AS (
  SELECT page_id,count(*) AS record_count FROM system_record_coverage_entries
  WHERE freeze_id=?1 AND record_kind=?2 GROUP BY page_id
), terminal AS (
  SELECT * FROM pages ORDER BY sequence DESC LIMIT 1
), totals AS (
  SELECT count(*) AS page_count, coalesce(sum(json_array_length(snapshot_json,'$.records')),0) AS record_count FROM pages
)
SELECT terminal.snapshot_json,terminal.digest,totals.page_count,totals.record_count
FROM terminal,totals WHERE terminal.next_cursor IS NULL
AND terminal.sequence=totals.page_count
AND NOT EXISTS (
  SELECT 1 FROM pages current LEFT JOIN pages previous ON previous.sequence=current.sequence-1
  LEFT JOIN entry_counts counts ON counts.page_id=current.id
  WHERE json_extract(current.snapshot_json,'$.sourceNamespace') IS NOT ?3
    OR json_extract(current.snapshot_json,'$.ownerContext') IS NOT ?4
    OR json_extract(current.snapshot_json,'$.purpose') IS NOT ?5
    OR (current.sequence=1 AND (current.after_cursor IS NOT NULL OR current.previous_digest IS NOT NULL))
    OR (current.sequence>1 AND (previous.id IS NULL OR previous.next_cursor IS NULL
      OR current.previous_digest IS NOT previous.digest OR current.after_cursor IS NOT previous.next_cursor))
    OR coalesce(counts.record_count,0) != json_array_length(current.snapshot_json,'$.records')
)`

/** 一つの記録種別の照合が先頭から終端まで連続することを検査する。本文・添付の再検証や撤去許可は行わない。 */
export class PrepareRecordKindCoverageAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown) {
    const parsed = z
      .strictObject({
        freezeId: z.uuid(),
        sourceNamespace: z.string().regex(/^\S{1,255}$/),
        ownerContext: z.string().regex(/^[a-z][a-z0-9-]{0,99}$/),
        recordKind: z.string().regex(/^[a-z][a-z0-9_.:-]{0,199}$/),
        purpose: z.string().trim().min(1).max(255),
      })
      .safeParse(input)
    if (!parsed.success) return parsed.error
    if (this.c.assertions.length === 0) return new Error("coverage authorization required")
    const scope = parsed.data
    const generation = await new RecordSourceFreezeRepository(this.c).prepareActiveGeneration({
      id: scope.freezeId,
      sourceNamespace: scope.sourceNamespace,
      ownerContext: scope.ownerContext,
    })
    if (generation instanceof Error) return generation
    const parameters = [
      scope.freezeId,
      scope.recordKind,
      scope.sourceNamespace,
      scope.ownerContext,
      scope.purpose,
    ]
    try {
      const statements = [
        ...generation.assertions,
        this.c.env.DB.prepare(chainSql).bind(...parameters),
        ...generation.assertions,
      ]
      const results = await this.c.env.DB.batch<{
        snapshot_json: string
        digest: string
        page_count: number
        record_count: number
      }>(statements)
      if (results.length !== statements.length || results.some((result) => !result.success))
        return new Error("coverage chain lookup failed")
      const row = results[generation.assertions.length]?.results[0]
      if (row === undefined) return new Error("record kind coverage is incomplete")
      const terminal = await RecordCoveragePageEntity.restore(
        JSON.parse(row.snapshot_json),
        row.digest,
      )
      if (terminal instanceof Error) return terminal
      if (!Number.isSafeInteger(row.page_count) || !Number.isSafeInteger(row.record_count))
        return new Error("coverage count exceeds supported range")
      const assertions = [
        ...generation.assertions,
        this.c.env.DB.prepare(`SELECT CASE WHEN EXISTS (
          SELECT 1 FROM (${chainSql}) verified WHERE snapshot_json IS ?6 AND digest IS ?7
          AND page_count=?8 AND record_count=?9
        ) THEN 1 ELSE json_extract('{}','record_kind_coverage_changed') END`).bind(
          ...parameters,
          row.snapshot_json,
          row.digest,
          row.page_count,
          row.record_count,
        ),
      ]
      return Object.freeze({
        summary: Object.freeze({
          ...scope,
          terminalPageId: terminal.snapshot.id,
          terminalDigest: terminal.digest,
          pageCount: row.page_count,
          recordCount: row.record_count,
        }),
        assertions: Object.freeze(assertions),
      })
    } catch (cause) {
      return new Error("coverage chain verification failed", { cause })
    }
  }
}
