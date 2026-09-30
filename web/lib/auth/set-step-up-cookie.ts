type CookieWriteOptions = {
  httpOnly: boolean
  secure: boolean
  sameSite: "lax"
  path: string
  maxAge: number
}

/** `cookies()`（Server Action）が満たす最小限の形。 */
type WritableCookieStore = {
  set: (name: string, value: string, options: CookieWriteOptions) => unknown
}

type Props = {
  cookieStore: WritableCookieStore
  stepUpToken: string
  maxAge: number
}

/**
 * 再認証 grant を httpOnly cookie へ書き込む。
 * maxAge は grant の失効時刻から求めた秒数で、期限切れの値は呼び出し側で弾く。
 */
export function setStepUpCookie(props: Props): void {
  props.cookieStore.set("step_up", props.stepUpToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: props.maxAge,
  })
}
