import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import {
  readFeatures,
  readWhenEnabled,
  readWorkDefinitions,
  readWorkRuns,
} from "@/api/http/business-page-readers"
import { readCurrentProfile } from "@/api/http/page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import type {
  FeatureAvailability,
  RecordPage,
  WorkDefinition,
  WorkRun,
} from "@/components/app/business-types"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const user = getUser()
  if (user === null) return c.redirect("/sign-in?next=%2Fwork")
  const [profile, features] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    readFeatures<FeatureAvailability>(c),
  ])
  const [definitions, runs] = await Promise.all([
    readWhenEnabled(features, "work-execution", () =>
      readWorkDefinitions<RecordPage<WorkDefinition>>(c, "/work-execution/definitions?limit=100"),
    ),
    readWhenEnabled(features, "work-execution", () =>
      readWorkRuns<RecordPage<WorkRun>>(c, "/work-execution/runs?limit=50"),
    ),
  ])
  return {
    email: user.email,
    pathname: "/work",
    initial: { profile, features, definitions, runs },
  }
})

export const head = defineHead(() => ({
  title: "業務の実行",
  bodyAttrs: { "data-shell": "app" },
}))
