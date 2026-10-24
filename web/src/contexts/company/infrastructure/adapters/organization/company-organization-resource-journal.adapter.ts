import type { OrganizationWorkforceChangeEntity } from "@/contexts/company/domain/entities/organization-workforce-change.entity"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import {
  CompanyUnavailableError,
  CompanyValidationError,
  type CompanyOperationError,
} from "@/contexts/company/domain/errors"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { CompanyResourceJournalAdapter } from "@/contexts/company/infrastructure/adapters/core/company-resource-journal.adapter"
import { validateCompanyOrganizationChange } from "@/contexts/company/domain/policies/company-organization.policy"
import { drizzle } from "drizzle-orm/d1"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"
type Context = D1Database

/** 接続済みの組織への既存writeを公開履歴へ反映し、新設組織は接続済みの親から引き継ぐ。 */
export class CompanyOrganizationResourceJournalAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  async prepare(
    change: OrganizationWorkforceChangeEntity,
  ): Promise<ReadonlyArray<D1PreparedStatement> | CompanyOperationError> {
    // この経路は組織単位の期間だけを公開履歴へ写す。所属と責務を旧台帳だけへ保存させない。
    if (change.assignments.length > 0 || change.responsibilities.length > 0)
      return new CompanyValidationError(
        "所属と責務の変更は組織変更または人事発令で記録してください",
        "invalid_change",
      )
    if (change.unitPeriods.length === 0) return []
    try {
      const bindings = await this.c
        .prepare(
          `SELECT organization_unit_id FROM company_organization_resource_bindings WHERE organization_id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'`,
        )
        .all<{ organization_unit_id: string }>()
      if (!bindings.success)
        return new CompanyUnavailableError(
          "公開組織の接続台帳を参照できません",
          "organization_change_unavailable",
        )
      const connected = new Set(bindings.results.map((binding) => binding.organization_unit_id))
      if (connected.size === 0) return []
      const newIds = new Set(change.organizationUnits.map((unit) => unit.id))
      for (const parentId of connected) {
        for (const period of change.unitPeriods) {
          if (newIds.has(period.organizationUnitId) && period.parentOrganizationUnitId === parentId)
            connected.add(period.organizationUnitId)
        }
      }
      const periods = change.unitPeriods.filter((period) =>
        connected.has(period.organizationUnitId),
      )
      if (periods.length === 0) return []
      const repository = new D1CompanyResourceRepository({ database: this.c })
      const current = await repository.findMany({
        organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
        types: ["organization-unit"],
      })
      if (!current.ok)
        return new CompanyUnavailableError(
          "公開組織を参照できません",
          "organization_change_unavailable",
          { cause: current.cause },
        )
      const command = CompanyResourceChangeEntity.create({
        commandId: `legacy-org:${change.operationId}`,
        expectedRevision: current.organizationRevision,
        actorAccountId: change.actorAccountId,
        reason: change.reason,
        recordedAt: change.recordedAt,
        resources: periods.map((period) => ({
          organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
          type: "organization-unit",
          id: period.periodId,
          revision: period.revision,
          state: period.isVoid ? "void" : "active",
          effectiveFrom: period.startsOn,
          effectiveTo: period.endsOn,
          attributes: {
            organizationUnitId: period.organizationUnitId,
            code: period.code,
            officialName: period.officialName,
            kind: period.kind,
            parentOrganizationUnitId: period.parentOrganizationUnitId,
          },
        })),
      })
      if (command instanceof Error)
        return new CompanyValidationError("公開組織の変更内容が不正です", "invalid_change", {
          cause: command,
        })
      const reportingHistory = await repository.findReportingRelationHistory(
        COMPANY_DEFAULT_ORGANIZATION_ID,
        current.organizationRevision,
      )
      if (reportingHistory instanceof Error)
        return new CompanyUnavailableError(
          "指揮命令の履歴を参照できません",
          "organization_change_unavailable",
          { cause: reportingHistory },
        )
      const invalid = validateCompanyOrganizationChange(
        current.resources,
        command,
        reportingHistory,
      )
      if (invalid !== null)
        return new CompanyValidationError(
          "親組織の接続と公開組織の期間を確認してください",
          "invalid_change",
          { cause: invalid },
        )
      const journal = await new CompanyResourceJournalAdapter({
        database: drizzle(this.c),
        d1: this.c,
      }).prepare(command)
      if (journal instanceof Error)
        return new CompanyUnavailableError(
          "公開組織の変更を準備できません",
          "organization_change_unavailable",
          { cause: journal },
        )
      return [
        ...journal.statements,
        ...[...newIds]
          .filter((id) => connected.has(id))
          .map((id) =>
            this.c
              .prepare(`INSERT INTO company_organization_resource_bindings
        (organization_unit_id, organization_id, recorded_at) VALUES (?1, '${COMPANY_DEFAULT_ORGANIZATION_ID}', ?2)`)
              .bind(id, change.recordedAt),
          ),
        journal.commit,
      ]
    } catch (cause) {
      return new CompanyUnavailableError(
        "公開組織の変更を準備できません",
        "organization_change_unavailable",
        { cause },
      )
    }
  }
}
