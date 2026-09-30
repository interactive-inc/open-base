/** 永続化済みJSONを明示的な失敗値付きで復元する。 */
export function parseJsonValue(value: string): Readonly<{ value: unknown }> | Error {
  try {
    return { value: JSON.parse(value) }
  } catch (cause) {
    return new Error("invalid JSON", { cause })
  }
}
