import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { testAccountId, testDerivedId } from "@system/test/system-test-id.test-support"
import { z } from "zod"
import { CaptureLinkedAttachmentRecordAdapter } from "@system/infrastructure/adapters/records/capture-linked-attachment-record.adapter"
import { AttachmentRecordContentValue } from "@system/domain/values/records/attachment-record-content.value"
import { PrepareAttachmentContentReadGuardAdapter } from "@system/infrastructure/adapters/attachments/prepare-attachment-content-read-guard.adapter"
import { preparePreservedRecordWriteAuthorization } from "@system/interface/authorization/prepare-preserved-record-write-authorization"
import { StartSystemProcedure } from "@system/application/workflow/start-system-procedure"
import { ApproveSystemTask } from "@system/application/workflow/approve-system-task"
import { SystemD1WorkflowAdapter } from "@system/infrastructure/adapters/workflow/system-d1-workflow.adapter"
import { RevalidateSystemExecutionAttestationsAdapter } from "@system/infrastructure/adapters/workflow/revalidate-system-execution-attestations.adapter"
import { ExecutionAuthorizationEntity } from "@system/domain/entities/execution-authorization.entity"
import { RecordPreservationProposalValue } from "@system/domain/values/records/record-preservation-proposal.value"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { PreservedRecordDisclosurePolicyRepository } from "@system/infrastructure/repositories/records/preserved-record-disclosure-policy.repository"
import { DisclosePreservedRecordPersistenceAdapter } from "@system/infrastructure/adapters/records/disclose-preserved-record-persistence.adapter"
import { FinalizePreservedRecordPersistenceAdapter } from "@system/infrastructure/adapters/records/finalize-preserved-record-persistence.adapter"
import { GET as RECORD_CONTENT } from "@system/interface/routes/system.preserved-records.$recordId.content"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { SystemHTTPException } from "@system/interface/errors"
import { SystemAccessTokenIssuer } from "@system/lib/auth/system-access-token-issuer"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { DisclosePreservedRecordContent } from "@system/application/records/disclose-preserved-record-content"
import { FinalizePreservedRecord } from "@system/application/records/finalize-preserved-record"
import { PreservedRecordDisclosurePolicyEntity } from "@system/domain/entities/preserved-record-disclosure-policy.entity"
import { AttachmentPreservationEntity } from "@system/domain/entities/attachment-preservation.entity"
import { readFileSync } from "node:fs"
import { VerifyPreservedRecordContentAdapter } from "@system/infrastructure/adapters/records/verify-preserved-record-content.adapter"
import { PreservedRecordEntity } from "@system/domain/entities/preserved-record.entity"
import { PreservedRecordPayloadValue } from "@system/domain/values/records/preserved-record-payload.value"
import { StorePreservedRecordContent } from "@system/application/records/store-preserved-record-content"
import { decryptAttachment } from "@system/application/attachments/lib/decrypt-attachment"
import { AttachmentKekRegistry } from "@system/application/attachments/lib/attachment-kek-registry"
import { describe, expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"
import { StoreAttachment } from "@system/application/attachments/store-attachment"
import { AttachmentObjectAdapter } from "@system/infrastructure/adapters/attachments/attachment-object.adapter"
import { AttachmentAdapter } from "@system/infrastructure/adapters/attachments/attachment.adapter"
import { systemAttachmentSchema } from "@system/infrastructure/schema/system-attachment"
import { systemCoreSchema } from "@system/infrastructure/schema/system-core"
import { createSystemAttachmentTestDatabase } from "@system/test/create-system-attachment-test-database.test-support"
import { createSystemAttachmentTestKekEnvironment } from "@system/test/create-system-attachment-test-kek-environment.test-support"
import { SystemAttachmentTestBucket } from "@system/test/system-attachment-test-bucket.test-support"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const ownerAccountId = testAccountId("acc_owner")

const now = new Date("2026-08-20T09:00:00.000Z")

function receiptBytes(): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode("%PDF-1.7 領収書 12,800円 タクシー")
}

async function createContext(
  bucket: SystemAttachmentTestBucket,
  kekEnv: string = createSystemAttachmentTestKekEnvironment(1),
) {
  const db = await createSystemAttachmentTestDatabase()

  return {
    var: { database: drizzle(db, { schema: { ...systemCoreSchema, ...systemAttachmentSchema } }) },
    env: { DB: db, ATTACHMENTS: bucket as unknown as R2Bucket, ATTACHMENT_KEKS: kekEnv },
  }
}

describe("添付の保管と取り出し", () => {
  test("保管すると pending になり、object storage には暗号文だけが置かれる", async () => {
    const bucket = new SystemAttachmentTestBucket()

    const context = await createContext(bucket)

    const plaintext = receiptBytes()

    const stored = await new StoreAttachment(context).run({
      ownerAccountId,
      fileName: "領収書.pdf",
      contentType: "application/pdf",
      content: plaintext,
      now,
    })

    if (stored instanceof Error) throw stored

    expect(stored.byteSize).toBe(plaintext.byteLength)

    const row = await new AttachmentAdapter(context).findById(stored.id)

    if (row instanceof Error || row === null) throw new Error("行が無い")

    expect(row.status).toBe("pending")
    expect(row.ownerAccountId).toBe(ownerAccountId)
    expect(row.objectKey).toBe(`att/${stored.id}`)

    // object key にファイル名を含めない（ファイル名自体が個人情報になり得る）
    expect(row.objectKey).not.toContain("領収書")
    expect(bucket.keys()).toEqual([`att/${stored.id}`])

    const bytes = bucket.storedBytes(`att/${stored.id}`)

    if (bytes === null) throw new Error("本体が無い")

    expect(bytes).not.toEqual(plaintext)
    expect(new TextDecoder().decode(bytes)).not.toContain("領収書")
  })

  test("許可していない形式と上限超過を拒否する", async () => {
    const bucket = new SystemAttachmentTestBucket()

    const context = await createContext(bucket)

    const rejectedType = await new StoreAttachment(context).run({
      ownerAccountId,
      fileName: "script.exe",
      contentType: "application/octet-stream",
      content: receiptBytes(),
      now,
    })

    expect(rejectedType).toBeInstanceOf(Error)

    const rejectedSize = await new StoreAttachment(context).run({
      ownerAccountId,
      fileName: "huge.pdf",
      contentType: "application/pdf",
      content: new Uint8Array(25 * 1024 * 1024 + 1),
      now,
    })

    expect(rejectedSize).toBeInstanceOf(Error)

    // 拒否したものは object storage にも行にも残らない
    expect(bucket.size()).toBe(0)
  })

  test("KEK 未設定では保管も取り出しもできない", async () => {
    const bucket = new SystemAttachmentTestBucket()

    const context = {
      ...(await createContext(bucket)),
      env: { ATTACHMENTS: bucket as unknown as R2Bucket, ATTACHMENT_KEKS: undefined },
    }

    const stored = await new StoreAttachment(context).run({
      ownerAccountId,
      fileName: "領収書.pdf",
      contentType: "application/pdf",
      content: receiptBytes(),
      now,
    })

    expect(stored).toBeInstanceOf(Error)
  })
})

