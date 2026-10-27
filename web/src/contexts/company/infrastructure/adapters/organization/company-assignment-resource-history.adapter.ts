import {
  CompanyResourceEntity,
  type CompanyResourceProps,
} from "@/contexts/company/domain/entities/company-resource.entity"
import { isCalendarDate } from "@/contexts/company/domain/definitions/is-calendar-date.definition"
import { z } from "zod"

const date = z.string().refine(isCalendarDate)
type Context = D1Database
export type CompanyAssignmentResourceHistoryEntry = CompanyResourceProps &
  Readonly<{ correctsRevision: number | null }>

/** 公開所属の全revisionを同じ属性・日付契約で復元する。 */
export class CompanyAssignmentResourceHistoryAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async read(
    resource: Readonly<{ organizationId: string; id: string }>,
  ): Promise<ReadonlyArray<CompanyResourceEntity> | Error> {
    const revisions = await this.readRevisions(resource)
    if (revisions instanceof Error) return revisions
    const history: CompanyResourceEntity[] = []
    for (const revision of revisions) {
      const entity = CompanyResourceEntity.create(revision)
      if (entity instanceof Error) return entity
      history.push(entity)
    }
    return history
  }

  /**
   * 全revisionを、訂正先の版の番号と一緒に返す。期間を計算する側は、訂正された版を有効な履歴から
   * 外すためにこの番号を使う。
   */
  async readRevisions(
    resource: Readonly<{ organizationId: string; id: string }>,
  ): Promise<ReadonlyArray<CompanyAssignmentResourceHistoryEntry> | Error> {
    const rows = await this.c
      .prepare(`SELECT revision, state, effective_from, effective_to, attributes_json, corrects_revision
      FROM company_resource_revisions WHERE organization_id = ?1 AND resource_type = 'assignment' AND resource_id = ?2
      ORDER BY revision`)
      .bind(resource.organizationId, resource.id)
      .all()
    if (!rows.success) return new Error("failed to read assignment resource history")
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
    const history: CompanyAssignmentResourceHistoryEntry[] = []
    for (const row of parsed.data) {
      const attributes = z.record(z.string(), z.json()).safeParse(JSON.parse(row.attributes_json))
      if (!attributes.success) return attributes.error
      history.push({
        organizationId: resource.organizationId,
        type: "assignment",
        id: resource.id,
        revision: row.revision,
        state: row.state,
        effectiveFrom: row.effective_from,
        effectiveTo: row.effective_to,
        attributes: attributes.data,
        correctsRevision: row.corrects_revision,
      })
    }
    return history
  }
}
