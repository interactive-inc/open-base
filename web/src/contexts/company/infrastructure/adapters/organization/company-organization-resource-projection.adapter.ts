import { companyOperationId } from "@/contexts/company/domain/definitions/company-operation-id.definition"
import { CompanyResponsibilityResourceProjectionAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-responsibility-resource-projection.adapter"
import { CompanyAssignmentResourceProjectionAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-assignment-resource-projection.adapter"
import type { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { OrganizationWorkforceChangeEntity } from "@/contexts/company/domain/entities/organization-workforce-change.entity"
import { CompanyResourceValidationError } from "@/contexts/company/domain/errors"
import { OrganizationUnitReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/organization-unit-read.adapter"
import { OrganizationUnitChangeStatementAdapter } from "@/contexts/company/infrastructure/adapters/organization/organization-unit-change-statement.adapter"
import {
  OrganizationStructureValue,
  type OrganizationUnitPeriod,
} from "@/contexts/company/domain/values/organization-structure.value"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { drizzle } from "drizzle-orm/d1"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"
type Context = D1Database
export type PreparedCompanyOrganizationProjection = Readonly<{
  beforeWorkforce: ReadonlyArray<D1PreparedStatement>
  statements: ReadonlyArray<D1PreparedStatement>
}>

/** 既定Companyの公開組織変更を、既存の期間台帳と同じtransactionへ接続する。 */
export class CompanyOrganizationResourceProjectionAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  async prepare(
    change: CompanyResourceChangeEntity,
    fingerprint: string,
  ): Promise<PreparedCompanyOrganizationProjection | Error> {
    const resources = change.resources.filter(
      (resource) =>
        resource.type === "organization-unit" &&
        resource.organizationId === COMPANY_DEFAULT_ORGANIZATION_ID,
    )
    if (
      resources.length === 0 &&
      !change.resources.some(
        (resource) =>
          resource.type === "assignment" || resource.type === "responsibility-assignment",
      )
    )
      return { beforeWorkforce: [], statements: [] }
    const first =
      resources[0] ??
      change.resources.find(
        (resource) =>
          resource.type === "assignment" || resource.type === "responsibility-assignment",
      )
    if (first === undefined) return new CompanyResourceValidationError("invalid_organization")
    const operationKey = `org-resource:${fingerprint}`
    const operationId = restoreWorkforceId("personnel_action", companyOperationId(operationKey))
    const assignmentProjection = await new CompanyAssignmentResourceProjectionAdapter(
      this.c,
    ).prepare(change, operationId)
    if (assignmentProjection instanceof Error) return assignmentProjection
    const responsibilityProjection = await new CompanyResponsibilityResourceProjectionAdapter(
      this.c,
    ).prepare(change, operationId)
    if (responsibilityProjection instanceof Error) return responsibilityProjection
    if (
      resources.length === 0 &&
      assignmentProjection.assignments.length === 0 &&
      responsibilityProjection.responsibilities.length === 0
    )
      return {
        beforeWorkforce: [],
        statements: [...assignmentProjection.bindings, ...responsibilityProjection.bindings],
      }
    const snapshot = await new OrganizationUnitReadAdapter(drizzle(this.c)).readSnapshot(
      first.effectiveFrom,
    )
    if (!snapshot.ok)
      return new Error("organization projection snapshot unavailable", { cause: snapshot.cause })
    const periods: OrganizationUnitPeriod[] = []
    for (const resource of resources) {
      const period = resource.toOrganizationUnitPeriod()
      if (period === null) return new CompanyResourceValidationError("invalid_organization")
      periods.push({ ...period, recordedByActionId: operationId, recordedAt: change.recordedAt })
    }
    const ids = [...new Set(periods.map((period) => period.organizationUnitId))]
    const existing = await this.c
      .prepare(`SELECT unit.id, binding.organization_id FROM company_organization_units AS unit
      LEFT JOIN company_organization_resource_bindings AS binding ON binding.organization_unit_id = unit.id
      WHERE unit.id IN (SELECT value FROM json_each(?1))`)
      .bind(JSON.stringify(ids))
      .all<{ id: string; organization_id: string | null }>()
    if (!existing.success) return new Error("organization bindings unavailable")
    if (existing.results.some((unit) => unit.organization_id !== COMPANY_DEFAULT_ORGANIZATION_ID))
      return new CompanyResourceValidationError("invalid_organization")
    const newIds = ids.filter((id) => !existing.results.some((unit) => unit.id === id))
    for (const period of periods) {
      const previous = snapshot.snapshot.units.find((unit) => unit.periodId === period.periodId)
      if (
        period.revision !== (previous?.revision ?? 0) + 1 ||
        (previous !== undefined && previous.organizationUnitId !== period.organizationUnitId)
      )
        return new CompanyResourceValidationError("invalid_organization")
    }
    const units = snapshot.snapshot.units.filter(
      (unit) => !periods.some((period) => period.periodId === unit.periodId),
    )
    const structure = OrganizationStructureValue.restore({
      revision:
        snapshot.snapshot.revision +
        periods.length +
        assignmentProjection.assignments.length +
        responsibilityProjection.responsibilities.length,
      asOf: first.effectiveFrom,
      units: [...units, ...periods],
    })
    if (!(structure instanceof OrganizationStructureValue))
      return new CompanyResourceValidationError("invalid_organization")
    const typed = OrganizationWorkforceChangeEntity.restore({
      operationId,
      operationKey,
      expectedRevision: snapshot.snapshot.revision,
      asOf: first.effectiveFrom,
      recordedAt: change.recordedAt,
      actorAccountId: change.actorAccountId,
      reason: "organization_resource_change",
      evidenceReferences: [
        {
          context: "company",
          kind: "command",
          id: change.commandId,
          version: String(change.expectedRevision + 1),
        },
      ],
      organizationUnits: newIds.map((id) => ({ id, createdAt: change.recordedAt })),
      unitPeriods: periods.toSorted(
        (left, right) =>
          Number(!left.isVoid && left.endsOn === null) -
            Number(!right.isVoid && right.endsOn === null) ||
          left.startsOn.localeCompare(right.startsOn),
      ),
      assignments: assignmentProjection.assignments,
      responsibilities: responsibilityProjection.responsibilities,
    })
    if (typed instanceof Error) return new CompanyResourceValidationError("invalid_organization")
    const statements = new OrganizationUnitChangeStatementAdapter(this.c).prepare(
      typed,
      fingerprint,
    )
    const completed = statements.at(-1)
    if (completed === undefined) return new Error("organization completion statement missing")
    const withdrawalCount = [
      ...assignmentProjection.assignments,
      ...responsibilityProjection.responsibilities,
    ].filter((period) => period.isVoid).length
    return {
      beforeWorkforce: statements.slice(0, withdrawalCount + 1),
      statements: [
        ...statements.slice(withdrawalCount + 1, -1),
        ...newIds.map((id) =>
          this.c
            .prepare(`INSERT INTO company_organization_resource_bindings
      (organization_unit_id, organization_id, recorded_at) VALUES (?1, '${COMPANY_DEFAULT_ORGANIZATION_ID}', ?2)`)
            .bind(id, change.recordedAt),
        ),
        ...assignmentProjection.bindings,
        ...responsibilityProjection.bindings,
        completed,
      ],
    }
  }
}
