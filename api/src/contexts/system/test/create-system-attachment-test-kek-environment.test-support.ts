/** 添付テスト用の32バイトKEKをJSON環境変数として作る。 */
export function createSystemAttachmentTestKekEnvironment(version = 1): string {
  const key = new Uint8Array(32)

  for (let index = 0; index < key.length; index += 1) {
    key[index] = (index * 7 + version) % 256
  }

  let binary = ""

  for (const byte of key) {
    binary += String.fromCharCode(byte)
  }

  return JSON.stringify({ [String(version)]: btoa(binary) })
}
