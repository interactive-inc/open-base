import { defineScheduled } from "void"
import { runScheduledAttachmentPurge } from "@/api/scheduled/run-attachment-purge"
import type { Bindings } from "@/bindings"

export const cron = "17 * * * *"

export default defineScheduled(async (_controller, env) => {
  const result = await runScheduledAttachmentPurge({
    env: env as unknown as Bindings,
    clock: () => new Date(),
  })
  if (result instanceof Error) throw result
})
