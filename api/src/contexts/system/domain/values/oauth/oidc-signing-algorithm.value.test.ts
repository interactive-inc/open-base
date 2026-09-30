import { oidcSigningAlgorithm } from "@system/domain/values/oauth/oidc-signing-algorithm.value"
import { expect, test } from "bun:test"

test("OIDC署名方式をES256へ固定する", () => {
  expect(oidcSigningAlgorithm.toString()).toBe("ES256")
  expect(Object.isFrozen(oidcSigningAlgorithm)).toBe(true)
})
