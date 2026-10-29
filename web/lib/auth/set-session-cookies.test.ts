import { NextResponse } from "next/server"
import { expect, test } from "vite-plus/test"
import { setSessionCookies } from "@/lib/auth/set-session-cookies"

for (const hasOldCookie of [false, true]) {
  test(`refreshのないsessionでは古いcookieを明示的に失効させる (old=${hasOldCookie})`, () => {
    const response = new NextResponse()
    if (hasOldCookie) response.cookies.set("refresh_token", "example-old-refresh")
    setSessionCookies({
      cookieStore: response.cookies,
      accessToken: "example-access",
      refreshToken: null,
    })
    expect(response.cookies.get("session")?.value).toBe("example-access")
    expect(response.cookies.get("refresh_token")).toMatchObject({
      name: "refresh_token",
      value: "",
      path: "/",
      maxAge: 0,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    })
    expect(response.headers.getSetCookie().join("\n")).not.toContain("example-old-refresh")
  })
}

test("後継refresh cookieは保護属性と有効期間を保って保存する", () => {
  const response = new NextResponse()
  response.cookies.set("refresh_token", "example-old-refresh")
  setSessionCookies({
    cookieStore: response.cookies,
    accessToken: "example-access",
    refreshToken: "example-successor",
  })
  expect(response.cookies.get("refresh_token")).toMatchObject({
    value: "example-successor",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
  })
})
