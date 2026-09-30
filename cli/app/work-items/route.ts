import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { writeFile } from "node:fs/promises"
import { factory } from "@/factory"
import { UsageError, InputError, ApiError } from "@/lib/errors"
import { api } from "@/lib/http/client"
import { createClient } from "@/lib/http/hc-client"
import { readJsonObjectFile } from "@/lib/input/read-json-file"

export const help = `base work-items list [--after <uuid> --limit <n>]
base work-items show <id>
base work-items history <id> [--after <revision> --limit <n>]
base work-items create --data <request.json>
base work-items accept <id> --data <command.json>
base work-items submit <id> --data <command.json>
base work-items approve|return|handover|receive|decline|cancel <id> --data <command.json> --step-up <token>
base work-items evidence <id> --attachment-id <id> --output <file>

保存するJSONにcommandId・expectedRevision・reasonを指定します。
承認・差戻しには表示されたresultId・resultDigestを指定します。
同じ依頼の再送は同じJSONを使用し、競合時は履歴を再確認してください。`

const operations = z.enum([
  "list",
  "show",
  "history",
  "create",
  "accept",
  "submit",
  "approve",
  "return",
  "handover",
  "receive",
  "decline",
  "cancel",
  "evidence",
])
const paths = {
  create: "",
  accept: "accept",
  submit: "results",
  approve: "approve",
  return: "return",
  handover: "handovers",
  receive: "handovers/accept",
  decline: "handovers/decline",
  cancel: "cancel",
}

export default factory.createHandlers(
  zValidator(
    "json",
    z
      .object({
        help: z.string().optional(),
        data: z.string().optional(),
        "step-up": z
          .string()
          .regex(/^[0-9a-f]{64}$/)
          .optional(),
        after: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(50).optional(),
        "attachment-id": z.string().min(1).max(64).optional(),
        output: z.string().min(1).optional(),
      })
      .strict(),
  ),
  async (c) => {
    const input = c.req.valid("json")
    if (input.help || c.req.param("operation") === undefined) return c.text(help)
    const operation = operations.safeParse(c.req.param("operation"))
    if (!operation.success) throw new UsageError(help)
    const name = operation.data
    const id = c.req.param("id")
    if (name !== "list" && name !== "create" && !z.string().uuid().safeParse(id).success)
      throw new UsageError("作業のUUIDを指定してください")
    if ((name === "list" || name === "create") && id !== undefined)
      throw new UsageError("この操作にpathのidは指定できません")
    const base = "/system/work-items"
    if (name === "list" || name === "show" || name === "history") {
      if (
        input.data !== undefined ||
        input["step-up"] !== undefined ||
        input.output !== undefined ||
        input["attachment-id"] !== undefined
      )
        throw new UsageError("参照に保存用の引数は指定できません")
      if (
        input.after !== undefined &&
        !(name === "list" ? z.string().uuid() : z.string().regex(/^(0|[1-9][0-9]*)$/)).safeParse(
          input.after,
        ).success
      )
        throw new UsageError("afterの形式が不正です")
      if (name === "show" && (input.after !== undefined || input.limit !== undefined))
        throw new UsageError("詳細参照にはページ指定できません")
      const path =
        name === "list" ? base : name === "show" ? `${base}/${id}` : `${base}/${id}/history`
      return c.text(
        JSON.stringify(
          await api(path, { query: { after: input.after, limit: input.limit } }),
          null,
          2,
        ),
      )
    }
    if (name === "evidence") {
      if (
        input["attachment-id"] === undefined ||
        input.output === undefined ||
        input.data !== undefined ||
        input["step-up"] !== undefined ||
        input.after !== undefined ||
        input.limit !== undefined
      )
        throw new UsageError("証拠は --attachment-id と --output を指定してください")
      const client = await createClient()
      const response = await client.system["work-items"][":id"].evidence[":attachmentId"].$get({
        param: { id: id ?? "", attachmentId: input["attachment-id"] },
      })
      if (!response.ok) throw new ApiError(response.status, "証拠の取得に失敗しました")
      const bytes = new Uint8Array(await response.arrayBuffer())
      try {
        await writeFile(input.output, bytes, { flag: "wx", mode: 0o600 })
      } catch {
        throw new InputError("証拠を保存できません。未使用の出力先を指定してください")
      }
      return c.json({ path: input.output, bytes: bytes.byteLength })
    }
    if (
      input.data === undefined ||
      input.after !== undefined ||
      input.limit !== undefined ||
      input.output !== undefined ||
      input["attachment-id"] !== undefined
    )
      throw new UsageError("保存は --data に確認済みJSONファイルを指定してください")
    if (
      name !== "create" &&
      name !== "accept" &&
      name !== "submit" &&
      input["step-up"] === undefined
    )
      throw new UsageError("人の判断には --step-up を指定してください")
    const command = z
      .object({
        commandId: z.string().uuid(),
        expectedRevision: z.number().int().nonnegative(),
        reason: z.string().trim().min(1).max(1000),
      })
      .passthrough()
      .safeParse(await readJsonObjectFile(input.data))
    if (!command.success)
      throw new InputError("commandId・expectedRevision・reasonを持つJSONが必要です")
    const path = name === "create" ? base : `${base}/${id}/${paths[name]}`
    return c.text(
      JSON.stringify(
        await api(path, { method: "POST", json: command.data, stepUpToken: input["step-up"] }),
        null,
        2,
      ),
    )
  },
)