describe("業務レコードへの紐づけ", () => {})

test("同じ保存先への再書き込みと競合は元の暗号文を上書きしない", async () => {
  const bucket = new SystemAttachmentTestBucket()
  const adapter = new AttachmentObjectAdapter(await createContext(bucket))
  const original = new Uint8Array([1, 2, 3])
  const replacement = new Uint8Array([4, 5, 6])
  const results = await Promise.all([
    adapter.put("att/immutable-object", original),
    adapter.put("att/immutable-object", replacement),
  ])
  expect(results.filter((result) => result instanceof Error)).toHaveLength(1)
  expect(bucket.storedBytes("att/immutable-object")).toEqual(original)
  expect(await adapter.put("att/immutable-object", original)).toBeInstanceOf(Error)
  expect(bucket.storedBytes("att/immutable-object")).toEqual(original)
})

test("原記録の本文と不足する来歴を暗号化保存し、空の元ファイルも復元できる", async () => {
  for (const fixture of [
    {
      text: "abc",
      digest: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      base64: "YWJj",
    },
    {
      text: "",
      digest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      base64: "",
    },
  ]) {
    const bucket = new SystemAttachmentTestBucket()
    const context = await createContext(bucket)
    const source = {
      sourceNamespace: "source-tenant-1",
      ownerContext: "sample-records",
      recordKind: "record",
      recordId: "original-1",
      formatId: "sample-record",
      formatVersion: 1,
      sourceRevision: null,
      sourceRecordedAt: null,
      capturedAt: now.toISOString(),
      contentDigest: fixture.digest,
    }
    const prepared = await new StorePreservedRecordContent(context).execute({
      source,
      content: new TextEncoder().encode(fixture.text),
      ownerAccountId,
      now,
    })
    if (prepared instanceof Error) throw prepared
    const row = await new AttachmentAdapter(context).findById(prepared.attachment.id)
    if (row === null || row instanceof Error) throw new Error("missing prepared attachment")
    expect(row.status).toBe("pending")
    const recordInput = {
      id: crypto.randomUUID(),
      source,
      attachmentId: row.id,
      attachmentDigest: row.plaintextSha256,
      preservationId: crypto.randomUUID(),
      disclosurePolicyId: crypto.randomUUID(),
      disclosurePolicyRevision: 1,
      sourceAuthorizationRef: {
        context: "sample-records",
        kind: "export-grant",
        id: "grant-1",
        version: "1",
      },
      actorAccountId: ownerAccountId,
      finalizedAt: now.toISOString(),
      reason: "Preserve original",
      auditEventId: crypto.randomUUID(),
    }
    const record = PreservedRecordEntity.create(recordInput)
    if (record instanceof Error) throw record
    const verified = await new VerifyPreservedRecordContentAdapter(context).execute(
      record,
      "pending",
    )
    if (verified instanceof Error) throw verified
    expect(new TextDecoder().decode(verified.payload.content.toBytes())).toBe(fixture.text)
    for (const mismatch of [
      { ...recordInput, actorAccountId: "5a1002aa-114b-4590-b6a2-708821897ee7" },
      { ...recordInput, attachmentDigest: "f".repeat(64) },
      { ...recordInput, source: { ...source, sourceNamespace: "other-source" } },
      { ...recordInput, source: { ...source, sourceRevision: "invented-revision" } },
    ]) {
      const different = PreservedRecordEntity.create(mismatch)
      if (different instanceof Error) throw different
      expect(
        await new VerifyPreservedRecordContentAdapter(context).execute(different, "pending"),
      ).toBeInstanceOf(Error)
    }
    const ciphertext = await new AttachmentObjectAdapter(context).get(row.objectKey)
    if (ciphertext instanceof Error) throw ciphertext
    const registry = AttachmentKekRegistry.fromEnv(context.env.ATTACHMENT_KEKS)
    if (registry instanceof Error) throw registry
    if (row.wrappedDek === null || row.wrappedDekIv === null)
      throw new Error("prepared content key is unavailable")
    const decoded = await decryptAttachment(
      ciphertext,
      {
        wrappedDek: row.wrappedDek,
        wrappedDekIv: row.wrappedDekIv,
        contentIv: row.contentIv,
        kekVersion: row.kekVersion,
      },
      registry.current(),
    )
    if (decoded instanceof Error) throw decoded
    expect(new TextDecoder().decode(ciphertext)).not.toContain("source-tenant-1")
    const restored = await PreservedRecordPayloadValue.restore(decoded, prepared.source, "binary")
    if (restored instanceof Error) throw restored
    expect(new TextDecoder().decode(restored.content.toBytes())).toBe(fixture.text)
    expect(new TextDecoder().decode(decoded.subarray(0, 4))).toBe("RCP2")
    expect(restored.source.props).toEqual(source)
    const ordinaryUpload = await new StoreAttachment(context).run({
      ownerAccountId,
      fileName: "record.json",
      contentType: prepared.attachment.contentType,
      content: decoded,
      now,
    })
    expect(ordinaryUpload).toBeInstanceOf(Error)
    expect(bucket.size()).toBe(1)
    await bucket.put(row.objectKey, new Uint8Array([1, 2, 3]).buffer)
    expect(
      await new VerifyPreservedRecordContentAdapter(context).execute(record, "pending"),
    ).toBeInstanceOf(Error)
    expect(await new AttachmentAdapter(context).findById(row.id)).toMatchObject({
      status: "pending",
    })
  }
})

