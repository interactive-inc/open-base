import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import process from "node:process"
import { z } from "zod"
import {
  ATTACHMENT_OBJECT_KEY,
  createS3AttachmentObjectStorage,
  readAttachmentStorageConfig,
  type AttachmentObjectStorage,
} from "./attachment-object-storage"

/**
 * 添付本体（暗号文）を、S3互換の別storageへ差分で複製する。
 * 複製元と複製先の設定が全て未設定なら何もしない。複製先へは書き込みだけを行い、読み出さない。
 * 前回の成功時刻から重なり幅を引いた時刻以降に更新された `att/` のobjectだけを書く。
 * 途中で失敗した場合は状態fileを進めず、次回の実行が同じ範囲を書き直す。
 */

const zReplicationState = z.strictObject({ replicatedUntil: z.iso.datetime() })

export type ReplicationResult = Readonly<{ copied: number; skipped: number; since: Date | null }>

export async function replicateAttachments(input: {
  source: AttachmentObjectStorage
  target: AttachmentObjectStorage
  since: Date | null
}): Promise<ReplicationResult> {
  let copied = 0
  let skipped = 0
  let continuationToken: string | undefined
  do {
    const page = await input.source.list({ prefix: "att/", continuationToken })
    for (const object of page.objects) {
      if (!ATTACHMENT_OBJECT_KEY.test(object.key)) {
        skipped += 1
        continue
      }
      if (
        input.since !== null &&
        object.lastModified !== null &&
        object.lastModified.getTime() < input.since.getTime()
      ) {
        skipped += 1
        continue
      }
      await input.target.write(object.key, await input.source.read(object.key))
      copied += 1
    }
    continuationToken = page.nextContinuationToken
  } while (continuationToken !== undefined)
  return { copied, skipped, since: input.since }
}

export function readReplicationState(path: string): Date | null | Error {
  if (!existsSync(path)) return null
  const parsed = zReplicationState.safeParse(JSON.parse(readFileSync(path, "utf8")))
  if (!parsed.success) return new Error("replication state file is invalid")
  return new Date(parsed.data.replicatedUntil)
}

export function writeReplicationState(path: string, replicatedUntil: Date): void {
  const temporary = `${path}.tmp`
  writeFileSync(
    temporary,
    `${JSON.stringify({ replicatedUntil: replicatedUntil.toISOString() })}\n`,
  )
  renameSync(temporary, path)
}

export function readOverlapMilliseconds(value: string | undefined): number | Error {
  if (value === undefined || value.trim() === "") return 60 * 60_000
  const minutes = Number(value)
  if (!Number.isInteger(minutes) || minutes < 1) return new Error("overlap minutes is invalid")
  return minutes * 60_000
}

async function main(): Promise<number> {
  const source = readAttachmentStorageConfig(process.env, "ATTACHMENT_REPLICA_SOURCE")
  const target = readAttachmentStorageConfig(process.env, "ATTACHMENT_REPLICA_TARGET")
  const statePath = process.env.ATTACHMENT_REPLICA_STATE_FILE?.trim() ?? ""
  if (source === null && target === null && statePath === "") {
    console.log("attachment replication is disabled")
    return 0
  }
  if (source instanceof Error || target instanceof Error) {
    console.error((source instanceof Error ? source : (target as Error)).message)
    return 1
  }
  if (source === null || target === null || statePath === "") {
    console.error(
      "attachment replication requires source, target and ATTACHMENT_REPLICA_STATE_FILE",
    )
    return 1
  }
  const overlap = readOverlapMilliseconds(process.env.ATTACHMENT_REPLICA_OVERLAP_MINUTES)
  if (overlap instanceof Error) {
    console.error(overlap.message)
    return 1
  }
  const previous = readReplicationState(statePath)
  if (previous instanceof Error) {
    console.error(previous.message)
    return 1
  }
  const startedAt = new Date()
  const result = await replicateAttachments({
    source: createS3AttachmentObjectStorage(source),
    target: createS3AttachmentObjectStorage(target),
    since: previous === null ? null : new Date(previous.getTime() - overlap),
  })
  writeReplicationState(statePath, startedAt)
  console.log(
    `attachment replication completed: copied=${result.copied} skipped=${result.skipped} since=${result.since?.toISOString() ?? "all"}`,
  )
  return 0
}

if (import.meta.main) {
  process.exitCode = await main().catch((cause: unknown) => {
    console.error(
      `attachment replication failed: ${cause instanceof Error ? cause.message : "unknown"}`,
    )
    return 1
  })
}
