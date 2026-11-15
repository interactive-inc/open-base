import type { MockArea } from "./area.ts"
import { area as applications } from "./applications.ts"
import { area as employees } from "./employees.ts"
import { area as organization } from "./organization.ts"
import { area as reviews } from "./reviews.ts"
import { area as notifications } from "./notifications.ts"
import { area as accounts } from "./accounts.ts"
import { area as operations } from "./operations.ts"
import { area as business } from "./business.ts"

/** 領域の一覧。上から順に経路を試す。 */
// 領域ごとに状態の型が違うので、一覧では型を消して扱う。
export const areas = [
  applications,
  employees,
  organization,
  reviews,
  notifications,
  accounts,
  operations,
  business,
] as unknown as ReadonlyArray<MockArea<unknown>>
