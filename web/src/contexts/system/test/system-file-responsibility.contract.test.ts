import { Glob } from "bun"
import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"

const contextDirectory = new URL("..", import.meta.url)

test("Systemのroute以外のproduction fileは公開実行操作を一つだけ持つ", () => {
  const violations = [...new Glob("**/*.ts").scanSync({ cwd: contextDirectory.pathname })].flatMap(
    (file) => {
      if (
        file.endsWith(".test.ts") ||
        file.startsWith("test/") ||
        file.startsWith("interface/routes/")
      ) {
        return []
      }

      const source = readFileSync(new URL(file, contextDirectory), "utf8")
      const operations =
        source.match(
          /^export (?:async )?function \w+|^export class (?!\w*Error\b)\w+|^export const \w+\s*=\s*(?:async\s*)?\(/gm,
        ) ?? []

      return operations.length > 1 ? [`${file}: ${operations.join(", ")}`] : []
    },
  )

  expect(violations).toEqual([])
})

test("System ApplicationへRepository・Persistence・Gateway・Portを置かない", () => {
  const applicationDirectory = new URL("application/", contextDirectory)
  const violations = [...new Glob("**/*.ts").scanSync({ cwd: applicationDirectory.pathname })]
    .filter((file) => !file.endsWith(".test.ts"))
    .flatMap((file) => {
      const source = readFileSync(new URL(file, applicationDirectory), "utf8")
      const isErrorDefinition = file === "errors.ts" || file.endsWith("/errors.ts")
      return [
        ...(!isErrorDefinition &&
        /(?:^|\/)[^/]*(?:^|[.-])(?:repository|persistence|gateway|port)(?:[.-]|$)/i.test(file)
          ? [`${file}: persistence contract file in Application`]
          : []),
        ...(/export (?:type|interface|class) \w*(?:Repository|Persistence|Gateway|Port|Reader|Writer)\b/.test(
          source,
        )
          ? [`${file}: persistence contract in Application`]
          : []),
      ]
    })

  expect(violations).toEqual([])
})
