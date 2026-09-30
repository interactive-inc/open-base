import { CompanyReportingRelationsReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/company-reporting-relations-read.adapter"
import { CanonicalOrganizationAuthorityEvidenceAdapter } from "@/contexts/company/infrastructure/adapters/workforce/canonical-organization-authority-evidence.adapter"
import { ResolveOrganizationAuthority } from "@/contexts/company/lib/workforce/resolve-organization-authority"
import { WorkforceSnapshotChangedError } from "@/contexts/company/domain/errors"
import type {
  OrganizationalAuthorityCandidateResolution,
  OrganizationalAuthorityCriterion as ProcedureCriterion,
} from "@/contexts/company/domain/definitions/organizational-authority-candidate.definition"
import type { OrganizationalAuthorityCriterion } from "@/contexts/company/domain/definitions/organizational-authority.definition"
import { periodContainsDate } from "@/contexts/company/domain/definitions/period-contains-date.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { restoreOrgResponsibilityType } from "@/contexts/company/domain/definitions/restore-org-responsibility-type.definition"
import type {
  EmployeeId,
  OrganizationUnitId,
} from "@/contexts/company/domain/definitions/workforce-id.definition"
import { OrganizationUnitReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/organization-unit-read.adapter"
import { OrganizationWorkforceSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/workforce/organization-workforce-snapshot.adapter"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import {
  CompanyOperationError,
  CompanyConflictError,
  CompanyUnexpectedError,
} from "@/contexts/company/domain/errors"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"

type EmployeeRow = Readonly<{ id: EmployeeId; code: string | null }>

type CanonicalCriteria = Readonly<{
  criteria: ReadonlyArray<OrganizationalAuthorityCriterion>
  indexes: ReadonlyArray<number>
}>

function toCriteria(props: {
  criteria: ReadonlyArray<ProcedureCriterion>
  employeeRows: ReadonlyArray<EmployeeRow>
  targetDepartmentCode: string | null
  organizationUnitIdsByCode: ReadonlyMap<string, OrganizationUnitId>
}): CanonicalCriteria | CompanyOperationError {
  const organizationUnitId = (code: string) => props.organizationUnitIdsByCode.get(code)
  const byCode = new Map(
    props.employeeRows.flatMap((employee) =>
      employee.code === null ? [] : [[employee.code, employee.id]],
    ),
  )
  const criteria: OrganizationalAuthorityCriterion[] = []
  const indexes: number[] = []

  for (const [index, criterion] of props.criteria.entries()) {
    if (criterion.kind === "technical_role") continue
    if (criterion.kind === "employee") {
      const employeeId = byCode.get(criterion.employeeCode)
      if (employeeId === undefined) {
        return new CompanyConflictError(
          "判断資格の従業員を解決できません",
          "organizational_authority_employee_reference_missing",
        )
      }
      criteria.push({ kind: "employee", employeeId })
    } else if (criterion.kind === "department_manager") {
      criteria.push({ kind: "subject_organization_manager" })
    } else if (criterion.kind === "target_department_manager") {
      if (props.targetDepartmentCode === null) {
        return new CompanyConflictError(
          "対象組織が指定されていません",
          "organizational_authority_organization_reference_missing",
        )
      }
      const targetOrganizationUnitId = organizationUnitId(props.targetDepartmentCode)
      if (targetOrganizationUnitId === undefined) {
        return new CompanyConflictError(
          "対象組織を解決できません",
          "organizational_authority_organization_reference_missing",
        )
      }
      criteria.push({
        kind: "target_organization_manager",
        organizationUnitId: targetOrganizationUnitId,
      })
    } else if (criterion.kind === "responsibility") {
      const scopedOrganizationUnitId =
        criterion.organizationUnitCode === null
          ? null
          : organizationUnitId(criterion.organizationUnitCode)
      if (scopedOrganizationUnitId === undefined) {
        return new CompanyConflictError(
          "判断資格の組織を解決できません",
          "organizational_authority_organization_reference_missing",
        )
      }
      criteria.push({
        kind: "responsibility",
        responsibilityType: restoreOrgResponsibilityType(criterion.responsibilityType),
        organizationUnitId: scopedOrganizationUnitId,
      })
    } else {
      criteria.push({ kind: criterion.kind })
    }
    indexes.push(index)
  }

  return { criteria, indexes }
}

/** canonical Company snapshotと共通Application serviceから既存内部wireを構成する。 */
async function resolveCanonicalOrganizationAuthority(props: {
  c: CompanyContext
  subjectEmployeeId: EmployeeId | null
  criteria: ReadonlyArray<ProcedureCriterion>
  employeeRows: ReadonlyArray<EmployeeRow>
  targetDepartmentCode: string | null
  asOf: string
}): Promise<OrganizationalAuthorityCandidateResolution | CompanyOperationError> {
  // 組織単位の ID は組織コードから組み立てず、判定日に有効な組織単位の期間からコードで引く。
  const asOf = restoreCalendarDate(props.asOf)
  const organizationUnitIdsByCode = new Map<string, OrganizationUnitId>()
  if (
    props.targetDepartmentCode !== null ||
    props.criteria.some(
      (criterion) => criterion.kind === "responsibility" && criterion.organizationUnitCode !== null,
    )
  ) {
    const organization = await new OrganizationUnitReadAdapter(props.c.var.database).readSnapshot(
      asOf,
    )
    if (!organization.ok) {
      return new CompanyUnexpectedError("組織単位を読み取れません", { cause: organization.cause })
    }
    for (const unit of organization.snapshot.units) {
      if (!unit.isVoid && periodContainsDate(unit, asOf))
        organizationUnitIdsByCode.set(unit.code, unit.organizationUnitId)
    }
  }
  const canonicalCriteria = toCriteria({ ...props, organizationUnitIdsByCode })
  if (canonicalCriteria instanceof CompanyOperationError) return canonicalCriteria

  const result = await new ResolveOrganizationAuthority({
    organization: new OrganizationUnitReadAdapter(props.c.var.database),
    workforce: new OrganizationWorkforceSnapshotAdapter(props.c),
    reporting: new CompanyReportingRelationsReadAdapter(props.c.env.DB),
  }).execute({
    subjectEmployeeId: props.subjectEmployeeId,
    criteria: canonicalCriteria.criteria,
    asOf,
  })

  if (result.kind === "unavailable") {
    if (result.cause instanceof WorkforceSnapshotChangedError) {
      return new CompanyConflictError(
        "組織 revision が変化したため判断資格を固定できません",
        "organization_revision_conflict",
        { cause: result.cause },
      )
    }
    return new CompanyUnexpectedError("組織資格のsnapshotを固定できません", { cause: result.cause })
  }
  if (result.kind === "invalid") {
    return new CompanyConflictError(
      "組織投影が不整合なため判断資格を固定できません",
      "code" in result.error ? String(result.error.code) : "lifecycle_projection_mismatch",
      { cause: result.error },
    )
  }

  const candidates: OrganizationalAuthorityCandidateResolution["candidates"][number][] = []
  for (const candidate of result.resolution.candidates) {
    const criterionIndex = canonicalCriteria.indexes[candidate.qualification.criterionIndex]
    if (criterionIndex === undefined) {
      return new CompanyUnexpectedError("組織資格の条件を解決できません")
    }
    candidates.push({
      employeeId: candidate.employeeId,
      accountId: zAccountId.parse(String(candidate.accountId)),
      qualification: {
        criterionIndex,
        evidence: {
          ...new CanonicalOrganizationAuthorityEvidenceAdapter(
            candidate.qualification.evidence,
          ).serialize(),
          system_account_id: candidate.accountId,
        },
      },
    })
  }

  return {
    snapshot: {
      schemaVersion: 1,
      source: "lifecycle",
      asOf: result.resolution.snapshot.asOf,
      organizationRevision: result.resolution.snapshot.organizationRevision,
      companyRevision: result.resolution.snapshot.companyRevision,
    },
    candidates,
  }
}
type ResolveCanonicalOrganizationAuthorityAdapterContext = {
  c: CompanyContext
  subjectEmployeeId: EmployeeId | null
  criteria: ReadonlyArray<ProcedureCriterion>
  employeeRows: ReadonlyArray<EmployeeRow>
  targetDepartmentCode: string | null
  asOf: string
}
type Context = ResolveCanonicalOrganizationAuthorityAdapterContext

export class ResolveCanonicalOrganizationAuthorityAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async resolveCanonicalOrganizationAuthority(): Promise<
    OrganizationalAuthorityCandidateResolution | CompanyOperationError
  > {
    return resolveCanonicalOrganizationAuthority(this.c)
  }
}
