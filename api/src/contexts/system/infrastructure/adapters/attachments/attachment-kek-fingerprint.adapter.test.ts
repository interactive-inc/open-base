import { expect, test } from "bun:test"
import { z } from "zod"
import { AttachmentKekFingerprintAdapter } from "@system/infrastructure/adapters/attachments/attachment-kek-fingerprint.adapter"
import { createSystemAttachmentTestKekEnvironment } from "@system/test/create-system-attachment-test-kek-environment.test-support"

const keyMap = (version: number) =>
  z
    .record(z.string(), z.string())
    .parse(JSON.parse(createSystemAttachmentTestKekEnvironment(version)))

test("使用する鍵の版だけを比較し、追加した未使用鍵で既存の検査を無効にしない", async () => {
  const original = await new AttachmentKekFingerprintAdapter({
    env: { ATTACHMENT_KEKS: JSON.stringify(keyMap(1)) },
  }).prepare([1])
  if (original instanceof Error) throw original
  expect(original).toHaveLength(1)
  expect(original[0]?.digest).toMatch(/^[0-9a-f]{64}$/)
  const extended = await new AttachmentKekFingerprintAdapter({
    env: { ATTACHMENT_KEKS: JSON.stringify({ ...keyMap(2), ...keyMap(1) }) },
  }).prepare([1, 1])
  expect(extended).toEqual(original)
  const changed = await new AttachmentKekFingerprintAdapter({
    env: { ATTACHMENT_KEKS: JSON.stringify({ "1": keyMap(2)["2"] }) },
  }).prepare([1])
  expect(changed).not.toEqual(original)
  expect(
    await new AttachmentKekFingerprintAdapter({
      env: { ATTACHMENT_KEKS: JSON.stringify(keyMap(2)) },
    }).prepare([1]),
  ).toBeInstanceOf(Error)
  expect(await new AttachmentKekFingerprintAdapter({ env: {} }).prepare([])).toEqual([])
  expect(await new AttachmentKekFingerprintAdapter({ env: {} }).prepare([1])).toBeInstanceOf(Error)
})
