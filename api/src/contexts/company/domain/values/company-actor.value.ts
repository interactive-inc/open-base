import { InvalidCompanyActorError } from "@/contexts/company/domain/errors"
import { COMPANY_PERMISSION_KEYS } from "@/contexts/company/domain/catalogs/iam/company-permission-key.catalog"
import type { CompanyPermissionKey } from "@/contexts/company/domain/catalogs/iam/company-permission-key.catalog"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

export const companyCapabilities = [
  "company:read",
  "company:write",
  "company:workforce:update",
  "company:master:write",
  "company:admin",
] as const

export type CompanyCapability = (typeof companyCapabilities)[number]

export type CompanyActorProps = Readonly<{
  accountId: string
  employeeId: string | null
  organizationIds: ReadonlyArray<string>
  capabilities: ReadonlyArray<CompanyCapability>
  permissions?: ReadonlyArray<CompanyPermissionKey>
}>

/** 認証結果からCompanyへ渡す、検証済みかつ変更不能な実行主体。 */
export class CompanyActorValue {
  readonly accountId: string
  readonly employeeId: EmployeeId | null
  readonly organizationIds: ReadonlyArray<string>
  readonly capabilities: ReadonlyArray<CompanyCapability>
  readonly permissions: ReadonlyArray<CompanyPermissionKey>

  private static isOpaqueIdentifier(value: string): boolean {
    return value.length >= 1 && value.length <= 256 && value.trim() === value
  }

  private constructor(props: CompanyActorProps) {
    this.accountId = props.accountId
    this.employeeId =
      props.employeeId === null ? null : restoreWorkforceId("employee", props.employeeId)
    this.organizationIds = Object.freeze([...props.organizationIds])
    this.capabilities = Object.freeze([...props.capabilities])
    this.permissions = Object.freeze([...(props.permissions ?? [])])
    Object.freeze(this)
  }

  static restore(props: CompanyActorProps): CompanyActorValue {
    let employeeIdIsValid = true
    if (props.employeeId !== null) {
      try {
        restoreWorkforceId("employee", props.employeeId)
      } catch {
        employeeIdIsValid = false
      }
    }

    if (
      !CompanyActorValue.isOpaqueIdentifier(props.accountId) ||
      !employeeIdIsValid ||
      props.organizationIds.length === 0 ||
      props.organizationIds.some(
        (organizationId) =>
          organizationId !== "*" && !CompanyActorValue.isOpaqueIdentifier(organizationId),
      ) ||
      new Set(props.organizationIds).size !== props.organizationIds.length ||
      props.capabilities.some((capability) => !companyCapabilities.includes(capability)) ||
      new Set(props.capabilities).size !== props.capabilities.length ||
      (props.permissions ?? []).some(
        (permission) => !COMPANY_PERMISSION_KEYS.includes(permission),
      ) ||
      new Set(props.permissions ?? []).size !== (props.permissions ?? []).length
    ) {
      throw new InvalidCompanyActorError()
    }

    return new CompanyActorValue(props)
  }

  canAccessOrganization(organizationId: string): boolean {
    return this.organizationIds.includes(organizationId) || this.organizationIds.includes("*")
  }

  hasCapability(capability: CompanyCapability): boolean {
    return this.capabilities.includes("company:admin") || this.capabilities.includes(capability)
  }

  canUpdateWorkforce(): boolean {
    return this.hasCapability("company:write") || this.hasCapability("company:workforce:update")
  }

  hasPermission(permission: CompanyPermissionKey): boolean {
    return this.hasCapability("company:admin") || this.permissions.includes(permission)
  }
}
