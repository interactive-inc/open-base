import { afterAll, beforeAll } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

/** 試験ごとの設定ディレクトリと入力JSONを一時ディレクトリへ作り、終了後に消す。 */
export function createCliFixtures(prefix: string) {
  const directory = mkdtempSync(join(tmpdir(), `${prefix}-cli-`))
  const original = process.env.BASE_CONFIG_DIR

  beforeAll(() => {
    process.env.BASE_CONFIG_DIR = directory
  })

  afterAll(() => {
    if (original === undefined) delete process.env.BASE_CONFIG_DIR
    else process.env.BASE_CONFIG_DIR = original
    rmSync(directory, { recursive: true, force: true })
  })

  return {
    directory,
    writeJson(name: string, value: unknown): string {
      const path = join(directory, name)
      writeFileSync(path, JSON.stringify(value))
      return path
    },
  }
}
