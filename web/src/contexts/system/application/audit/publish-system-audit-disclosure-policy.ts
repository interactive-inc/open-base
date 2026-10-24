import { SystemAuditDisclosurePolicyEntity } from "@system/domain/entities/system-audit-disclosure-policy.entity"
import { auditDisclosureCommandSchema } from "@system/domain/schemas/audit/system-audit-disclosure-policy.schema"
import { SystemAuditDisclosureError } from "@system/domain/errors"
import type { SystemAuditDisclosurePolicyRepository } from "@system/infrastructure/repositories/audit/system-audit-disclosure-policy.repository"

type Context = Readonly<{ repository: SystemAuditDisclosurePolicyRepository }>

/** 開示条件を期待版と再送キーに結び付けて公開する。 */
export class PublishSystemAuditDisclosurePolicy {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(input: unknown, now: Date) {
    const command = auditDisclosureCommandSchema.safeParse(input)
    if (!command.success || !Number.isSafeInteger(now.getTime()) || now.getTime() < 0)
      return new SystemAuditDisclosureError("invalid")
    const existing = await this.c.repository.findCommand(command.data.commandId)
    if (existing instanceof Error) return existing
    if (existing !== null)
      return existing.matches(command.data)
        ? { policy: existing, replayed: true }
        : new SystemAuditDisclosureError("conflict")
    const before = await this.c.repository.findCurrent(command.data.scope)
    if (before instanceof Error) return before
    if ((before?.snapshot.revision ?? 0) !== command.data.expectedRevision) {
      const raced = await this.c.repository.findCommand(command.data.commandId)
      if (raced instanceof Error) return raced
      return raced !== null && raced.matches(command.data)
        ? { policy: raced, replayed: true }
        : new SystemAuditDisclosureError("conflict")
    }
    const { expectedRevision, ...props } = command.data
    const policy = SystemAuditDisclosurePolicyEntity.create({
      ...props,
      revision: expectedRevision + 1,
      recordedAt: now.toISOString(),
      auditEventId: crypto.randomUUID(),
    })
    if (policy instanceof Error) return policy
    const result = await this.c.repository.append(policy, before)
    if (result === undefined) return { policy, replayed: false }
    if (result.kind !== "conflict") return result
    const raced = await this.c.repository.findCommand(command.data.commandId)
    if (raced instanceof Error) return raced
    return raced !== null && raced.matches(command.data)
      ? { policy: raced, replayed: true }
      : result
  }
}
