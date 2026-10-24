import { decryptAttachment } from "@system/application/attachments/lib/decrypt-attachment"
import { encryptAttachment } from "@system/application/attachments/lib/encrypt-attachment"
import { fromBase64 } from "@system/application/attachments/lib/from-base64"
import { rewrapAttachmentKey } from "@system/application/attachments/lib/rewrap-attachment-key"
import { toSha256Hex } from "@system/application/attachments/lib/to-sha256-hex"
import { createSystemAttachmentTestKekEnvironment } from "@system/test/create-system-attachment-test-kek-environment.test-support"
import { describe, expect, test } from "bun:test"
import { AttachmentKekRegistry } from "@system/application/attachments/lib/attachment-kek-registry"

function receiptBytes(): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode("%PDF-1.7 領収書 12,800円")
}

function kekOf(version: number) {
  const registry = AttachmentKekRegistry.fromEnv(createSystemAttachmentTestKekEnvironment(version))

  if (registry instanceof Error) throw registry

  return registry.current()
}

describe("attachment envelope encryption", () => {
  test("暗号文には平文が現れず、復号すると元に戻る", async () => {
    const plaintext = receiptBytes()

    const encrypted = await encryptAttachment(plaintext, kekOf(1))

    expect(encrypted.ciphertext).not.toEqual(plaintext)
    expect(new TextDecoder().decode(encrypted.ciphertext)).not.toContain("領収書")

    const decrypted = await decryptAttachment(
      encrypted.ciphertext,
      {
        wrappedDek: encrypted.wrappedDek,
        wrappedDekIv: encrypted.wrappedDekIv,
        contentIv: encrypted.contentIv,
        kekVersion: encrypted.kekVersion,
      },
      kekOf(1),
    )

    expect(decrypted).toEqual(plaintext)
  })

  test("平文ハッシュで復号後の整合を検証できる", async () => {
    const plaintext = receiptBytes()

    const encrypted = await encryptAttachment(plaintext, kekOf(1))

    expect(encrypted.plaintextSha256).toBe(await toSha256Hex(plaintext))
  })

  test("同じ内容でも DEK と IV が毎回変わる", async () => {
    const first = await encryptAttachment(receiptBytes(), kekOf(1))

    const second = await encryptAttachment(receiptBytes(), kekOf(1))

    expect(first.contentIv).not.toBe(second.contentIv)
    expect(first.wrappedDek).not.toBe(second.wrappedDek)
    expect(first.ciphertext).not.toEqual(second.ciphertext)
  })

  test("別の KEK では復号できない", async () => {
    const encrypted = await encryptAttachment(receiptBytes(), kekOf(1))

    const decrypted = await decryptAttachment(
      encrypted.ciphertext,
      {
        wrappedDek: encrypted.wrappedDek,
        wrappedDekIv: encrypted.wrappedDekIv,
        contentIv: encrypted.contentIv,
        kekVersion: encrypted.kekVersion,
      },
      kekOf(2),
    )

    expect(decrypted).toBeInstanceOf(Error)
  })

  test("鍵を破棄すると暗号文は残っていても復号できない", async () => {
    const encrypted = await encryptAttachment(receiptBytes(), kekOf(1))

    // crypto-shredding は wrappedDek を失うこと。暗号文だけでは戻せない
    const decrypted = await decryptAttachment(
      encrypted.ciphertext,
      {
        wrappedDek: btoa("destroyed"),
        wrappedDekIv: encrypted.wrappedDekIv,
        contentIv: encrypted.contentIv,
        kekVersion: encrypted.kekVersion,
      },
      kekOf(1),
    )

    expect(decrypted).toBeInstanceOf(Error)
  })

  test("KEK ローテーションは本体に触れず包み直しだけで済む", async () => {
    const plaintext = receiptBytes()

    const encrypted = await encryptAttachment(plaintext, kekOf(1))

    const rewrapped = await rewrapAttachmentKey(
      {
        wrappedDek: encrypted.wrappedDek,
        wrappedDekIv: encrypted.wrappedDekIv,
        kekVersion: encrypted.kekVersion,
      },
      kekOf(1),
      kekOf(2),
    )

    if (rewrapped instanceof Error) throw rewrapped

    expect(rewrapped.kekVersion).toBe(2)

    const decrypted = await decryptAttachment(
      encrypted.ciphertext,
      { ...rewrapped, contentIv: encrypted.contentIv },
      kekOf(2),
    )

    expect(decrypted).toEqual(plaintext)
  })
})

describe("AttachmentKekRegistry", () => {
  test("未設定は利用時に拒否する", () => {
    expect(AttachmentKekRegistry.fromEnv(undefined)).toBeInstanceOf(Error)
    expect(AttachmentKekRegistry.fromEnv("")).toBeInstanceOf(Error)
  })

  test("最大 version を現行鍵にし、旧 version も解決できる", () => {
    const registry = AttachmentKekRegistry.fromEnv(
      JSON.stringify({
        1: JSON.parse(createSystemAttachmentTestKekEnvironment(1))["1"],
        2: JSON.parse(createSystemAttachmentTestKekEnvironment(2))["2"],
      }),
    )

    if (registry instanceof Error) throw registry

    expect(registry.current().version).toBe(2)
    expect(registry.versions()).toEqual([1, 2])
    expect(registry.resolve(1)).not.toBeInstanceOf(Error)
  })

  test("設定に無い version は fail-closed で拒否する", () => {
    const registry = AttachmentKekRegistry.fromEnv(createSystemAttachmentTestKekEnvironment(1))

    if (registry instanceof Error) throw registry

    expect(registry.resolve(9)).toBeInstanceOf(Error)
  })

  test("鍵長が 32 バイトでなければ拒否する", () => {
    expect(AttachmentKekRegistry.fromEnv(JSON.stringify({ 1: btoa("short") }))).toBeInstanceOf(
      Error,
    )
  })

  test("base64 の鍵を 32 バイトへ復元する", () => {
    const registry = AttachmentKekRegistry.fromEnv(createSystemAttachmentTestKekEnvironment(1))

    if (registry instanceof Error) throw registry

    expect(registry.current().key.byteLength).toBe(32)
    expect(
      fromBase64(JSON.parse(createSystemAttachmentTestKekEnvironment(1))["1"]).byteLength,
    ).toBe(32)
  })
})
