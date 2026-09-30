import { z } from "zod"
import type { SystemD1Context } from "@system/configuration/system-context"
import type { PreservedRecordDisclosurePolicyEntity } from "@system/domain/entities/preserved-record-disclosure-policy.entity"
import type { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import type { SystemAttachmentRow } from "@system/infrastructure/schema/system-attachment"
import { PreservedRecordRepository } from "@system/infrastructure/repositories/records/preserved-record.repository"
import { PreservedRecordDisclosurePolicyRepository } from "@system/infrastructure/repositories/records/preserved-record-disclosure-policy.repository"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { PrepareAttachmentContentReadGuardAdapter } from "@system/infrastructure/adapters/attachments/prepare-attachment-content-read-guard.adapter"

type Context = SystemD1Context &
  Readonly<{ assertions: readonly [D1PreparedStatement, ...D1PreparedStatement[]] }>

/** 現在の開示資格と本文を固定し、開示監査を保存する。 */
export class DisclosePreservedRecordPersistenceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  async findRecord(id: string) {
    if (this.c.assertions.length === 0) return new Error("record authorization is required")
    return new PreservedRecordRepository(this.c).find(id)
  }
  findPolicy(id: string) {
    return new PreservedRecordDisclosurePolicyRepository(this.c).findCurrent(id)
  }
  prepareGuards(
    input: Readonly<{
      policy: PreservedRecordDisclosurePolicyEntity
      request: unknown
      attachment: SystemAttachmentRow
      at: Date
    }>,
  ) {
    const request = z
      .strictObject({
        recordId: z.uuid(),
        accountId: z.string(),
        action: z.enum(["read", "export"]),
        purpose: z.string(),
        at: z.date(),
      })
      .safeParse(input.request)
    if (!request.success) return request.error
    const guards = new PreservedRecordDisclosurePolicyRepository(this.c).prepareDisclosureGuard(
      input.policy,
      input.request,
    )
    if (guards instanceof Error) return guards
    const timed = this.c.env.DB.prepare(`WITH evaluation AS (
      SELECT max(?1,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)) AS at
    ) SELECT CASE WHEN EXISTS (
      SELECT 1 FROM system_record_disclosure_policies p, json_each(p.snapshot_json,'$.grants') g
      WHERE p.id=?2 AND p.revision=?3 AND json_extract(p.snapshot_json,'$.status')='active'
        AND round((julianday(json_extract(p.snapshot_json,'$.publishedAt'))-2440587.5)*86400000) <= (SELECT at FROM evaluation)
        AND json_extract(g.value,'$.accountId')=?4
        AND EXISTS(SELECT 1 FROM json_each(g.value,'$.actions') a WHERE a.value=?5)
        AND EXISTS(SELECT 1 FROM json_each(g.value,'$.purposes') u WHERE u.value=?6)
        AND round((julianday(json_extract(g.value,'$.validFrom'))-2440587.5)*86400000) <= (SELECT at FROM evaluation)
        AND (json_type(g.value,'$.validUntil')='null' OR round((julianday(json_extract(g.value,'$.validUntil'))-2440587.5)*86400000) > (SELECT at FROM evaluation))
    ) THEN 1 ELSE json_extract('{}','record_disclosure_period_changed') END`).bind(
      input.at.getTime(),
      input.policy.snapshot.id,
      input.policy.snapshot.revision,
      request.data.accountId,
      request.data.action,
      request.data.purpose,
    )
    return Object.freeze([
      ...guards,
      timed,
      new PrepareAttachmentContentReadGuardAdapter(this.c).prepare(input.attachment, input.at),
    ])
  }

  /** 添付原文への変換後にも、開示時に固定した条件が現在も有効か確認する。 */
  async revalidate(guards: ReadonlyArray<D1PreparedStatement>): Promise<true | Error> {
    if (guards.length === 0) return new Error("record disclosure guards required")
    try {
      const checked = await this.c.env.DB.batch([...guards])
      if (checked.length !== guards.length || checked.some((result) => !result.success))
        return new Error("record disclosure conditions changed")
      return true
    } catch (cause) {
      return new Error("record disclosure conditions changed", { cause })
    }
  }

  async write(
    input: Readonly<{
      policy: PreservedRecordDisclosurePolicyEntity
      request: unknown
      attachment: SystemAttachmentRow
      audit: SystemAuditEventEntity
      at: Date
    }>,
  ) {
    const guards = this.prepareGuards(input)
    if (guards instanceof Error) return guards
    return new SystemAuditEventRepository(this.c).append(input.audit, guards)
  }
}
