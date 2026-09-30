import { appendFileSync, existsSync, readFileSync } from "node:fs"
import process from "node:process"
import { z } from "zod"
import { fetchRemoteD1Rows } from "./fetch-remote-d1-rows"

/**
 * 承認を経て確定した添付DEKの破棄を、D1の外の追記専用ledgerへ写し、D1の復元後に同じ破棄を再適用する。
 * 正本はSystem監査の `system.attachment.key.destroyed` で、ledgerはその写しである。
 * 再適用は記録済みの破棄をやり直すだけで、新しい破棄の判断を作らない。
 */

const ATTACHMENT_ID = /^[0-9A-Za-z-]{1,128}$/
const DESTROYED_ACTION = "system.attachment.key.destroyed"

const zLedgerEntry = z.strictObject({
  eventId: z.string().min(1).max(256),
  requestId: z.uuid(),
  occurredAt: z.iso.datetime(),
  erasedAt: z.iso.datetime(),
  attachmentIds: z.array(z.string().regex(ATTACHMENT_ID)).min(1).max(1000),
})

export type ErasureLedgerEntry = z.infer<typeof zLedgerEntry>

const zAuditRow = z.object({
  event_id: z.string(),
  target_id: z.string(),
  occurred_at: z.number().int().nonnegative(),
  after_json: z.string(),
})

const zDestroyedAfter = z.object({
  requestId: z.uuid(),
  attachmentIds: z.array(z.string().regex(ATTACHMENT_ID)).min(1).max(1000),
  erasedAt: z.iso.datetime(),
})

/** 監査行を検査し、ledgerの一行へ変換する。形式の崩れた行は破棄を推測せずErrorを返す。 */
export function toLedgerEntry(row: unknown): ErasureLedgerEntry | Error {
  const audit = zAuditRow.safeParse(row)
  if (!audit.success) return new Error("destroyed audit row is invalid")
  let after: unknown
  try {
    after = JSON.parse(audit.data.after_json)
  } catch {
    return new Error(`destroyed audit ${audit.data.event_id} has invalid after_json`)
  }
  const parsed = zDestroyedAfter.safeParse(after)
  if (!parsed.success || parsed.data.requestId !== audit.data.target_id)
    return new Error(`destroyed audit ${audit.data.event_id} does not describe a destruction`)
  return {
    eventId: audit.data.event_id,
    requestId: parsed.data.requestId,
    occurredAt: new Date(audit.data.occurred_at).toISOString(),
    erasedAt: parsed.data.erasedAt,
    attachmentIds: parsed.data.attachmentIds,
  }
}

/** ledger fileを読み、全行を検査する。一行でも壊れていれば再適用の根拠にしない。 */
export function readLedger(path: string): ReadonlyArray<ErasureLedgerEntry> | Error {
  if (!existsSync(path)) return []
  const entries: ErasureLedgerEntry[] = []
  const lines = readFileSync(path, "utf8").split("\n")
  for (const [index, line] of lines.entries()) {
    if (line.trim() === "") continue
    let value: unknown
    try {
      value = JSON.parse(line)
    } catch {
      return new Error(`ledger line ${index + 1} is not JSON`)
    }
    const entry = zLedgerEntry.safeParse(value)
    if (!entry.success) return new Error(`ledger line ${index + 1} is invalid`)
    entries.push(entry.data)
  }
  return entries
}

/** まだledgerに無い破棄だけを返す。event_idが同じ行は同じ破棄として扱う。 */
export function selectNewEntries(
  known: ReadonlyArray<ErasureLedgerEntry>,
  fetched: ReadonlyArray<ErasureLedgerEntry>,
): ReadonlyArray<ErasureLedgerEntry> {
  const seen = new Set(known.map((entry) => entry.eventId))
  return fetched.filter((entry) => {
    if (seen.has(entry.eventId)) return false
    seen.add(entry.eventId)
    return true
  })
}

export function buildDestroyedAuditQuery(afterOccurredAtMs: number, limit: number): string | Error {
  if (!Number.isSafeInteger(afterOccurredAtMs) || afterOccurredAtMs < 0)
    return new Error("cursor is invalid")
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) return new Error("limit is invalid")
  return `SELECT event_id, target_id, occurred_at, after_json FROM system_audit_events WHERE action = '${DESTROYED_ACTION}' AND target_type = 'system:attachment-erasure' AND outcome = 'succeeded' AND occurred_at >= ${afterOccurredAtMs} ORDER BY occurred_at, event_id LIMIT ${limit}`
}

/**
 * 記録済みの破棄を再適用するSQL。包んだDEKが残る行だけを消し、既に消去済みの行は変えない。
 * 保全中の添付はDBのtriggerが拒否し、再適用全体を失敗させる。
 */
