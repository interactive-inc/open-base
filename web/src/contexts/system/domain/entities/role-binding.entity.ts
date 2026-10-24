import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { iamRoleIdSchema, type IamRoleId } from "@system/domain/schemas/iam/iam-role.schema"
import { InvalidRoleBindingError } from "@system/domain/errors"
import {
  roleBindingIdSchema,
  roleBindingResourceSchema,
  type RoleBindingId,
  type RoleBindingResource,
} from "@system/domain/schemas/iam/role-binding.schema"
import { z } from "zod"

const propsSchema = z
  .object({
    id: roleBindingIdSchema,
    accountId: zAccountId,
    roleId: iamRoleIdSchema,
    resource: roleBindingResourceSchema.nullable(),
    createdAt: z.date(),
    revokedAt: z.date().nullable(),
  })
  .strict()

type ParsedProps = z.output<typeof propsSchema>

/** AccountへRoleをglobalまたはopaque resource単位で関連付けるSystem binding。 */
export class RoleBindingEntity {
  readonly id: RoleBindingId
  readonly accountId: AccountId
  readonly roleId: IamRoleId
  readonly resource: RoleBindingResource | null
  readonly #createdAtEpochMilliseconds: number
  readonly #revokedAtEpochMilliseconds: number | null

  private constructor(props: ParsedProps) {
    this.id = props.id
    this.accountId = props.accountId
    this.roleId = props.roleId
    this.resource =
      props.resource === null
        ? null
        : Object.freeze({ type: props.resource.type, id: props.resource.id })
    this.#createdAtEpochMilliseconds = props.createdAt.getTime()
    this.#revokedAtEpochMilliseconds = props.revokedAt?.getTime() ?? null
    Object.freeze(this)
  }

  static create(input: unknown): RoleBindingEntity | InvalidRoleBindingError {
    const parsed = propsSchema.safeParse(input)

    if (!parsed.success) return new InvalidRoleBindingError("invalid_shape", parsed.error)
    if (
      parsed.data.revokedAt !== null &&
      parsed.data.revokedAt.getTime() < parsed.data.createdAt.getTime()
    ) {
      return new InvalidRoleBindingError("revocation_before_creation")
    }

    return new RoleBindingEntity(parsed.data)
  }

  get createdAt(): Date {
    return new Date(this.#createdAtEpochMilliseconds)
  }

  get revokedAt(): Date | null {
    return this.#revokedAtEpochMilliseconds === null
      ? null
      : new Date(this.#revokedAtEpochMilliseconds)
  }

  isActiveAt(at: Date): boolean {
    const atEpochMilliseconds = at.getTime()

    return (
      Number.isFinite(atEpochMilliseconds) &&
      atEpochMilliseconds >= this.#createdAtEpochMilliseconds &&
      (this.#revokedAtEpochMilliseconds === null ||
        atEpochMilliseconds < this.#revokedAtEpochMilliseconds)
    )
  }

  appliesTo(resource: RoleBindingResource | null): boolean {
    if (this.resource === null) return true
    if (resource === null) return false

    return this.resource.type === resource.type && this.resource.id === resource.id
  }

  revoke(at: Date): RoleBindingEntity | InvalidRoleBindingError {
    if (this.#revokedAtEpochMilliseconds !== null) {
      if (!Number.isFinite(at.getTime())) return new InvalidRoleBindingError("invalid_shape")
      if (at.getTime() < this.#revokedAtEpochMilliseconds) {
        return new InvalidRoleBindingError("transition_before_last_update")
      }

      return this
    }

    return RoleBindingEntity.create({ ...this.toProps(), revokedAt: at })
  }

  private toProps(): ParsedProps {
    return {
      id: this.id,
      accountId: this.accountId,
      roleId: this.roleId,
      resource: this.resource === null ? null : { ...this.resource },
      createdAt: this.createdAt,
      revokedAt: this.revokedAt,
    }
  }
}
