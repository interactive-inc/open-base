import { isCalendarDate } from "@/contexts/company/domain/definitions/is-calendar-date.definition"
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

/** Companyのappend-only組織台帳へ組織単位の訂正版を追記する。 */
export class UpdateOrganizationUnit {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(input: {
    operationId: string
    code: string
    officialName: string
    parentCode: string | null
    expectedOrganizationRevision: number
    expectedAsOf: string
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
    if (
      !Number.isSafeInteger(input.expectedOrganizationRevision) ||
      input.expectedOrganizationRevision < 0 ||
      !isCalendarDate(input.expectedAsOf)
    ) {
      return new CompanyValidationError("確認した組織版と日付が必要です", "invalid_change")
    }
    let operationId
    try {
      operationId = restoreWorkforceId("personnel_action", input.operationId)
    } catch (cause) {
      return new CompanyValidationError("組織変更IDが不正です", "invalid_change", { cause })
    }
    const requestFingerprint = await fingerprintOrganizationUnitCommand({
      kind: "update",
      expectedOrganizationRevision: input.expectedOrganizationRevision,
      expectedAsOf: input.expectedAsOf,
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
      now: Number.isFinite(input.now.getTime()) ? input.now.toISOString() : "",
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
    if (
      snapshot.snapshot.revision !== input.expectedOrganizationRevision ||
      asOf !== input.expectedAsOf
    ) {
      const replay = await this.c.repository.find({ operationId, requestFingerprint })
      if (replay instanceof CompanyOperationError) return replay
      if (replay !== null)
        return {
          id: replay.organizationUnitId,
          code: input.code,
          name: input.officialName,
          parentCode: input.parentCode,
          replayed: true,
        }
      return new CompanyConflictError(
        "組織情報または基準日が変わっています。一覧を再読み込みして内容を確認してください",
        "personnel_action_stale",
      )
    }
    const currentUnits = snapshot.snapshot.units.filter(
      (unit) => !unit.isVoid && periodContainsDate(unit, asOf),
    )
    const current = currentUnits.find(
      (unit) => !unit.isVoid && unit.kind !== "COMPANY" && unit.code === input.code,
    )
    if (current === undefined) {
      return new CompanyNotFoundError("組織単位が見つかりません", "organization_unit_not_found")
    }
    const root = currentUnits.find((unit) => !unit.isVoid && unit.kind === "COMPANY")
    const parent =
      input.parentCode === null
        ? root
        : currentUnits.find((unit) => !unit.isVoid && unit.code === input.parentCode)
    if (parent === undefined) {
      return new CompanyNotFoundError("親組織が見つかりません", "organization_unit_not_found")
    }

    const recordedAt = input.now.getTime()
    const change = OrganizationWorkforceChangeEntity.restore({
      operationId,
      expectedRevision: input.expectedOrganizationRevision,
      asOf,
      recordedAt,
      actorAccountId: this.c.actor.accountId,
      reason: "organization_unit_updated",
      evidenceReferences: [
        {
          context: "company",
          kind: "organization-unit",
          id: input.code,
          version: String(current.revision + 1),
        },
      ],
      organizationUnits: [],
      unitPeriods: [
        {
          ...current,
          revision: current.revision + 1,
          officialName: input.officialName,
          parentOrganizationUnitId: parent.organizationUnitId,
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
      const replay = await this.c.repository.find({ operationId, requestFingerprint })
      if (replay instanceof CompanyOperationError) return replay
      if (replay !== null)
        return {
          id: replay.organizationUnitId,
          code: input.code,
          name: input.officialName,
          parentCode: input.parentCode,
          replayed: true,
        }
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
      code: current.code,
      name: input.officialName,
      parentCode: parent.kind === "COMPANY" ? null : parent.code,
      replayed: appended.replayed,
    }
  }
}
