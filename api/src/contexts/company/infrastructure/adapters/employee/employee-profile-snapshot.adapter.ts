import { z } from "zod"
import type { EmployeeProfileSnapshot } from "@/contexts/company/domain/entities/employee-profile-change.entity"
import { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

type Context = D1Database
const rowSchema = z.object({
  organization_revision: z.number().int().nonnegative(),
  person_revision: z.number().int().positive(),
  effective_revision: z.number().int().positive(),
  person_id: z.string(),
  employee_code: z.string().nullable(),
  effective_from: z.string().date(),
  effective_to: z.string().date().nullable(),
  attributes_json: z.string(),
})
const attributesSchema = z
  .object({
    officialName: z.string(),
    email: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
  })
  .strict()

/** 人物表示と編集対象の版を、一つの会社snapshotから読む。 */
export class EmployeeProfileSnapshotAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async find(
    input: Readonly<{
      employeeId: string
      effectiveOn: string
      organizationRevision?: number
    }>,
  ): Promise<EmployeeProfileSnapshot | null | Error> {
    try {
      const row = await this.c
        .prepare(`WITH snapshot AS (
        SELECT coalesce(?3, revision) AS revision FROM company_organizations
        WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}' AND (?3 IS NULL OR revision >= ?3)
      ), employee AS (
        SELECT resource.* FROM company_resource_revisions AS resource
        JOIN company_workforce_resource_bindings AS binding
          ON binding.organization_id = resource.organization_id
          AND binding.resource_id = resource.resource_id AND binding.resource_type = 'employee'
        CROSS JOIN snapshot
        WHERE binding.employee_id = ?1 AND resource.organization_id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'
          AND resource.resource_type = 'employee' AND resource.organization_revision <= snapshot.revision
          AND resource.effective_from <= ?2
        ORDER BY resource.effective_from DESC, resource.revision DESC LIMIT 1
      ), person AS (
        SELECT resource.* FROM company_resource_revisions AS resource CROSS JOIN snapshot
        JOIN employee ON resource.resource_id = json_extract(employee.attributes_json, '$.personId')
        WHERE resource.organization_id = '${COMPANY_DEFAULT_ORGANIZATION_ID}' AND resource.resource_type = 'person'
          AND resource.organization_revision <= snapshot.revision AND resource.effective_from <= ?2
          AND employee.state = 'active' AND (employee.effective_to IS NULL OR employee.effective_to > ?2)
        ORDER BY resource.effective_from DESC, resource.revision DESC LIMIT 1
      ) SELECT snapshot.revision AS organization_revision,
        (SELECT max(revision) FROM company_resource_revisions
          WHERE organization_id = '${COMPANY_DEFAULT_ORGANIZATION_ID}' AND resource_type = 'person'
            AND resource_id = person.resource_id AND organization_revision <= snapshot.revision) AS person_revision,
        person.revision AS effective_revision, person.resource_id AS person_id,
        json_extract(employee.attributes_json, '$.employeeCode') AS employee_code,
        person.effective_from, person.effective_to, person.attributes_json
      FROM snapshot CROSS JOIN employee CROSS JOIN person
      WHERE person.state = 'active' AND (person.effective_to IS NULL OR person.effective_to > ?2)`)
        .bind(input.employeeId, input.effectiveOn, input.organizationRevision ?? null)
        .first<unknown>()
      if (row === null) {
        if (input.organizationRevision === undefined) {
          const binding = await this.c
            .prepare(
              "SELECT 1 AS present FROM company_workforce_resource_bindings WHERE employee_id = ?1 AND resource_type = 'employee'",
            )
            .bind(input.employeeId)
            .first<unknown>()
          if (binding !== null) return new Error("bound employee has no effective public profile")
        }
        return null
      }
      const parsed = rowSchema.safeParse(row)
      if (!parsed.success) return parsed.error
      const values = parsed.data
      const attributes = attributesSchema.safeParse(JSON.parse(values.attributes_json))
      if (!attributes.success) return attributes.error
      const person = CompanyResourceEntity.create({
        organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
        type: "person",
        id: values.person_id,
        revision: values.effective_revision,
        state: "active",
        effectiveFrom: restoreCalendarDate(values.effective_from),
        effectiveTo: values.effective_to === null ? null : restoreCalendarDate(values.effective_to),
        attributes: {
          officialName: attributes.data.officialName,
          ...(attributes.data.email === undefined ? {} : { email: attributes.data.email }),
          ...(attributes.data.phone === undefined ? {} : { phone: attributes.data.phone }),
        },
      })
      if (person instanceof Error) return person
      return {
        version: {
          employeeId: input.employeeId,
          organizationRevision: values.organization_revision,
          personRevision: values.person_revision,
          effectiveOn: input.effectiveOn,
        },
        employeeCode: values.employee_code,
        person,
      }
    } catch (cause) {
      return new Error("failed to read employee profile snapshot", { cause })
    }
  }
}
