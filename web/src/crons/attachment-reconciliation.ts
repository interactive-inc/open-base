import { defineScheduled } from "void"
import { runScheduledAttachmentReconciliation } from "@/api/scheduled/run-attachment-reconciliation"
import type { Bindings } from "@/bindings"

export const cron = "47 * * * *"

export default defineScheduled(async (_controller, env) => {
  const result = await runScheduledAttachmentReconciliation({
    env: env as unknown as Bindings,
    clock: () => new Date(),
  })
  if (result instanceof Error) throw result
})
