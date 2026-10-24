import { describe, expect, test } from "bun:test"
import { Glob } from "bun"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { negotiateSystemProblemDetails } from "@system/interface/problem-details/lib/negotiate-system-problem-details"
import { systemRouteManifest } from "@system/interface/route-manifest"

const contextDirectory = new URL("..", import.meta.url).pathname

const VERSION_SEGMENT = /(?:^|[/.])v\d+(?:$|[/.])/u

function negotiate(accept: string | null) {
  return negotiateSystemProblemDetails({
    accept,
    status: 409,
    code: "conflict",
    detail: "The resource changed.",
    sourceBody: { error: "conflict" },
  })
}

describe("System API versioning contract", () => {
  test("URLとroute fileにversionの区切りを含めない", () => {
    const routeFiles = [
      ...new Glob("interface/routes/*.ts").scanSync({ cwd: contextDirectory }),
    ].map((file) => file.slice("interface/routes/".length))

    expect(
      systemRouteManifest.map((route) => route.path).filter((path) => VERSION_SEGMENT.test(path)),
    ).toEqual([])
    expect(routeFiles.filter((file) => VERSION_SEGMENT.test(file))).toEqual([])
  })

  test("新しい表現は明示的に選んだrequestだけへ返し、既定の表現を変えない", () => {
    for (const accept of [
      null,
      "*/*",
      "application/json",
      "application/*",
      "application/problem+json;q=0",
      'application/problem+json;profile="x"',
    ]) {
      expect(negotiate(accept)).toBeNull()
    }
    expect(negotiate("application/json, application/problem+json;q=0.5")).toMatchObject({
      status: 409,
      code: "conflict",
    })
  })

  test("表現の選択はinterface層に置き、applicationとdomainへ持ち込まない", () => {
    const files = ["application", "domain"].flatMap((layer) =>
      [...new Glob(`${layer}/**/*.ts`).scanSync({ cwd: contextDirectory })].filter(
        (file) => !file.endsWith(".test.ts"),
      ),
    )

    expect(
      files.filter((file) =>
        /problem\+json|problem-details/iu.test(readFileSync(join(contextDirectory, file), "utf8")),
      ),
    ).toEqual([])
  })
})
