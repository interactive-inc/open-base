import { createRuntimeApp } from "@/api/runtime-app"
import type { Bindings } from "@/env"
import {
  resolveSystemServiceBindingWhoami,
  type SystemServiceBindingWhoamiResult,
} from "@system/interface/operations/resolve-system-service-binding-whoami"
import { WorkerEntrypoint } from "cloudflare:workers"

// route module は要求された経路の分だけ評価する。全route を静的に import する app.ts は
// isolate のメモリ上限を超え、isolate が要求ごとに作り直されて毎回全評価の CPU を払う。
const app = createRuntimeApp()

/**
 * 同じCloudflare accountのWorkerがService Bindingで呼ぶRPC入口。公開URLからは到達できない。
 * `cloudflare:workers` はbunのテストから読めないため、検証の本体はSystemの
 * resolveSystemServiceBindingWhoami に置き、ここでは時刻を決めて渡すだけにする。
 */
export class ServiceBindingEntrypoint extends WorkerEntrypoint<Bindings> {
  async whoami(accessToken: string): Promise<SystemServiceBindingWhoamiResult> {
    return await resolveSystemServiceBindingWhoami(
      { env: this.env },
      { accessToken, now: new Date(this.env.NOW ?? Date.now()) },
    )
  }
}

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
