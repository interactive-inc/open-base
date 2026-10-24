import type { SystemD1Context } from "@system/configuration/system-context"
import type { SystemAttestationView } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { DelegationEntity } from "@system/domain/entities/delegation.entity"
import { systemCaseReferenceSchema } from "@system/domain/schemas/workflow/system-case-reference.schema"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { z } from "zod"

type Context = SystemD1Context
const dateSchema = z
  .number()
  .int()
  .transform((value) => new Date(value))
const delegationSchema = z
  .object({
    id: z.string().min(1).max(255),
    delegatorAccountId: zAccountId,
    delegateAccountId: zAccountId,
    scope: systemCaseReferenceSchema.nullable(),
    startsAt: dateSchema,
    endsAt: dateSchema,
    createdAt: dateSchema,
    revokedAt: dateSchema.nullable(),
    procedureKey: z.string().min(1).nullable(),
  })
  .strict()
const snapshotSql = `SELECT json_group_array(json_object(
  'id',id,'delegatorAccountId',delegator_account_id,'delegateAccountId',delegate_account_id,
  'scope',CASE WHEN scope_context IS NULL AND scope_kind IS NULL AND scope_id IS NULL AND scope_version IS NULL
    THEN NULL ELSE json_object('context',scope_context,'kind',scope_kind,'id',scope_id,'version',scope_version) END,
  'startsAt',starts_at,'endsAt',ends_at,'createdAt',created_at,'revokedAt',revoked_at,
  'procedureKey',procedure_key)) AS snapshot FROM (
    SELECT delegation.*,scope.procedure_key FROM system_delegations delegation
    LEFT JOIN system_delegation_procedure_scopes scope ON scope.delegation_id=delegation.id
    WHERE delegation.id IN (SELECT delegation_id FROM system_human_attestations WHERE case_id=?1)
    ORDER BY delegation.id
  )`

/** 過去の代理承認が参照する委任条件を復元し、当時の範囲と資格を検証する。 */
export class PreparePreservedRecordDelegationsAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    input: Readonly<{
      caseId: string
      subject: z.output<typeof systemCaseReferenceSchema>
      procedureKey: string
      attestations: ReadonlyArray<SystemAttestationView>
    }>,
  ) {
    try {
      const snapshot = await this.c.env.DB.prepare(snapshotSql)
        .bind(input.caseId)
        .first<string>("snapshot")
      if (snapshot === null) return new Error("record delegation history is unavailable")
      const parsed = z.array(delegationSchema).safeParse(JSON.parse(snapshot))
      if (!parsed.success) return new Error("record delegation history is invalid")
      const delegations = new Map<string, DelegationEntity>()
      for (const row of parsed.data) {
        const delegation = DelegationEntity.create({
          id: row.id,
          delegatorAccountId: row.delegatorAccountId,
          delegateAccountId: row.delegateAccountId,
          scope: row.scope,
          startsAt: row.startsAt,
          endsAt: row.endsAt,
          createdAt: row.createdAt,
          revokedAt: row.revokedAt,
        })
        if (delegation instanceof Error) return delegation
        if (
          row.procedureKey !== null &&
          (row.scope !== null || row.procedureKey !== input.procedureKey)
        )
          return new Error("record delegation procedure does not match")
        delegations.set(row.id, delegation)
      }
      for (const attestation of input.attestations) {
        if (attestation.delegationId === null) continue
        const delegation = delegations.get(attestation.delegationId)
        if (
          delegation === undefined ||
          delegation.delegatorAccountId !== attestation.representedAccountId ||
          delegation.delegateAccountId !== attestation.actorAccountId ||
          !delegation.isActiveAt(attestation.decidedAt, input.subject)
        )
          return new Error("record attestation delegation is missing or invalid")
      }
      return Object.freeze({
        delegations: Object.freeze(parsed.data),
        guard: this.c.env.DB.prepare(`SELECT CASE WHEN EXISTS (
          SELECT 1 FROM (${snapshotSql}) current WHERE current.snapshot=?2
        ) THEN 1 ELSE json_extract('{}','record_delegation_history_changed') END`).bind(
          input.caseId,
          snapshot,
        ),
      })
    } catch (cause) {
      return new Error("record delegation history is unavailable", { cause })
    }
  }
}
