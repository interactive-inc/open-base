/** 添付名をUTF-8の拡張parameterへ符号化し、header構造として解釈される文字を残さない。 */
export function toAttachmentContentDisposition(fileName: string): string {
  const normalized = new TextDecoder().decode(new TextEncoder().encode(fileName))
  const encoded = encodeURIComponent(normalized).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  )
  return `attachment; filename*=UTF-8''${encoded}`
}
