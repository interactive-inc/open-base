/**
 * bun:sqlite の Database.exec は複数文の途中で起きた制約違反を後続文で上書きし得る。
 * trigger 本体だけを一つの文として保ち、それ以外はセミコロン単位で実行する。
 */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = []
  let statement = ""
  let quote: "'" | '"' | "`" | "]" | null = null
  let lineComment = false
  let blockComment = false

  const isTrigger = () =>
    /^\s*(?:(?:--[^\n]*\n)|(?:\/\*[\s\S]*?\*\/))*\s*CREATE\s+TRIGGER\b/i.test(statement)
  const hasSql = (value: string) =>
    value
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*--.*$/gm, "")
      .trim().length > 0

  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index] ?? ""
    const next = sql[index + 1] ?? ""
    statement += character

    if (lineComment) {
      if (character === "\n") lineComment = false
      continue
    }
    if (blockComment) {
      if (character === "*" && next === "/") {
        statement += next
        index += 1
        blockComment = false
      }
      continue
    }
    if (quote !== null) {
      if (quote === "]" && character === "]") {
        quote = null
        continue
      }
      if (quote !== "]" && character === quote) {
        if (next === quote) {
          statement += next
          index += 1
        } else {
          quote = null
        }
      }
      continue
    }
    if (character === "-" && next === "-") {
      statement += next
      index += 1
      lineComment = true
      continue
    }
    if (character === "/" && next === "*") {
      statement += next
      index += 1
      blockComment = true
      continue
    }
    if (character === "'" || character === '"' || character === "`") {
      quote = character
      continue
    }
    if (character === "[") {
      quote = "]"
      continue
    }
    if (character !== ";") continue
    if (isTrigger() && !/\bEND\s*;\s*$/i.test(statement)) continue

    const complete = statement.trim()
    if (hasSql(complete)) statements.push(complete)
    statement = ""
  }

  const trailing = statement.trim()
  if (hasSql(trailing)) statements.push(trailing)
  return statements
}
