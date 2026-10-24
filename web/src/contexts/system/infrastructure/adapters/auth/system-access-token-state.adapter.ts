import type { SystemDatabase } from "@system/configuration/system-context"
import { AccountEntity } from "@system/domain/entities/account.entity"
import { SystemMachineCredentialEntity } from "@system/domain/entities/system-machine-credential.entity"
import { SystemPrincipalEntity } from "@system/domain/entities/system-principal.entity"
import {
  getAccountSessionRejection,
  type AccountSessionRejection,
} from "@system/domain/policies/account-session.policy"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { systemAccounts } from "@system/infrastructure/schema/system-core"
import { systemConnectors } from "@system/infrastructure/schema/system-integration"
import {
  systemMachineCredentials,
  systemPrincipals,
} from "@system/infrastructure/schema/system-principal"
import { and, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"

type Context = Readonly<{
  database: D1Database | Pick<SystemDatabase, "select">
}>

export type SystemAccessTokenState =
  | Readonly<{
      kind: "accepted"
      account: AccountEntity
      machine: Readonly<{
        principalId: string
        kind: "agent" | "service" | "connector"
        credentialId: string
        connectorId: string | null
      }> | null
    }>
  | Readonly<{
      kind: "rejected"
      reason: AccountSessionRejection | "account_not_found" | "invalid_machine_credential"
    }>

/** 検証済みの主体とAccount・機械credentialの現在状態を、1回の読取で照合する。 */
export class SystemAccessTokenStateAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async resolve(
    input: Readonly<{
      accountId: AccountId
      tokenVersion: number
      issuedAtMs: number
      machineCredentialId?: string
      at: Date
    }>,
  ): Promise<SystemAccessTokenState | Error> {
    try {
      const database = "select" in this.c.database ? this.c.database : drizzle(this.c.database)
      const rows = await database
        .select({
          account: systemAccounts,
          principal: systemPrincipals,
          credential: systemMachineCredentials,
          connector: { id: systemConnectors.id, status: systemConnectors.status },
        })
        .from(systemAccounts)
        .leftJoin(systemPrincipals, eq(systemPrincipals.accountId, systemAccounts.id))
        .leftJoin(
          systemMachineCredentials,
          and(
            eq(systemMachineCredentials.principalId, systemPrincipals.id),
            eq(systemMachineCredentials.id, input.machineCredentialId ?? ""),
          ),
        )
        .leftJoin(systemConnectors, eq(systemConnectors.id, systemPrincipals.connectorId))
        .where(eq(systemAccounts.id, input.accountId))
        .limit(1)
      const row = rows.at(0)
      if (row === undefined) return { kind: "rejected", reason: "account_not_found" }
      const account = AccountEntity.create(row.account)
      if (account instanceof Error) return account
      const rejection = getAccountSessionRejection({
        accountStatus: account.status,
        accountTokenVersion: account.tokenVersion,
        sessionTokenVersion: input.tokenVersion,
      })
      if (rejection !== null) return { kind: "rejected", reason: rejection }

      const principal = row.principal === null ? null : SystemPrincipalEntity.create(row.principal)
      if (principal instanceof Error) return principal
      if (input.machineCredentialId === undefined) {
        // 人のAccountだけがサインイン済みセッションを使える。機械主体には機械credentialが必要。
        if (principal === null || principal.kind === "human") {
          return { kind: "accepted", account, machine: null }
        }
        return { kind: "rejected", reason: "invalid_machine_credential" }
      }
      if (principal === null || principal.kind === "human" || row.credential === null) {
        return { kind: "rejected", reason: "invalid_machine_credential" }
      }
      const credential = SystemMachineCredentialEntity.create(row.credential)
      if (credential instanceof Error) return credential
      if (
        !credential.isUsableAt(input.at) ||
        !credential.isUsableAt(new Date(input.issuedAtMs)) ||
        credential.lastUsedAt === null ||
        credential.lastUsedAt.getTime() < input.issuedAtMs ||
        (principal.kind === "connector" && row.connector?.status !== "active")
      ) {
        return { kind: "rejected", reason: "invalid_machine_credential" }
      }

      return {
        kind: "accepted",
        account,
        machine: {
          principalId: principal.id,
          kind: principal.kind,
          credentialId: credential.id,
          connectorId: principal.connectorId,
        },
      }
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to resolve access token state")
    }
  }
}
