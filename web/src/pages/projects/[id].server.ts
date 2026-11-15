import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import { readClientProjects, readFeatures, readWhenEnabled } from "@/api/http/business-page-readers"
import { readCurrentProfile } from "@/api/http/page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import {
  isRecordId,
  type FeatureAvailability,
  type ProjectRecord,
  type RecordPage,
} from "@/components/app/business-types"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const id = c.req.param("id") ?? ""
  // IDとして読めない値はAPIへ渡さず、見つからない扱いにする。
  const valid = isRecordId(id)
  const user = getUser()
  if (user === null) {
    return c.redirect(
      `/sign-in?next=${encodeURIComponent(valid ? `/projects/${id}` : "/projects")}`,
    )
  }
  const [profile, features] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    readFeatures<FeatureAvailability>(c),
  ])
  const project = valid
    ? await readWhenEnabled(features, "client-project", () =>
        readClientProjects<RecordPage<ProjectRecord>>(
          c,
          `/client-project/records?kind=project&id=${id}`,
        ),
      )
    : ({ kind: "forbidden" } as const)
  return {
    email: user.email,
    pathname: "/projects",
    id,
    initial: { profile, features, project },
  }
})

export const head = defineHead(() => ({
  title: "案件の詳細",
  bodyAttrs: { "data-shell": "app" },
}))
