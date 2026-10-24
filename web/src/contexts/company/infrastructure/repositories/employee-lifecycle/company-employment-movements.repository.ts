import { CompanyEmploymentMovementsValue } from "@/contexts/company/domain/values/company-employment-movements.value"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanySnapshotRevisionError } from "@/contexts/company/domain/errors"
import { z } from "zod"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

const rowSchema = z.object({
  resource_id: z.string(),
  revision: z.number().int().positive(),
  state: z.enum(["active", "void"]),
  effective_from: z.string(),
  effective_to: z.string().nullable(),
  attributes_json: z.string(),
})
type Context = { env: { DB: D1Database } }
type Props = Readonly<{
  organizationId: string
  organizationRevision: number
  from: string
  through: string
}>

/** 指定した会社版までの公開雇用履歴だけから、連続在籍の開始・終了を読む。 */
export class CompanyEmploymentMovementsRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async find(props: Props): Promise<CompanyEmploymentMovementsValue | Error> {
    if (!Number.isSafeInteger(props.organizationRevision) || props.organizationRevision < 0)
      return new CompanySnapshotRevisionError()
    try {
      const snapshot = await this.c.env.DB.batch([
        this.c.env.DB.prepare("SELECT revision FROM company_organizations WHERE id = ?1").bind(
          props.organizationId,
        ),
        this.c.env.DB.prepare(`SELECT resource_id, revision, state, effective_from, effective_to, attributes_json
          FROM company_resource_revisions
          WHERE organization_id = ?1 AND resource_type = 'employment' AND organization_revision <= ?2
          ORDER BY resource_id, revision`).bind(props.organizationId, props.organizationRevision),
        this.c.env.DB.prepare(`SELECT count(*) AS missing FROM company_employments employment
          LEFT JOIN company_workforce_resource_bindings binding
            ON binding.resource_type = 'employment' AND binding.resource_id = employment.id
          WHERE (binding.organization_id = ?1 OR (binding.organization_id IS NULL AND ?1 = '${COMPANY_DEFAULT_ORGANIZATION_ID}'))
            AND NOT EXISTS (SELECT 1 FROM company_resource_revisions resource
              WHERE resource.organization_id = ?1 AND resource.resource_type = 'employment'
                AND resource.resource_id = employment.id AND resource.organization_revision <= ?2
                AND json_extract(resource.attributes_json, '$.employeeId') = employment.employee_id)`).bind(
          props.organizationId,
          props.organizationRevision,
        ),
      ])
      if (snapshot.length !== 3 || snapshot.some((part) => !part.success))
        return new Error("failed to read company employment movement snapshot")
      const organization = z
        .object({ revision: z.number().int().nonnegative() })
        .safeParse(snapshot[0]?.results[0])
      if (!organization.success || organization.data.revision < props.organizationRevision)
        return new CompanySnapshotRevisionError()
      const coverage = z
        .object({ missing: z.number().int().nonnegative() })
        .safeParse(snapshot[2]?.results[0])
      if (!coverage.success || coverage.data.missing !== 0)
        return new Error("company employment history migration is incomplete")
      const rows = z.array(rowSchema).safeParse(snapshot[1]?.results)
      if (!rows.success) return rows.error
      const histories = new Map<string, CompanyResourceProps[]>()
      for (const row of rows.data) {
        const attributes = z.record(z.string(), z.json()).safeParse(JSON.parse(row.attributes_json))
        if (!attributes.success) return attributes.error
        const history = histories.get(row.resource_id) ?? []
        history.push({
          organizationId: props.organizationId,
          type: "employment",
          id: row.resource_id,
          revision: row.revision,
          state: row.state,
          effectiveFrom: restoreCalendarDate(row.effective_from),
          effectiveTo: row.effective_to === null ? null : restoreCalendarDate(row.effective_to),
          attributes: attributes.data,
        })
        histories.set(row.resource_id, history)
      }
      return CompanyEmploymentMovementsValue.create({
        histories: [...histories.values()],
        from: props.from,
        through: props.through,
      })
    } catch (cause) {
      return new Error("failed to read company employment movements", { cause })
    }
  }
}
