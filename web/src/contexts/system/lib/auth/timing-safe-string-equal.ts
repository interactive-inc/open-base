/** SHA-256で固定長化し、入力長や先頭不一致で早期終了せず文字列を比較する。 */
export async function timingSafeStringEqual(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const hashes = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ])
  const leftBytes = new Uint8Array(hashes[0]!)
  const rightBytes = new Uint8Array(hashes[1]!)
  const difference = leftBytes.reduce(
    (currentDifference, leftByte, index) =>
      currentDifference | (leftByte ^ (rightBytes[index] ?? 0)),
    leftBytes.length ^ rightBytes.length,
  )

  return difference === 0
}
