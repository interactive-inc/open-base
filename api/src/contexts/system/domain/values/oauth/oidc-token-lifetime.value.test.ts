import {
  oidcAccessTokenLifetime,
  oidcAuthorizationCodeLifetime,
} from "@system/domain/values/oauth/oidc-token-lifetime.value"
import { expect, test } from "bun:test"

test("OIDC credentialの寿命をimmutableな秒・ミリ秒で保持する", () => {
  expect(oidcAuthorizationCodeLifetime.milliseconds).toBe(120_000)
  expect(oidcAccessTokenLifetime.seconds).toBe(300)
  expect(oidcAccessTokenLifetime.milliseconds).toBe(300_000)
  expect(Object.isFrozen(oidcAccessTokenLifetime)).toBe(true)
})
