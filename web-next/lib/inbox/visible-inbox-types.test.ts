import { expect, test } from "vite-plus/test"
import { visibleInboxTypes } from "@/lib/inbox/visible-inbox-types"

test("foundation inbox exposes only System applications", () => {
  expect(visibleInboxTypes([], []).map((item) => item.key)).toEqual(["applications"])
  expect(
    visibleInboxTypes(["expense:approve"], ["expenses", "leave"]).map((item) => item.key),
  ).toEqual(["applications"])
})
