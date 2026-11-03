import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { api } from "@/lib/http/client"
import { readJsonObjectFile } from "@/lib/input/read-json-file"

const flagsSchema = z.strictObject({
  help: z.string().optional(),
  data: z.string().min(1).optional(),
  "idempotency-key": z.uuid().optional(),
  id: z.uuid().optional(),
  search: z.string().min(1).max(200).optional(),
  history: z.enum(["true", "false"]).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export function catalogRoute(catalog: "customer" | "offering") {
  const path = `/${catalog}/records`
  const help = `base ${catalog} list [--id <uuid> --search <text> --history true --offset <n> --limit <n>]
base ${catalog} save --data <record.json> --idempotency-key <uuid>`
  return factory.createHandlers(zValidator("json", flagsSchema), async (c) => {
    const operation = c.req.param("operation")
    const flags = c.req.valid("json")
    const { data, "idempotency-key": key, help: showHelp, ...query } = flags
    if (showHelp || operation === undefined) return c.text(help)
    if (operation === "list" && data === undefined && key === undefined)
      return c.text(JSON.stringify(await api(path, { query }), null, 2))
    if (operation === "save" && data && key && Object.keys(query).length === 0) {
      const json = await readJsonObjectFile(data)
      return c.text(
        JSON.stringify(await api(path, { method: "POST", json, idempotencyKey: key }), null, 2),
      )
    }
    throw new UsageError(help)
  })
}
