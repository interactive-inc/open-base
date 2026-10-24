import { z } from "zod"

/** 権限カタログ 1 件のレスポンス。 */
export const zAppPermission = z.object({
  key: z.string(),
  description: z.string(),
  category: z.string(),
})

/** 権限カタログ一覧のレスポンス。 */
export const zAppPermissionList = z.object({
  data: z.array(zAppPermission),
  total: z.number(),
})