test("encrypted original is verified before atomic finalization and failed source authority leaves it pending", async () => {
  const now = new Date()
  for (const scenario of [
    "purge-before-submission",
    "denied",
    "allowed",
    "allowed-attachment",
    "revoked-during-read",
    "reviewer-suspended-during-read",
    "permission-revoked-during-read",
  ]) {
    const allowed = scenario === "allowed" || scenario === "allowed-attachment"
    const bucket = new SystemAttachmentTestBucket()
    const context = await createContext(bucket)
    await execSql(
      context.env.DB,
      readFileSync(
        new URL("../infrastructure/schema/system-record-preservation.sql", import.meta.url),
        "utf8",
      ),
    )
    await execSql(
      context.env.DB,
      `CREATE TABLE test_source_authority (allowed INTEGER); INSERT INTO test_source_authority VALUES (${Number(scenario !== "denied")})`,
    )
    const captureBytes = await (async () => {
      const bytes = new TextEncoder().encode("abc")
      if (scenario !== "allowed-attachment") return bytes
      const attachment = await AttachmentRecordContentValue.create(
        {
          id: "source-1",
          fileName: "原本 '件'.pdf",
          contentType: "application/pdf",
          byteSize: bytes.byteLength,
          sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
          ownerAccountId,
          createdAt: now.toISOString(),
          linkedAt: now.toISOString(),
        },
        bytes,
      )
      if (attachment instanceof Error) throw attachment
      const encoded = attachment.toBytes()
      if (encoded instanceof Error) throw encoded
      return encoded
    })()
    const captureDigest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", captureBytes))]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
    const prepared = await new StorePreservedRecordContent(context).execute({
      source: {
        sourceNamespace: "sample-source",
        ownerContext: "sample-records",
        recordKind: "record",
        recordId: "source-1",
        formatId: scenario === "allowed-attachment" ? "system-attachment-record" : "sample-record",
        formatVersion: 1,
        sourceRevision: null,
        sourceRecordedAt: null,
        capturedAt: now.toISOString(),
        contentDigest: captureDigest,
      },
      content: captureBytes,
      ownerAccountId,
      now,
    })
    if (prepared instanceof Error) throw prepared
    const row = await new AttachmentAdapter(context).findById(prepared.attachment.id)
    if (row instanceof Error || row === null) throw new Error("missing pending attachment")
    const record = PreservedRecordEntity.create({
      id: crypto.randomUUID(),
      source: prepared.source.props,
      attachmentId: row.id,
      attachmentDigest: row.plaintextSha256,
      preservationId: crypto.randomUUID(),
      disclosurePolicyId: crypto.randomUUID(),
      disclosurePolicyRevision: 1,
      sourceAuthorizationRef: {
        context: "sample-records",
        kind: "export-grant",
        id: "grant-1",
        version: "1",
      },
      actorAccountId: ownerAccountId,
      finalizedAt: now.toISOString(),
      reason: "Preserve original",
      auditEventId: crypto.randomUUID(),
    })
    if (record instanceof Error) throw record
    const disclosure = PreservedRecordDisclosurePolicyEntity.create({
      id: record.snapshot.disclosurePolicyId,
      revision: 1,
      recordId: record.snapshot.id,
      status: "active",
      publishedAt: now.toISOString(),
      actorAccountId: ownerAccountId,
      reason: "Authorized preservation",
      auditEventId: crypto.randomUUID(),
      grants: [
        ...["agent", "service", "connector"].map((kind) => ({
          accountId: testAccountId(`reader-${kind}`),
          actions: ["read"],
          purposes: ["review"],
          validFrom: now.toISOString(),
          validUntil: null,
        })),
        {
          accountId: "eb2aaac2-352f-4196-8e01-adea61c54466",
          actions: ["read"],
          purposes: ["review"],
          validFrom: now.toISOString(),
          validUntil: new Date(now.getTime() + 3600000).toISOString(),
        },
        {
          accountId: "8c7435a1-1641-435b-90f2-a437ade56f20",
          actions: ["export"],
          purposes: ["archive"],
          validFrom: now.toISOString(),
          validUntil: null,
        },
      ],
    })
    if (disclosure instanceof Error) throw disclosure
    const preservation = AttachmentPreservationEntity.create({
      id: record.snapshot.preservationId,
      attachmentId: row.id,
      sha256: row.plaintextSha256,
      kind: "hold",
      retainUntil: null,
      reason: "Preserve original",
      actorAccountId: ownerAccountId,
      createdAt: now.toISOString(),
      auditEventId: crypto.randomUUID(),
      revision: 1,
      release: null,
    })
    if (preservation instanceof Error) throw preservation
    for (const schema of [
      "system-decision-policy",
      "system-procedure-delegation",
      "system-human-decision",
    ])
      await execSql(
        context.env.DB,
        readFileSync(new URL(`../infrastructure/schema/${schema}.sql`, import.meta.url), "utf8"),
      )
    for (const accountId of [ownerAccountId, "95968d87-d176-408a-95b6-f974400b253b"]) {
      await context.env.DB.prepare(
        "INSERT INTO system_accounts(id,status,created_at,updated_at) VALUES (?1,'active',0,0)",
      )
        .bind(accountId)
        .run()
      await context.env.DB.prepare(
        "INSERT INTO system_principals(id,account_id,kind,name,revision,created_at,updated_at) VALUES (?1,?2,'human',?2,1,0,0)",
      )
        .bind(testDerivedId("principal", accountId), accountId)
        .run()
    }
    await execSql(
      context.env.DB,
      `INSERT INTO system_procedure_definitions(key,current_revision,status,created_at,updated_at) VALUES ('record-preservation',1,'active',0,0);
      INSERT INTO system_procedure_definition_revisions(procedure_key,revision,title,category,input_schema_json,decision_policy_json,created_by_account_id,created_at)
      VALUES ('record-preservation',1,'Preserve records','operation','{}','{}','${ownerAccountId}',0)`,
    )
    const proposal = await RecordPreservationProposalValue.fromRequest({
      request: {
        reason: record.snapshot.reason,
        preservation: {
          kind: preservation.snapshot.kind,
          retainUntil: preservation.snapshot.retainUntil,
          reason: preservation.snapshot.reason,
        },
        disclosure: {
          reason: disclosure.snapshot.reason,
          grants: disclosure.snapshot.grants,
        },
      },
      recordId: record.snapshot.id,
      source: prepared.source,
      actorAccountId: ownerAccountId,
      attachmentId: row.id,
      attachmentDigest: row.plaintextSha256,
      sourceAuthorizationRef: record.snapshot.sourceAuthorizationRef,
      preservationId: preservation.snapshot.id,
      disclosurePolicyId: disclosure.snapshot.id,
    })
    if (proposal instanceof Error) throw proposal
    const later = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
    const threshold = new Date(later.getTime() - 24 * 60 * 60 * 1000)
    const beforeSubmission = await new AttachmentAdapter(context).listStaleUnlinked(
      threshold,
      100,
      later,
    )
    if (beforeSubmission instanceof Error) throw beforeSubmission
    expect(beforeSubmission.map((attachment) => attachment.id)).toContain(row.id)
    const verifiedForSubmission = await new VerifyPreservedRecordContentAdapter(context).execute(
      record,
      "pending",
    )
    if (verifiedForSubmission instanceof Error) throw verifiedForSubmission
    const submissionGuard = new PrepareAttachmentContentReadGuardAdapter(context).prepare(
      verifiedForSubmission.attachment,
      now,
      "pending",
    )
    if (scenario === "purge-before-submission") {
      const claimed = await new AttachmentAdapter(context).claimUnlinkedPurge(
        row.id,
        threshold,
        later,
      )
      if (claimed instanceof Error || claimed === null)
        throw new Error("purge did not claim pending attachment")
      expect(claimed.status).toBe("erased")
    }
    const writer = new SystemD1WorkflowAdapter({ ...context, startGuards: [submissionGuard] })
    const started = await new StartSystemProcedure({ writer }).run({
      seriesId: crypto.randomUUID(),
      version: 1,
      procedureKey: "record-preservation",
      procedureRevision: 1,
      body: JSON.parse(proposal.props.canonical.toString()),
      createdByAccountId: zAccountId.parse(ownerAccountId),
      supersedesProposalId: null,
      createdAt: now,
      subject: {
        context: "system",
        kind: "record-preservation",
        id: record.snapshot.id,
        version: "1",
      },
      firstTask: {
        key: "review",
        requiredApprovals: 1,
        openedAt: now,
        dueAt: null,
        excludedAccountIds: [zAccountId.parse(ownerAccountId)],
        candidates: [
          {
            accountId: zAccountId.parse("95968d87-d176-408a-95b6-f974400b253b"),
            source: "primary",
            evidenceContext: "sample-source",
            evidenceKind: "qualification",
            evidenceId: "preservation-reviewer",
            evidenceVersion: "1",
            eligibilityDigest: proposal.props.digest.toString(),
            eligibleFrom: null,
            resolvedAt: now,
          },
        ],
      },
    })
    if (scenario === "purge-before-submission") {
      expect(started).toBeInstanceOf(Error)
      expect(
        await context.env.DB.prepare(
          "SELECT count(*) AS count FROM system_proposals",
        ).first<number>("count"),
      ).toBe(0)
      expect(
        await context.env.DB.prepare("SELECT count(*) AS count FROM system_cases").first<number>(
          "count",
        ),
      ).toBe(0)
      expect(
        await context.env.DB.prepare(
          "SELECT count(*) AS count FROM system_decision_tasks",
        ).first<number>("count"),
      ).toBe(0)
      continue
    }
    if (started instanceof Error) throw started
    expect(started.proposal.digest).toBe(proposal.props.digest.toString())
    const stale = await new AttachmentAdapter(context).listStaleUnlinked(threshold, 100, later)
    if (stale instanceof Error) throw stale
    expect(stale.map((attachment) => attachment.id)).not.toContain(row.id)
    expect(
      await new AttachmentAdapter(context).claimUnlinkedPurge(row.id, threshold, later),
    ).toBeNull()
    const approved = await new ApproveSystemTask(writer).execute({
      caseId: started.workflowCase.id,
      taskKey: "review",
      round: 1,
      actorAccountId: zAccountId.parse("95968d87-d176-408a-95b6-f974400b253b"),
      representedAccountId: zAccountId.parse("95968d87-d176-408a-95b6-f974400b253b"),
      delegationId: null,
      proposalDigest: started.proposal.digest,
      comment: "Preserve original evidence",
      decidedAt: now,
      nextTask: null,
    })
    expect(approved).toEqual({ caseStatus: "approved", taskOutcome: "approved" })
    const executionEvidence = await new RevalidateSystemExecutionAttestationsAdapter(
      context,
    ).prepare({ caseId: started.workflowCase.id, executedAt: now })
    if (executionEvidence instanceof Error) throw executionEvidence
    expect(executionEvidence.attestations).toHaveLength(1)
    const authorization = ExecutionAuthorizationEntity.create({
      id: crypto.randomUUID(),
      caseId: started.workflowCase.id,
      operationKey: "system.record.preserve",
      proposalDigest: started.proposal.digest,
      grantedToAccountId: ownerAccountId,
      grantedAt: now,
      expiresAt: new Date(now.getTime() + 3600000),
      usedAt: null,
    })
    if (authorization instanceof Error) throw authorization
    await execSql(
      context.env.DB,
      "INSERT INTO system_iam_roles(id,key,kind,name,created_at,updated_at) VALUES ('2c36a869-fdde-4a95-833c-90b9186dc1ab','record:preserver','custom','Preserver',0,0); INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('2c36a869-fdde-4a95-833c-90b9186dc1ab','system:record:preserve')",
    )
    await context.env.DB.prepare(
      "INSERT INTO system_role_bindings(id,account_id,role_id,created_at) VALUES ('e1e36e78-8919-432e-8884-16b1257ecdc1',?1,'2c36a869-fdde-4a95-833c-90b9186dc1ab',0)",
    )
      .bind(ownerAccountId)
      .run()
    const technical = await preparePreservedRecordWriteAuthorization(context, {
      authentication: {
        accountId: zAccountId.parse(ownerAccountId),
        tokenVersion: 0,
        issuedAtMs: now.getTime(),
        expiresAtMs: now.getTime() + 3600000,
        machineCredentialId: null,
        identityBindingId: null,
      },
      at: now,
    })
    if (technical === null || technical instanceof Error)
      throw new Error("missing preservation permission")
    const technicalGuards = technical.assertions(now)
    if (technicalGuards instanceof Error) throw technicalGuards
    const application = new FinalizePreservedRecord({
      ...context,
      persistence: new FinalizePreservedRecordPersistenceAdapter({
        ...context,
        authorization,
        executionGuards: [executionEvidence.guard],
        assertions: [
          context.env.DB.prepare(
            "SELECT CASE WHEN (SELECT allowed FROM test_source_authority) = 1 THEN 1 ELSE json_extract('', '$') END",
          ),
          ...technicalGuards,
        ],
      }),
    })
    const getObject = bucket.get.bind(bucket)
    const reads: string[] = []
    const read = spyOn(bucket, "get").mockImplementation(async (key) => {
      reads.push(key)
      const object = await getObject(key)
      if (scenario === "revoked-during-read")
        await execSql(context.env.DB, "UPDATE test_source_authority SET allowed = 0")
      if (scenario === "permission-revoked-during-read")
        await execSql(
          context.env.DB,
          "DELETE FROM system_iam_role_permissions WHERE role_id = '2c36a869-fdde-4a95-833c-90b9186dc1ab'",
        )
      if (scenario === "reviewer-suspended-during-read")
        await context.env.DB.prepare(
          "UPDATE system_accounts SET status = 'suspended', token_version = token_version + 1, updated_at = ?1 WHERE id = '95968d87-d176-408a-95b6-f974400b253b' AND status = 'active'",
        )
          .bind(now.getTime())
          .run()
      return object
    })
    const attempts = await Promise.all([
      application.execute({ record, disclosure, preservation }),
      application.execute({ record, disclosure, preservation }),
    ])
    read.mockRestore()
    if (scenario === "denied") expect(reads).toHaveLength(0)
    else expect(reads.length).toBeGreaterThan(0)
    for (const completed of attempts) expect(completed instanceof Error).toBe(!allowed)
    if (allowed) {
      expect(await application.execute({ record, disclosure, preservation })).toEqual(record)
      const approvedIntent = await RecordPreservationProposalValue.restore(started.proposal.body)
      if (approvedIntent instanceof Error) throw approvedIntent
      const replay = approvedIntent.toFinalization({
        actorAccountId: ownerAccountId,
        at: new Date(now.getTime() + 1000),
      })
      if (replay instanceof Error) throw replay
      expect(await application.execute(replay)).toEqual(record)

      const changedPolicy = PreservedRecordDisclosurePolicyEntity.create({
        ...disclosure.snapshot,
        reason: "Changed disclosure intent",
      })
      if (changedPolicy instanceof Error) throw changedPolicy
      expect(
        await application.execute({ record, disclosure: changedPolicy, preservation }),
      ).toBeInstanceOf(Error)
      const changedHold = AttachmentPreservationEntity.create({
        ...preservation.snapshot,
        reason: "Changed retention intent",
      })
      if (changedHold instanceof Error) throw changedHold
      expect(
        await application.execute({ record, disclosure, preservation: changedHold }),
      ).toBeInstanceOf(Error)
      const clock = { at: now }
      const reader = new DisclosePreservedRecordContent({
        ...context,
        accountId: "eb2aaac2-352f-4196-8e01-adea61c54466",
        now: () => clock.at,
        persistence: new DisclosePreservedRecordPersistenceAdapter({
          ...context,
          assertions: [
            context.env.DB.prepare(
              "SELECT CASE WHEN (SELECT allowed FROM test_source_authority) = 1 THEN 1 ELSE json_extract('', '$') END",
            ),
          ],
        }),
      })
      const request = { recordId: record.snapshot.id, action: "read", purpose: "review" }
      expect(await reader.execute({ ...request, action: "export" })).toBeInstanceOf(Error)
      expect(await reader.execute({ ...request, purpose: "other" })).toBeInstanceOf(Error)
      const original = await reader.execute(request)
      if (original instanceof Error) throw original
      expect(original.content).toEqual(captureBytes)
      expect(original.source.sourceRecordedAt).toBeNull()
      const exporter = new DisclosePreservedRecordContent({
        ...context,
        accountId: "8c7435a1-1641-435b-90f2-a437ade56f20",
        now: () => clock.at,
        persistence: new DisclosePreservedRecordPersistenceAdapter({
          ...context,
          assertions: [
            context.env.DB.prepare(
              "SELECT CASE WHEN (SELECT allowed FROM test_source_authority) = 1 THEN 1 ELSE json_extract('', '$') END",
            ),
          ],
        }),
      })
      expect(await exporter.execute(request)).toBeInstanceOf(Error)
      const exported = await exporter.execute({
        recordId: record.snapshot.id,
        action: "export",
        purpose: "archive",
      })
      if (exported instanceof Error) throw exported
      expect(exported.content).toEqual(captureBytes)
      await execSql(
        context.env.DB,
        "INSERT INTO system_accounts (id,status,token_version,created_at,updated_at) VALUES ('eb2aaac2-352f-4196-8e01-adea61c54466','active',0,100,100); INSERT INTO system_principals(id,account_id,kind,name,revision,created_at,updated_at) VALUES ('61c03c32-b3c6-41c8-861f-f84868b70c5c','eb2aaac2-352f-4196-8e01-adea61c54466','human','Viewer',1,100,100); INSERT INTO system_iam_roles(id,key,kind,name,created_at,updated_at) VALUES ('6d947d9f-a028-4025-8113-1d4d9d300ea2','record:reader','custom','Reader',100,100); INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('6d947d9f-a028-4025-8113-1d4d9d300ea2','system:record:read'); INSERT INTO system_role_bindings(id,account_id,role_id,created_at) VALUES ('dfd5bbdb-f9ff-47b9-8287-6e97e4e2486a','eb2aaac2-352f-4196-8e01-adea61c54466','6d947d9f-a028-4025-8113-1d4d9d300ea2',100)",
      )
      const secret = "record-http-test-secret-only"
      const token = await new SystemAccessTokenIssuer(secret).issue({
        accountId: zAccountId.parse("eb2aaac2-352f-4196-8e01-adea61c54466"),
        tokenVersion: 0,
        now,
      })
      if (token instanceof Error) throw token
      const http = systemFactory
        .createApp()
        .use("*", async (c, next) => {
          c.set("now", () => clock.at)
          c.set("database", context.var.database)
          await next()
        })
        .get("/system/preserved-records/:recordId/content", ...RECORD_CONTENT)
        .onError((error, c) => {
          if (error instanceof SystemHTTPException)
            return c.json({ error: error.code }, error.status)
          return c.json({ error: "unexpected" }, 500)
        })
      const endpoint = `/system/preserved-records/${record.snapshot.id}/content?action=read&purpose=review`
      const environment = { ...context.env, JWT_SECRET: secret }
      const headers = { authorization: `Bearer ${token}` }
      expect((await http.request(endpoint, {}, environment)).status).toBe(401)
      expect(
        (
          await http.request(
            endpoint.replace("action=read", "action=export"),
            { headers },
            environment,
          )
        ).status,
      ).toBe(403)
      expect(
        (
          await http.request(
            endpoint.replace("purpose=review", "purpose=other"),
            { headers },
            environment,
          )
        ).status,
      ).toBe(403)
      const response = await http.request(endpoint, { headers }, environment)
      expect(response.status).toBe(200)
      expect(response.headers.get("cache-control")).toBe("no-store")
      expect(response.headers.get("content-type")).toBe("application/octet-stream")
      expect(response.headers.get("x-content-type-options")).toBe("nosniff")
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(captureBytes)
      const file = await http.request(`${endpoint}&format=attachment`, { headers }, environment)
      if (scenario === "allowed-attachment") {
        expect(file.status).toBe(200)
        expect(file.headers.get("content-type")).toBe("application/pdf")
        expect(file.headers.get("content-disposition")).toBe(
          "attachment; filename*=UTF-8''%E5%8E%9F%E6%9C%AC%20%27%E4%BB%B6%27.pdf",
        )
        expect(file.headers.get("cache-control")).toBe("no-store")
        expect(file.headers.get("x-content-type-options")).toBe("nosniff")
        expect(await file.text()).toBe("abc")
        const restoreAttachment = AttachmentRecordContentValue.restore.bind(
          AttachmentRecordContentValue,
        )
        const revoke = spyOn(AttachmentRecordContentValue, "restore").mockImplementation(
          async (bytes) => {
            const decoded = await restoreAttachment(bytes)
            await execSql(
              context.env.DB,
              "DELETE FROM system_iam_role_permissions WHERE role_id='6d947d9f-a028-4025-8113-1d4d9d300ea2' AND permission_key='system:record:read'",
            )
            return decoded
          },
        )
        try {
          const denied = await http.request(
            `${endpoint}&format=attachment`,
            { headers },
            environment,
          )
          expect(denied.status).toBe(503)
          expect(z.strictObject({ error: z.string() }).parse(await denied.json())).toEqual({
            error: "preserved_record_unavailable",
          })
        } finally {
          revoke.mockRestore()
          await execSql(
            context.env.DB,
            "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('6d947d9f-a028-4025-8113-1d4d9d300ea2','system:record:read')",
          )
        }
      } else {
        expect(file.status).toBe(400)
      }
      for (const kind of ["agent", "service", "connector"]) {
        const accountId = testAccountId(`reader-${kind}`)
        const credentialId = testDerivedId("credential", kind)
        if (kind === "connector")
          await execSql(
            context.env.DB,
            "INSERT INTO system_connectors(id,key,name,direction,transport,status,revision,created_at,updated_at) VALUES ('record-connector','record-connector','Record connector','bidirectional','api','active',1,100,100)",
          )
        await context.env.DB.prepare(
          "INSERT INTO system_accounts(id,status,token_version,created_at,updated_at) VALUES (?1,'active',0,100,100)",
        )
          .bind(accountId)
          .run()
        await context.env.DB.prepare(
          "INSERT INTO system_principals(id,account_id,kind,name,connector_id,revision,created_at,updated_at) VALUES (?1,?1,?2,'Reader',?3,1,100,100)",
        )
          .bind(accountId, kind, kind === "connector" ? "record-connector" : null)
          .run()
        await context.env.DB.prepare(
          "INSERT INTO system_machine_credentials(id,principal_id,name,secret_hash,status,created_at,updated_at,last_used_at,expires_at) VALUES (?1,?2,'Reader credential',?3,'active',100,?4,?4,?5)",
        )
          .bind(
            credentialId,
            accountId,
            ["agent", "service", "connector"].indexOf(kind).toString(16).repeat(64),
            now.getTime(),
            now.getTime() + 60000,
          )
          .run()
        await context.env.DB.prepare(
          "INSERT INTO system_role_bindings(id,account_id,role_id,created_at) VALUES (?2,?1,'6d947d9f-a028-4025-8113-1d4d9d300ea2',100)",
        )
          .bind(accountId, crypto.randomUUID())
          .run()
        const machineToken = await new SystemAccessTokenIssuer(secret).issue({
          accountId: zAccountId.parse(accountId),
          tokenVersion: 0,
          machineCredentialId: credentialId,
          now,
        })
        if (machineToken instanceof Error) throw machineToken
        const machineHeaders = { authorization: `Bearer ${machineToken}` }
        const machineResponse = await http.request(
          endpoint,
          { headers: machineHeaders },
          environment,
        )
        expect(machineResponse.status).toBe(200)
        expect(new Uint8Array(await machineResponse.arrayBuffer())).toEqual(captureBytes)
        await context.env.DB.prepare(
          "UPDATE system_machine_credentials SET status='revoked', revoked_at=?1 WHERE id=?2",
        )
          .bind(now.getTime(), credentialId)
          .run()
        expect(
          (await http.request(endpoint, { headers: machineHeaders }, environment)).status,
        ).toBe(401)
      }
      await execSql(
        context.env.DB,
        "DELETE FROM system_iam_role_permissions WHERE role_id = '6d947d9f-a028-4025-8113-1d4d9d300ea2'",
      )
      expect((await http.request(endpoint, { headers }, environment)).status).toBe(403)
      await execSql(
        context.env.DB,
        "INSERT INTO system_accounts(id,status,token_version,created_at,updated_at) VALUES ('8c7435a1-1641-435b-90f2-a437ade56f20','active',0,100,100); INSERT INTO system_principals(id,account_id,kind,name,revision,created_at,updated_at) VALUES ('88abcca4-7319-49cd-bcf3-468b4f6a5838','8c7435a1-1641-435b-90f2-a437ade56f20','human','Exporter',1,100,100); INSERT INTO system_iam_roles(id,key,kind,name,created_at,updated_at) VALUES ('a13faa42-3cc9-47ac-8400-e3d87f81a68d','record:exporter','custom','Exporter',100,100); INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('a13faa42-3cc9-47ac-8400-e3d87f81a68d','system:record:export'); INSERT INTO system_role_bindings(id,account_id,role_id,created_at) VALUES ('6367ff23-452a-4ff1-80db-73892719479a','8c7435a1-1641-435b-90f2-a437ade56f20','a13faa42-3cc9-47ac-8400-e3d87f81a68d',100)",
      )
      const exportToken = await new SystemAccessTokenIssuer(secret).issue({
        accountId: zAccountId.parse("8c7435a1-1641-435b-90f2-a437ade56f20"),
        tokenVersion: 0,
        now,
      })
      if (exportToken instanceof Error) throw exportToken
      const exportResponse = await http.request(
        `/system/preserved-records/${record.snapshot.id}/content?action=export&purpose=archive&format=package`,
        { headers: { authorization: `Bearer ${exportToken}` } },
        environment,
      )
      expect(exportResponse.status).toBe(200)
      expect(exportResponse.headers.get("content-type")).toBe(
        "application/vnd.record-preservation+json",
      )
      expect(exportResponse.headers.get("cache-control")).toBe("no-store")
      const packageBytes = new Uint8Array(await exportResponse.arrayBuffer())
      const restoredPackage = await PreservedRecordPayloadValue.restore(packageBytes, record.source)
      if (restoredPackage instanceof Error) throw restoredPackage
      expect(restoredPackage.content.toBytes()).toEqual(captureBytes)
      expect(restoredPackage.source.props.sourceRevision).toBeNull()
      expect(restoredPackage.source.props.sourceRecordedAt).toBeNull()
      expect(
        (await http.request(`${endpoint}&format=package`, { headers }, environment)).status,
      ).toBe(400)
      const originalGet = bucket.get.bind(bucket)
      const expire = spyOn(bucket, "get").mockImplementation(async (key) => {
        const object = await originalGet(key)
        clock.at = new Date(now.getTime() + 3600000)
        return object
      })
      try {
        expect(await reader.execute(request)).toBeInstanceOf(Error)
      } finally {
        expire.mockRestore()
        clock.at = now
      }
      await execSql(
        context.env.DB,
        "CREATE TRIGGER test_disclosure_audit_failure BEFORE INSERT ON system_audit_events WHEN NEW.action = 'system.record.disclosed' BEGIN SELECT RAISE(ABORT, 'test audit failure'); END;",
      )
      try {
        expect(await reader.execute(request)).toBeInstanceOf(Error)
      } finally {
        await execSql(context.env.DB, "DROP TRIGGER test_disclosure_audit_failure")
      }
      const revoke = spyOn(bucket, "get").mockImplementation(async (key) => {
        const object = await originalGet(key)
        await execSql(context.env.DB, "UPDATE test_source_authority SET allowed = 0")
        return object
      })
      try {
        expect(await reader.execute(request)).toBeInstanceOf(Error)
      } finally {
        revoke.mockRestore()
      }
      expect(await application.execute({ record, disclosure, preservation })).toBeInstanceOf(Error)
      await execSql(context.env.DB, "UPDATE test_source_authority SET allowed = 1")
      const revokedPolicy = PreservedRecordDisclosurePolicyEntity.create({
        ...disclosure.snapshot,
        revision: 2,
        status: "revoked",
        reason: "Withdraw disclosure",
        auditEventId: crypto.randomUUID(),
      })
      if (revokedPolicy instanceof Error) throw revokedPolicy
      const revocationAudit = SystemAuditEventEntity.restore({
        eventId: revokedPolicy.snapshot.auditEventId,
        actorAccountId: ownerAccountId,
        action: "system.record.disclosure_policy.published",
        targetType: "system:record-disclosure-policy",
        targetId: revokedPolicy.snapshot.id,
        outcome: "succeeded",
        reasonCode: null,
        authorizationJson: null,
        beforeJson: JSON.stringify(disclosure.snapshot),
        afterJson: JSON.stringify(revokedPolicy.snapshot),
        metadataJson: null,
        occurredAtEpochMilliseconds: now.getTime(),
      })
      if (revocationAudit instanceof Error) throw revocationAudit
      const revokePolicy = spyOn(bucket, "get").mockImplementation(async (key) => {
        const object = await originalGet(key)
        await context.env.DB.batch([
          ...new PreservedRecordDisclosurePolicyRepository({
            ...context,
            assertions: [context.env.DB.prepare("SELECT 1")],
          }).preparePublish(revokedPolicy, revocationAudit),
        ])
        return object
      })
      try {
        expect(await reader.execute(request)).toBeInstanceOf(Error)
        expect(revokePolicy).toHaveBeenCalledTimes(1)
      } finally {
        revokePolicy.mockRestore()
      }
    }
    expect(
      await context.env.DB.prepare(
        "SELECT count(*) AS count FROM system_execution_authorizations WHERE used_at IS NOT NULL",
      ).first<{ count: number }>(),
    ).toEqual({ count: Number(allowed) })
    expect(
      await context.env.DB.prepare("SELECT status FROM system_cases WHERE id = ?1")
        .bind(authorization.caseId)
        .first<{ status: string }>(),
    ).toEqual({ status: allowed ? "executed" : "approved" })
    const stored = await new AttachmentAdapter(context).findById(row.id)
    expect(stored).toMatchObject({ status: allowed ? "linked" : "pending" })
    expect(
      await context.env.DB.prepare("SELECT count(*) AS count FROM system_preserved_records").first<{
        count: number
      }>(),
    ).toEqual({ count: Number(allowed) })
    expect(
      await context.env.DB.prepare("SELECT count(*) AS count FROM system_audit_events").first<{
        count: number
      }>(),
    ).toEqual({ count: allowed ? (scenario === "allowed-attachment" ? 13 : 12) : 0 })
  }
})

