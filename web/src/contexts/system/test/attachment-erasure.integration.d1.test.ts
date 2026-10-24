import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { testAccountId, testDerivedId } from "@system/test/system-test-id.test-support"
import { readFileSync } from "node:fs"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"
import { StoreAttachment } from "@system/application/attachments/store-attachment"
import { CreateAttachmentPreservation } from "@system/application/attachments/create-attachment-preservation"
import { AttachmentErasureError } from "@system/application/attachments/errors"
import { decryptAttachment } from "@system/application/attachments/lib/decrypt-attachment"
import { AttachmentKekRegistry } from "@system/application/attachments/lib/attachment-kek-registry"
import { ApproveSystemTask } from "@system/application/workflow/approve-system-task"
import { RejectSystemTask } from "@system/application/workflow/reject-system-task"
import { StartSystemProcedure } from "@system/application/workflow/start-system-procedure"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { systemCaseIdSchema } from "@system/domain/schemas/workflow/system-case.schema"
import { proposalDigestSchema } from "@system/domain/schemas/workflow/system-case-reference.schema"
import { AttachmentAdapter } from "@system/infrastructure/adapters/attachments/attachment.adapter"
import { AttachmentPreservationRepository } from "@system/infrastructure/repositories/attachments/attachment-preservation.repository"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { SystemD1WorkflowAdapter } from "@system/infrastructure/adapters/workflow/system-d1-workflow.adapter"
import { systemAttachmentSchema } from "@system/infrastructure/schema/system-attachment"
import { systemCoreSchema } from "@system/infrastructure/schema/system-core"
import { executeSystemAttachmentErasure } from "@system/interface/operations/execute-system-attachment-erasure"
import { prepareSystemAttachmentErasureDecisionAudit } from "@system/interface/operations/prepare-system-attachment-erasure-decision-audit"
import { prepareSystemAttachmentErasureRequest } from "@system/interface/operations/prepare-system-attachment-erasure-request"
import { createSystemAttachmentTestDatabase } from "@system/test/create-system-attachment-test-database.test-support"
import { createSystemAttachmentTestKekEnvironment } from "@system/test/create-system-attachment-test-kek-environment.test-support"
import { SystemAttachmentTestBucket } from "@system/test/system-attachment-test-bucket.test-support"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

// 読取資格は実時刻でも有効期間を確かめるため、実時刻を使う。
const now = new Date(Math.floor(Date.now() / 1_000) * 1_000)
const subjectAccountId = testAccountId("acc_subject")
const officerAccountId = testAccountId("acc_privacy_officer")
const rootAccountId = testAccountId("acc_root")
const memberAccountId = testAccountId("acc_member")
const reviewerAccountId = testAccountId("acc_reviewer")

function authentication(accountId: string) {
  return {
    accountId: zAccountId.parse(accountId),
    tokenVersion: 0,
    issuedAtMs: now.getTime(),
    expiresAtMs: now.getTime() + 3_600_000,
    machineCredentialId: null,
    identityBindingId: null,
  }
}

