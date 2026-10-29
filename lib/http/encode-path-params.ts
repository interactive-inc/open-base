/** 識別子を単一のpath segmentに固定し、URLの正規化で消える値は送信前に拒否する。 */
export function encodePathParams<Params extends Readonly<Record<string, string>>>(
  params: Params,
): { [Key in keyof Params]: string } {
  const encoded: { [Key in keyof Params]: string } = { ...params }

  for (const key of Object.keys(params)) {
    const value = params[key]
    if (value === "" || value === "." || value === "..")
      throw new Error("invalid URL path parameter")
    Object.assign(encoded, { [key]: encodeURIComponent(value) })
  }

  return encoded
}
