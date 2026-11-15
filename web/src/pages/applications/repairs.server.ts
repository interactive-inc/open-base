import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import { readCurrentProfile, readWorkflowRepairs } from "@/api/http/page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import type { WorkflowRepairList } from "@/components/app/application-types"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const user = getUser()
  if (user === null) return c.redirect("/sign-in?next=%2Fapplications%2Frepairs")
  const [profile, repairs] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    readWorkflowRepairs<WorkflowRepairList>(
      c,
      "/company/application-requests/workflow-repairs?limit=100",
    ),
  ])
  return { email: user.email, pathname: "/applications", initial: { profile, repairs } }
})

export const head = defineHead(() => ({
  title: "止まった申請の修復",
  bodyAttrs: { "data-shell": "app" },
}))
