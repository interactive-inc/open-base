import { expect, setDefaultTimeout, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"
import { createSystemAttachmentTestDatabase } from "@system/test/create-system-attachment-test-database.test-support"
import { AttachmentAdapter } from "@system/infrastructure/adapters/attachments/attachment.adapter"
import { PrepareAttachmentEvidenceAdapter } from "@system/infrastructure/adapters/attachments/prepare-attachment-evidence.adapter"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

async function fixture() {
  const database = await createSystemAttachmentTestDatabase()
  const context = { env: { DB: database }, var: { database: drizzle(database) } }
  const attachments = new AttachmentAdapter(context)
  const at = new Date("2026-01-01T00:00:00Z")
  for (const id of ["first", "second"]) {
    const reserved = await attachments.reserve({
      id,
      ownerAccountId: "owner",
      objectKey: `att/${id}`,
      contentType: "application/pdf",
      byteSize: 100,
      fileName: `${id}.pdf`,
      plaintextSha256: "a".repeat(64),
      wrappedDek: "test-key",
      wrappedDekIv: "test-key-iv",
      contentIv: "test-content-iv",
      kekVersion: 1,
      createdAt: at,
    })
    if (reserved instanceof Error) throw reserved
    const pending = await attachments.markPending(id)
    if (pending instanceof Error) throw pending
  }
  const adapter = new PrepareAttachmentEvidenceAdapter(context)
  const input = {
    attachmentIds: ["second", "first"],
    ownerAccountId: "owner",
    linkedAttachmentIds: new Set<string>(),
    at,
  }
  return { database, attachments, adapter, input }
}

test("添付二件を業務保存と一緒に巻き戻し、同じ準備から再試行できる", async () => {
  const c = await fixture()
  const prepared = await c.adapter.prepare(c.input)
  if (prepared instanceof Error) throw prepared
  expect(prepared.evidence.map((item) => item.id)).toEqual(["first", "second"])
  expect(
    await c.database
      .batch([
        ...prepared.guards,
        ...prepared.effects,
        c.database.prepare("SELECT abs(-9223372036854775808)"),
      ])
      .catch((cause: unknown) => cause),
  ).toBeInstanceOf(Error)
  for (const id of c.input.attachmentIds)
    expect(await c.attachments.findById(id)).toMatchObject({ status: "pending", linkedAt: null })
  await c.database.batch([...prepared.guards, ...prepared.effects])
  for (const id of c.input.attachmentIds)
    expect(await c.attachments.findById(id)).toMatchObject({ status: "linked" })
  const linked = await c.adapter.prepare({
    ...c.input,
    linkedAttachmentIds: new Set(c.input.attachmentIds),
    expected: prepared.evidence,
  })
  if (linked instanceof Error) throw linked
  expect(linked.effects).toEqual([])
  await c.database.batch([...linked.guards])
})

test("準備後の添付差し替えを保存時の検査で拒否する", async () => {
  const c = await fixture()
  const prepared = await c.adapter.prepare(c.input)
  if (prepared instanceof Error) throw prepared
  await c.database
    .prepare("UPDATE system_attachments SET plaintext_sha256 = ?1 WHERE id = 'second'")
    .bind("b".repeat(64))
    .run()
  expect(
    await c.database
      .batch([...prepared.guards, ...prepared.effects])
      .catch((cause: unknown) => cause),
  ).toBeInstanceOf(Error)
  expect(await c.attachments.findById("first")).toMatchObject({ status: "pending" })
  expect(await c.adapter.prepare({ ...c.input, expected: prepared.evidence })).toBeInstanceOf(Error)
})

test("重複・他人・未来の添付と欠けた確認対象を拒否する", async () => {
  const c = await fixture()
  expect(await c.adapter.prepare({ ...c.input, attachmentIds: ["first", "first"] })).toBeInstanceOf(
    Error,
  )
  expect(await c.adapter.prepare({ ...c.input, ownerAccountId: "another" })).toBeInstanceOf(Error)
  expect(
    await c.adapter.prepare({ ...c.input, at: new Date(c.input.at.getTime() - 1) }),
  ).toBeInstanceOf(Error)
  expect(await c.adapter.prepare({ ...c.input, expected: [] })).toBeInstanceOf(Error)
})
