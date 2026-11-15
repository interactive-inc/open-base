import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import { readCurrentProfile } from "@/api/http/page-readers"
import {
  readEmployee,
  readLifecycleEvents,
  readLifecycleState,
} from "@/api/http/employees-page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import type {
  EmployeeDetail,
  LifecycleEventPage,
  LifecycleState,
} from "@/components/app/employees-types"
import {
  employeeCodeFromPath,
  eventsPath,
  statePath,
} from "@/components/app/employees-detail-paths"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const code = employeeCodeFromPath(c.req.param("code") ?? "")
  const requested = c.req.query("as_of") ?? ""
  const asOf = /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : null
  const user = getUser()
  if (user === null) {
    const next = code === null ? "/employees" : `/employees/${encodeURIComponent(code)}`
    return c.redirect(`/sign-in?next=${encodeURIComponent(next)}`)
  }
  // コードとして読めない値はAPIへ渡さず、見つからない扱いにする。
  const missing = { kind: "forbidden" } as const
  const [profile, employee, state, events] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    code === null
      ? missing
      : readEmployee<EmployeeDetail>(c, `/company/employee-directory/${encodeURIComponent(code)}`),
    code === null ? missing : readLifecycleState<LifecycleState>(c, statePath(code, asOf)),
    code === null ? missing : readLifecycleEvents<LifecycleEventPage>(c, eventsPath(code, null)),
  ])
  return {
    email: user.email,
    pathname: "/employees",
    code: code ?? "",
    asOf,
    initial: { profile, employee, state, events },
  }
})

export const head = defineHead(() => ({
  title: "従業員の詳細",
  bodyAttrs: { "data-shell": "app" },
}))
