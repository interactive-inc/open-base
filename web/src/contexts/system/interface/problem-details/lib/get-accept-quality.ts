/** Accept media rangeのq値を厳密に読み、不正値は選択不能として扱う。 */
export function getAcceptQuality(parameters: ReadonlyArray<string>): number {
  let parsedQuality: number | null = null

  for (const parameter of parameters) {
    const separator = parameter.indexOf("=")
    if (separator < 0 || parameter.slice(0, separator).trim().toLowerCase() !== "q") continue
    if (parsedQuality !== null) return 0

    const quality = parameter.slice(separator + 1).trim()
    if (!/^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(quality)) return 0

    parsedQuality = Number(quality)
  }

  return parsedQuality ?? 1
}
