import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `base application-requests delegation-delete <id>`
export default factory.createHandlers(async (c) => {
  const id = c.req.param("id")
  if (!id) throw new UsageError("id が必要です")
  await (await createClient()).company["approval-delegations"][":id"].$delete({ param: { id } })
  return c.json({ deleted: true })
})
