import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import { readCurrentProfile } from "@/api/http/page-readers"
import { readNotification } from "@/api/http/notifications-page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import { isNotificationId, type SystemNotification } from "@/components/app/notifications-model"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const id = c.req.param("id") ?? ""
  // 番号として読めない値はAPIへ渡さず、見つからない扱いにする。
  const valid = isNotificationId(id)
  const user = getUser()
  if (user === null) {
    return c.redirect(
      `/sign-in?next=${encodeURIComponent(valid ? `/notifications/${id}` : "/notifications")}`,
    )
  }
  const [profile, notification] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    valid
      ? readNotification<SystemNotification>(c, `/system/notifications/${id}`)
      : Promise.resolve({ kind: "forbidden" } as const),
  ])
  return { email: user.email, pathname: "/notifications", id, initial: { profile, notification } }
})

export const head = defineHead(() => ({
  title: "通知の詳細",
  bodyAttrs: { "data-shell": "app" },
}))
