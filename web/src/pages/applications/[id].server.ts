import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import {
  readApplication,
  readApplicationTemplate,
  readCurrentProfile,
} from "@/api/http/page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import type { ApplicationDetail, Template } from "@/components/app/application-types"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const id = c.req.param("id") ?? ""
  // 数字でない番号はAPIへ渡さず、見つからない扱いにする。
  const valid = /^[1-9]\d{0,15}$/.test(id)
  const user = getUser()
  if (user === null) {
    return c.redirect(`/sign-in?next=${encodeURIComponent(valid ? `/applications/${id}` : "/")}`)
  }
  const [profile, application] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    valid
      ? readApplication<ApplicationDetail>(c, `/company/application-requests/${id}`)
      : Promise.resolve({ kind: "forbidden" } as const),
  ])
  // 入力項目の名前を出すためにテンプレートも読む。読めなくても申請は表示する。
  const template =
    application.kind === "ok"
      ? await readApplicationTemplate<Template>(
          c,
          `/company/application-templates/${encodeURIComponent(application.data.template_code)}`,
        )
      : null
  return {
    email: user.email,
    pathname: "/applications",
    id,
    initial: { profile, application, template },
  }
})

export const head = defineHead(() => ({
  title: "申請の詳細",
  bodyAttrs: { "data-shell": "app" },
}))
