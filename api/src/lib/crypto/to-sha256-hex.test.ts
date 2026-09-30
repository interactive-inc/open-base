import { expect, test } from "bun:test"
import { toSha256Hex } from "@/lib/crypto/to-sha256-hex"

test("toSha256Hex is deterministic", async () => {
  expect(await toSha256Hex("open-base")).toHaveLength(64)
  expect(await toSha256Hex("open-base")).toBe(await toSha256Hex("open-base"))
})
