/** 戻り先は同じoriginの経路だけにし、外部サイトへのリダイレクトに使わせない。 */
export function sameOriginPath(value: string | undefined): string {
  if (value === undefined || !value.startsWith("/") || value.startsWith("//")) return "/"
  if (value.includes("\\") || /[\u0000-\u001f]/.test(value)) return "/"
  return value
}
