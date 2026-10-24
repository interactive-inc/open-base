import type { SystemD1Context } from "@system/configuration/system-context"
import { HumanAttestationEntity } from "@system/domain/entities/human-attestation.entity"
import { z } from "zod"

type Context = SystemD1Context
const snapshotSql = `SELECT json_group_array(json_object(
  'id',id,'caseId',case_id,'taskKey',task_key,'round',round,
  'actorAccountId',actor_account_id,'representedAccountId',represented_account_id,
  'delegationId',delegation_id,'action',action,'proposalDigest',proposal_digest,
  'comment',comment,'decidedAt',decided_at)) AS snapshot FROM (
  SELECT * FROM system_human_attestations WHERE case_id=?1 ORDER BY decided_at,id
)`
const rowsSchema = z.array(z.object({ decidedAt: z.number().int() }).passthrough())

/** 判断対象のdigestを含む承認証明を復元し、出力までの全項目の変更を検出する。 */
export class PreparePreservedRecordAttestationsAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: Readonly<{ caseId: string; proposalDigest: string }>) {
    try {
      const snapshot = await this.c.env.DB.prepare(snapshotSql)
        .bind(input.caseId)
        .first<string>("snapshot")
      if (snapshot === null) return new Error("record attestations are unavailable")
      const rows = rowsSchema.safeParse(JSON.parse(snapshot))
      if (!rows.success) return new Error("record attestations are invalid")
      const attestations: HumanAttestationEntity[] = []
      for (const row of rows.data) {
        const attestation = HumanAttestationEntity.create({
          ...row,
          decidedAt: new Date(row.decidedAt),
        })
        if (attestation instanceof Error) return attestation
        if (attestation.proposalDigest !== input.proposalDigest)
          return new Error("record attestation does not match executed proposal")
        attestations.push(attestation)
      }
      return Object.freeze({
        attestations: Object.freeze(
          attestations.map((attestation) => ({
            id: attestation.id,
            caseId: attestation.caseId,
            taskKey: attestation.taskKey,
            round: attestation.round,
            actorAccountId: attestation.actorAccountId,
            representedAccountId: attestation.representedAccountId,
            delegationId: attestation.delegationId,
            action: attestation.action,
            proposalDigest: attestation.proposalDigest,
            comment: attestation.comment,
            decidedAt: attestation.decidedAt,
          })),
        ),
        guard: this.c.env.DB.prepare(`SELECT CASE WHEN EXISTS (
          SELECT 1 FROM (${snapshotSql}) current WHERE current.snapshot=?2
        ) THEN 1 ELSE json_extract('{}','record_attestations_changed') END`).bind(
          input.caseId,
          snapshot,
        ),
      })
    } catch (cause) {
      return new Error("record attestations are unavailable", { cause })
    }
  }
}
