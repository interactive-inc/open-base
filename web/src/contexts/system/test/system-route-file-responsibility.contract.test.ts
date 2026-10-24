import { describe, expect, test } from "bun:test"
import { Glob } from "bun"
import { systemRouteManifest } from "@system/interface/route-manifest"

const contextDirectory = new URL("..", import.meta.url)

describe("System route file responsibility contract", () => {
  test("URLをdotで表すflat fileだけを許可する", () => {
    const files = [
      ...new Glob("interface/routes/**/*.ts").scanSync({ cwd: contextDirectory.pathname }),
    ].sort()

    expect(files.filter((file) => file.split("/").length !== 3)).toEqual([])
    expect(files.filter((file) => /\/(?:route|create-route)(?:\.test)?\.ts$/.test(file))).toEqual(
      [],
    )
  })

  test("一つのURLを一つのmoduleだけが所有する", () => {
    const moduleByUrl = new Map<string, Set<string>>()

    for (const route of systemRouteManifest) {
      const modulesForUrl = moduleByUrl.get(route.path) ?? new Set<string>()
      modulesForUrl.add(route.handler.module)
      moduleByUrl.set(route.path, modulesForUrl)
    }

    expect([...moduleByUrl.values()].filter((owners) => owners.size !== 1)).toEqual([])
  })

  test("manifestのURLとflat file名が同じURLを表す", () => {
    // flat file名からURLを導く生成appとmanifestのURLがずれると、生成appだけparamsが欠けて400になる
    const mismatches = systemRouteManifest
      .map((route) => ({
        path: route.path,
        module: route.handler.module,
        expected: `@system/interface/routes/${route.path.slice(1).replaceAll("/", ".").replaceAll(":", "$")}`,
      }))
      .filter((route) => route.module !== route.expected)

    expect(mismatches).toEqual([])
  })
})
