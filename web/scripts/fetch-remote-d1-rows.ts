import { spawn } from "node:child_process"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"

/** 配備前の読み取りを実行し、照会失敗を空の結果と区別する。 */
export async function fetchRemoteD1Rows(props: {
  binding: string
  configPath: string
  query: string
  allowMissingJournal?: true
}): Promise<ReadonlyArray<unknown> | null> {
  const child = spawn(
    "node",
    [
      join(
        dirname(createRequire(import.meta.url).resolve("wrangler/package.json")),
        "bin/wrangler.js",
      ),
      "d1",
      "execute",
      props.binding,
      "--remote",
      "--json",
      "--config",
      props.configPath,
      "--command",
      props.query,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  )
  const stdoutChunks: Array<Buffer> = []
  const stderrChunks: Array<Buffer> = []
  child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk))
  child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk))
  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once("error", reject)
    child.once("close", (code, signal) => {
      if (signal) {
        reject(new Error(`D1 query was terminated for ${props.binding} (signal=${signal})`))
        return
      }
      resolve(code ?? 1)
    })
  })

  if (exitCode !== 0) {
    if (
      props.allowMissingJournal &&
      props.query === "SELECT name FROM d1_migrations ORDER BY id" &&
      /no such table: (?:main\.)?d1_migrations\b/.test(Buffer.concat(stderrChunks).toString())
    )
      return null
    throw new Error(`D1 query failed for ${props.binding} (exit=${exitCode})`)
  }

  const stdoutText = Buffer.concat(stdoutChunks).toString()
  const jsonStart = stdoutText.indexOf("[")
  if (jsonStart < 0) throw new Error(`D1 query returned no JSON for ${props.binding}`)
  const parsed: unknown = JSON.parse(stdoutText.slice(jsonStart))
  if (!Array.isArray(parsed) || parsed.length !== 1)
    throw new Error(`D1 query returned an unexpected shape for ${props.binding}`)
  const first: unknown = parsed[0]
  if (
    typeof first !== "object" ||
    first === null ||
    !("success" in first) ||
    first.success !== true ||
    !("results" in first) ||
    !Array.isArray(first.results)
  )
    throw new Error(`D1 query returned an unsuccessful result for ${props.binding}`)
  return first.results
}
