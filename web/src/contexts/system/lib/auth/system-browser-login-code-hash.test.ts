import { expect, spyOn, test } from "bun:test"
import { systemBrowserLoginCodeHash } from "@system/lib/auth/system-browser-login-code-hash"
import { systemLoginCodeHash } from "@system/lib/auth/system-login-code-hash"

test("同じcodeは同じ値になり、旧方式・別用途・別codeと混ざらない", async () => {
  const code = crypto.randomUUID()
  const hash = await systemBrowserLoginCodeHash(code)
  if (hash instanceof Error) throw hash
  const repeated = await systemBrowserLoginCodeHash(code)
  if (repeated instanceof Error) throw repeated
  expect(hash).toBe(repeated)
  expect(hash).not.toBe(await systemLoginCodeHash(code))
  expect(hash).not.toBe(await systemBrowserLoginCodeHash(crypto.randomUUID()))
  expect(hash).toMatch(/^[0-9a-f]{64}$/)
})

test("暗号処理の失敗で旧方式へ戻らない", async () => {
  const failure = new Error("digest unavailable")
  const digest = spyOn(crypto.subtle, "digest").mockRejectedValue(failure)
  try {
    expect(await systemBrowserLoginCodeHash("code")).toBe(failure)
  } finally {
    digest.mockRestore()
  }
})
