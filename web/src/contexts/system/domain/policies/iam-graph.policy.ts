import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { IamRoleEntity } from "@system/domain/entities/iam-role.entity"
import { InvalidIamGraphError } from "@system/domain/errors"
import { permissionKeySchema } from "@system/domain/values/iam/permission.value"
import { RoleBindingEntity } from "@system/domain/entities/role-binding.entity"
import {
  roleBindingIdSchema,
  roleBindingResourceSchema,
  type RoleBindingResource,
} from "@system/domain/schemas/iam/role-binding.schema"
import { SystemPermission } from "@system/domain/catalogs/iam/system-permission.catalog"

const iamPermissionDecisions = Object.freeze(["allowed", "denied", "invalid"] as const)

type IamPermissionDecision = (typeof iamPermissionDecisions)[number]

type RoleBindingRevocationRejection =
  | "binding_not_active"
  | "invalid_evaluation_input"
  | "last_root_binding"

type PermissionProps = Readonly<{
  accountId: unknown
  permissionKey: unknown
  resource: unknown
  at: unknown
}>

type RevocationProps = Readonly<{
  bindingId: unknown
  activeAccountIds: ReadonlySet<unknown>
  at: unknown
}>

/** live Role / Bindingから権限とlast-rootを評価する、token非依存のSystem IAM graph。 */
export class IamGraphPolicy {
  readonly #bindings: ReadonlyArray<RoleBindingEntity>
  readonly #rolesById: ReadonlyMap<string, IamRoleEntity>

  private constructor(
    roles: ReadonlyArray<IamRoleEntity>,
    bindings: ReadonlyArray<RoleBindingEntity>,
  ) {
    this.#bindings = Object.freeze([...bindings])
    this.#rolesById = new Map(roles.map((role) => [role.id, role]))
    Object.freeze(this)
  }

  static create(
    roles: ReadonlyArray<IamRoleEntity>,
    bindings: ReadonlyArray<RoleBindingEntity>,
  ): IamGraphPolicy | InvalidIamGraphError {
    if (!roles.every((role) => role instanceof IamRoleEntity)) {
      return new InvalidIamGraphError("invalid_shape")
    }
    if (!bindings.every((binding) => binding instanceof RoleBindingEntity)) {
      return new InvalidIamGraphError("invalid_shape")
    }
    if (new Set(roles.map((role) => role.id)).size !== roles.length) {
      return new InvalidIamGraphError("duplicate_role_id")
    }
    if (new Set(bindings.map((binding) => binding.id)).size !== bindings.length) {
      return new InvalidIamGraphError("duplicate_binding_id")
    }

    const roleIds = new Set(roles.map((role) => role.id))
    if (bindings.some((binding) => !roleIds.has(binding.roleId))) {
      return new InvalidIamGraphError("unknown_binding_role")
    }

    return new IamGraphPolicy(roles, bindings)
  }

  getPermissionDecision(props: PermissionProps): IamPermissionDecision {
    const accountId = zAccountId.safeParse(props.accountId)
    const permissionKey = permissionKeySchema.safeParse(props.permissionKey)
    const resource = IamGraphPolicy.parseResource(props.resource)
    const at = props.at

    if (!(at instanceof Date) || !Number.isFinite(at.getTime())) return "invalid"
    if (!accountId.success || !permissionKey.success || resource instanceof Error) return "invalid"

    const hasPermission = this.#bindings.some((binding) => {
      if (binding.accountId !== accountId.data || !binding.isActiveAt(at)) return false
      if (!binding.appliesTo(resource)) return false

      const role = this.#rolesById.get(binding.roleId)
      const hasGlobalSystemAdmin =
        binding.resource === null && role?.hasPermission(SystemPermission.SYSTEM_ADMIN.key) === true

      if (permissionKey.data === SystemPermission.SYSTEM_ADMIN.key) return hasGlobalSystemAdmin

      return role?.hasPermission(permissionKey.data) === true || hasGlobalSystemAdmin
    })

    return hasPermission ? "allowed" : "denied"
  }

  getBindingRevocationRejection(props: RevocationProps): RoleBindingRevocationRejection | null {
    const bindingId = roleBindingIdSchema.safeParse(props.bindingId)
    const activeAccountIds = this.parseActiveAccountIds(props.activeAccountIds)
    const at = props.at

    if (!(at instanceof Date) || !Number.isFinite(at.getTime())) {
      return "invalid_evaluation_input"
    }
    if (!bindingId.success || activeAccountIds instanceof Error) return "invalid_evaluation_input"

    const target = this.#bindings.find((binding) => binding.id === bindingId.data)
    if (target === undefined || !target.isActiveAt(at)) return "binding_not_active"
    if (!this.isEffectiveRootBinding(target, activeAccountIds, at)) return null

    const remainingRootAccounts = new Set(
      this.#bindings
        .filter((binding) => binding.id !== target.id)
        .filter((binding) => this.isEffectiveRootBinding(binding, activeAccountIds, at))
        .map((binding) => binding.accountId),
    )

    return remainingRootAccounts.size === 0 ? "last_root_binding" : null
  }

  private static parseResource(resource: unknown): RoleBindingResource | null | Error {
    if (resource === null) return null

    const parsed = roleBindingResourceSchema.safeParse(resource)

    return parsed.success ? parsed.data : new Error("invalid_resource")
  }

  private parseActiveAccountIds(accountIds: ReadonlySet<unknown>): ReadonlySet<string> | Error {
    if (!(accountIds instanceof Set)) return new Error("invalid_active_accounts")

    const parsedAccountIds = [...accountIds].map((accountId) => zAccountId.safeParse(accountId))

    return parsedAccountIds.every((parsed) => parsed.success)
      ? new Set(parsedAccountIds.map((parsed) => (parsed.success ? parsed.data : "")))
      : new Error("invalid_active_accounts")
  }

  private isEffectiveRootBinding(
    binding: RoleBindingEntity,
    activeAccountIds: ReadonlySet<string>,
    at: Date,
  ): boolean {
    const role = this.#rolesById.get(binding.roleId)

    return (
      binding.resource === null &&
      binding.isActiveAt(at) &&
      activeAccountIds.has(binding.accountId) &&
      role?.hasPermission(SystemPermission.SYSTEM_ADMIN.key) === true
    )
  }
}
