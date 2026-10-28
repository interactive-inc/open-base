import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { factory } from "@/factory"
import { UsageError, InputError } from "@/lib/errors"
import { api } from "@/lib/http/client"
import { readJsonObjectFile } from "@/lib/input/read-json-file"

export const help = `base reviews cycles list [--limit <n> --offset <n>]
base reviews cycles show <id>
base reviews cycles create --data <period.json> --idempotency-key <uuid>
base reviews sheets list [--scope mine|inbox|all --cycle-id <id> --limit <n> --offset <n>]
base reviews sheets show|history <id> [--limit <n> --offset <n>]
base reviews sheets create --data <sheet.json> --idempotency-key <uuid>
base reviews sheets revise-goals|reopen-goals|submit-goals|self-evaluate|submit-evaluation|approve|return|reject|cancel <id> --data <command.json> --idempotency-key <uuid>
base reviews sheets command <id> --data <command.json> --idempotency-key <uuid>

変更するJSONにはreason、シートの変更にはexpected_revisionも指定します。
承認・差戻し・却下にはshowで表示したdecision_targetをtargetとして指定してください。
評価の承認には全目標の点数と根拠をassessmentsに指定します。
commandではoperationもJSONに含めます。他の操作名ではoperationを自動で指定します。
通信失敗時は同じJSONと冪等キーで再送し、409では読み直して内容を確認してください。`

const commands: Readonly<Record<string, Readonly<{ operation: string; action?: string }>>> = {
  "revise-goals": { operation: "revise_goals" },
  "reopen-goals": { operation: "reopen_goals" },
  "submit-goals": { operation: "submit_goals" },
  "self-evaluate": { operation: "self_evaluate" },
  "submit-evaluation": { operation: "submit_evaluation" },
  approve: { operation: "decide", action: "approve" },
  return: { operation: "decide", action: "return" },
  reject: { operation: "decide", action: "reject" },
  cancel: { operation: "cancel" },
}

export default factory.createHandlers(
  zValidator(
    "json",
    z
      .object({
        help: z.string().optional(),
        data: z.string().min(1).optional(),
        "idempotency-key": z.string().uuid().optional(),
        "cycle-id": z.string().uuid().optional(),
        scope: z.enum(["mine", "inbox", "all"]).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        offset: z.coerce.number().int().min(0).max(100000).optional(),
      })
      .strict(),
  ),
  async (c) => {
    const flags = c.req.valid("json")
    const resource = c.req.param("resource")
    const operation = c.req.param("operation")
    const id = c.req.param("id")
    if (flags.help || resource === undefined || operation === undefined) return c.text(help)
    if (resource !== "cycles" && resource !== "sheets") throw new UsageError(help)
    if (id !== undefined && !z.string().uuid().safeParse(id).success)
      throw new UsageError("評価のUUIDを指定してください")
    const base = `/performance-review/${resource}`
    const isRead = ["list", "show", "history"].includes(operation)
    if (isRead) {
      if (flags.data !== undefined || flags["idempotency-key"] !== undefined)
        throw new UsageError("参照には保存用の引数を指定できません")
      if ((operation === "list" && id !== undefined) || (operation !== "list" && id === undefined))
        throw new UsageError(help)
      if (operation === "history" && resource !== "sheets") throw new UsageError(help)
      if (
        (operation !== "list" || resource !== "sheets") &&
        (flags.scope !== undefined || flags["cycle-id"] !== undefined)
      )
        throw new UsageError("scopeとcycle-idはシート一覧だけに指定できます")
      if (operation === "show" && (flags.limit !== undefined || flags.offset !== undefined))
        throw new UsageError("詳細にはページ指定できません")
      const path =
        operation === "list"
          ? base
          : operation === "show"
            ? `${base}/${id}`
            : `${base}/${id}/history`
      return c.text(
        JSON.stringify(
          await api(path, {
            query: {
              scope: flags.scope,
              cycle_id: flags["cycle-id"],
              limit: flags.limit,
              offset: flags.offset,
            },
          }),
          null,
          2,
        ),
      )
    }
    const selected = Object.hasOwn(commands, operation) ? commands[operation] : undefined
    if (
      operation !== "create" &&
      (resource !== "sheets" || (operation !== "command" && selected === undefined))
    )
      throw new UsageError(help)
    if (
      (operation === "create" && id !== undefined) ||
      (operation !== "create" && id === undefined)
    )
      throw new UsageError(help)
    if (flags.data === undefined || flags["idempotency-key"] === undefined)
      throw new UsageError("--data と --idempotency-key が必要です")
    if (
      flags.limit !== undefined ||
      flags.offset !== undefined ||
      flags.scope !== undefined ||
      flags["cycle-id"] !== undefined
    )
      throw new UsageError("変更には参照用の引数を指定できません")
    const body = await readJsonObjectFile(flags.data)
    if (!z.string().trim().min(1).max(3000).safeParse(body.reason).success)
      throw new InputError("reasonが必要です")
    if (
      operation !== "create" &&
      !z.number().int().positive().safeParse(body.expected_revision).success
    )
      throw new InputError("expected_revisionが必要です")
    if (
      selected !== undefined &&
      ((body.operation !== undefined && body.operation !== selected.operation) ||
        (body.action !== undefined && body.action !== selected.action))
    )
      throw new InputError("JSONと操作名が一致しません")
    const json = selected === undefined ? body : { ...body, ...selected }
    const path = operation === "create" ? base : `${base}/${id}/commands`
    return c.text(
      JSON.stringify(
        await api(path, { method: "POST", idempotencyKey: flags["idempotency-key"], json }),
        null,
        2,
      ),
    )
  },
)
