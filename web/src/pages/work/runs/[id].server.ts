import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import { readFeatures, readWhenEnabled, readWorkRuns } from "@/api/http/business-page-readers"
import { readCurrentProfile } from "@/api/http/page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import {
  findWorkRun,
  isRecordId,
  isWorkSlug,
  type FeatureAvailability,
  type RecordPage,
  type WorkRun,
} from "@/components/app/business-types"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const id = c.req.param("id") ?? ""
  const requested = c.req.query("slug") ?? ""
  // IDとして読めない値はAPIへ渡さず、見つからない扱いにする。業務の識別名は絞り込みにだけ使う。
  const valid = isRecordId(id)
  const slug = isWorkSlug(requested) ? requested : null
  const user = getUser()
  if (user === null) {
    const next = valid ? `/work/runs/${id}${slug === null ? "" : `?slug=${slug}`}` : "/work"
    return c.redirect(`/sign-in?next=${encodeURIComponent(next)}`)
  }
  const [profile, features] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    readFeatures<FeatureAvailability>(c),
  ])
  const run = valid
    ? await readWhenEnabled(features, "work-execution", () =>
        findWorkRun(id, slug, (path) => readWorkRuns<RecordPage<WorkRun>>(c, path)),
      )
    : ({ kind: "ok", data: null } as const)
  return {
    email: user.email,
    pathname: "/work",
    id,
    slug,
    initial: { profile, features, run },
  }
})

export const head = defineHead(() => ({
  title: "実行の記録",
  bodyAttrs: { "data-shell": "app" },
}))
