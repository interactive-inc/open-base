import { z } from "zod"
import { createClient } from "@/lib/api/hc-client"

const availabilitySchema = z.object({ disabled_features: z.array(z.string()) })

/** 機能の有効状態を確認できないときは、全機能有効とみなさず失敗を返す。 */
export async function getFeatureAvailability(): Promise<ReadonlyArray<string> | Error> {
  const client = await createClient()
  const response = await client.company.features.$get()
  if (!response.ok) return new Error("機能設定を取得できませんでした")
  const body = await response.json().catch(() => null)
  const availability = availabilitySchema.safeParse(body)
  if (!availability.success) return new Error("機能設定を確認できませんでした")
  return availability.data.disabled_features
}
