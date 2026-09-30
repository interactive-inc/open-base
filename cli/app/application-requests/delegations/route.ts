import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `base application-requests delegations`
export default factory.createHandlers(async (c) =>
  c.json(await (await (await createClient()).company["approval-delegations"].$get()).json()),
)
