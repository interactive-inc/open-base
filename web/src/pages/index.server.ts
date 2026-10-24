import { defineHandler, type InferProps } from "void"
import { getUser } from "void/auth"

export type Props = InferProps<typeof loader>

export const loader = defineHandler(() => {
  const user = getUser()
  return { email: user?.email ?? null }
})
