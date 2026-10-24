import { z } from "zod"
import {
  ATTACHMENT_RECONCILIATION_JOB_NAME,
  ATTACHMENT_RECONCILIATION_LEASE_MILLISECONDS,
  ATTACHMENT_RECONCILIATION_NOTIFICATION_KIND,
  ATTACHMENT_RECONCILIATION_RECIPIENT_PERMISSIONS,
  ATTACHMENT_RECONCILIATION_REPORTED_ID_LIMIT,
  ATTACHMENT_RECONCILIATION_SOURCE_TYPE,
} from "@system/domain/catalogs/attachments/attachment-reconciliation.catalog"
import { AttachmentObjectAdapter } from "@system/infrastructure/adapters/attachments/attachment-object.adapter"
import { ListSystemPermissionHolderAccountsAdapter } from "@system/infrastructure/adapters/iam/list-system-permission-holder-accounts.adapter"
import { NotificationDeliveryEntity } from "@system/domain/entities/notification-delivery.entity"
import { NotificationMessageEntity } from "@system/domain/entities/notification-message.entity"
import { NotificationDeliveryBatchValue } from "@system/domain/values/notifications/notification-delivery-batch.value"
import { SystemNotificationRepository } from "@system/infrastructure/repositories/notifications/system-notification.repository"

type Context = Readonly<{
  env: Readonly<{ DB: D1Database; ATTACHMENTS?: R2Bucket }>
  clock: () => Date
}>

type Input = Readonly<{ chunkSize: number; maxChunks: number }>

export type AttachmentReconciliationOutcome =
  | Readonly<{ status: "busy" }>
  | Readonly<{
      status: "completed" | "failed"
      runId: string
      checked: number
      missingAttachmentIds: ReadonlyArray<string>
      nextCursor: string | null
      notifiedAccounts: number
    }>

const zRecordedCursor = z.object({ nextCursor: z.string().min(1).max(255).nullable() })

const ABORT_UNLESS_ONE_CHANGE =
  "SELECT CASE WHEN changes() = 1 THEN 1 ELSE abs(-9223372036854775808) END AS ok"

/**
 * 保存済みの添付行をid順に辿り、本体の実在を確認する。object storageの全件一覧は使わない。
 * 実行と結果はSystem batch jobへ記録し、次の位置は最後に進めた実行の記録から読む。
 * 確認に失敗したchunkでは位置を進めず、次の実行が同じ範囲を確認し直す。
 * 欠損と、成功から失敗へ変わった実行は、batch:viewまたはsystem:adminを持つAccountへ通知する。
 * 実行の完了、結果、通知は同じbatchで確定し、別の実行が先に閉じた記録へ結果を書かない。
 */
export class AttachmentReconciliationAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(input: Input): Promise<AttachmentReconciliationOutcome | Error> {
    if (!isBoundedInteger(input.chunkSize, 1, 500) || !isBoundedInteger(input.maxChunks, 1, 100))
      return new Error("attachment reconciliation limits are invalid")
    if (this.c.env.ATTACHMENTS === undefined)
      return new Error("attachment reconciliation requires attachment storage")

