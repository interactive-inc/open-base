import { AttachmentPreservationEntity } from "@system/domain/entities/attachment-preservation.entity"
import { attachmentPreservationCommandSchema } from "@system/domain/schemas/attachments/attachment-preservation.schema"
import type { AttachmentPreservationRepository } from "@system/infrastructure/repositories/attachments/attachment-preservation.repository"
import { SystemAttachmentError } from "@system/domain/errors"

type Context = Readonly<{ repository: AttachmentPreservationRepository }>

/** 添付の内容を指定して保全を登録し、同じ登録の再送を受け付ける。 */
export class CreateAttachmentPreservation {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(input: unknown, now: Date) {
    const command = attachmentPreservationCommandSchema.safeParse(input)
    if (!command.success || !Number.isSafeInteger(now.getTime()))
      return new SystemAttachmentError("validation", "preservation_invalid", "保全の指定が不正です")
    const existing = await this.c.repository.find(command.data.id)
    if (existing instanceof Error) return existing
    if (existing !== null)
      return existing.matchesCreation(command.data)
        ? { kind: "replayed" as const, preservation: existing }
        : "conflict"
    const preservation = AttachmentPreservationEntity.create({
      ...command.data,
      createdAt: now.toISOString(),
      auditEventId: crypto.randomUUID(),
      revision: 1,
      release: null,
    })
    if (preservation instanceof Error) return preservation
    const audit = preservation.audit(null)
    if (audit instanceof Error) return audit
    const written = await this.c.repository.write(preservation, audit)
    if (written === "written") return { kind: "created" as const, preservation }
    if (written instanceof Error) return written
    const raced = await this.c.repository.find(command.data.id)
    if (raced instanceof Error) return raced
    return raced !== null && raced.matchesCreation(command.data)
      ? { kind: "replayed" as const, preservation: raced }
      : "conflict"
  }
}
