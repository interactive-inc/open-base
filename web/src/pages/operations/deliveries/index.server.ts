import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import { readBatchJobs, readDeadLetters, readDeliveries } from "@/api/http/operations-page-readers"
import { readCurrentProfile } from "@/api/http/page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import type { BatchJobPage, DeadLetterList, DeliveryList } from "@/components/app/operations-types"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const user = getUser()
  if (user === null) return c.redirect("/sign-in?next=%2Foperations%2Fdeliveries")
  const [profile, deadLetters, jobs, outbox, batchJobs] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    readDeadLetters<DeadLetterList>(c),
    readDeliveries<DeliveryList>(c, "/system/deliveries?kind=job"),
    readDeliveries<DeliveryList>(c, "/system/deliveries?kind=outbox"),
    readBatchJobs<BatchJobPage>(c, "/system/batch-jobs?limit=50"),
  ])
  return {
    email: user.email,
    pathname: "/operations",
    initial: { profile, deadLetters, jobs, outbox, batchJobs },
  }
})

export const head = defineHead(() => ({
  title: "配信と再試行",
  bodyAttrs: { "data-shell": "app" },
}))