async function createFixture() {
  const bucket = new SystemAttachmentTestBucket()
  const db = await createSystemAttachmentTestDatabase()
  const context = {
    var: { database: drizzle(db, { schema: { ...systemCoreSchema, ...systemAttachmentSchema } }) },
    env: {
      DB: db,
      ATTACHMENTS: bucket as unknown as R2Bucket,
      ATTACHMENT_KEKS: createSystemAttachmentTestKekEnvironment(1),
    },
  }
  for (const schema of [
    "system-decision-policy",
    "system-procedure-delegation",
    "system-human-decision",
  ])
    await execSql(
      db,
      readFileSync(new URL(`../infrastructure/schema/${schema}.sql`, import.meta.url), "utf8"),
    )
  for (const accountId of [
    subjectAccountId,
    officerAccountId,
    rootAccountId,
    memberAccountId,
    reviewerAccountId,
  ]) {
    await db
      .prepare(
        "INSERT INTO system_accounts(id,status,token_version,created_at,updated_at) VALUES (?1,'active',0,0,0)",
      )
      .bind(accountId)
      .run()
    await db
      .prepare(
        "INSERT INTO system_principals(id,account_id,kind,name,revision,created_at,updated_at) VALUES (?1,?2,'human',?2,1,0,0)",
      )
      .bind(testDerivedId("principal", accountId), accountId)
      .run()
  }
  await execSql(
    db,
    `
    INSERT INTO system_iam_roles(id,key,kind,name,created_at,updated_at) VALUES
      ('00a29165-13b2-4723-8bb5-8aaeb1096d2d','test:privacy_officer','custom','Privacy officer',0,0),
      ('af285551-000d-4320-8ea0-bbfbc6c96a81','test:root','custom','Root',0,0),
      ('6df06337-edc8-475b-81f5-9e32869ed52f','test:member','custom','Member',0,0);
    INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES
      ('00a29165-13b2-4723-8bb5-8aaeb1096d2d','personal_data:erase'),
      ('af285551-000d-4320-8ea0-bbfbc6c96a81','system:admin'),
      ('6df06337-edc8-475b-81f5-9e32869ed52f','audit:read');
    INSERT INTO system_role_bindings(id,account_id,role_id,created_at) VALUES
      ('085ed3fb-b610-4ab9-8c00-8e5966aa81b3','${officerAccountId}','00a29165-13b2-4723-8bb5-8aaeb1096d2d',0),
      ('f16b950f-c6db-4760-8994-95cc8065169d','${rootAccountId}','af285551-000d-4320-8ea0-bbfbc6c96a81',0),
      ('fb62108d-f4b6-4fdb-8b11-43ab1ca26adb','${memberAccountId}','6df06337-edc8-475b-81f5-9e32869ed52f',0);
    INSERT INTO system_procedure_definitions(key,current_revision,status,created_at,updated_at)
      VALUES ('personal-data-erasure',1,'active',0,0);
    INSERT INTO system_procedure_numbers(procedure_key) VALUES ('personal-data-erasure');
    INSERT INTO system_procedure_definition_revisions
      (procedure_key,revision,title,category,input_schema_json,decision_policy_json,
       completion_operation_key,created_by_account_id,created_at)
      VALUES ('personal-data-erasure',1,'Erase personal data','operation','{}','{}',
       'system.attachment.erase','${rootAccountId}',0);
  `,
  )

  const store = async (fileName: string) => {
    const stored = await new StoreAttachment(context).run({
      ownerAccountId: subjectAccountId,
      fileName,
      contentType: "application/pdf",
      content: new TextEncoder().encode(`%PDF-1.7 ${fileName}`),
      now,
    })
    if (stored instanceof Error) throw stored
    return stored.id
  }
  const request = (accountId: string, scope: unknown, requestId: string = crypto.randomUUID()) =>
    prepareSystemAttachmentErasureRequest(context, {
      authentication: authentication(accountId),
      requestId,
      scope,
      reason: "本人からの消去請求",
      at: now,
    })
  const start = async (accountId: string, scope: unknown) => {
    const prepared = await request(accountId, scope)
    if (prepared instanceof Error) throw prepared
    const started = await new StartSystemProcedure({
      writer: new SystemD1WorkflowAdapter({ env: context.env, startGuards: prepared.startGuards }),
    }).run({
      seriesId: prepared.seriesId,
      version: 1,
      procedureKey: "personal-data-erasure",
      procedureRevision: 1,
      body: prepared.body,
      createdByAccountId: zAccountId.parse(accountId),
      supersedesProposalId: null,
      createdAt: now,
      subject: prepared.subject,
      firstTask: {
        key: "review",
        requiredApprovals: 1,
        openedAt: now,
        dueAt: null,
        excludedAccountIds: [zAccountId.parse(accountId)],
        candidates: [
          {
            accountId: zAccountId.parse(reviewerAccountId),
            source: "primary",
            evidenceContext: "sample-source",
            evidenceKind: "qualification",
            evidenceId: "erasure-reviewer",
            evidenceVersion: "1",
            eligibilityDigest: proposalDigestSchema.parse("a".repeat(64)),
            eligibleFrom: null,
            resolvedAt: now,
          },
        ],
      },
    })
    if (started instanceof Error) throw started
    return { prepared, started }
  }
  const proposal = async (number: number) => {
    const found = await new SystemD1ProposalAdapter({ env: context.env }).findByNumber(number)
    if (found instanceof Error || found === null) throw new Error("proposal missing")
    return found
  }
  const decide = async (number: number, action: "approve" | "reject") => {
    const current = await proposal(number)
    const audit = prepareSystemAttachmentErasureDecisionAudit(context, {
      proposal: current,
      actorAccountId: reviewerAccountId,
      representedAccountId: reviewerAccountId,
      action,
      taskKey: "review",
      round: 1,
      decidedAt: now,
    })
    if (audit instanceof Error) throw audit
    const writer = new SystemD1WorkflowAdapter({ env: context.env, decisionEffects: audit })
    const command = {
      caseId: systemCaseIdSchema.parse(current.caseId),
      taskKey: "review",
      round: 1,
      actorAccountId: zAccountId.parse(reviewerAccountId),
      representedAccountId: zAccountId.parse(reviewerAccountId),
      delegationId: null,
      proposalDigest: current.digest,
      comment: null,
      decidedAt: now,
      nextTask: null,
    }
    const decided =
      action === "approve"
        ? await new ApproveSystemTask(writer).execute(command)
        : await new RejectSystemTask(writer).execute(command)
    if (decided instanceof Error) throw decided
  }
  const execute = async (accountId: string, number: number) =>
    executeSystemAttachmentErasure(context, {
      authentication: authentication(accountId),
      proposal: await proposal(number),
      executionGuards: [],
      at: now,
    })
  const row = async (id: string) => {
    const found = await new AttachmentAdapter(context).findById(id)
    if (found instanceof Error || found === null) throw new Error("attachment missing")
    return found
  }
  const audits = async () =>
    (
      await db
        .prepare(
          `SELECT action, actor_account_id, reason_code FROM system_audit_events
           WHERE target_type = 'system:attachment-erasure' ORDER BY rowid`,
        )
        .all<{ action: string; actor_account_id: string; reason_code: string | null }>()
    ).results
  const preserve = async (attachmentId: string) => {
    const current = await row(attachmentId)
    const created = await new CreateAttachmentPreservation({
      repository: new AttachmentPreservationRepository({ env: context.env, assertions: [] }),
    }).execute(
      {
        id: crypto.randomUUID(),
        attachmentId,
        sha256: current.plaintextSha256,
        kind: "hold",
        retainUntil: null,
        reason: "訴訟対応のため保全",
        actorAccountId: rootAccountId,
      },
      now,
    )
    if (created instanceof Error || created === "conflict") throw new Error("preservation failed")
  }
  return { context, bucket, store, request, start, decide, execute, row, audits, preserve }
}

