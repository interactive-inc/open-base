import { expect, test } from "bun:test"
import { factory } from "@/api/http/factory"
import { guardBootstrapSignInMethod } from "./guard-bootstrap-sign-in-method"

const app = factory
  .createApp()
  .use("/system/bootstrap", guardBootstrapSignInMethod)
  .post("/system/bootstrap", (c) => c.json({ accepted: true }))

test("初期登録の認証方式が配備設定と一致するときだけ先へ進む", async () => {
  for (const method of ["password", "passkey", "oidc"]) {
    for (const requested of ["password", "passkey", "oidc"]) {
      const response = await app.request(
        "/system/bootstrap",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "you@example.com", method: requested }),
        },
        { SIGN_IN_METHOD: method, BOOTSTRAP_TOKEN: "test-only-bootstrap-token" },
      )
      expect(response.status).toBe(method === requested ? 200 : 400)
    }
  }
})
