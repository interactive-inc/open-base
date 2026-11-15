import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import {
  readApplicationTemplate,
  readApplicationTemplateWorkflow,
  readCurrentProfile,
} from "@/api/http/page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import type { TemplateDetail, TemplateWorkflow } from "@/components/app/application-types"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const requested = c.req.param("code") ?? ""
  // コードとして読めない値はAPIへ渡さず、見つからない扱いにする。
  const valid = /^[A-Za-z0-9_-]{1,100}$/.test(requested)
  const code = valid ? requested : ""
  const user = getUser()
  if (user === null) {
    const next = valid ? `/applications/templates/${code}` : "/applications/templates"
    return c.redirect(`/sign-in?next=${encodeURIComponent(next)}`)
  }
  const missing = { kind: "forbidden" } as const
  const [profile, template, workflow] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    valid
      ? readApplicationTemplate<TemplateDetail>(c, `/company/application-templates/${code}`)
      : Promise.resolve(missing),
    valid
      ? readApplicationTemplateWorkflow<TemplateWorkflow>(
          c,
          `/company/application-templates/${code}/workflow`,
        )
      : Promise.resolve(missing),
  ])
  return {
    email: user.email,
    pathname: "/applications",
    code,
    initial: { profile, template, workflow },
  }
})

export const head = defineHead(() => ({
  title: "テンプレート",
  bodyAttrs: { "data-shell": "app" },
}))
