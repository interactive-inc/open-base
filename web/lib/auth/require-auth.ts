import "server-only"
import { getMe } from "@/lib/api/get-me"

/** Server Action の公開 POST 境界で、呼び出し元の有効なセッションを必須にする。 */
export async function requireAuth() {
  return getMe()
}
