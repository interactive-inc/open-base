const VERSION = "v1"
const IV_BYTE_LENGTH = 12
const KEY_INFO = "system-totp-secret:v1"

/**
 * TOTPの秘密鍵を保存用に暗号化・復号する（AES-256-GCM）。鍵は製品が渡す鍵素材から
 * HKDF-SHA-256で導出し、用途の文字列で他の用途の鍵と分ける。暗号文はAccount IDへ
 * 結び付け（additional data）、別のAccountの行へ移しても復号できないようにする。
 */
export class SystemTotpSecretCipher {
  private constructor(private readonly key: CryptoKey) {
    Object.freeze(this)
  }

  static async open(keyMaterial: string): Promise<SystemTotpSecretCipher | Error> {
    if (keyMaterial.length === 0) return new Error("TOTP key material is empty")

    try {
      const base = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(keyMaterial),
        "HKDF",
        false,
        ["deriveKey"],
      )
      const key = await crypto.subtle.deriveKey(
        {
          name: "HKDF",
          hash: "SHA-256",
          salt: new Uint8Array(32),
          info: new TextEncoder().encode(KEY_INFO),
        },
        base,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
      )

      return new SystemTotpSecretCipher(key)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to open TOTP secret cipher")
    }
  }

  async encrypt(secret: string, accountId: string): Promise<string | Error> {
    try {
      const iv = new Uint8Array(IV_BYTE_LENGTH)
      crypto.getRandomValues(iv)
      const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(accountId) },
        this.key,
        new TextEncoder().encode(secret),
      )

      return `${VERSION}.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(ciphertext))}`
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to encrypt TOTP secret")
    }
  }

  async decrypt(sealed: string, accountId: string): Promise<string | Error> {
    const [version, iv, ciphertext, ...rest] = sealed.split(".")
    if (version !== VERSION || iv === undefined || ciphertext === undefined || rest.length > 0) {
      return new Error("TOTP secret ciphertext is malformed")
    }

    try {
      const plaintext = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: fromBase64Url(iv),
          additionalData: new TextEncoder().encode(accountId),
        },
        this.key,
        fromBase64Url(ciphertext),
      )

      return new TextDecoder().decode(plaintext)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to decrypt TOTP secret")
    }
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/")
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4))

  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}
