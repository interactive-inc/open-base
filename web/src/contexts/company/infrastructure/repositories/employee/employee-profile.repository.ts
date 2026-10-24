import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { EmployeeProfileChangeEntity } from "@/contexts/company/domain/entities/employee-profile-change.entity"
import type { EmployeeProfileVersion } from "@/contexts/company/domain/definitions/employee-profile-version.definition"
import {
  CompanyConflictError,
  CompanyOperationError,
  CompanyUnexpectedError,
  CompanyValidationError,
} from "@/contexts/company/domain/errors"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { EmployeeProfileSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-profile-snapshot.adapter"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

type Context = Readonly<{ env: CompanyContext["env"] }>
export type EmployeeProfileUpdateResult = Readonly<{
  employeeId: string
  employeeCode: string | null
  officialName: string
  phone: string | null
  profile: EmployeeProfileVersion
  replayed: boolean
}>

/** 人物履歴、従業員表示、Account表示名を同じCompany commandで保存する。 */
export class EmployeeProfileRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async update(
    command: EmployeeProfileChangeEntity,
  ): Promise<EmployeeProfileUpdateResult | CompanyOperationError> {
    try {
      const input = command.props
      const snapshot = await new EmployeeProfileSnapshotAdapter(this.c.env.DB).find({
        employeeId: input.profile.employeeId,
        effectiveOn: input.profile.effectiveOn,
        organizationRevision: input.profile.organizationRevision,
      })
      if (snapshot instanceof Error)
        return new CompanyUnexpectedError("人物情報を読み込めません", { cause: snapshot })
      if (snapshot === null)
        return new CompanyConflictError(
          "公開人物情報との対応を確認できません",
          "employee_profile_unlinked",
        )
      const change = command.toResourceChange(snapshot)
      if (change instanceof CompanyOperationError) return change
      if (change instanceof Error)
        return new CompanyValidationError(
          "人物情報の変更内容が不正です",
          "invalid_employee_profile",
          { cause: change },
        )
      const today = resolveCompanyBusinessDate({
        now: new Date(input.recordedAt).toISOString(),
        timeZone: this.c.env.COMPANY_TIME_ZONE,
      })
      if (today instanceof Error)
        return new CompanyUnexpectedError("会社の日付を確認できません", { cause: today })
      if (today !== input.profile.effectiveOn) {
        const receipt = await this.c.env.DB.prepare(
          `SELECT 1 AS present FROM company_command_receipts WHERE organization_id = '${COMPANY_DEFAULT_ORGANIZATION_ID}' AND command_id = ?1`,
        )
          .bind(change.commandId)
          .first<unknown>()
        if (receipt === null)
          return new CompanyConflictError(
            "日付が変わりました。再読み込みしてください",
            "employee_profile_date_changed",
          )
      }
      const saved = await new D1CompanyResourceRepository({ database: this.c.env.DB }).write(change)
      if (saved.kind === "unavailable")
        return new CompanyUnexpectedError("人物情報を保存できません", { cause: saved.cause })
      if (saved.kind === "invalid")
        return new CompanyValidationError(
          "人物情報の変更内容が不正です",
          "invalid_employee_profile",
          { cause: saved.error },
        )
      if (saved.kind !== "applied")
        return new CompanyConflictError(
          "人物情報が変更されています。再読み込みしてください",
          "employee_profile_conflict",
        )
      const person = change.resources[0]
      const officialName = person?.readText("officialName")
      if (person === undefined || officialName === null || officialName === undefined)
        return new CompanyUnexpectedError("人物情報の保存結果が不正です")
      return {
        employeeId: input.profile.employeeId,
        employeeCode: snapshot.employeeCode,
        officialName,
        phone: person.readNullableText("phone") ?? null,
        replayed: saved.replayed,
        profile: {
          ...input.profile,
          organizationRevision: saved.organizationRevision,
          personRevision: person.revision,
        },
      }
    } catch (cause) {
      return new CompanyUnexpectedError("人物情報を保存できません", { cause })
    }
  }
}
