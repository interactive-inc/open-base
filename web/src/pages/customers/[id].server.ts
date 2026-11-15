import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import {
  readClientProjects,
  readCustomers,
  readFeatures,
  readWhenEnabled,
} from "@/api/http/business-page-readers"
import { readCurrentProfile } from "@/api/http/page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import {
  isRecordId,
  type CustomerRecord,
  type FeatureAvailability,
  type ProjectRecord,
  type RecordPage,
} from "@/components/app/business-types"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const id = c.req.param("id") ?? ""
  // IDとして読めない値はAPIへ渡さず、見つからない扱いにする。
  const valid = isRecordId(id)
  const user = getUser()
  if (user === null) {
    return c.redirect(
      `/sign-in?next=${encodeURIComponent(valid ? `/customers/${id}` : "/customers")}`,
    )
  }
  const [profile, features] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    readFeatures<FeatureAvailability>(c),
  ])
  const [customer, projects] = await Promise.all([
    valid
      ? readWhenEnabled(features, "customer", () =>
          readCustomers<RecordPage<CustomerRecord>>(c, `/customer/records?id=${id}`),
        )
      : Promise.resolve({ kind: "forbidden" } as const),
    valid
      ? readWhenEnabled(features, "client-project", () =>
          readClientProjects<RecordPage<ProjectRecord>>(
            c,
            `/client-project/records?kind=project&customer_id=${id}&limit=100`,
          ),
        )
      : Promise.resolve(null),
  ])
  return {
    email: user.email,
    pathname: "/customers",
    id,
    initial: { profile, features, customer, projects },
  }
})

export const head = defineHead(() => ({
  title: "顧客の詳細",
  bodyAttrs: { "data-shell": "app" },
}))
