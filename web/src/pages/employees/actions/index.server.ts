import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import { readCurrentProfile } from "@/api/http/page-readers"
import {
  readPersonnelActionRequests,
  readPersonnelActions,
} from "@/api/http/employees-page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import { actionsPath, REQUESTS_PATH } from "@/components/app/employees-actions-paths"
import type {
  PersonnelActionPage,
  PersonnelActionRequestList,
} from "@/components/app/employees-types"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const user = getUser()
  if (user === null) return c.redirect("/sign-in?next=%2Femployees%2Factions")
  const [profile, actions, requests] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    readPersonnelActions<PersonnelActionPage>(c, actionsPath(null)),
    readPersonnelActionRequests<PersonnelActionRequestList>(c, REQUESTS_PATH),
  ])
  return {
    email: user.email,
    pathname: "/employees",
    initial: { profile, actions, requests },
  }
})

export const head = defineHead(() => ({
  title: "人事発令",
  bodyAttrs: { "data-shell": "app" },
}))
