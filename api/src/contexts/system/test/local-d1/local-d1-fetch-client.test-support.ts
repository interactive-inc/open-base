import type { Miniflare } from "miniflare"
import { runningWorkerdPids } from "@system/test/local-d1/guard-workerd-stdio.test-support"

/**
 * ローカルD1のworkerdへ載せるWorker。受け取ったSQLを本物のD1 bindingで実行し、
 * 結果と失敗をJSONで返す。SQLの解釈・batchのtransaction・制約とtriggerの失敗は、
 * すべてworkerd上のD1が決める。
 */
export const LOCAL_D1_WORKER_SCRIPT = `
const BYTES = "__localD1Bytes"

function encode(value) {
  if (value instanceof ArrayBuffer) return { [BYTES]: toBase64(new Uint8Array(value)), kind: "ArrayBuffer" }
  if (ArrayBuffer.isView(value)) {
    return { [BYTES]: toBase64(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)), kind: "Uint8Array" }
  }
  if (Array.isArray(value)) return value.map(encode)
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]))
  }
  return value
}

function decode(value) {
  if (Array.isArray(value)) return value.map(decode)
  if (value !== null && typeof value === "object") {
    if (typeof value[BYTES] === "string") {
      const bytes = fromBase64(value[BYTES])
      return value.kind === "ArrayBuffer" ? bytes.buffer : bytes
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decode(item)]))
  }
  return value
}

function toBase64(bytes) {
  let text = ""
  for (const byte of bytes) text += String.fromCharCode(byte)
  return btoa(text)
}

function fromBase64(text) {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function serializeError(error, depth = 0) {
  if (!(error instanceof Error) || depth > 8) return { name: "Error", message: String(error) }
  return {
    name: error.name,
    message: error.message,
    cause: error.cause === undefined ? undefined : serializeError(error.cause, depth + 1),
  }
}

function statement(db, input) {
  const prepared = db.prepare(input.sql)
  return input.params.length === 0 ? prepared : prepared.bind(...decode(input.params))
}

export default {
  async fetch(request, env) {
    const command = await request.json()
    const db = env[command.binding]
    if (db === undefined) return Response.json({ ok: false, error: { name: "Error", message: "unknown local D1 binding" } })
    try {
      let value
      switch (command.op) {
        case "all":
          value = await statement(db, command.statement).all()
          break
        case "run":
          value = await statement(db, command.statement).run()
          break
        case "raw":
          value = await statement(db, command.statement).raw(command.options)
          break
        case "first":
          value =
            command.column === undefined
              ? await statement(db, command.statement).first()
              : await statement(db, command.statement).first(command.column)
          break
        case "batch":
          value = await db.batch(command.statements.map((input) => statement(db, input)))
          break
        case "exec":
          value = await db.exec(command.sql)
          break
        default:
          throw new Error("unknown local D1 operation")
      }
      return Response.json({ ok: true, value: encode(value ?? null) })
    } catch (error) {
      return Response.json({ ok: false, error: serializeError(error) })
    }
  },
}
`

const BYTES = "__localD1Bytes"

type SerializedD1Failure = Readonly<{ name: string; message: string; cause?: SerializedD1Failure }>

type StatementInput = Readonly<{ sql: string; params: ReadonlyArray<unknown> }>

type Command =
  | Readonly<{ op: "all" | "run"; statement: StatementInput }>
  | Readonly<{ op: "raw"; statement: StatementInput; options?: { columnNames?: boolean } }>
  | Readonly<{ op: "first"; statement: StatementInput; column?: string }>
  | Readonly<{ op: "batch"; statements: ReadonlyArray<StatementInput> }>
  | Readonly<{ op: "exec"; sql: string }>

/**
 * workerd上のD1 bindingを、Miniflareの同期proxyを使わずにfetchだけで呼ぶD1Databaseを返す。
 *
 * Miniflareの`getD1Database`が返すproxyは、`prepare`や`bind`をworker threadの同期fetchで
 * workerdへ送る。Bunではこの同期fetchが接続を失ったまま戻らず、testが止まることがある。
 * ここでは`prepare`と`bind`を手元の値として組み立て、実行だけを非同期の`dispatchFetch`で送る。
 * 処理中にworkerdが落ちると接続が切れ、要求はその場で失敗する（local-d1-fetch-client.d1.test.ts）。
 * 応答が長く返らない要求は、どのSQLで止まっているかを追えるよう記録する。
 * SQLの実行はworkerd上のD1が行うため、D1のbind・batch・制約・triggerの挙動は変わらない。
 */
