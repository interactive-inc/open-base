import { expect, test } from "bun:test"
import { AttachmentKekRegistry } from "@system/application/attachments/lib/attachment-kek-registry"
import { SystemAttachmentError } from "@system/domain/errors"

const firstKey = btoa(String.fromCharCode(...new Uint8Array(32).fill(1)))
const secondKey = btoa(String.fromCharCode(...new Uint8Array(32).fill(2)))

for (const alias of ["01", "+1", "1.0", "1e0", "0x1", " 1", "1 ", "1\n", "1\r", "1\t"]) {
  test(`KEKの版${JSON.stringify(alias)}が既存の版1を上書きする設定を拒否する`, () => {
    const registry = AttachmentKekRegistry.fromEnv(
      JSON.stringify({ "1": firstKey, [alias]: secondKey }),
    )
    expect(registry).toBeInstanceOf(SystemAttachmentError)
    expect(registry).toMatchObject({ code: "attachment_kek_invalid" })
  })
}

for (const version of ["0", "-1", "1.5", "9007199254740992", "", "１"]) {
  test(`KEKの不正な版${JSON.stringify(version)}を拒否する`, () => {
    const registry = AttachmentKekRegistry.fromEnv(JSON.stringify({ [version]: firstKey }))
    expect(registry).toBeInstanceOf(SystemAttachmentError)
    expect(registry).toMatchObject({ code: "attachment_kek_invalid" })
  })
}

test("正規の版を順に解決し、最大の安全な整数まで異なる鍵を保持する", () => {
  const registry = AttachmentKekRegistry.fromEnv(
    JSON.stringify({ "9007199254740991": secondKey, "1": firstKey, "10": secondKey }),
  )
  if (registry instanceof Error) throw registry
  expect(registry.versions()).toEqual([1, 10, Number.MAX_SAFE_INTEGER])
  expect(registry.current()).toEqual({
    version: Number.MAX_SAFE_INTEGER,
    key: new Uint8Array(32).fill(2),
  })
  expect(registry.resolve(1)).toEqual({ version: 1, key: new Uint8Array(32).fill(1) })
  expect(registry.resolve(10)).toEqual({ version: 10, key: new Uint8Array(32).fill(2) })
})
