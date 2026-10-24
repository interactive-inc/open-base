import {
  executeServiceBindingRequest,
  type ServiceBindingRequestInput,
  type ServiceBindingRequestResult,
} from "@/api/http/service-binding/execute-service-binding-request"
import { createRuntimeApp } from "@/api/runtime-app"
import type { Bindings } from "@/bindings"
import {
  resolveSystemServiceBindingWhoami,
  type SystemServiceBindingWhoamiResult,
} from "@system/interface/operations/resolve-system-service-binding-whoami"
import { WorkerEntrypoint } from "cloudflare:workers"

// route module は要求された経路の分だけ評価する。全route を静的に import する app.ts は
// isolate のメモリ上限を超え、isolate が要求ごとに作り直されて毎回全評価の CPU を払う。
// HTTP の入口はVoidの route file が持つ。このappはRPCの request だけが使う。
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

  /**
   * access tokenの本人として、HTTP APIと同じappへ要求を通す。認可はその本人のHTTP呼び出しと同じ。
   * どの操作を利用者へ開くかは、bindingを持つWorkerが決める。
   */
  async request(
    accessToken: string,
    input: ServiceBindingRequestInput,
  ): Promise<ServiceBindingRequestResult> {
    return await executeServiceBindingRequest({
      app,
      env: this.env,
      executionContext: this.ctx,
      accessToken,
      input,
    })
  }
}
