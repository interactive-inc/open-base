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
import { and, eq, sql } from "drizzle-orm"
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
      reason:
        | AccountSessionRejection
        | "account_not_found"
        | "invalid_machine_credential"
        | "session_revoked"
    }>

/**
 * 検証済みtokenの発行元とAccount・機械credential・Session familyの現在状態を同じ読取で照合する。
 * Sessionから発行したtokenは `sessionFamilyId` を持ち、logoutや再利用検知でfamilyが失効すると
 * 有効期限内でも拒否する。familyの確認はAccountを読む同じqueryへ相関subqueryで載せ、
 * bearer検証1回あたりのD1往復を増やさない。
 */
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
      sessionFamilyId: string | null
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
          sessionActive:
            input.sessionFamilyId === null
              ? sql<number>`1`
              : sql<number>`EXISTS (
                  SELECT 1 FROM system_sessions AS session
                  WHERE session.family_id = ${input.sessionFamilyId}
                    AND session.account_id = ${systemAccounts.id}
                    AND (session.revoked_at IS NULL OR session.revoked_at > ${input.at.getTime()})
                )`,
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
      if (input.sessionFamilyId !== null && Number(row.sessionActive) !== 1) {
        return { kind: "rejected", reason: "session_revoked" }
      }

      const principal = row.principal === null ? null : SystemPrincipalEntity.create(row.principal)
      if (principal instanceof Error) return principal
      if (input.machineCredentialId === undefined) {
        // Principal導入前の人のAccountは既存sessionを継続できる。明示された機械主体は除く。
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
