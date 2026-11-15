import { test } from "node:test"
import assert from "node:assert/strict"
import { createNodeMock } from "./node.ts"
import { createSqliteMock } from "./sqlite.ts"
import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

await test("Node fetch uses independent MSW memory without listening server", async () => {
  const mock = createNodeMock()
  mock.server.listen({ onUnhandledFrame: "error" })
  try {
    const response = await fetch("http://localhost/api/company/current-profile")
    assert.equal(response.status, 200)
    assert.equal(((await response.json()) as { email: string }).email, "you@example.com")
  } finally {
    mock.server.close()
  }
})

await test("Node SQLite also reopens the temporary snapshot", async () => {
  const directory = mkdtempSync(join(tmpdir(), "base-node-mock-"))
  try {
    const first = await createSqliteMock({ directory })
    first.state.applications = 17
    first.save()
    first.close()
    const reopened = await createSqliteMock({ directory })
    assert.equal(reopened.state.applications, 17)
    reopened.close()
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
