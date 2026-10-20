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
import { and, asc, desc, eq, gt, isNotNull, isNull, lte, or } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"

function createDatabase(database: D1Database) {
  return drizzle(database, {
    schema: { systemAccounts, systemIdentityBindings, systemPasswordCredentials },
  })
}

/**
 * 1つのAccountで照合するpassword credentialの上限。
 * passwordの照合は1件ごとに重いハッシュ計算を伴うため、1回の試行で照合する件数を数件に抑える。
 */
const MAX_ACCOUNT_PASSWORD_CANDIDATES = 5

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

  /**
   * Accountの有効なpassword credentialを、passwordを最近変えた順に上限件数まで読む。
   * pending・失効済みのIdentityは候補に含めない。
   */
  async findActiveByAccountId(
    accountId: AccountId,
    now: Date,
  ): Promise<ReadonlyArray<SystemPasswordCredential> | Error> {
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
            isNotNull(systemIdentityBindings.activatedAt),
            lte(systemIdentityBindings.activatedAt, now),
            or(isNull(systemIdentityBindings.revokedAt), gt(systemIdentityBindings.revokedAt, now)),
          ),
        )
        .orderBy(
          desc(systemPasswordCredentials.changedAt),
          desc(systemIdentityBindings.createdAt),
          asc(systemIdentityBindings.id),
        )
        .limit(MAX_ACCOUNT_PASSWORD_CANDIDATES)

      const credentials: Array<SystemPasswordCredential> = []
      for (const row of rows) {
        const account = AccountEntity.create(row.account)
        if (account instanceof Error) return account
        const identity = IdentityBindingEntity.create(row.identity)
        if (identity instanceof Error) return identity
        credentials.push(Object.freeze({ account, identity, passwordHash: row.passwordHash }))
      }

      return Object.freeze(credentials)
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

  /**
   * 認証済みAccountのpasswordを、そのAccountの有効なpassword credentialのどれかと照合する。
   * 一致したIdentityを返すので、呼び出し側はそのcredentialだけを更新できる。
   * 1回の試行で行うpassword照合の回数を抑えるため、照合するのはpasswordを最近変えた上限件数まで。
   */
  async authenticateAccount(
    command: Readonly<{ accountId: AccountId; password: string; now: Date }>,
    passwordMaterialService: SystemPasswordMaterialService,
  ): Promise<SystemPasswordAuthentication | Error> {
    if (!Number.isSafeInteger(command.now.getTime())) {
      return new Error("System password authentication time is invalid")
    }

    const credentials = await this.findActiveByAccountId(command.accountId, command.now)
    if (credentials instanceof Error) return credentials
    const candidates = credentials.filter(
      (credential) =>
        credential.account.status === "active" && credential.identity.wasActiveAt(command.now),
    )
    const rejected = Object.freeze({
      kind: "rejected" as const,
      reason: "invalid_credentials" as const,
    })

    if (candidates.length === 0) {
      const verified = await passwordMaterialService.verify(
        command.password,
        passwordMaterialService.dummyHash,
      )
      if (verified instanceof Error) return verified
      return rejected
    }

    for (const credential of candidates) {
      const verified = await passwordMaterialService.verify(
        command.password,
        credential.passwordHash,
      )
      if (verified instanceof Error) return verified
      if (!verified) continue

      return Object.freeze({
        kind: "authenticated" as const,
        accountId: credential.account.id,
        identityId: credential.identity.id,
        requiresPasswordRehash: passwordMaterialService.needsRehash(credential.passwordHash),
        tokenVersion: credential.account.tokenVersion,
      })
    }

    return rejected
  }
}
