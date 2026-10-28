import type {
  ReviewContext,
  ReviewCommand,
} from "@/contexts/performance-review/configuration/review-context"
import { ReviewCycleEntity } from "@/contexts/performance-review/domain/entities/review-cycle.entity"
import { ReviewError } from "@/contexts/performance-review/domain/errors"

export class ReviewCycleRepository {
  constructor(private readonly c: ReviewContext) {}
  async find(id: string) {
    const row = await this.c.env.DB.prepare(
      "SELECT snapshot_json FROM performance_review_cycles WHERE id = ?",
    )
      .bind(id)
      .first<{ snapshot_json: string }>()
    return row === null ? null : ReviewCycleEntity.create(JSON.parse(row.snapshot_json))
  }
  async list(limit = 50, offset = 0) {
    const rows = await this.c.env.DB.prepare(
      "SELECT snapshot_json FROM performance_review_cycles ORDER BY created_at DESC, id LIMIT ? OFFSET ?",
    )
      .bind(limit, offset)
      .all<{ snapshot_json: string }>()
    return rows.results.map((row) => ReviewCycleEntity.create(JSON.parse(row.snapshot_json)).data)
  }
  async save(
    cycle: ReviewCycleEntity,
    command: ReviewCommand,
    statements: ReadonlyArray<D1PreparedStatement>,
    guards: ReadonlyArray<D1PreparedStatement> = [],
  ) {
    const db = this.c.env.DB
    const prior = await db
      .prepare(
        "SELECT command_digest, snapshot_json FROM performance_review_cycles WHERE created_by_account_id = ? AND idempotency_key = ?",
      )
      .bind(this.c.actor.accountId, command.idempotencyKey)
      .first<{ command_digest: string; snapshot_json: string }>()
    if (prior !== null) {
      if (prior.command_digest !== command.digest)
        throw new ReviewError(409, "idempotency_key_reused")
      await db.batch([...guards])
      return ReviewCycleEntity.create(JSON.parse(prior.snapshot_json)).data
    }
    try {
      await db.batch([
        ...guards,
        ...statements,
        db
          .prepare(`INSERT INTO performance_review_cycles
        (id, snapshot_json, created_by_account_id, idempotency_key, command_digest, reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .bind(
            cycle.data.id,
            JSON.stringify(cycle.data),
            this.c.actor.accountId,
            command.idempotencyKey,
            command.digest,
            command.reason,
            cycle.data.created_at,
          ),
      ])
    } catch {
      const replay = await db
        .prepare(
          "SELECT command_digest, snapshot_json FROM performance_review_cycles WHERE created_by_account_id = ? AND idempotency_key = ?",
        )
        .bind(this.c.actor.accountId, command.idempotencyKey)
        .first<{ command_digest: string; snapshot_json: string }>()
      if (replay?.command_digest === command.digest) {
        await db.batch([...guards])
        return ReviewCycleEntity.create(JSON.parse(replay.snapshot_json)).data
      }
      throw new ReviewError(409, "cycle_write_conflict")
    }
    return cycle.data
  }
}
