import { toPkceS256Challenge } from "@system/lib/auth/to-pkce-s256-challenge"
import { expect, test } from "bun:test"

test("RFC 7636 Appendix Bの既知ベクタを導出する", async () => {
  expect(await toPkceS256Challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
    "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  )
})
