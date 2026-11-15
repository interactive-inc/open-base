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
import type {
  CustomerRecord,
  FeatureAvailability,
  ProjectRecord,
  RecordPage,
} from "@/components/app/business-types"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const user = getUser()
  if (user === null) return c.redirect("/sign-in?next=%2Fcustomers")
  const [profile, features] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    readFeatures<FeatureAvailability>(c),
  ])
  const [customers, projects] = await Promise.all([
    readWhenEnabled(features, "customer", () =>
      readCustomers<RecordPage<CustomerRecord>>(c, "/customer/records?limit=100"),
    ),
    readWhenEnabled(features, "client-project", () =>
      readClientProjects<RecordPage<ProjectRecord>>(
        c,
        "/client-project/records?kind=project&limit=100",
      ),
    ),
  ])
  return {
    email: user.email,
    pathname: "/customers",
    initial: { profile, features, customers, projects },
  }
})

export const head = defineHead(() => ({
  title: "顧客",
  bodyAttrs: { "data-shell": "app" },
}))
