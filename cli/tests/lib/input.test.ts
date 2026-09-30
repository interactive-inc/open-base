import { readJsonObjectFile } from "@/lib/input/read-json-file"
import { readSecretStdin } from "@/lib/input/read-secret-stdin"
import { InputError } from "@/lib/errors"
import { afterEach, describe, expect, test } from "bun:test"
import { rm } from "node:fs/promises"
import { join } from "node:path"

const files: string[] = []

afterEach(async () => {
  await Promise.all(files.splice(0).map((path) => rm(path, { force: true })))
})

describe("bounded CLI inputs", () => {
  test("reads a UTF-8 JSON object without reflecting its contents in errors", async () => {
    const path = join(import.meta.dir, `fixture-${crypto.randomUUID()}.json`)
    files.push(path)
    await Bun.write(path, JSON.stringify({ employeeCode: "E001" }))
    expect(await readJsonObjectFile(path)).toEqual({ employeeCode: "E001" })

    await Bun.write(path, '"private-value"')
    try {
      await readJsonObjectFile(path)
      throw new Error("expected an input error")
    } catch (error) {
      expect(error).toBeInstanceOf(InputError)
      expect(String(error)).not.toContain("private-value")
    }
  })

  test("removes only trailing newlines from a bounded stdin secret", async () => {
    expect(await readSecretStdin(async () => " secret value \r\n")).toBe(" secret value ")
    for (const invalidValue of ["\n", "x".repeat(4097)]) {
      try {
        await readSecretStdin(async () => invalidValue)
        throw new Error("expected an input error")
      } catch (error) {
        expect(error).toBeInstanceOf(InputError)
      }
    }
  })
})
