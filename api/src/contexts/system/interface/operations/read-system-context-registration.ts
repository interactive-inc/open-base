import { systemContextModule } from "@system/interface/module"
import { systemRouteManifest } from "@system/interface/route-manifest"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"

/** 公開操作とHTTP経路へ製品が注入する実行環境。 */
export type SystemOperationEnvironment = Readonly<{
  Bindings: SystemHonoEnv["Bindings"]
  Variables: SystemHonoEnv["Variables"]
}>

/** composition rootが登録するSystemの経路とcapabilityを読む。 */
export function readSystemContextRegistration() {
  return { ...systemContextModule, routes: systemRouteManifest }
}
