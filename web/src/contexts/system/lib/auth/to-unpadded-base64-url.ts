/** bytesをRFC 4648のpaddingなしbase64urlへ変換する。 */
export function toUnpaddedBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "")
}