test("25MiBの原記録を暗号化して準備し、保存実体から完全に読み戻せる", async () => {
  const bucket = new SystemAttachmentTestBucket()
  const context = await createContext(bucket)
  const content = new Uint8Array(25 * 1024 * 1024)
  content[0] = 255
  content[content.length - 1] = 128
  const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", content))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
  const prepared = await new StorePreservedRecordContent(context).execute({
    source: {
      sourceNamespace: "example-source",
      ownerContext: "sample-records",
      recordKind: "attachment",
      recordId: "original",
      formatId: "application/pdf",
      formatVersion: 1,
      sourceRevision: null,
      sourceRecordedAt: null,
      capturedAt: now.toISOString(),
      contentDigest: digest,
    },
    content,
    ownerAccountId,
    now,
  })
  if (prepared instanceof Error) throw prepared
  expect(prepared.attachment.byteSize).toBeGreaterThan(content.byteLength)
  expect(prepared.attachment.byteSize).toBeLessThan(content.byteLength + 16 * 1024 + 8)
  const record = PreservedRecordEntity.create({
    id: crypto.randomUUID(),
    source: prepared.source.props,
    attachmentId: prepared.attachment.id,
    attachmentDigest: prepared.attachment.plaintextSha256,
    preservationId: crypto.randomUUID(),
    disclosurePolicyId: crypto.randomUUID(),
    disclosurePolicyRevision: 1,
    sourceAuthorizationRef: {
      context: "sample-records",
      kind: "export-grant",
      id: "grant",
      version: "1",
    },
    actorAccountId: ownerAccountId,
    finalizedAt: now.toISOString(),
    reason: "Preserve original",
    auditEventId: crypto.randomUUID(),
  })
  if (record instanceof Error) throw record
  const verified = await new VerifyPreservedRecordContentAdapter(context).execute(record, "pending")
  if (verified instanceof Error) throw verified
  const restored = verified.payload.content.toBytes()
  expect(restored.byteLength).toBe(content.byteLength)
  expect(restored[0]).toBe(255)
  expect(restored[restored.length - 1]).toBe(128)
  expect(bucket.size()).toBe(1)
})

