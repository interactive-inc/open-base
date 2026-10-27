import { InvalidSystemPasswordError } from "@system/domain/errors"
import { SystemPasswordValue } from "@system/domain/values/auth/system-password.value"
import { expect, test } from "bun:test"

test("System passwordは12文字以上200文字以下のパスフレーズを受理する", () => {
  expect(SystemPasswordValue.create("correct horse battery staple")).toBeInstanceOf(
    SystemPasswordValue,
  )
  expect(SystemPasswordValue.create("a".repeat(12))).toBeInstanceOf(SystemPasswordValue)
  expect(SystemPasswordValue.create("a".repeat(200))).toBeInstanceOf(SystemPasswordValue)
})

test("System passwordは短すぎる値とhash資源を浪費する長さを拒否する", () => {
  expect(SystemPasswordValue.create("a".repeat(11))).toEqual(
    new InvalidSystemPasswordError("password_too_short"),
  )
  expect(SystemPasswordValue.create("a".repeat(201))).toEqual(
    new InvalidSystemPasswordError("password_too_long"),
  )
})
