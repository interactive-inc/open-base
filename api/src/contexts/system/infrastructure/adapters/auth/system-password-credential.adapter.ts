import { AccountEntity } from "@system/domain/entities/account.entity"
import { IdentityBindingEntity } from "@system/domain/entities/identity-binding.entity"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { IdentityId } from "@system/domain/schemas/identity/identity-id.schema"
import type { IdentitySubject } from "@system/domain/schemas/identity/identity-subject.schema"
import {
  systemAccounts,
  systemIdentityBindings,
  systemPasswordCredentials,
} from "@system/infrastructure/schema/system-core"
import { and, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"

function createDatabase(database: D1Database) {
  return drizzle(database, {
    schema: { systemAccounts, systemIdentityBindings, systemPasswordCredentials },
  })
}

type Props = Readonly<{
  database: D1Database | Pick<ReturnType<typeof createDatabase>, "select">
}>

export type SystemPasswordCredential = Readonly<{
  account: AccountEntity
  identity: IdentityBindingEntity
  passwordHash: string
}>

export type SystemPasswordMaterialService = Readonly<{
  dummyHash: string
  needsRehash: (passwordHash: string) => boolean
  verify: (password: string, passwordHash: string) => Promise<boolean | Error>
}>

export type SystemPasswordAuthentication =
  | Readonly<{
      kind: "authenticated"
      accountId: AccountId
      identityId: IdentityId
      requiresPasswordRehash: boolean
      tokenVersion: number
    }>
  | Readonly<{ kind: "rejected"; reason: "invalid_credentials" }>
type SystemPasswordCredentialAdapterContext = Props
type Context = SystemPasswordCredentialAdapterContext

/** canonical Identity/password credential/AccountEntityを一つのDB snapshotとして復元する。 */
export class SystemPasswordCredentialAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findBySubject(subject: IdentitySubject): Promise<SystemPasswordCredential | null | Error> {
    try {
      const database =
        "select" in this.c.database ? this.c.database : createDatabase(this.c.database)
      const rows = await database
        .select({
          account: systemAccounts,
          identity: systemIdentityBindings,
          passwordHash: systemPasswordCredentials.passwordHash,
        })
        .from(systemIdentityBindings)
        .innerJoin(
          systemPasswordCredentials,
          eq(systemPasswordCredentials.identityId, systemIdentityBindings.id),
        )
        .innerJoin(systemAccounts, eq(systemAccounts.id, systemIdentityBindings.accountId))
        .where(
          and(
            eq(systemIdentityBindings.provider, "password"),
            eq(systemIdentityBindings.subject, subject),
          ),
        )
        .limit(1)
      const row = rows.at(0)

      if (row === undefined) return null
      const account = AccountEntity.create(row.account)
      if (account instanceof Error) return account
      const identity = IdentityBindingEntity.create(row.identity)
      if (identity instanceof Error) return identity

      return Object.freeze({ account, identity, passwordHash: row.passwordHash })
    } catch (caught) {
      return caught instanceof Error
        ? caught
        : new Error("failed to find System password credential")
    }
  }

  async findByAccountId(accountId: AccountId): Promise<SystemPasswordCredential | null | Error> {
    try {
      const database =
        "select" in this.c.database ? this.c.database : createDatabase(this.c.database)
      const rows = await database
        .select({
          account: systemAccounts,
          identity: systemIdentityBindings,
          passwordHash: systemPasswordCredentials.passwordHash,
        })
        .from(systemIdentityBindings)
        .innerJoin(
          systemPasswordCredentials,
          eq(systemPasswordCredentials.identityId, systemIdentityBindings.id),
        )
        .innerJoin(systemAccounts, eq(systemAccounts.id, systemIdentityBindings.accountId))
        .where(
          and(
            eq(systemIdentityBindings.accountId, accountId),
            eq(systemIdentityBindings.provider, "password"),
          ),
        )
        .limit(1)
      const row = rows.at(0)

      if (row === undefined) return null
      const account = AccountEntity.create(row.account)
      if (account instanceof Error) return account
      const identity = IdentityBindingEntity.create(row.identity)
      if (identity instanceof Error) return identity

      return Object.freeze({ account, identity, passwordHash: row.passwordHash })
    } catch (caught) {
      return caught instanceof Error
        ? caught
        : new Error("failed to find System password credential")
    }
  }

  async authenticate(
    command: Readonly<{ subject: IdentitySubject; password: string; now: Date }>,
    passwordMaterialService: SystemPasswordMaterialService,
  ): Promise<SystemPasswordAuthentication | Error> {
    if (!Number.isSafeInteger(command.now.getTime())) {
      return new Error("System password authentication time is invalid")
    }

    const credential = await this.findBySubject(command.subject)
    if (credential instanceof Error) return credential

    const verified = await passwordMaterialService.verify(
      command.password,
      credential?.passwordHash ?? passwordMaterialService.dummyHash,
    )
    if (verified instanceof Error) return verified
    if (
      credential === null ||
      !verified ||
      credential.account.status !== "active" ||
      !credential.identity.wasActiveAt(command.now)
    ) {
      return Object.freeze({ kind: "rejected" as const, reason: "invalid_credentials" as const })
    }

    return Object.freeze({
      kind: "authenticated" as const,
      accountId: credential.account.id,
      identityId: credential.identity.id,
      requiresPasswordRehash: passwordMaterialService.needsRehash(credential.passwordHash),
      tokenVersion: credential.account.tokenVersion,
    })
  }

  async authenticateAccount(
    command: Readonly<{ accountId: AccountId; password: string; now: Date }>,
    passwordMaterialService: SystemPasswordMaterialService,
  ): Promise<SystemPasswordAuthentication | Error> {
    if (!Number.isSafeInteger(command.now.getTime())) {
      return new Error("System password authentication time is invalid")
    }

    const credential = await this.findByAccountId(command.accountId)
    if (credential instanceof Error) return credential
    const verified = await passwordMaterialService.verify(
      command.password,
      credential?.passwordHash ?? passwordMaterialService.dummyHash,
    )
    if (verified instanceof Error) return verified
    if (
      credential === null ||
      !verified ||
      credential.account.status !== "active" ||
      !credential.identity.wasActiveAt(command.now)
    ) {
      return Object.freeze({ kind: "rejected" as const, reason: "invalid_credentials" as const })
    }

    return Object.freeze({
      kind: "authenticated" as const,
      accountId: credential.account.id,
      identityId: credential.identity.id,
      requiresPasswordRehash: passwordMaterialService.needsRehash(credential.passwordHash),
      tokenVersion: credential.account.tokenVersion,
    })
  }
}
