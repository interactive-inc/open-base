import type { SystemD1Context } from "@system/configuration/system-context"
import type { PreservedRecordEntity } from "@system/domain/entities/preserved-record.entity"
import { PreservedRecordDisclosurePolicyEntity } from "@system/domain/entities/preserved-record-disclosure-policy.entity"

type Context = SystemD1Context & Readonly<{ assertions: ReadonlyArray<D1PreparedStatement> }>
const historySql = `SELECT json_group_array(json(snapshot_json)) AS history FROM (
  SELECT snapshot_json FROM system_record_disclosure_policies WHERE id = ?1 ORDER BY revision
)`

/** 原記録に属する開示設定を初版から取得し、版の欠損や取得後の更新を検出する。 */
export class PreparePreservedRecordDisclosureHistoryAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(record: PreservedRecordEntity) {
    if (this.c.assertions.length === 0)
      return new Error("disclosure history authorization is required")
    try {
      const batches = await this.c.env.DB.batch<{ history: string }>([
        ...this.c.assertions,
        this.c.env.DB.prepare(historySql).bind(record.snapshot.disclosurePolicyId),
      ])
      if (
        batches.length !== this.c.assertions.length + 1 ||
        batches.some((batch) => !batch.success)
      )
        return new Error("disclosure history unavailable")
      const history = batches.at(-1)?.results.at(0)?.history
      if (typeof history !== "string") return new Error("disclosure history unavailable")
      const snapshots: unknown = JSON.parse(history)
      if (!Array.isArray(snapshots) || snapshots.length < record.snapshot.disclosurePolicyRevision)
        return new Error("original disclosure revision is missing")
      const policies: PreservedRecordDisclosurePolicyEntity[] = []
      for (const snapshot of snapshots) {
        const policy = PreservedRecordDisclosurePolicyEntity.create(snapshot)
        if (policy instanceof Error) return policy
        const previous = policies.at(-1)
        if (
          policy.snapshot.id !== record.snapshot.disclosurePolicyId ||
          policy.snapshot.recordId !== record.snapshot.id ||
          policy.snapshot.revision !== policies.length + 1 ||
          (previous !== undefined &&
            Date.parse(previous.snapshot.publishedAt) > Date.parse(policy.snapshot.publishedAt))
        )
          return new Error("disclosure history is inconsistent")
        policies.push(policy)
      }
      return Object.freeze({
        policies: Object.freeze(policies.map((policy) => policy.snapshot)),
        guard: this.c.env.DB.prepare(`SELECT CASE WHEN EXISTS (
          SELECT 1 FROM (${historySql}) current WHERE current.history = ?2
        ) THEN 1 ELSE json_extract('{}', 'record_disclosure_history_changed') END`).bind(
          record.snapshot.disclosurePolicyId,
          history,
        ),
      })
    } catch (cause) {
      return new Error("disclosure history unavailable", { cause })
    }
  }
}
