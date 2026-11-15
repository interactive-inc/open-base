import { UsageError } from "@/lib/errors"
import type { RequestOptions } from "@/lib/http/client"
import { readApiCommandBody } from "@/lib/command/read-api-command-body"
import type { ApiCommand } from "@/lib/command/types"

const STEP_UP_TOKEN = /^[0-9a-f]{64}$/

const HEADER_VALUE = /^\S{1,255}$/

type Props = {
  command: ApiCommand
  ids: ReadonlyArray<string>
  flags: Readonly<Record<string, string>>
}

/** 送信前に必須の引数とヘッダーをそろえ、欠けていれば何も送らずに断る。 */
export async function toApiCommandRequest(props: Props) {
  const command = props.command
  const flags = props.flags

  const unknown = Object.keys(flags).filter((flag) => !toAllowedFlags(command).has(flag))
  if (unknown.length > 0)
    throw new UsageError(`この操作に指定できないフラグです: --${unknown.join(", --")}`)

  if (command.stepUp && !STEP_UP_TOKEN.test(flags["step-up"] ?? ""))
    throw new UsageError("この操作には --step-up が必要です。base step-up で発行してください")
  if (command.idempotencyKey && !HEADER_VALUE.test(flags["idempotency-key"] ?? ""))
    throw new UsageError("--idempotency-key が必要です")
  if (command.organization === "flag" && !HEADER_VALUE.test(flags["organization-id"] ?? ""))
    throw new UsageError("--organization-id が必要です")
  if (command.download && flags.output === undefined)
    throw new UsageError("--output に保存先を指定してください")

  const missing = (command.requiredQuery ?? []).filter((flag) => flags[flag] === undefined)
  if (missing.length > 0) throw new UsageError(`--${missing.join(", --")} が必要です`)

  const query: Record<string, string> = {}
  for (const [flag, name] of Object.entries(command.query ?? {})) {
    const value = flags[flag]
    if (value !== undefined) query[name] = value
  }

  const body = await readApiCommandBody(command, flags)

  const organizationId = flags["organization-id"]
  if (organizationId !== undefined) body.headers["x-company-organization-id"] = organizationId

  const options: RequestOptions = {
    method: command.method,
    query,
    json: body.json ?? undefined,
    stepUpToken: flags["step-up"],
    idempotencyKey: flags["idempotency-key"],
    headers: body.headers,
  }

  return { path: toApiPath(command.path, props.ids), options, output: flags.output ?? null }
}

function toApiPath(template: string, ids: ReadonlyArray<string>): string {
  const remaining = [...ids]

  return template.replace(/:[A-Za-z]+/g, () => encodeURIComponent(remaining.shift() ?? ""))
}

function toAllowedFlags(command: ApiCommand): ReadonlySet<string> {
  const flags = new Set(Object.keys(command.query ?? {}))

  if (command.data !== undefined) flags.add("data")
  if (command.stepUp) flags.add("step-up")
  if (command.idempotencyKey) flags.add("idempotency-key")
  if (command.organization === "flag") flags.add("organization-id")
  if (command.secret !== undefined) flags.add(command.secret.flag)
  if (command.download) flags.add("output")

  return flags
}
