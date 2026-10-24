import { defineHandler, type InferProps } from "void"

export type Props = InferProps<typeof loader>

export const loader = defineHandler((c) => ({ token: c.req.query("token") ?? null }))
