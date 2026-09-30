import { RecordSourceFreezeEntity } from "@system/domain/entities/record-source-freeze.entity"
import { recordSourceFreezeCommandSchema } from "@system/domain/schemas/records/record-source-freeze.schema"
import type { RecordSourceFreezeRepository } from "@system/infrastructure/repositories/records/record-source-freeze.repository"

type Context = Readonly<{ repository: RecordSourceFreezeRepository }>
type Result =
  | Readonly<{ kind: "created" | "replayed"; freeze: RecordSourceFreezeEntity }>
  | "conflict"
  | Error

/** 同じIDの再送では元の停止世代を返し、解除済みの世代を復活させない。 */
export class CreateRecordSourceFreeze {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(input: unknown, now: Date): Promise<Result> {
    const command = recordSourceFreezeCommandSchema.safeParse(input)
    if (!command.success || !Number.isSafeInteger(now.getTime()))
      return new Error("invalid source freeze command")
    const matches = (freeze: RecordSourceFreezeEntity) =>
      JSON.stringify(recordSourceFreezeCommandSchema.strip().parse(freeze.snapshot)) ===
      JSON.stringify(command.data)
    const existing = await this.c.repository.find(command.data.id)
    if (existing instanceof Error) return existing
    if (existing !== null)
      return matches(existing) ? { kind: "replayed", freeze: existing } : "conflict"
    const freeze = RecordSourceFreezeEntity.create({
      ...command.data,
      createdAt: now.toISOString(),
      auditEventId: crypto.randomUUID(),
      revision: 1,
      release: null,
    })
    if (freeze instanceof Error) return freeze
    const audit = freeze.audit(null)
    if (audit instanceof Error) return audit
    const result = await this.c.repository.write(freeze, audit)
    if (result === "written") return { kind: "created", freeze }
    if (result instanceof Error) return result
    const raced = await this.c.repository.find(command.data.id)
    if (raced instanceof Error) return raced
    return raced !== null && matches(raced) ? { kind: "replayed", freeze: raced } : "conflict"
  }
}