export function buildReapplyStatement(entry: ErasureLedgerEntry): string | Error {
  const parsed = zLedgerEntry.safeParse(entry)
  if (!parsed.success) return new Error("ledger entry is invalid")
  const erasedAt = Date.parse(parsed.data.erasedAt)
  const ids = parsed.data.attachmentIds.map((id) => `'${id}'`).join(", ")
  return `UPDATE system_attachments SET status = 'erased', wrapped_dek = NULL, wrapped_dek_iv = NULL, erased_at = coalesce(erased_at, ${erasedAt}) WHERE id IN (${ids}) AND wrapped_dek IS NOT NULL RETURNING id`
}

type Query = (query: string) => Promise<ReadonlyArray<unknown>>

/** D1の破棄監査をledgerへ追記する。既に写した行は追記しない。 */
export async function exportErasures(input: {
  query: Query
  ledgerPath: string
  append: (path: string, lines: string) => void
}): Promise<Readonly<{ appended: number }> | Error> {
  const known = readLedger(input.ledgerPath)
  if (known instanceof Error) return known
  const since = known.reduce((latest, entry) => Math.max(latest, Date.parse(entry.occurredAt)), 0)
  const fetched: ErasureLedgerEntry[] = []
  let cursor = since
  for (;;) {
    const query = buildDestroyedAuditQuery(cursor, 500)
    if (query instanceof Error) return query
    const rows = await input.query(query)
    for (const row of rows) {
      const entry = toLedgerEntry(row)
      if (entry instanceof Error) return entry
      fetched.push(entry)
    }
    const last = fetched.at(-1)
    if (rows.length < 500 || last === undefined) break
    const next = Date.parse(last.occurredAt)
    if (next === cursor) return new Error("too many destructions share one timestamp")
    cursor = next
  }
  const additions = selectNewEntries(known, fetched)
  if (additions.length > 0)
    input.append(input.ledgerPath, additions.map((entry) => `${JSON.stringify(entry)}\n`).join(""))
  return { appended: additions.length }
}

/** ledgerの全破棄をD1へ再適用し、実際に鍵を消し直した添付idを返す。 */
export async function reapplyErasures(input: {
  query: Query
  ledgerPath: string
}): Promise<ReadonlyArray<string> | Error> {
  const entries = readLedger(input.ledgerPath)
  if (entries instanceof Error) return entries
  const reapplied: string[] = []
  for (const entry of entries) {
    const statement = buildReapplyStatement(entry)
    if (statement instanceof Error) return statement
    const rows = await input.query(statement)
    for (const row of rows) {
      const parsed = z.object({ id: z.string() }).safeParse(row)
      if (!parsed.success) return new Error("reapply returned an invalid row")
      reapplied.push(parsed.data.id)
    }
  }
  return reapplied
}

export async function main(argv: ReadonlyArray<string>): Promise<number> {
  const command = argv[0]
  const ledgerPath = process.env.ATTACHMENT_ERASURE_LEDGER_FILE?.trim()
  if (
    (command !== "export" && command !== "reapply") ||
    ledgerPath === undefined ||
    ledgerPath === ""
  ) {
    console.error(
      "usage: ATTACHMENT_ERASURE_LEDGER_FILE=<path> bun run ops:attachments:erasure-ledger <export|reapply>",
    )
    return 1
  }
  const binding = process.env.ATTACHMENT_ERASURE_D1_BINDING?.trim() || "base"
  const configPath = process.env.ATTACHMENT_ERASURE_WRANGLER_CONFIG?.trim() || "wrangler.jsonc"
  const query: Query = async (statement) => {
    const rows = await fetchRemoteD1Rows({ binding, configPath, query: statement })
    if (rows === null) throw new Error("D1 query returned no result")
    return rows
  }
  try {
    if (command === "export") {
      const result = await exportErasures({ query, ledgerPath, append: appendFileSync })
      if (result instanceof Error) {
        console.error(result.message)
        return 1
      }
      console.log(`attachment erasure ledger export completed: appended=${result.appended}`)
      return 0
    }
    const reapplied = await reapplyErasures({ query, ledgerPath })
    if (reapplied instanceof Error) {
      console.error(reapplied.message)
      return 1
    }
    console.log(`attachment erasure reapply completed: reapplied=${reapplied.length}`)
    if (reapplied.length > 0) console.log(`reapplied attachment ids: ${reapplied.join(",")}`)
    return 0
  } catch (cause) {
    console.error(
      `attachment erasure ledger failed: ${cause instanceof Error ? cause.message : "unknown"}`,
    )
    return 1
  }
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)))