export function createLocalD1FetchClient(runtime: Miniflare, binding: string): D1Database {
  const send = async (command: Command): Promise<unknown> => {
    const pending = reportPending(binding, command)
    try {
      const response = await runtime
        .dispatchFetch("http://local-d1.invalid/", {
          method: "POST",
          // 一括書込の接続を次の要求へ持ち越さない。SQLの再送は行わない。
          headers: {
            "content-type": "application/json",
            ...(command.op === "batch" ? { connection: "close" } : {}),
          },
          body: JSON.stringify({ binding, ...command, ...encodeCommand(command) }),
        })
        .catch((error: unknown) => {
          throw new Error("local D1 request could not reach workerd", { cause: error })
        })
      const payload = (await response.json()) as
        | { ok: true; value: unknown }
        | { ok: false; error: SerializedD1Failure }
      if (!payload.ok) throw restoreError(payload.error)
      return decode(payload.value)
    } finally {
      clearTimeout(pending)
    }
  }

  const createStatement = (input: StatementInput): D1PreparedStatement => {
    const statement = {
      bind: (...values: unknown[]) => createStatement({ sql: input.sql, params: values }),
      first: (column?: string) => send({ op: "first", statement: input, column }),
      all: () => send({ op: "all", statement: input }),
      run: () => send({ op: "run", statement: input }),
      raw: (options?: { columnNames?: boolean }) => send({ op: "raw", statement: input, options }),
      [STATEMENT]: input,
    }
    return statement as unknown as D1PreparedStatement
  }

  const database = {
    prepare: (sql: string) => createStatement({ sql, params: [] }),
    batch: (statements: ReadonlyArray<D1PreparedStatement>) =>
      send({ op: "batch", statements: statements.map(statementInput) }),
    exec: (sql: string) => send({ op: "exec", sql }),
    dump: () => Promise.reject(new Error("dump is not supported by the local D1 test client")),
    withSession: () => {
      throw new Error("withSession is not supported by the local D1 test client")
    },
  }
  return database as unknown as D1Database
}

const STATEMENT = Symbol("local D1 statement")

/** 応答を待つ要求を記録するまでの時間。要求は止めず、止まった場所を示すためだけに使う。 */
const PENDING_REPORT_MS = 20_000

/** 応答が長く返らない要求の種類とSQLの先頭、動いているworkerdを記録する。 */
function reportPending(binding: string, command: Command): ReturnType<typeof setTimeout> {
  const sql =
    command.op === "batch"
      ? command.statements.map((statement) => statement.sql).join("; ")
      : command.op === "exec"
        ? command.sql
        : command.statement.sql
  const timer = setTimeout(() => {
    console.warn(
      `local D1 request has been pending for ${PENDING_REPORT_MS}ms: ${binding} ${command.op} ${sql.replace(/\s+/g, " ").slice(0, 200)} (running workerd: ${runningWorkerdPids().join(", ") || "none"})`,
    )
  }, PENDING_REPORT_MS)
  timer.unref?.()
  return timer
}

function statementInput(statement: D1PreparedStatement): StatementInput {
  const input = (statement as unknown as { [STATEMENT]?: StatementInput })[STATEMENT]
  if (input === undefined) throw new Error("batch accepts only statements from the same local D1")
  return input
}

/** bind値のbyte列をJSONで運べる形にする。 */
function encodeCommand(command: Command): Partial<Command> {
  if (command.op === "batch") {
    return {
      statements: command.statements.map((input) => encodeStatement(input)),
    } as Partial<Command>
  }
  if (command.op === "exec") return {}
  return { statement: encodeStatement(command.statement) } as Partial<Command>
}

function encodeStatement(input: StatementInput): StatementInput {
  return { sql: input.sql, params: input.params.map(encodeValue) }
}

function encodeValue(value: unknown): unknown {
  if (value instanceof ArrayBuffer)
    return { [BYTES]: toBase64(new Uint8Array(value)), kind: "ArrayBuffer" }
  if (ArrayBuffer.isView(value)) {
    return {
      [BYTES]: toBase64(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)),
      kind: "Uint8Array",
    }
  }
  return value
}

function decode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decode)
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>
    const bytes = record[BYTES]
    if (typeof bytes === "string") {
      const decoded = Uint8Array.from(Buffer.from(bytes, "base64"))
      return record.kind === "ArrayBuffer" ? decoded.buffer : decoded
    }
    return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, decode(item)]))
  }
  return value
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64")
}

/** workerd上のD1が投げた失敗を、messageとcauseの連鎖を保って復元する。 */
function restoreError(error: SerializedD1Failure): Error {
  const cause = error.cause === undefined ? undefined : restoreError(error.cause)
  const restored = new Error(error.message, cause === undefined ? undefined : { cause })
  restored.name = error.name
  return restored
}
