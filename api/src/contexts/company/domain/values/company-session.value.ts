import type { EmploymentStatus } from "@/contexts/company/domain/definitions/employment-status.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"

type Props = Readonly<{
  accountId: AccountId
  employeeId: EmployeeId
  employmentStatus: EmploymentStatus
  permissions: ReadonlySet<string>
  roleKeys: ReadonlyArray<string>
}>

/** 認証済みSystem AccountとCompany上の在籍・権限を結び付けた実行主体。 */
export class CompanySessionValue {
  constructor(private readonly props: Props) {
    Object.freeze(this)
  }

  get accountId(): AccountId {
    return this.props.accountId
  }

  get employeeId(): EmployeeId {
    return this.props.employeeId
  }

  get employmentStatus(): EmploymentStatus {
    return this.props.employmentStatus
  }

  get permissions(): ReadonlySet<string> {
    return this.props.permissions
  }

  get roleKeys(): ReadonlyArray<string> {
    return this.props.roleKeys
  }

  hasPermission(permission: string): boolean {
    return permission.length > 0 && this.props.permissions.has(permission)
  }
}
