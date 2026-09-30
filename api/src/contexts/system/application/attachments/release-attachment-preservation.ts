import type { AttachmentPreservationRepository } from "@system/infrastructure/repositories/attachments/attachment-preservation.repository"
import { SystemAttachmentError } from "@system/domain/errors"
import { attachmentPreservationReleaseCommandSchema } from "@system/domain/schemas/attachments/attachment-preservation.schema"

type Context = Readonly<{ repository: AttachmentPreservationRepository }>

/** 指定した削除停止だけを解除し、他の保全と過去の理由を残す。 */
export class ReleaseAttachmentPreservation {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(input: unknown, now: Date) {
    const command = attachmentPreservationReleaseCommandSchema.safeParse(input)
    if (!command.success || !Number.isSafeInteger(now.getTime()))
      return new SystemAttachmentError(
        "validation",
        "preservation_release_invalid",
        "解除の指定が不正です",
      )
    const existing = await this.c.repository.find(command.data.id)
    if (existing instanceof Error) return existing
    if (existing === null || existing.snapshot.attachmentId !== command.data.attachmentId)
      return "not_found"
    const release = existing.snapshot.release
    if (release !== null)
      return release.operationId === command.data.operationId &&
        release.reason === command.data.reason &&
        release.actorAccountId === command.data.actorAccountId
        ? { kind: "replayed" as const, preservation: existing }
        : "conflict"
    const preservation = existing.release({
      operationId: command.data.operationId,
      reason: command.data.reason,
      actorAccountId: command.data.actorAccountId,
      at: now.toISOString(),
      auditEventId: crypto.randomUUID(),
    })
    if (preservation instanceof Error) return "conflict"
    const audit = preservation.audit(existing)
    if (audit instanceof Error) return audit
    const written = await this.c.repository.write(preservation, audit)
    if (written === "written") return { kind: "released" as const, preservation }
    if (written instanceof Error) return written
    const raced = await this.c.repository.find(command.data.id)
    if (raced instanceof Error) return raced
    const racedRelease = raced?.snapshot.release
    return raced !== null &&
      racedRelease !== null &&
      racedRelease !== undefined &&
      racedRelease.operationId === command.data.operationId &&
      racedRelease.reason === command.data.reason &&
      racedRelease.actorAccountId === command.data.actorAccountId
      ? { kind: "replayed" as const, preservation: raced }
      : "conflict"
  }
}
