import { expect, test } from "bun:test"
import { createHTTPErrorBody } from "@system/interface/http-error-body/lib/create-http-error-body"

test("HTTPエラー本文へstatus別の既定メッセージを補う", () => {
  expect(createHTTPErrorBody(403, "forbidden")).toEqual({
    error: "forbidden",
    message: "この操作を行う権限がありません。",
  })
  expect(createHTTPErrorBody(400, { error: "invalid", message: "入力が不正です。" })).toEqual({
    error: "invalid",
    message: "入力が不正です。",
  })
})
