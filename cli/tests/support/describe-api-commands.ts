import { describe, expect, test } from "bun:test"
import { runCliInProcess } from "@/tests/support/run-cli-in-process"

export const STEP_UP_TOKEN = "a".repeat(64)

export type ApiCommandCase = {
  name: string
  argv: ReadonlyArray<string>
  expected: {
    method: string
    path: string
    query?: Record<string, string>
    headers?: Record<string, string>
    body?: unknown
  }
}

type Props = {
  group: string
  help: string
  cases: ReadonlyArray<ApiCommandCase>
  /** 標準入力やファイルの保存など、別の試験で確かめるコマンド名。 */
  testedElsewhere?: ReadonlyArray<string>
}

/**
 * help に載る全コマンドについて、method・経路・クエリ・ヘッダー・本文がAPIへ届くことを確かめる。
 * `--step-up` を渡す場合は、外すと何も送らずに断ることも確かめる。
 */
export function describeApiCommands(props: Props) {
  describe(`base ${props.group}`, () => {
    test("help の全コマンドに試験がある", () => {
      const names = [...props.cases.map((entry) => entry.name), ...(props.testedElsewhere ?? [])]
      expect([...new Set(names)].toSorted()).toEqual(toHelpCommandNames(props).toSorted())
    })

    for (const entry of props.cases) {
      test(`${entry.name} は ${entry.expected.method} ${entry.expected.path} へ送る`, async () => {
        const run = await runCliInProcess(entry.argv)

        expect({ status: run.status, count: run.requests.length }).toEqual({
          status: 200,
          count: 1,
        })
        const request = run.requests[0]
        expect(request?.method).toBe(entry.expected.method)
        expect(request?.path).toBe(`/api${entry.expected.path}`)
        expect(request?.query).toEqual(entry.expected.query ?? {})
        expect(request?.headers).toMatchObject(entry.expected.headers ?? {})
        expect(request?.body).toEqual(entry.expected.body ?? null)
      })

      const index = entry.argv.indexOf("--step-up")
      if (index === -1) continue

      test(`${entry.name} は --step-up が無いと送らずに断る`, async () => {
        const run = await runCliInProcess(
          entry.argv.filter((_, at) => at !== index && at !== index + 1),
        )

        expect({ status: run.status, count: run.requests.length }).toEqual({
          status: 400,
          count: 0,
        })
        expect(run.text).toContain("--step-up")
      })
    }
  })
}

function toHelpCommandNames(props: Props): Array<string> {
  const prefix = `  base ${props.group} `

  return props.help
    .split("\n")
    .filter((line) => line.startsWith(prefix))
    .map((line) =>
      line
        .slice(prefix.length)
        .split(" ")
        .filter((word, at, words) => words.slice(0, at + 1).every((part) => /^[a-z]/.test(part)))
        .join(" "),
    )
}
