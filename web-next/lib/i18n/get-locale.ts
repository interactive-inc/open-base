import { cookies } from "next/headers"
import { defaultLocale, localeCookieName, zLocale } from "@/lib/i18n/locale"
import type { Locale } from "@/lib/i18n/locale"

/**
 * `locale` cookie から表示言語を取り出す。Server Component / Server Action 専用。
 * cookie が無い、または不正な値の場合は `defaultLocale`（ja）にフォールバックする。
 */
export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies()

  const localeCookie = cookieStore.get(localeCookieName)

  if (localeCookie === undefined) {
    return defaultLocale
  }

  const result = zLocale.safeParse(localeCookie.value)

  if (!result.success) {
    return defaultLocale
  }

  return result.data
}
