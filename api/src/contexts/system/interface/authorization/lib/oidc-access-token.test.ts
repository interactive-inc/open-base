import { readOidcAccessToken } from "@system/interface/authorization/lib/oidc-access-token"
import { expect, test } from "bun:test"

test("canonicalなOIDC access tokenだけをBearerから読む", () => {
  const token = `${"A".repeat(42)}E`
  expect(readOidcAccessToken(`Bearer ${token}`)).toBe(token)
  expect(readOidcAccessToken(`bearer ${token}`)).toBe(token)
  expect(readOidcAccessToken(`Basic ${token}`)).toBeNull()
  expect(readOidcAccessToken("Bearer short")).toBeNull()
  expect(readOidcAccessToken(token)).toBeNull()
  expect(readOidcAccessToken(`Bearer ${"A".repeat(42)}B`)).toBeNull()
})
