import { OIDCInvalidTokenError } from "@system/interface/errors"
import { describe, expect, test } from "bun:test"
import { HTTPException } from "hono/http-exception"

describe("OIDCHTTPException", () => {
  test("Responseを持たないHTTPException派生にする", () => {
    const error = new OIDCInvalidTokenError()

    expect(error).toBeInstanceOf(HTTPException)
    expect(error.status).toBe(401)
    expect(error.code).toBe("invalid_token")
    expect(error.res).toBeUndefined()
  })
})
