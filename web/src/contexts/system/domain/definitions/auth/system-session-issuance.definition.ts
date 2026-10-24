import type { SystemSessionAuditContext } from "@system/domain/definitions/audit/system-session-audit-context.definition"
import type { AccountSessionRejection } from "@system/domain/policies/account-session.policy"
import type { SessionFamilyId } from "@system/domain/schemas/auth/session-family-id.schema"
import type { SessionId } from "@system/domain/schemas/auth/session-id.schema"
import type { SessionTokenHash } from "@system/domain/schemas/auth/session-token-hash.schema"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"

export type SystemSessionMaterial = Readonly<{
  generateSessionId: () => SessionId | Error
  generateFamilyId: () => SessionFamilyId | Error
  generateRawToken: () => string | Error
  hashRawToken: (rawToken: string) => Promise<SessionTokenHash | Error>
}>

export type SystemAccessTokenIssuer = Readonly<{
  issue: (
    input: Readonly<{
      accountId: AccountId
      tokenVersion: number
      sessionFamilyId?: SessionFamilyId
      now: Date
    }>,
  ) => Promise<string | Error>
}>

export type IssueSystemSessionCommand = Readonly<{
  accountId: AccountId
  tokenVersion: number
  now: Date
  auditContext: SystemSessionAuditContext
}>

export type IssueSystemSessionResult =
  | Readonly<{
      kind: "issued"
      accountId: AccountId
      tokenVersion: number
      accessToken: string
      rawToken: string
      sessionId: SessionId
      expiresAt: Date
    }>
  | Readonly<{
      kind: "rejected"
      reason: AccountSessionRejection | "account_not_found"
    }>

export type SystemSessionIssuer = Readonly<{
  issue: (command: IssueSystemSessionCommand) => Promise<IssueSystemSessionResult | Error>
}>
