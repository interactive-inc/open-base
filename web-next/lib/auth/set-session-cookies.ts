import { sessionMaxAge } from "@/lib/auth/session-max-age"

type CookieWriteOptions = {
  httpOnly: boolean
  secure: boolean
  sameSite: "lax"
  path: string
  maxAge: number
}

/** `cookies()`（Server Action）と `NextResponse.cookies`（Middleware）の両方が満たす最小限の形。 */
type WritableCookieStore = {
  set: (name: string, value: string, options: CookieWriteOptions) => unknown
}

type Props = {
  cookieStore: WritableCookieStore
  accessToken: string
  refreshToken: string | null
}

const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60

/**
 * ログイン・リフレッシュ共通の cookie 書き込み。Server Action（`cookies()`）と
 * Middleware（`NextResponse.cookies`）はどちらも `ResponseCookies` 互換の `set()` を持つ。
 */
export function setSessionCookies(props: Props): void {
  props.cookieStore.set("session", props.accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: sessionMaxAge(props.accessToken),
  })

  if (props.refreshToken !== null) {
    props.cookieStore.set("refresh_token", props.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: REFRESH_TOKEN_MAX_AGE,
    })
  }
}
