import { pageApiReader, type PageApiJson } from "@/api/http/void-api-route"
import * as featuresRoute from "@/api/routes/company.features"
import * as clientProjectRoute from "@/contexts/client-project/interface/routes/client-project.records"
import * as customerRoute from "@/contexts/customer/interface/routes/customer.records"
import * as offeringRoute from "@/contexts/offering/interface/routes/offering.records"
import * as workDefinitionsRoute from "@/contexts/work-execution/interface/routes/work-execution.definitions"
import * as workRunsRoute from "@/contexts/work-execution/interface/routes/work-execution.runs"

/**
 * 業務の領域の画面のloaderが、最初の表示のために読むAPI。
 * 型は画面の側が決める。ここは経路とhandlerの対応だけを持つ。
 */
export const readFeatures = pageApiReader("/company/features", featuresRoute.GET)

export const readCustomers = pageApiReader("/customer/records", customerRoute.GET)

export const readOfferings = pageApiReader("/offering/records", offeringRoute.GET)

export const readClientProjects = pageApiReader("/client-project/records", clientProjectRoute.GET)

export const readWorkDefinitions = pageApiReader(
  "/work-execution/definitions",
  workDefinitionsRoute.GET,
)

export const readWorkRuns = pageApiReader("/work-execution/runs", workRunsRoute.GET)

/**
 * 機能が無効と分かっているときは読まずに null を返す。
 * 無効な機能のAPIは404を返すので、読むと「権限なし」と区別できなくなる。
 */
export async function readWhenEnabled<T>(
  features: PageApiJson<{ disabled_features: ReadonlyArray<string> }>,
  feature: string,
  read: () => Promise<PageApiJson<T>>,
): Promise<PageApiJson<T> | null> {
  if (features.kind === "ok" && features.data.disabled_features.includes(feature)) return null
  return read()
}
