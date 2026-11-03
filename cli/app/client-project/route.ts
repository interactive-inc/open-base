import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { api } from "@/lib/http/client"
import { readJsonObjectFile } from "@/lib/input/read-json-file"

const help = `base client-project list <project|effort> [--id <uuid> --project-id <uuid> --customer-id <uuid> --search <text> --history true --offset <n> --limit <n>]
base client-project save --data <record.json> --idempotency-key <uuid>`

export default factory.createHandlers(
  zValidator(
    "json",
    z.strictObject({
      help: z.string().optional(),
      data: z.string().min(1).optional(),
      "idempotency-key": z.uuid().optional(),
      "project-id": z.uuid().optional(),
      "customer-id": z.uuid().optional(),
      search: z.string().min(1).max(200).optional(),
      id: z.uuid().optional(),
      history: z.enum(["true", "false"]).optional(),
      offset: z.coerce.number().int().min(0).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    }),
  ),
  async (c) => {
    const flags = c.req.valid("json")
    const operation = c.req.param("operation")
    const kind = c.req.param("kind")
    const path = "/client-project/records"
    if (flags.help || operation === undefined) return c.text(help)
    if (operation === "save" && flags.data && flags["idempotency-key"] && kind === undefined) {
      const json = await readJsonObjectFile(flags.data)
      return c.text(
        JSON.stringify(
          await api(path, {
            method: "POST",
            json,
            idempotencyKey: flags["idempotency-key"],
          }),
          null,
          2,
        ),
      )
    }
    if (operation !== "list" || !z.enum(["project", "effort"]).safeParse(kind).success)
      throw new UsageError(help)
    return c.text(
      JSON.stringify(
        await api(path, {
          query: {
            kind,
            id: flags.id,
            project_id: flags["project-id"],
            customer_id: flags["customer-id"],
            search: flags.search,
            history: flags.history,
            offset: flags.offset,
            limit: flags.limit,
          },
        }),
        null,
        2,
      ),
    )
  },
)
