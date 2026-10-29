import { expect, test } from "bun:test"
import { toFoundationPath } from "@/lib/to-foundation-path"

for (const scenario of [
  { input: "/system", path: "/system" },
  { input: "/company", path: "/company" },
  { input: "/system/health", path: "/system/health" },
  { input: "/company/people/person:example", path: "/company/people/person%3Aexample" },
  { input: "/company/people/person%3aexample", path: "/company/people/person%3Aexample" },
  { input: "/company/people/人物", path: "/company/people/%E4%BA%BA%E7%89%A9" },
  { input: "/company/people/folder%2fitem", path: "/company/people/folder%2Fitem" },
  { input: "/company/people/folder%5citem", path: "/company/people/folder%5Citem" },
  { input: "/company/people/id%3fquery%23hash", path: "/company/people/id%3Fquery%23hash" },
  { input: "/company/people/id%25percent", path: "/company/people/id%25percent" },
  { input: "/company/people/%252e%252e", path: "/company/people/%252e%252e" },
]) {
  test(`URIの単一segmentを保持する: ${scenario.input}`, () => {
    const path = toFoundationPath(scenario.input)
    expect(path).toBe(scenario.path)
    expect(new URL(path ?? "", "https://example.com").pathname).toBe(scenario.path)
  })
}

for (const path of [
  "",
  "system/health",
  "https://example.com/system/health",
  "//example.com/system/health",
  "/other/health",
  "/systematic/health",
  "/company-extra/people",
  "/%73ystem/health",
  "/system/",
  "/system//health",
  "/system/.",
  "/system/..",
  "/system/../other",
  "/system/%2e",
  "/system/%2E%2e",
  "/system/.%2e/other",
  "/company/people/%2e.",
  "/system/health?next=example",
  "/system/health#example",
  "/system\\..\\other",
  "/system/health\r\nexample",
  "/system/health\u0000",
  "/system/health\u007f",
  "/system/health example",
  "/system/%",
  "/system/%2",
  "/system/%zz",
  "/system/%FF",
  "/system/\ud800",
]) {
  test(`namespaceやURL解釈が不安定なpathを拒否する: ${JSON.stringify(path)}`, () => {
    expect(toFoundationPath(path)).toBeNull()
  })
}
