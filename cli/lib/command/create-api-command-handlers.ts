import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { factory } from "@/factory"
import { InputError, UsageError } from "@/lib/errors"
import { api, apiBytes } from "@/lib/http/client"
import { writeNewFile } from "@/lib/io/write-new-file"
import { resolveApiCommand } from "@/lib/command/resolve-api-command"
import { toApiCommandHelp } from "@/lib/command/to-api-command-help"
import { toApiCommandRequest } from "@/lib/command/to-api-command-request"
import type { ApiCommandGroup } from "@/lib/command/types"

/**
 * 定義したコマンド群を一つのhandlerで受ける。位置引数は `/<group>/` 以降のpathから読み、
 * 応答はJSONを整形し、それ以外（CSVなど）はそのまま返す。
 */
export function createApiCommandHandlers(group: ApiCommandGroup) {
  const help = toApiCommandHelp(group)

  return factory.createHandlers(zValidator("json", z.record(z.string(), z.string())), async (c) => {
    const flags = { ...c.req.valid("json") }
    if (flags.help !== undefined) return c.text(help)

    const segments = c.req.path
      .split("/")
      .filter((segment) => segment !== "")
      .slice(1)
      .map((segment) => decodeURIComponent(segment))
    if (segments.length === 0 && group.defaultCommand === null) return c.text(help)

    const resolved = resolveApiCommand(
      group,
      segments.length === 0 && group.defaultCommand !== null ? [group.defaultCommand] : segments,
    )
    if (resolved === null) throw new UsageError(help)

    const request = await toApiCommandRequest({
      command: resolved.command,
      ids: resolved.ids,
      flags,
    })

    if (request.output !== null) {
      if (await Bun.file(request.output).exists())
        throw new InputError("保存できません。未使用の出力先を指定してください")
      const bytes = await apiBytes(request.path, request.options)
      await writeNewFile(request.output, bytes)
      return c.text(JSON.stringify({ path: request.output, bytes: bytes.byteLength }, null, 2))
    }

    const response = await api(request.path, request.options)

    return c.text(typeof response === "string" ? response : JSON.stringify(response, null, 2))
  })
}
