import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import { readFeatures, readOfferings, readWhenEnabled } from "@/api/http/business-page-readers"
import { readCurrentProfile } from "@/api/http/page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import type {
  FeatureAvailability,
  OfferingRecord,
  RecordPage,
} from "@/components/app/business-types"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const user = getUser()
  if (user === null) return c.redirect("/sign-in?next=%2Fofferings")
  const [profile, features] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    readFeatures<FeatureAvailability>(c),
  ])
  const offerings = await readWhenEnabled(features, "offering", () =>
    readOfferings<RecordPage<OfferingRecord>>(c, "/offering/records?limit=100"),
  )
  return { email: user.email, pathname: "/offerings", initial: { profile, features, offerings } }
})

export const head = defineHead(() => ({
  title: "サービス",
  bodyAttrs: { "data-shell": "app" },
}))
