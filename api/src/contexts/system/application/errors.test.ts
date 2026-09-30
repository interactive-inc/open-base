import {
  ApplicationBadRequestError,
  ApplicationForbiddenError,
  ApplicationNotFoundError,
} from "@system/application/errors"
import { expect, test } from "bun:test"

test("application errors preserve HTTP status, response body, layer, and cause", () => {
  const cause = new Error("database unavailable")
  const error = new ApplicationBadRequestError(
    { error: "invalid_input", message: "Invalid input", value: "bad" },
    { cause },
  )

  expect(error).toMatchObject({
    body: { error: "invalid_input", message: "Invalid input", value: "bad" },
    cause,
    layer: "application",
    message: "Invalid input",
    name: "ApplicationBadRequestError",
    status: 400,
  })
})

test("application errors retain stable authorization and missing-resource defaults", () => {
  expect(new ApplicationForbiddenError()).toMatchObject({
    body: { error: "forbidden", message: "この操作を行う権限がありません。" },
    status: 403,
  })
  expect(new ApplicationNotFoundError()).toMatchObject({
    body: {
      error: "not_found",
      message: "対象のデータが見つかりません。削除または更新された可能性があります。",
    },
    status: 404,
  })
})
