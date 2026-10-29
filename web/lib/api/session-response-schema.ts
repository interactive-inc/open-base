import { z } from "zod"

/** 欠落をnullへ補完せず、検証済みのtoken対だけを認証状態へ反映する。 */
export const sessionResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).nullable(),
})
