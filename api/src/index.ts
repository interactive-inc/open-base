import { createRuntimeApp } from "@/api/runtime-app"
import type { Bindings } from "@/env"

// route module は要求された経路の分だけ評価する。全route を静的に import する app.ts は
// isolate のメモリ上限を超え、isolate が要求ごとに作り直されて毎回全評価の CPU を払う。
const app = createRuntimeApp()

export default {
  async fetch(request: Request, env: Bindings, context: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, context)
  },
  async scheduled(_controller: ScheduledController, env: Bindings): Promise<void> {
    const { SCHEDULED_JOBS } = await import("@/api/scheduled/jobs")
    const deliveries = await Promise.allSettled(
      SCHEDULED_JOBS.map((job) => job({ env, clock: () => new Date() })),
    )
    for (const delivery of deliveries) {
      if (delivery.status === "rejected") throw delivery.reason
      if (delivery.value instanceof Error) throw delivery.value
    }
  },
}
