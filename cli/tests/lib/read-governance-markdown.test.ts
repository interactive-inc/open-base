import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { readGovernanceMarkdownSources } from "@/lib/governance/read-governance-markdown"

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe("readGovernanceMarkdownSources", () => {
  test("reads Markdown recursively as cwd-relative paths and skips README", async () => {
    const root = await tempRoot()
    await mkdir(join(root, ".docs/governance/policies"), { recursive: true })
    await writeFile(join(root, ".docs/governance/README.md"), "guide")
    await writeFile(join(root, ".docs/governance/policies/policy.md"), "---\nid: policy.test\n---")

    const result = await readGovernanceMarkdownSources(".docs/governance", root)

    expect(result).toEqual([
      {
        source_path: ".docs/governance/policies/policy.md",
        markdown: "---\nid: policy.test\n---",
      },
    ])
  })

  test("does not follow symlinks or accept paths outside cwd", async () => {
    const root = await tempRoot()
    await mkdir(join(root, "docs"))
    await writeFile(join(root, "target.md"), "secret")
    await symlink(join(root, "target.md"), join(root, "docs/link.md"))

    expect((await readError("docs", root)).message).toContain("同期対象の Markdown がありません")
    expect((await readError("../outside.md", root)).message).toContain("作業ディレクトリ内")
  })
})

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "governance-markdown-"))
  roots.push(root)
  return root
}

async function readError(path: string, root: string): Promise<Error> {
  try {
    await readGovernanceMarkdownSources(path, root)
    return new Error("expected governance Markdown read to fail")
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error))
  }
}
