const reservedMembers = new Set([
  "type",
  "title",
  "status",
  "detail",
  "instance",
  "code",
  "error",
  "message",
  "cause",
  "stack",
  "__proto__",
  "prototype",
  "constructor",
])

/** 既存の公開error bodyから予約memberと内部例外情報を除いてextensionだけを返す。 */
export function getSystemProblemExtensions(body: object): Readonly<Record<string, unknown>> {
  const extensions: Record<string, unknown> = {}

  for (const key of Object.keys(body)) {
    if (reservedMembers.has(key)) continue

    const property = Object.getOwnPropertyDescriptor(body, key)
    if (property === undefined || !("value" in property)) continue

    extensions[key] = property.value
  }

  return extensions
}
