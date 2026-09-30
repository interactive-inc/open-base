import type {
  CompanyReportingRelationsReadPort,
  CompanyReportingRelationsReadResult,
} from "@/contexts/company/domain/definitions/company-reporting-relations-read.definition"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import type { OrganizationalAuthorityReportingRelationEvidence } from "@/contexts/company/domain/definitions/organizational-authority.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

type Context = D1Database

/** 既定organizationの業務台帳へ、公開APIと同じ時点選択で指揮命令を渡す。 */
export class CompanyReportingRelationsReadAdapter implements CompanyReportingRelationsReadPort {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async readSnapshot(asOf: CalendarDate): Promise<CompanyReportingRelationsReadResult> {
    try {
      const result = await new D1CompanyResourceRepository({ database: this.c }).findMany({
        organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
        types: ["reporting-relation"],
        effectiveOn: asOf,
      })
      if (!result.ok) return result
      const relations: OrganizationalAuthorityReportingRelationEvidence[] = []
      for (const resource of result.resources) {
        const employeeId = resource.readText("employeeId")
        const managerEmployeeId = resource.readText("managerEmployeeId")
        const organizationUnitId = resource.readText("organizationUnitId")
        if (employeeId === null || managerEmployeeId === null || organizationUnitId === null) {
          return {
            ok: false,
            cause: new Error("Company reporting relation references are missing"),
          }
        }
        relations.push({
          employeeId: restoreWorkforceId("employee", employeeId),
          managerEmployeeId: restoreWorkforceId("employee", managerEmployeeId),
          organizationUnitId: restoreWorkforceId("organization_unit", organizationUnitId),
          reportingRelationId: resource.id,
          reportingRelationRevision: resource.revision,
          asOf,
        })
      }
      return { ok: true, companyRevision: result.organizationRevision, relations }
    } catch (cause) {
      return { ok: false, cause }
    }
  }

  async readRevision(): ReturnType<CompanyReportingRelationsReadPort["readRevision"]> {
    try {
      const revision = await this.c
        .prepare(
          `SELECT revision FROM company_organizations WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'`,
        )
        .first<number>("revision")
      if (revision === null) return { ok: true, revision: 0 }
      if (!Number.isSafeInteger(revision) || revision < 0) {
        return { ok: false, cause: new Error("Company organization revision is invalid") }
      }
      return { ok: true, revision }
    } catch (cause) {
      return { ok: false, cause }
    }
  }
}
