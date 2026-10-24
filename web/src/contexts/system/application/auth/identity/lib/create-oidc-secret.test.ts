import { createOidcSecret } from "@system/application/auth/identity/lib/create-oidc-secret"
import { expect, test } from "bun:test"

test("256bit secretを43文字のpaddingなしbase64urlで生成する", () => {
  expect(createOidcSecret()).toMatch(/^[A-Za-z0-9_-]{43}$/)
})
