import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { EmailValue } from "@system/domain/values/identity/email.value"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { zIdentityId, type IdentityId } from "@system/domain/schemas/identity/identity-id.schema"
import { identitySubjectSchema } from "@system/domain/schemas/identity/identity-subject.schema"
import { roleBindingIdSchema } from "@system/domain/schemas/iam/role-binding.schema"
import type {
  D1SystemRootBootstrapAdapter,
  SystemRootBootstrapAdapterResult,
} from "@system/infrastructure/adapters/iam/d1-system-root-bootstrap.adapter"
import { z } from "zod"

/** 初期rootのパスキー招待を作るport。招待は初期化と同じbatchで保存する。 */
export type SystemRootEnrollmentIssuer = Readonly<{
  prepare: (
    input: Readonly<{ accountId: AccountId; identityId: IdentityId; now: Date }>,
  ) => Promise<
    | Readonly<{ token: string; expiresAt: Date; statements: ReadonlyArray<D1PreparedStatement> }>
    | Error
  >
}>

type Props = Readonly<{
  enrollmentIssuer: SystemRootEnrollmentIssuer
  repository: Pick<D1SystemRootBootstrapAdapter, "bootstrap">
}>

export type BootstrapSystemRootCommand = Readonly<{
  email: string
  now: Date
}>

export type BootstrapSystemRootResult =
  | Exclude<SystemRootBootstrapAdapterResult, Readonly<{ kind: "created" }>>
  | (Extract<SystemRootBootstrapAdapterResult, Readonly<{ kind: "created" }>> &
      Readonly<{ enrollment: Readonly<{ token: string; expiresAt: Date }> }>)
  | Readonly<{
      kind: "invalid_input"
      reason: "invalid_email" | "invalid_time"
    }>
type BootstrapSystemRootContext = Props
type Context = BootstrapSystemRootContext

/**
 * Account・パスキーIdentity・root binding・監査をCompanyなしで初期化する。
 * パスワードは持たない。初期rootは返したパスキー招待でパスキーを登録してからサインインする。
 */
export class BootstrapSystemRoot {
  private static readonly emailSchema = EmailValue.schema
    .pipe(z.string().max(254))
    .pipe(identitySubjectSchema)

  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(command: BootstrapSystemRootCommand): Promise<BootstrapSystemRootResult | Error> {
    if (!Number.isSafeInteger(command.now.getTime())) {
      return Object.freeze({ kind: "invalid_input" as const, reason: "invalid_time" as const })
    }

    const email = BootstrapSystemRoot.emailSchema.safeParse(command.email)
    if (!email.success) {
      return Object.freeze({ kind: "invalid_input" as const, reason: "invalid_email" as const })
    }

    const accountId = zAccountId.safeParse(crypto.randomUUID())
    const identityId = zIdentityId.safeParse(crypto.randomUUID())
    const rootBindingId = roleBindingIdSchema.safeParse(crypto.randomUUID())
    if (!accountId.success || !identityId.success || !rootBindingId.success) {
      return new Error("failed to generate System bootstrap identifiers")
    }

    const enrollment = await this.c.enrollmentIssuer.prepare({
      accountId: accountId.data,
      identityId: identityId.data,
      now: command.now,
    })
    if (enrollment instanceof Error) return enrollment

    const auditEvent = SystemAuditEventEntity.create<AccountId>({
      actorAccountId: null,
      action: SYSTEM_AUDIT_ACTIONS.systemBootstrapCompleted,
      targetType: "system_account",
      targetId: accountId.data,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: null,
      afterJson: null,
      metadataJson: null,
      occurredAt: command.now,
    })
    if (auditEvent instanceof Error) return auditEvent

    const bootstrap = await this.c.repository.bootstrap({
      accountId: accountId.data,
      identityId: identityId.data,
      email: email.data,
      rootBindingId: rootBindingId.data,
      occurredAt: command.now,
      auditEvent,
      enrollmentStatements: enrollment.statements,
    })
    if (bootstrap instanceof Error || bootstrap.kind !== "created") return bootstrap
    return Object.freeze({
      ...bootstrap,
      enrollment: Object.freeze({ token: enrollment.token, expiresAt: enrollment.expiresAt }),
    })
  }
}
