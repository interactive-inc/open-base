import { defineHandler, type InferProps } from "void"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = InferProps<typeof loader>

export const loader = defineHandler((c) => ({ token: c.req.query("token") ?? null }))
