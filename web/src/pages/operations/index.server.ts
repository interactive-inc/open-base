import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import {
  readBatchJobs,
  readDeadLetters,
  readDeliveries,
  readFeatures,
  readHealth,
  readWorkItems,
} from "@/api/http/operations-page-readers"
import { readCurrentProfile } from "@/api/http/page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import type {
  BatchJobPage,
  DeadLetterList,
  DeliveryList,
  FeatureAvailability,
  Health,
  WorkItemPage,
} from "@/components/app/operations-types"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const user = getUser()
  if (user === null) return c.redirect("/sign-in?next=%2Foperations")
  const [profile, health, deadLetters, stoppedJobs, stoppedOutbox, batchJobs, workItems, features] =
    await Promise.all([
      readCurrentProfile<CurrentProfile>(c),
      readHealth<Health>(c),
      readDeadLetters<DeadLetterList>(c),
      readDeliveries<DeliveryList>(c, "/system/deliveries?kind=job&status=dead_letter"),
      readDeliveries<DeliveryList>(c, "/system/deliveries?kind=outbox&status=dead_letter"),
      readBatchJobs<BatchJobPage>(c, "/system/batch-jobs?limit=50"),
      readWorkItems<WorkItemPage>(c, "/system/work-items?limit=50"),
      readFeatures<FeatureAvailability>(c),
    ])
  return {
    email: user.email,
    pathname: "/operations",
    initial: {
      profile,
      health,
      deadLetters,
      stoppedJobs,
      stoppedOutbox,
      batchJobs,
      workItems,
      features,
    },
  }
})

export const head = defineHead(() => ({
  title: "運用と監査",
  bodyAttrs: { "data-shell": "app" },
}))
