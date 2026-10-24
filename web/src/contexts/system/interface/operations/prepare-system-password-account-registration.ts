import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { iamRoleIdSchema } from "@system/domain/schemas/iam/iam-role.schema"
import { roleBindingIdSchema } from "@system/domain/schemas/iam/role-binding.schema"
import {
  systemAccounts,
  systemIdentityBindings,
  systemIdentityProfiles,
  systemPasswordCredentials,
  systemRoleBindings,
} from "@system/infrastructure/schema/system-core"
import { drizzle } from "drizzle-orm/d1"

/** 招待受諾で作るSystem Account・Identity・Role bindingを同一batchに載せる。 */
export function prepareSystemPasswordAccountRegistration(
  database: D1Database,
  input: Readonly<{
    accountId: string
    reuseExistingAccount: boolean
    identityId: string
    email: string
    passwordHash: string
    roleBindingId: string
    roleId: string
    resourceType: string | null
    resourceId: string | null
    now: Date
  }>,
) {
  const accountId = zAccountId.safeParse(input.accountId)
  if (
    !accountId.success ||
    input.identityId.length < 1 ||
    input.identityId.length > 255 ||
    !roleBindingIdSchema.safeParse(input.roleBindingId).success ||
    !iamRoleIdSchema.safeParse(input.roleId).success ||
    input.email.length < 3 ||
    input.email.length > 320 ||
    input.passwordHash.length < 1 ||
    (input.resourceType === null) !== (input.resourceId === null) ||
    (input.resourceType !== null &&
      (!/^[a-z][a-z0-9_]*(?::[a-z][a-z0-9_]*)+$/.test(input.resourceType) ||
        input.resourceType.length > 100 ||
        input.resourceId === null ||
        input.resourceId.length < 1 ||
        input.resourceId.length > 255)) ||
    !Number.isSafeInteger(input.now.getTime())
  ) {
    return new Error("Invalid System password account registration")
  }

  const db = drizzle(database)
  return {
    accountCreation: input.reuseExistingAccount
      ? null
      : db.insert(systemAccounts).values({
          id: accountId.data,
          status: "active",
          createdAt: input.now,
          updatedAt: input.now,
        }),
    identityCreation: db.insert(systemIdentityBindings).values({
      id: input.identityId,
      accountId: input.accountId,
      provider: "password",
      subject: input.email,
      activatedAt: input.now,
      revokedAt: null,
      createdAt: input.now,
    }),
    identityProfileCreation: db.insert(systemIdentityProfiles).values({
      identityId: input.identityId,
      email: input.email,
      emailVerified: true,
      canReceiveEmail: true,
      lastUsedAt: null,
      updatedAt: input.now,
    }),
    passwordCredentialCreation: db.insert(systemPasswordCredentials).values({
      identityId: input.identityId,
      passwordHash: input.passwordHash,
      changedAt: input.now,
      createdAt: input.now,
      updatedAt: input.now,
    }),
    roleBindingCreation: db.insert(systemRoleBindings).values({
      id: input.roleBindingId,
      accountId: input.accountId,
      roleId: input.roleId,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      createdAt: input.now,
      revokedAt: null,
    }),
  }
}
