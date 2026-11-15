import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import { readWorkItem, readWorkItemHistory } from "@/api/http/operations-page-readers"
import { readCurrentProfile } from "@/api/http/page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import type { WorkItemDetail, WorkItemHistory } from "@/components/app/operations-types"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const id = c.req.param("id") ?? ""
  // UUIDでない番号はAPIへ渡さず、見つからない扱いにする。
  const valid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  const user = getUser()
  if (user === null) {
    const next = valid ? `/operations/work-items/${id}` : "/operations/work-items"
    return c.redirect(`/sign-in?next=${encodeURIComponent(next)}`)
  }
  const forbidden = { kind: "forbidden" } as const
  const [profile, workItem, history] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    valid ? readWorkItem<WorkItemDetail>(c, `/system/work-items/${id}`) : forbidden,
    valid
      ? readWorkItemHistory<WorkItemHistory>(c, `/system/work-items/${id}/history?limit=50`)
      : forbidden,
  ])
  return { email: user.email, pathname: "/operations", id, initial: { profile, workItem, history } }
})

export const head = defineHead(() => ({
  title: "作業の詳細",
  bodyAttrs: { "data-shell": "app" },
}))
