import { defineHandler, type InferProps } from "void"

export type Props = InferProps<typeof loader>

export const loader = defineHandler((c) => ({ userCode: c.req.query("user_code") ?? null }))
