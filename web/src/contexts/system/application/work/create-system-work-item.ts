import { SystemWorkItemEntity } from "@system/domain/entities/system-work-item.entity"
import { SystemWorkItemError } from "@system/domain/errors"
import { createSystemWorkItemSchema } from "@system/domain/schemas/work/system-work-item.schema"
import type { SystemWorkItemRepository } from "@system/infrastructure/repositories/work/system-work-item.repository"
import type {
  SystemWorkAuthorization,
  SystemWorkAuthorizationAdapter,
} from "@system/infrastructure/adapters/work/system-work-authorization.adapter"

type Context = Readonly<{
  repository: SystemWorkItemRepository
  authorization: SystemWorkAuthorization
  identities: SystemWorkAuthorizationAdapter
  now: () => Date
}>

/** 作業の依頼と責任者を記録する。 */
export class CreateSystemWorkItem {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(input: unknown) {
    const command = createSystemWorkItemSchema.safeParse(input)
    if (!command.success) return new SystemWorkItemError("invalid", command.error)
    const proof = this.c.authorization
    if (proof.permission !== "system:work:create" || proof.actor.kind !== "human")
      return new SystemWorkItemError("forbidden")
    const existing = await this.c.repository.findCommand(command.data.commandId)
    if (existing instanceof Error) return existing
    if (existing !== null)
      return (await existing.matches(command.data, proof.actor))
        ? { workItem: existing, replayed: true }
        : new SystemWorkItemError("conflict")
    const before = await this.c.repository.findCurrent(command.data.id)
    if (before instanceof Error) return before
    if (before !== null) return new SystemWorkItemError("conflict")
    if (command.data.previousRevisionId !== null) {
      const previous = await this.c.repository.findCommand(command.data.previousRevisionId)
      if (previous instanceof Error) return previous
      if (
        previous === null ||
        (previous.snapshot.state !== "completed" && previous.snapshot.state !== "cancelled")
      )
        return new SystemWorkItemError("conflict")
    }
    const recipient = await this.c.identities.recipient(command.data.assigneeAccountId)
    if (recipient instanceof Error) return recipient
    const workItem = await SystemWorkItemEntity.create({
      command: command.data,
      actor: proof.actor,
      authentication: proof.authentication,
      now: this.c.now(),
      recipient,
      recovery: proof.isAdmin,
    })
    if (workItem instanceof Error) return workItem
    const saved = await this.c.repository.append(workItem, before)
    if (saved === undefined) return { workItem, replayed: false }
    if (saved.kind !== "conflict") return saved
    const raced = await this.c.repository.findCommand(command.data.commandId)
    if (raced instanceof Error) return raced
    return raced !== null && (await raced.matches(command.data, proof.actor))
      ? { workItem: raced, replayed: true }
      : saved
  }
}
