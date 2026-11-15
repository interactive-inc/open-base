import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import {
  readAdminApplications,
  readApplicationList,
  readApplicationTemplates,
  readCurrentProfile,
} from "@/api/http/page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import type { AdminApplicationList, TemplateList } from "@/components/app/application-types"
import {
  readApplicationFilter,
  toApplicationListPath,
  toFilterQuery,
} from "@/components/app/applications-filter"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const filter = readApplicationFilter(new URL(c.req.url).searchParams)
  const user = getUser()
  if (user === null) {
    const query = toFilterQuery(filter)
    const next = query === "" ? "/applications/all" : `/applications/all?${query}`
    return c.redirect(`/sign-in?next=${encodeURIComponent(next)}`)
  }
  const path = toApplicationListPath(filter)
  const [profile, templates, applications] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    readApplicationTemplates<TemplateList>(c, "/company/application-templates?limit=100"),
    path === null
      ? null
      : filter.scope === "department"
        ? readApplicationList<AdminApplicationList>(c, path)
        : readAdminApplications<AdminApplicationList>(c, path),
  ])
  return {
    email: user.email,
    pathname: "/applications",
    filter,
    initial: { profile, templates, applications, path },
  }
})

export const head = defineHead(() => ({
  title: "全社の申請",
  bodyAttrs: { "data-shell": "app" },
}))
