import { route as applications } from "./applications"
import { route as employees } from "./employees"
import { route as organization } from "./organization"
import { route as reviews } from "./reviews"
import { route as notifications } from "./notifications"
import { route as accounts } from "./accounts"
import { route as operations } from "./operations"
import { route as business } from "./business"
import type { MockRoute } from "./route"

/** 領域ごとの画面の割り当て。上から順に試す。 */
export const routes: ReadonlyArray<MockRoute> = [
  applications,
  employees,
  organization,
  reviews,
  notifications,
  accounts,
  operations,
  business,
]
