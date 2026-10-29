import { expect, test } from "bun:test"
import { toAttachmentContentDisposition } from "@system/interface/operations/to-attachment-content-disposition"

for (const example of [
  { name: "example.pdf", encoded: "example.pdf", decoded: "example.pdf" },
  { name: "原本 💡.pdf", encoded: "%E5%8E%9F%E6%9C%AC%20%F0%9F%92%A1.pdf", decoded: "原本 💡.pdf" },
  {
    name: "example 'copy'(1)*!.pdf",
    encoded: "example%20%27copy%27%281%29%2A%21.pdf",
    decoded: "example 'copy'(1)*!.pdf",
  },
  { name: "100%+#?.pdf", encoded: "100%25%2B%23%3F.pdf", decoded: "100%+#?.pdf" },
  {
    name: "folder/name\\file.pdf",
    encoded: "folder%2Fname%5Cfile.pdf",
    decoded: "folder/name\\file.pdf",
  },
  { name: "line\r\nname.pdf", encoded: "line%0D%0Aname.pdf", decoded: "line\r\nname.pdf" },
  { name: "\ud800.pdf", encoded: "%EF%BF%BD.pdf", decoded: "�.pdf" },
  {
    name: "before\udc00after.pdf",
    encoded: "before%EF%BF%BDafter.pdf",
    decoded: "before�after.pdf",
  },
]) {
  test(`Content-DispositionをUTF-8拡張parameterへ符号化する: ${JSON.stringify(example.name)}`, () => {
    const header = toAttachmentContentDisposition(example.name)
    expect(header).toBe(`attachment; filename*=UTF-8''${example.encoded}`)
    expect(header).toMatch(
      /^attachment; filename\*=UTF-8''(?:[A-Za-z0-9!#$&+.^_`|~-]|%[0-9A-Fa-f]{2})*$/,
    )
    expect(decodeURIComponent(header.slice("attachment; filename*=UTF-8''".length))).toBe(
      example.decoded,
    )
  })
}
