import { Glob } from "bun"
import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"

const domainRoot = resolve(import.meta.dir, "../domain")

const bucketSuffixes: Readonly<Record<string, RegExp>> = {
  entities: /\.entity(?:\.test)?\.ts$/,
  values: /\.value(?:\.test)?\.ts$/,
  schemas: /\.schema(?:\.test)?\.ts$/,
  catalogs: /\.catalog(?:\.test)?\.ts$/,
  definitions: /\.definition(?:\.test)?\.ts$/,
  policies: /\.policy(?:\.test)?\.ts$/,
}

const bucketNames = Object.keys(bucketSuffixes)

describe("System domain structure", () => {
  test("domain直下をmodel bucketとerror定義だけに限定する", () => {
    expect(
      readdirSync(domainRoot, { withFileTypes: true })
        .map((entry) => `${entry.isDirectory() ? "directory" : "file"}:${entry.name}`)
        .toSorted(),
    ).toEqual([...bucketNames.map((name) => `directory:${name}`), "file:errors.ts"].toSorted())

    const paths = Array.from(new Glob("**/*.ts").scanSync({ cwd: domainRoot, onlyFiles: true }))

    expect(
      paths.filter((path) => {
        if (path === "errors.ts") return false
        const directory = path.split("/")[0]
        return directory === undefined || !bucketNames.includes(directory)
      }),
    ).toEqual([])
  })

  test("各bucketにはそのsuffixのfileだけを置く", () => {
    const violations: string[] = []

    for (const [bucket, pattern] of Object.entries(bucketSuffixes)) {
      for (const path of new Glob("**/*.ts").scanSync({
        cwd: resolve(domainRoot, bucket),
        onlyFiles: true,
      })) {
        if (!pattern.test(path)) violations.push(`${bucket}/${path}`)
      }
    }

    expect(violations).toEqual([])
  })

  test("Domain Errorをdomain直下のerrors.tsに集約する", () => {
    const misplacedErrors = Array.from(
      new Glob(`{${bucketNames.join(",")}}/**/*.ts`).scanSync({
        cwd: domainRoot,
        onlyFiles: true,
      }),
    ).filter((path) =>
      /^export class \w*Error\b/m.test(readFileSync(resolve(domainRoot, path), "utf8")),
    )
    const errorClasses =
      readFileSync(resolve(domainRoot, "errors.ts"), "utf8").match(/^export class \w*Error\b/gm) ??
      []

    expect(misplacedErrors).toEqual([])
    expect(errorClasses.length).toBeGreaterThan(0)
  })
})
