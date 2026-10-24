import type { RecordSourceFreezeEntity } from "@system/domain/entities/record-source-freeze.entity"
import { recordSourceFreezeCommandSchema } from "@system/domain/schemas/records/record-source-freeze.schema"
import type { RecordSourceFreezeRepository } from "@system/infrastructure/repositories/records/record-source-freeze.repository"

type Context = Readonly<{ repository: RecordSourceFreezeRepository }>
type Result =
  | Readonly<{ kind: "released" | "replayed"; freeze: RecordSourceFreezeEntity }>
  | "not_found"
  | "conflict"
  | Error

/** 対象の停止だけを解除し、同じ主体・理由の再送を元の解除へ対応させる。 */
export class ReleaseRecordSourceFreeze {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(input: unknown, now: Date): Promise<Result> {
    const command = recordSourceFreezeCommandSchema.safeParse(input)
    if (!command.success || !Number.isSafeInteger(now.getTime()))
      return new Error("invalid source freeze release")
    const existing = await this.c.repository.find(command.data.id)
    if (existing instanceof Error) return existing
    if (
      existing === null ||
      existing.snapshot.sourceNamespace !== command.data.sourceNamespace ||
      existing.snapshot.ownerContext !== command.data.ownerContext
    )
      return "not_found"
    const matches = (freeze: RecordSourceFreezeEntity) =>
      freeze.snapshot.release?.actorAccountId === command.data.actorAccountId &&
      freeze.snapshot.release.reason === command.data.reason
    if (existing.snapshot.release !== null)
      return matches(existing) ? { kind: "replayed", freeze: existing } : "conflict"
    const freeze = existing.release({
      actorAccountId: command.data.actorAccountId,
      reason: command.data.reason,
      at: now.toISOString(),
      auditEventId: crypto.randomUUID(),
    })
    if (freeze instanceof Error) return freeze
    const audit = freeze.audit(existing)
    if (audit instanceof Error) return audit
    const result = await this.c.repository.write(freeze, audit, existing)
    if (result === "written") return { kind: "released", freeze }
    if (result instanceof Error) return result
    const raced = await this.c.repository.find(command.data.id)
    if (raced instanceof Error) return raced
    return raced !== null && matches(raced) ? { kind: "replayed", freeze: raced } : "conflict"
  }
}
