import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { isCalendarDate } from "@/contexts/company/domain/definitions/is-calendar-date.definition"
import { z } from "zod"

const date = z.string().refine(isCalendarDate)
type Context = D1Database
export type CompanyEmploymentResourceHistoryEntry = CompanyResourceProps &
  Readonly<{ correctsRevision: number | null }>

/** 公開雇用の全revisionを同じ属性・日付契約で復元する。 */
export class CompanyEmploymentResourceHistoryAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async read(
    resource: Readonly<{ organizationId: string; id: string }>,
  ): Promise<ReadonlyArray<CompanyEmploymentResourceHistoryEntry> | Error> {
    const rows = await this.c
      .prepare(`SELECT revision, state, effective_from, effective_to, attributes_json, corrects_revision
      FROM company_resource_revisions WHERE organization_id = ?1 AND resource_type = 'employment' AND resource_id = ?2
      ORDER BY revision`)
      .bind(resource.organizationId, resource.id)
      .all()
    if (!rows.success) return new Error("failed to read employment resource history")
    const parsed = z
      .array(
        z.object({
          revision: z.number().int().positive(),
          state: z.enum(["active", "void"]),
          effective_from: date,
          effective_to: date.nullable(),
          attributes_json: z.string(),
          corrects_revision: z.number().int().positive().nullable(),
        }),
      )
      .safeParse(rows.results)
    if (!parsed.success) return parsed.error
    const history: CompanyEmploymentResourceHistoryEntry[] = []
    for (const row of parsed.data) {
      const attributes = z.record(z.string(), z.json()).safeParse(JSON.parse(row.attributes_json))
      if (!attributes.success) return attributes.error
      const resourceProps: CompanyEmploymentResourceHistoryEntry = {
        organizationId: resource.organizationId,
        type: "employment",
        id: resource.id,
        revision: row.revision,
        state: row.state,
        effectiveFrom: row.effective_from,
        effectiveTo: row.effective_to,
        attributes: attributes.data,
        correctsRevision: row.corrects_revision,
      }
      history.push(resourceProps)
    }
    return history
  }

  async readMany(
    input: Readonly<{
      organizationId: string
      employmentIds: ReadonlyArray<string>
      organizationRevision: number
    }>,
  ): Promise<ReadonlyMap<string, ReadonlyArray<CompanyEmploymentResourceHistoryEntry>> | Error> {
    if (
      input.employmentIds.length < 1 ||
      input.employmentIds.length > 100 ||
      !Number.isSafeInteger(input.organizationRevision) ||
      input.organizationRevision < 0
    ) {
      return new Error("invalid employment history query")
    }
    const rows = await this.c
      .prepare(`SELECT resource_id, revision, state, effective_from, effective_to, attributes_json, corrects_revision
      FROM company_resource_revisions
      WHERE organization_id = ?1 AND resource_type = 'employment'
        AND resource_id IN (SELECT value FROM json_each(?2))
        AND organization_revision <= ?3
      ORDER BY resource_id, revision`)
      .bind(
        input.organizationId,
        JSON.stringify([...new Set(input.employmentIds)]),
        input.organizationRevision,
      )
      .all()
      .catch((cause: unknown) =>
        cause instanceof Error ? cause : new Error("failed to read employment resource histories"),
      )
    if (rows instanceof Error) return rows
    if (!rows.success) return new Error("failed to read employment resource histories")
    const parsed = z
      .array(
        z.object({
          resource_id: z.string(),
          revision: z.number().int().positive(),
          state: z.enum(["active", "void"]),
          effective_from: date,
          effective_to: date.nullable(),
          attributes_json: z.string(),
          corrects_revision: z.number().int().positive().nullable(),
        }),
      )
      .safeParse(rows.results)
    if (!parsed.success) return parsed.error
    const histories = new Map<string, CompanyEmploymentResourceHistoryEntry[]>()
    for (const row of parsed.data) {
      let attributes: unknown
      try {
        attributes = JSON.parse(row.attributes_json)
      } catch (cause) {
        return new Error("invalid employment resource attributes", { cause })
      }
      const parsedAttributes = z.record(z.string(), z.json()).safeParse(attributes)
      if (!parsedAttributes.success) return parsedAttributes.error
      const history = histories.get(row.resource_id) ?? []
      history.push({
        organizationId: input.organizationId,
        type: "employment",
        id: row.resource_id,
        revision: row.revision,
        state: row.state,
        effectiveFrom: row.effective_from,
        effectiveTo: row.effective_to,
        attributes: parsedAttributes.data,
        correctsRevision: row.corrects_revision,
      })
      histories.set(row.resource_id, history)
    }
    return histories
  }
}
