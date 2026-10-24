import { periodContainsDate } from "@/contexts/company/domain/definitions/period-contains-date.definition"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { fingerprintOrganizationUnitCommand } from "@/contexts/company/domain/definitions/fingerprint-organization-unit-command.definition"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { OrganizationWorkforceChangeEntity } from "@/contexts/company/domain/entities/organization-workforce-change.entity"
import {
  CompanyConflictError,
  CompanyForbiddenError,
  CompanyNotFoundError,
  CompanyOperationError,
  CompanyUnavailableError,
  CompanyValidationError,
} from "@/contexts/company/domain/errors"
import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { OrganizationWorkforceSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/workforce/organization-workforce-snapshot.adapter"
import { OrganizationUnitReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/organization-unit-read.adapter"
import { OrganizationWorkforceChangeRepository } from "@/contexts/company/infrastructure/repositories/organization/organization-workforce-change.repository"
import { ValidateOrganizationChange } from "@/contexts/company/lib/workforce/validate-organization-change"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

type Context = Readonly<{
  actor: CompanyActorValue
  company: CompanyContext
  repository: OrganizationWorkforceChangeRepository
}>

/** Companyのappend-only組織台帳へ組織単位を新設する。 */
export class CreateOrganizationUnit {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(input: {
    operationId: string
    code: string
    officialName: string
    parentCode: string | null
    now: Date
  }): Promise<
    | { id: string; code: string; name: string; parentCode: string | null; replayed: boolean }
    | CompanyOperationError
  > {
    if (
      !this.c.actor.canAccessOrganization(COMPANY_DEFAULT_ORGANIZATION_ID) ||
      !this.c.actor.hasPermission("org:write")
    )
      return new CompanyForbiddenError()
    let operationId
    try {
      operationId = restoreWorkforceId("personnel_action", input.operationId)
    } catch (cause) {
      return new CompanyValidationError("組織変更IDが不正です", "invalid_change", { cause })
    }
    const requestFingerprint = await fingerprintOrganizationUnitCommand({
      kind: "create",
      actorAccountId: this.c.actor.accountId,
      code: input.code,
      officialName: input.officialName,
      parentCode: input.parentCode,
    })
    const completed = await this.c.repository.find({ operationId, requestFingerprint })
    if (completed instanceof CompanyOperationError) return completed
    if (completed !== null) {
      return {
        id: completed.organizationUnitId,
        code: input.code,
        name: input.officialName,
        parentCode: input.parentCode,
        replayed: true,
      }
    }
    const resolvedDate = resolveCompanyBusinessDate({
      now: input.now.toISOString(),
      timeZone: this.c.company.env.COMPANY_TIME_ZONE,
    })
    if (typeof resolvedDate !== "string") {
      return new CompanyUnavailableError(
        "会社営業日を解決できません",
        "company_timezone_unavailable",
        { cause: resolvedDate },
      )
    }
    const asOf = restoreCalendarDate(resolvedDate)
    const snapshot = await this.c.repository.readSnapshot(asOf)
    if (!snapshot.ok) {
      return new CompanyUnavailableError(
        "組織情報を取得できません",
        "organization_change_unavailable",
        { cause: snapshot.cause },
      )
    }
    const currentUnits = snapshot.snapshot.units.filter(
      (unit) => !unit.isVoid && periodContainsDate(unit, asOf),
    )
    if (currentUnits.some((unit) => !unit.isVoid && unit.code === input.code)) {
      return new CompanyConflictError("組織コードはすでに使用されています", "invalid_change")
    }
    const root = currentUnits.find((unit) => !unit.isVoid && unit.kind === "COMPANY")
    const parent =
      input.parentCode === null
        ? root
        : currentUnits.find((unit) => !unit.isVoid && unit.code === input.parentCode)
    if (parent === undefined) {
      return new CompanyNotFoundError("親組織が見つかりません", "organization_unit_not_found")
    }

    const organizationUnitId = restoreWorkforceId("organization_unit", crypto.randomUUID())
    const periodId = restoreWorkforceId("period", crypto.randomUUID())
    const recordedAt = input.now.getTime()
    const change = OrganizationWorkforceChangeEntity.restore({
      operationId,
      expectedRevision: snapshot.snapshot.revision,
      asOf,
      recordedAt,
      actorAccountId: this.c.actor.accountId,
      reason: "organization_unit_created",
      evidenceReferences: [
        { context: "company", kind: "organization-unit", id: input.code, version: resolvedDate },
      ],
      organizationUnits: [{ id: organizationUnitId, createdAt: recordedAt }],
      unitPeriods: [
        {
          periodId,
          revision: 1,
          organizationUnitId,
          code: input.code,
          officialName: input.officialName,
          kind: "DEPARTMENT",
          parentOrganizationUnitId: parent.organizationUnitId,
          startsOn: asOf,
          endsOn: null,
          isVoid: false,
          recordedByActionId: operationId,
          recordedAt,
        },
      ],
      assignments: [],
      responsibilities: [],
    })
    if (change instanceof Error) {
      return new CompanyValidationError("組織単位が不正です", "invalid_change", {
        cause: change,
      })
    }
    const validation = await new ValidateOrganizationChange({
      organization: OrganizationUnitReadAdapter.fromContext(this.c.company),
      workforce: new OrganizationWorkforceSnapshotAdapter(this.c.company),
    }).execute(change)
    if (validation.kind === "conflict" || validation.kind === "operation_conflict") {
      return new CompanyConflictError("組織情報が更新されています", "personnel_action_stale")
    }
    if (validation.kind === "invalid") {
      return new CompanyValidationError("組織変更後の状態が不正です", "invalid_change", {
        cause: validation.error,
      })
    }
    if (validation.kind === "unavailable") {
      return new CompanyUnavailableError(
        "組織変更を検証できません",
        "organization_change_unavailable",
        { cause: validation.cause },
      )
    }
    const appended = await this.c.repository.append(change, requestFingerprint)
    if (appended instanceof CompanyOperationError) return appended
    return {
      id: appended.organizationUnitId,
      code: input.code,
      name: input.officialName,
      parentCode: parent.kind === "COMPANY" ? null : parent.code,
      replayed: appended.replayed,
    }
  }
}
