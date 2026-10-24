import { readBearerAuthorization } from "@system/interface/operations/bearer-authorization"
import { describe, expect, test } from "bun:test"

describe("readBearerAuthorization", () => {
  test("正しいBearer tokenを読む", () => {
    const header = "Bearer abc.def-123_456"

    const authorization = readBearerAuthorization(header)

    expect(authorization).toEqual({ kind: "token", token: "abc.def-123_456" })
    expect(Object.isFrozen(authorization)).toBe(true)
  })

  test("Bearer以外はcredentialなしとして扱う", () => {
    for (const header of [undefined, "", "Basic abc", "Digest abc", "BearerX abc"]) {
      expect(readBearerAuthorization(header)).toEqual({ kind: "absent" })
    }
  })

  test("Bearer schemeがある壊れたcredentialを区別する", () => {
    for (const header of ["Bearer", "Bearer ", "Bearer\tabc def", "Bearer abc def"]) {
      expect(readBearerAuthorization(header)).toEqual({ kind: "malformed" })
    }
  })
})
