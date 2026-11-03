import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { api } from "@/lib/http/client"
import { readJsonObjectFile } from "@/lib/input/read-json-file"

const help = `base work-execution definitions list [--slug <slug> --tag <tag> --revision <n>]
base work-execution definitions save --data <definition.json>
base work-execution runs list [--slug <slug> --agent-id <uuid> --tag <tag> --since <utc>]
base work-execution runs list --reference-kind <kind> --reference-id <id>`

export default factory.createHandlers(
  zValidator(
    "json",
    z.strictObject({
      help: z.string().optional(),
      data: z.string().optional(),
      slug: z.string().optional(),
      "agent-id": z.string().uuid().optional(),
      tag: z.string().optional(),
      revision: z.coerce.number().int().positive().optional(),
      since: z.string().optional(),
      "reference-kind": z.string().optional(),
      "reference-id": z.string().optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
      offset: z.coerce.number().int().min(0).optional(),
    }),
  ),
  async (c) => {
    const flags = c.req.valid("json")
    const resource = c.req.param("resource")
    const operation = c.req.param("operation")
    if (flags.help || !resource) return c.text(help)
    if (resource !== "definitions" && resource !== "runs") throw new UsageError(help)
    const path = `/work-execution/${resource}`
    const {
      data,
      help: _,
      "agent-id": agent_id,
      "reference-kind": reference_kind,
      "reference-id": reference_id,
      ...rest
    } = flags
    if (
      resource === "definitions" &&
      operation === "save" &&
      data &&
      Object.keys(flags).length === 1
    ) {
      const json = await readJsonObjectFile(data)
      return c.text(JSON.stringify(await api(path, { method: "POST", json }), null, 2))
    }
    if (operation !== "list" || data !== undefined) throw new UsageError(help)
    return c.text(
      JSON.stringify(
        await api(path, { query: { ...rest, agent_id, reference_kind, reference_id } }),
        null,
        2,
      ),
    )
  },
)