function erasureCode(result: unknown) {
  return result instanceof AttachmentErasureError ? result.code : result
}

describe("添付DEKの破棄", () => {
  test("既定のRoleでは申請できず、personal_data:erase か system:admin を持つ人だけが申請できる", async () => {
    const c = await createFixture()
    const attachmentId = await c.store("receipt.pdf")
    const scope = { kind: "attachment", attachmentId }

    expect(erasureCode(await c.request(memberAccountId, scope))).toBe("forbidden")
    expect(await c.request(officerAccountId, scope)).toMatchObject({
      body: { operation: "system.attachment.erase", targetAttachmentIds: [attachmentId] },
    })
    expect(await c.request(rootAccountId, scope)).toMatchObject({
      subject: { context: "system", kind: "proposal" },
    })
  })

  test("承認前と否決後は破棄できず、鍵も案件も変わらない", async () => {
    const c = await createFixture()
    const attachmentId = await c.store("receipt.pdf")
    const { started } = await c.start(officerAccountId, { kind: "attachment", attachmentId })

    expect(erasureCode(await c.execute(officerAccountId, started.number))).toBe("not_approved")
    await c.decide(started.number, "reject")
    expect(erasureCode(await c.execute(officerAccountId, started.number))).toBe("not_approved")
    expect((await c.row(attachmentId)).wrappedDek).not.toBeNull()
    expect((await c.row(attachmentId)).status).toBe("pending")
  })

  test("承認後に権限の無い人は実行できない", async () => {
    const c = await createFixture()
    const attachmentId = await c.store("receipt.pdf")
    const { started } = await c.start(officerAccountId, { kind: "attachment", attachmentId })
    await c.decide(started.number, "approve")

    expect(erasureCode(await c.execute(memberAccountId, started.number))).toBe("forbidden")
    expect((await c.row(attachmentId)).wrappedDek).not.toBeNull()
  })

  test("承認確定後の実行でDEKを破棄し、原本と複製の暗号文を復号不能にして申請・判断・実行を監査に残す", async () => {
    const c = await createFixture()
    const attachmentId = await c.store("receipt.pdf")
    const before = await c.row(attachmentId)
    const replica = c.bucket.storedBytes(`att/${attachmentId}`)
    if (replica === null || before.wrappedDek === null || before.wrappedDekIv === null)
      throw new Error("stored attachment is incomplete")
    const { started } = await c.start(officerAccountId, { kind: "attachment", attachmentId })
    await c.decide(started.number, "approve")

    expect(await c.execute(officerAccountId, started.number)).toEqual({
      kind: "destroyed",
      requestId: started.workflowCase.subject.id,
      attachmentIds: [attachmentId],
    })
    const after = await c.row(attachmentId)
    expect(after).toMatchObject({ status: "erased", wrappedDek: null, wrappedDekIv: null })
    expect(after.erasedAt).toEqual(now)
    expect(c.bucket.storedBytes(`att/${attachmentId}`)).toEqual(replica)
    expect(await c.audits()).toEqual([
      {
        action: "system.attachment.erasure.requested",
        actor_account_id: officerAccountId,
        reason_code: null,
      },
      {
        action: "system.attachment.erasure.decided",
        actor_account_id: reviewerAccountId,
        reason_code: "approve",
      },
      {
        action: "system.attachment.key.destroyed",
        actor_account_id: officerAccountId,
        reason_code: null,
      },
    ])
    expect(
      await c.context.env.DB.prepare("SELECT status FROM system_cases WHERE id = ?1")
        .bind(started.workflowCase.id)
        .first<string>("status"),
    ).toBe("executed")
  })

  test("破棄後の読み出しは、保存済みの暗号文が残っていても失敗する", async () => {
    const c = await createFixture()
    const attachmentId = await c.store("receipt.pdf")
    const { started } = await c.start(officerAccountId, { kind: "attachment", attachmentId })
    await c.decide(started.number, "approve")
    await c.execute(officerAccountId, started.number)

    const erased = await c.row(attachmentId)
    const stored = c.bucket.storedBytes(`att/${attachmentId}`)
    const ciphertext = stored === null ? null : new Uint8Array(stored)
    const registry = AttachmentKekRegistry.fromEnv(c.context.env.ATTACHMENT_KEKS)
    if (ciphertext === null || registry instanceof Error) throw new Error("fixture is incomplete")
    const kek = registry.resolve(erased.kekVersion)
    if (kek instanceof Error) throw kek
    expect(erased.wrappedDek).toBeNull()
    expect(
      await decryptAttachment(
        ciphertext,
        {
          wrappedDek: erased.wrappedDek ?? "",
          wrappedDekIv: erased.wrappedDekIv ?? "",
          contentIv: erased.contentIv,
          kekVersion: erased.kekVersion,
        },
        kek,
      ),
    ).toBeInstanceOf(Error)
  })

  test("同じ添付への重複申請と、破棄済みの添付への申請を拒否する", async () => {
    const c = await createFixture()
    const attachmentId = await c.store("receipt.pdf")
    const scope = { kind: "attachment", attachmentId }
    const { started } = await c.start(officerAccountId, scope)

    expect(erasureCode(await c.request(rootAccountId, scope))).toBe("duplicate")
    expect(
      erasureCode(await c.request(rootAccountId, { kind: "account", accountId: subjectAccountId })),
    ).toBe("duplicate")

    await c.decide(started.number, "approve")
    await c.execute(officerAccountId, started.number)
    expect(erasureCode(await c.request(rootAccountId, scope))).toBe("already_erased")
  })

  test("実行の再送は破棄済みとして応答し、二度目の破棄や監査を作らない", async () => {
    const c = await createFixture()
    const attachmentId = await c.store("receipt.pdf")
    const { started } = await c.start(officerAccountId, { kind: "attachment", attachmentId })
    await c.decide(started.number, "approve")

    const [first, second] = await Promise.all([
      c.execute(officerAccountId, started.number),
      c.execute(officerAccountId, started.number),
    ])
    expect([first, second].filter((result) => !(result instanceof Error))).toHaveLength(1)
    expect(await c.execute(officerAccountId, started.number)).toMatchObject({ kind: "replayed" })
    expect(
      (await c.audits()).filter((audit) => audit.action === "system.attachment.key.destroyed"),
    ).toHaveLength(1)
  })

  test("Account単位の申請は所有する添付を固定し、保全中の添付を除いて破棄する", async () => {
    const c = await createFixture()
    const first = await c.store("a.pdf")
    const second = await c.store("b.pdf")
    const held = await c.store("held.pdf")
    await c.preserve(held)
    const { prepared, started } = await c.start(officerAccountId, {
      kind: "account",
      accountId: subjectAccountId,
    })
    expect(prepared.body.targetAttachmentIds).toEqual([first, second].sort())
    expect(prepared.body.preservedAttachmentIds).toEqual([held])
    await c.decide(started.number, "approve")

    expect(await c.execute(officerAccountId, started.number)).toMatchObject({ kind: "destroyed" })
    expect((await c.row(first)).status).toBe("erased")
    expect((await c.row(second)).status).toBe("erased")
    expect((await c.row(held)).wrappedDek).not.toBeNull()
  })

  test("保全中の添付だけを指す申請と、承認後に保全された添付の破棄を拒否する", async () => {
    const c = await createFixture()
    const held = await c.store("held.pdf")
    await c.preserve(held)
    expect(
      erasureCode(await c.request(officerAccountId, { kind: "attachment", attachmentId: held })),
    ).toBe("preserved")

    const later = await c.store("later.pdf")
    const { started } = await c.start(officerAccountId, { kind: "attachment", attachmentId: later })
    await c.decide(started.number, "approve")
    await c.preserve(later)
    expect(erasureCode(await c.execute(officerAccountId, started.number))).toBe("preserved")
    expect((await c.row(later)).wrappedDek).not.toBeNull()
  })

  test("存在しない添付と不正な範囲を拒否する", async () => {
    const c = await createFixture()
    expect(
      erasureCode(await c.request(officerAccountId, { kind: "attachment", attachmentId: "none" })),
    ).toBe("not_found")
    expect(erasureCode(await c.request(officerAccountId, { kind: "everything" }))).toBe("invalid")
  })
})