test("添付の名前と実体を一緒に保全候補へ固定し、取得後の変更で保存を戻す", async () => {
  const context = await createContext(new SystemAttachmentTestBucket())
  const stored = await new StoreAttachment(context).run({
    ownerAccountId,
    fileName: "original.pdf",
    contentType: "application/pdf",
    content: receiptBytes(),
    now,
  })
  if (stored instanceof Error) throw stored
  const input = {
    attachmentId: stored.id,
    sourceNamespace: "example-source",
    ownerContext: "sample-records",
    recordKind: "attachment",
  }
  const capture = new CaptureLinkedAttachmentRecordAdapter({
    ...context,
    now: () => now,
    assertions: [context.env.DB.prepare("SELECT 1")],
  })
  expect(await capture.prepare(input)).toBeInstanceOf(Error)
  const linked = await new AttachmentAdapter(context).markLinked(stored.id, now)
  if (linked instanceof Error) throw linked
  expect(
    await new CaptureLinkedAttachmentRecordAdapter({
      ...context,
      now: () => now,
      assertions: [],
    }).prepare(input),
  ).toBeInstanceOf(Error)
  const captured = await capture.prepare(input)
  if (captured instanceof Error) throw captured
  const original = await AttachmentRecordContentValue.restore(captured.content.toBytes())
  if (original instanceof Error) throw original
  expect(original.metadata).toMatchObject({
    id: stored.id,
    fileName: "original.pdf",
    contentType: "application/pdf",
    ownerAccountId,
    createdAt: now.toISOString(),
    linkedAt: now.toISOString(),
  })
  expect(original.contentBytes()).toEqual(receiptBytes())
  const preserved = await new StorePreservedRecordContent(context).execute({
    source: captured.source.props,
    content: captured.content.toBytes(),
    ownerAccountId,
    now,
  })
  if (preserved instanceof Error) throw preserved
  expect(preserved.source.props.contentDigest).toBe(captured.source.props.contentDigest)
  await execSql(
    context.env.DB,
    "CREATE TABLE attachment_capture_test_receipts (id TEXT PRIMARY KEY)",
  )
  await context.env.DB.prepare("UPDATE system_attachments SET file_name='renamed.pdf' WHERE id=?1")
    .bind(stored.id)
    .run()
  expect(
    await context.env.DB.batch([
      context.env.DB.prepare("INSERT INTO attachment_capture_test_receipts VALUES ('stale')"),
      ...captured.assertions,
    ]).catch((error: unknown) => error),
  ).toBeInstanceOf(Error)
  expect(
    await context.env.DB.prepare(
      "SELECT count(*) AS n FROM attachment_capture_test_receipts",
    ).first<number>("n"),
  ).toBe(0)
  const renamed = await capture.prepare(input)
  if (renamed instanceof Error) throw renamed
  expect(renamed.source.props.contentDigest).not.toBe(captured.source.props.contentDigest)
  expect(original.metadata.fileName).toBe("original.pdf")
})
