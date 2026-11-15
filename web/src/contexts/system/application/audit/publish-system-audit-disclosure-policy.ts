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
    if (
      !command.success ||
      !Number.isSafeInteger(now.getTime()) ||
      now.getTime() < 0 ||
      (command.data.scope === "*" && command.data.supersedesLegacyRevision !== undefined)
    )
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
    const result = await this.append(policy, before)
    if (result === undefined) return { policy, replayed: false }
    if (!(result instanceof SystemAuditDisclosureError) || result.kind !== "conflict") return result
    const raced = await this.c.repository.findCommand(command.data.commandId)
    if (raced instanceof Error) return raced
    return raced !== null && raced.matches(command.data)
      ? { policy: raced, replayed: true }
      : result
  }

  private async append(
    policy: SystemAuditDisclosurePolicyEntity,
    before: SystemAuditDisclosurePolicyEntity | null,
  ) {
    const expected = policy.snapshot.supersedesLegacyRevision
    if (expected === undefined) return this.c.repository.append(policy, before)
    const legacy = await this.c.repository.findLegacyCurrent(policy.snapshot.scope)
    if (legacy instanceof Error) return legacy
    if (legacy === null || legacy.snapshot.revision !== expected)
      return new SystemAuditDisclosureError("conflict")
    const retirement = legacy.retireInFavorOf(policy, {
      commandId: crypto.randomUUID(),
      auditEventId: crypto.randomUUID(),
    })
    if (retirement instanceof Error) return retirement
    return this.c.repository.appendReplacingLegacy(policy, before, retirement, legacy)
  }
}
