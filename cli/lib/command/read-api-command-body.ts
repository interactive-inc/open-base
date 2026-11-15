import { z } from "zod"
import { InputError, UsageError } from "@/lib/errors"
import type { ApiCommand } from "@/lib/command/types"
import { readJsonObjectFile } from "@/lib/input/read-json-file"
import { readSecretStdin } from "@/lib/input/read-secret-stdin"

const companyEnvelope = z.object({
  organizationId: z.string().regex(/^\S{1,255}$/),
  expectedRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
})

type ApiCommandBody = { json: Record<string, unknown> | null; headers: Record<string, string> }

/**
 * `--data` のJSONと標準入力の秘密から本文を作る。
 * Companyの確認済みJSONは organizationId と expectedRevision を会社と版のヘッダーへ移す。
 */
export async function readApiCommandBody(
  command: ApiCommand,
  flags: Readonly<Record<string, string>>,
): Promise<ApiCommandBody> {
  const file = flags.data
  if (command.data === "required" && file === undefined)
    throw new UsageError("--data に確認済みのJSONファイルを指定してください")

  const json = file === undefined ? null : await readJsonObjectFile(file)

  const headers: Record<string, string> = {}

  if (command.organization === "data" && json !== null) {
    const envelope = companyEnvelope.safeParse(json)
    if (!envelope.success)
      throw new InputError("JSONに organizationId と expectedRevision を指定してください")
    headers["x-company-organization-id"] = envelope.data.organizationId
    headers["if-match"] = String(envelope.data.expectedRevision)
    delete json.organizationId
    delete json.expectedRevision
  }

  const secret = command.secret
  if (secret === undefined) return { json, headers }

  if (json !== null && secret.field in json)
    throw new InputError(
      `${secret.field} はJSONに書かず --${secret.flag} で標準入力から渡してください`,
    )
  if (flags[secret.flag] === undefined) {
    if (secret.required) throw new UsageError(`--${secret.flag} で標準入力から渡してください`)
    return { json, headers }
  }

  return { json: { ...json, [secret.field]: await readSecretStdin() }, headers }
}