    try {
      const startedAt = this.c.clock()
      const runId = crypto.randomUUID()
      const started = await this.start(runId, startedAt)
      if (!started) return { status: "busy" }

      const previous = await this.previous(runId)
      let cursor = previous.cursor
      const objects = new AttachmentObjectAdapter(this.c)
      const missing: string[] = []
      let checked = 0
      let failed = false

      for (let chunk = 0; chunk < input.maxChunks && !failed; chunk++) {
        const rows = await this.c.env.DB.prepare(
          `SELECT id, object_key AS objectKey FROM system_attachments
           WHERE status IN ('pending', 'linked') AND (?1 IS NULL OR id > ?1)
           ORDER BY id LIMIT ?2`,
        )
          .bind(cursor, input.chunkSize)
          .all<{ id: string; objectKey: string }>()
        for (const row of rows.results) {
          if (row.objectKey !== `att/${row.id}`) {
            missing.push(row.id)
            continue
          }
          const exists = await objects.exists(row.objectKey)
          if (exists instanceof Error) {
            failed = true
            break
          }
          checked += 1
          if (!exists) missing.push(row.id)
        }
        if (failed) break
        const last = rows.results.at(-1)
        // 末尾まで辿ったら先頭へ戻し、次の実行が一巡目から確認する。
        cursor = rows.results.length < input.chunkSize || last === undefined ? null : last.id
        if (cursor === null) break
      }

      const finishedAt = this.c.clock()
      const status = failed ? "failed" : "completed"
      const notify = missing.length > 0 || (failed && previous.status !== "failed")
      const recipients = notify ? await this.recipients() : []
      if (recipients instanceof Error) return recipients
      const reported = missing.slice(0, ATTACHMENT_RECONCILIATION_REPORTED_ID_LIMIT)
      const notification =
        recipients.length === 0
          ? []
          : this.prepareNotification({
              runId,
              at: finishedAt,
              title: failed ? "添付本体の照合が失敗しました" : "添付本体の欠損を検出しました",
              body: notificationBody(missing.length, reported, failed),
              recipients,
            })
      if (notification instanceof Error) return notification

      const message = JSON.stringify({
        checked,
        missingCount: missing.length,
        missingAttachmentIds: reported,
        nextCursor: cursor,
        failure: failed ? "attachment_head_failed" : null,
        notifiedAccounts: recipients.length,
      })
      await this.c.env.DB.batch([
        this.c.env.DB.prepare(
          `UPDATE system_batch_jobs SET status = ?2, finished_at = ?3, message = ?4
           WHERE id = ?1 AND status = 'running'`,
        ).bind(runId, status, finishedAt.getTime(), message),
        this.c.env.DB.prepare(ABORT_UNLESS_ONE_CHANGE),
        ...notification,
      ])

      return {
        status,
        runId,
        checked,
        missingAttachmentIds: missing,
        nextCursor: cursor,
        notifiedAccounts: recipients.length,
      }
    } catch (cause) {
      return new Error("attachment reconciliation failed", { cause })
    }
  }

  /** 期限を過ぎた実行を失敗として閉じ、実行中の記録が無い場合だけ新しい実行を始める。 */
  private async start(runId: string, at: Date): Promise<boolean> {
    await this.c.env.DB.batch([
      this.c.env.DB.prepare(
        `UPDATE system_batch_jobs SET status = 'failed', finished_at = ?2, message = ?3
         WHERE name = ?1 AND status = 'running' AND started_at <= ?4`,
      ).bind(
        ATTACHMENT_RECONCILIATION_JOB_NAME,
        at.getTime(),
        JSON.stringify({ failure: "lease_expired" }),
        at.getTime() - ATTACHMENT_RECONCILIATION_LEASE_MILLISECONDS,
      ),
      this.c.env.DB.prepare(
        `INSERT INTO system_batch_jobs (id, name, status, started_at)
         SELECT ?1, ?2, 'running', ?3
         WHERE NOT EXISTS (
           SELECT 1 FROM system_batch_jobs WHERE name = ?2 AND status = 'running'
         )`,
      ).bind(runId, ATTACHMENT_RECONCILIATION_JOB_NAME, at.getTime()),
    ])
    // batchの件数表示に頼らず、この実行の記録が保存されたかを読んで判定する。
    const own = await this.c.env.DB.prepare(
      "SELECT 1 AS found FROM system_batch_jobs WHERE id = ?1",
    )
      .bind(runId)
      .first<number>("found")
    return own === 1
  }

  /** 直前に終わった実行の状態と、位置を記録した最後の実行の次の位置を読む。 */
  private async previous(
    runId: string,
  ): Promise<Readonly<{ status: "completed" | "failed" | null; cursor: string | null }>> {
    const [last, recorded] = await this.c.env.DB.batch<{ status?: string; message?: string }>([
      this.c.env.DB.prepare(
        `SELECT status FROM system_batch_jobs
         WHERE name = ?1 AND id <> ?2 AND status IN ('completed', 'failed')
         ORDER BY finished_at DESC, rowid DESC LIMIT 1`,
      ).bind(ATTACHMENT_RECONCILIATION_JOB_NAME, runId),
      this.c.env.DB.prepare(
        `SELECT message FROM system_batch_jobs
         WHERE name = ?1 AND id <> ?2 AND status IN ('completed', 'failed')
           AND json_valid(message) AND json_type(message, '$.nextCursor') IS NOT NULL
         ORDER BY finished_at DESC, rowid DESC LIMIT 1`,
      ).bind(ATTACHMENT_RECONCILIATION_JOB_NAME, runId),
    ])
    const status = last?.results[0]?.status
    const message = recorded?.results[0]?.message
    // 記録が読めない場合は先頭から確認し直す。確認を飛ばす方向へは倒さない。
    const parsed = message === undefined ? null : zRecordedCursor.safeParse(safeJson(message))
    return {
      status: status === "completed" || status === "failed" ? status : null,
      cursor: parsed?.success === true ? parsed.data.nextCursor : null,
    }
  }

  private prepareNotification(
    input: Readonly<{
      runId: string
      at: Date
      title: string
      body: string
      recipients: ReadonlyArray<string>
    }>,
  ): ReadonlyArray<D1PreparedStatement> | Error {
    const message = NotificationMessageEntity.create({
      id: crypto.randomUUID(),
      kind: ATTACHMENT_RECONCILIATION_NOTIFICATION_KIND,
      title: input.title,
      body: input.body,
      source: { type: ATTACHMENT_RECONCILIATION_SOURCE_TYPE, id: input.runId },
      action: null,
      resourceScope: null,
      priority: "high",
      publicationKey: `${ATTACHMENT_RECONCILIATION_JOB_NAME}:${input.runId}`,
      createdAt: input.at,
    })
    if (message instanceof Error) return message
    const deliveries = []
    for (const recipientAccountId of input.recipients) {
      const delivery = NotificationDeliveryEntity.create({
        id: crypto.randomUUID(),
        messageId: message.id,
        recipientAccountId,
        deliveredAt: input.at,
        readAt: null,
        dismissedAt: null,
      })
      if (delivery instanceof Error) return delivery
      deliveries.push(delivery)
    }
    const batch = NotificationDeliveryBatchValue.create(deliveries)
    if (batch instanceof Error) return batch
    return new SystemNotificationRepository({
      context: { env: { DB: this.c.env.DB } },
    }).preparePublishBatch([{ message, deliveries: batch }])
  }

  private async recipients(): Promise<ReadonlyArray<string> | Error> {
    const holders = new Set<string>()
    for (const permissionKey of ATTACHMENT_RECONCILIATION_RECIPIENT_PERMISSIONS) {
      const accounts = await new ListSystemPermissionHolderAccountsAdapter(this.c.env.DB).list({
        permissionKey,
        resource: null,
      })
      if (accounts instanceof Error) return accounts
      for (const account of accounts) holders.add(account)
    }
    return [...holders].sort()
  }
}

function notificationBody(
  missingCount: number,
  reported: ReadonlyArray<string>,
  failed: boolean,
): string {
  const parts: string[] = []
  if (failed) parts.push("添付本体の存在確認に失敗したため、照合を途中で止めました。")
  if (missingCount > 0) {
    const rest = missingCount - reported.length
    parts.push(
      `本体が見つからない添付: ${missingCount}件（${reported.join(", ")}${rest > 0 ? ` ほか${rest}件` : ""}）`,
    )
  }
  return parts.join("\n")
}

function isBoundedInteger(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}
