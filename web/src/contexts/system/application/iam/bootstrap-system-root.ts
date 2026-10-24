import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import type { InvalidSystemPasswordReason } from "@system/domain/errors"
import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { EmailValue } from "@system/domain/values/identity/email.value"
import { SystemPasswordValue } from "@system/domain/values/auth/system-password.value"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { zIdentityId } from "@system/domain/schemas/identity/identity-id.schema"
import { identitySubjectSchema } from "@system/domain/schemas/identity/identity-subject.schema"
import { roleBindingIdSchema } from "@system/domain/schemas/iam/role-binding.schema"
import type {
  D1SystemRootBootstrapAdapter,
  SystemRootBootstrapAdapterResult,
} from "@system/infrastructure/adapters/iam/d1-system-root-bootstrap.adapter"
import { z } from "zod"

export type SystemPasswordHasher = Readonly<{
  hash: (password: string) => Promise<string | Error>
}>

type Props = Readonly<{
  passwordHasher: SystemPasswordHasher
  repository: Pick<D1SystemRootBootstrapAdapter, "bootstrap">
}>

export type BootstrapSystemRootCommand = Readonly<{
  email: string
  password: string
  now: Date
}>

export type BootstrapSystemRootResult =
  | SystemRootBootstrapAdapterResult
  | Readonly<{
      kind: "invalid_input"
      reason: "invalid_email" | "invalid_time" | InvalidSystemPasswordReason
    }>
type BootstrapSystemRootContext = Props
type Context = BootstrapSystemRootContext

/** AccountEntity・Identity・credential・root binding・監査をCompanyなしで初期化する。 */
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

    const password = SystemPasswordValue.create(command.password)
    if (!(password instanceof SystemPasswordValue)) {
      return Object.freeze({ kind: "invalid_input" as const, reason: password.reason })
    }

    const accountId = zAccountId.safeParse(crypto.randomUUID())
    const identityId = zIdentityId.safeParse(crypto.randomUUID())
    const rootBindingId = roleBindingIdSchema.safeParse(crypto.randomUUID())
    if (!accountId.success || !identityId.success || !rootBindingId.success) {
      return new Error("failed to generate System bootstrap identifiers")
    }

    let passwordHash: string | Error
    try {
      passwordHash = await this.c.passwordHasher.hash(password.toString())
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to hash System password")
    }
    if (passwordHash instanceof Error) return passwordHash

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

    return this.c.repository.bootstrap({
      accountId: accountId.data,
      identityId: identityId.data,
      identitySubject: email.data,
      email: email.data,
      passwordHash,
      rootBindingId: rootBindingId.data,
      occurredAt: command.now,
      auditEvent,
    })
  }
}
