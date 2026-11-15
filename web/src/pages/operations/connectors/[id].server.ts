import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import { readConnectors, readExchanges } from "@/api/http/operations-page-readers"
import { readCurrentProfile } from "@/api/http/page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import type { ConnectorList, ExchangeList } from "@/components/app/operations-types"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const id = c.req.param("id") ?? ""
  // UUIDでない番号はAPIへ渡さず、見つからない扱いにする。
  const valid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  const user = getUser()
  if (user === null) {
    const next = valid ? `/operations/connectors/${id}` : "/operations/connectors"
    return c.redirect(`/sign-in?next=${encodeURIComponent(next)}`)
  }
  const forbidden = { kind: "forbidden" } as const
  // 一件を読むAPIは無いので、一覧から探す。
  const [profile, connectors, exchanges] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    readConnectors<ConnectorList>(c),
    valid
      ? readExchanges<ExchangeList>(c, `/system/integration-exchanges?connector_id=${id}`)
      : forbidden,
  ])
  return {
    email: user.email,
    pathname: "/operations",
    id,
    initial: { profile, connectors, exchanges },
  }
})

export const head = defineHead(() => ({
  title: "外部接続の詳細",
  bodyAttrs: { "data-shell": "app" },
}))
