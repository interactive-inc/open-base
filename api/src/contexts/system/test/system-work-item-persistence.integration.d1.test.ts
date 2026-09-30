import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"
import { createSystemWorkTestFixture } from "@system/test/create-system-work-test-fixture.test-support"
import { SystemWorkItemEntity } from "@system/domain/entities/system-work-item.entity"
import { SystemWorkItemError } from "@system/domain/errors"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

async function fixture() {
  const f = await createSystemWorkTestFixture()
  const owner = await f.authorized("45712a13-6a79-4dff-b2b0-d518052d6101", "system:work:create")
  const worker = await f.authorized("caf47224-b967-45fd-85b2-8d67e7bdd8c9", "system:work:perform")
  const command = {
    kind: "create",
    id: crypto.randomUUID(),
    commandId: crypto.randomUUID(),
    expectedRevision: 0,
    reason: "依頼する",
    title: "資料の確認",
    instructions: "根拠をまとめる",
    acceptanceCriteria: "人が根拠と結論を確認する",
    assigneeAccountId: "caf47224-b967-45fd-85b2-8d67e7bdd8c9",
    dueAt: null,
    previousRevisionId: null,
  }
  const recipient = await f
    .adapter("45712a13-6a79-4dff-b2b0-d518052d6101")
    .recipient("caf47224-b967-45fd-85b2-8d67e7bdd8c9")
  if (recipient instanceof Error) throw recipient
  const entity = await SystemWorkItemEntity.create({
    command,
    actor: owner.authorization.actor,
    authentication: owner.authorization.authentication,
    now: f.clock.now,
    recipient,
  })
  if (entity instanceof Error) throw entity
  expect(await owner.repository.append(entity, null)).toBeUndefined()
  async function transition(
    previous: SystemWorkItemEntity,
    kind: string,
    account = "caf47224-b967-45fd-85b2-8d67e7bdd8c9",
    props: Record<string, unknown> = {},
  ) {
    const current = await f.authorized(
      account,
      kind === "accept" || kind === "submit" ? "system:work:perform" : "system:work:manage",
      kind !== "accept" && kind !== "submit",
    )
    const to =
      kind === "request_handover"
        ? await f.adapter(account).recipient(String(props.toAccountId))
        : undefined
    if (to instanceof Error) throw to
    const next = await previous.transition({
      command: {
        id: command.id,
        commandId: crypto.randomUUID(),
        expectedRevision: previous.snapshot.revision,
        reason: "確認する",
        kind,
        ...props,
      },
      actor: current.authorization.actor,
      authentication: current.authorization.authentication,
      now: f.clock.now,
      recipient: to,
      recovery: current.authorization.isAdmin,
    })
    if (next instanceof Error) throw next
    return { next, repository: current.repository }
  }
  return { ...f, owner, worker, command, entity, transition }
}

test("依頼、受領、成果、人の承認を監査付きで保存し、参加者だけが読む", async () => {
  const f = await fixture()
  const accepted = await f.transition(f.entity, "accept")
  expect(await accepted.repository.append(accepted.next, f.entity)).toBeUndefined()
  const submitted = await f.transition(
    accepted.next,
    "submit",
    "caf47224-b967-45fd-85b2-8d67e7bdd8c9",
    {
      result: { summary: "確認用の成果", evidence: [] },
    },
  )
  expect(await submitted.repository.append(submitted.next, accepted.next)).toBeUndefined()
  const approved = await f.transition(
    submitted.next,
    "approve",
    "45712a13-6a79-4dff-b2b0-d518052d6101",
    {
      resultId: submitted.next.snapshot.result?.id,
      resultDigest: submitted.next.snapshot.result?.digest,
    },
  )
  expect(await approved.repository.append(approved.next, submitted.next)).toBeUndefined()
  const current = await f.owner.repository.findCurrent(f.command.id)
  if (current instanceof Error) throw current
  expect(current?.snapshot.state).toBe("completed")
  expect(
    await (
      await f.authorized("28689052-c77f-42e5-8f85-1b461d9f5514")
    ).repository.findCurrent(f.command.id),
  ).toBeNull()
  expect(
    await (
      await f.authorized("28689052-c77f-42e5-8f85-1b461d9f5514")
    ).repository.findCommand(f.command.commandId),
  ).toBeNull()
  const history = await f.owner.repository.history({ id: f.command.id, after: 0, limit: 100 })
  if (history instanceof Error) throw history
  expect(history.length).toBe(4)
  expect(
    await f.db
      .prepare("SELECT count(*) AS total FROM system_audit_events WHERE target_id=?1")
      .bind(f.command.id)
      .first<Record<string, unknown>>(),
  ).toEqual({ total: 4 })
})

test("同じ版への競合、保存途中の失権、監査無視は全変更をrollbackする", async () => {
  const f = await fixture()
  const first = await f.transition(f.entity, "accept")
  const second = await f.transition(f.entity, "accept")
  expect(await first.repository.append(first.next, f.entity)).toBeUndefined()
  expect(await second.repository.append(second.next, f.entity)).toMatchObject({ kind: "conflict" })
  const submitted = await f.transition(
    first.next,
    "submit",
    "caf47224-b967-45fd-85b2-8d67e7bdd8c9",
    {
      result: { summary: "結果", evidence: [] },
    },
  )
  await execSql(
    f.db,
    `CREATE TRIGGER revoke_on_work AFTER INSERT ON system_work_item_revisions WHEN NEW.action='submit'
    BEGIN UPDATE system_accounts SET token_version=token_version+1 WHERE id='caf47224-b967-45fd-85b2-8d67e7bdd8c9'; END;`,
  )
  expect(await submitted.repository.append(submitted.next, first.next)).toMatchObject({
    kind: "forbidden",
  })
  expect(
    await f.db
      .prepare(
        "SELECT token_version FROM system_accounts WHERE id='caf47224-b967-45fd-85b2-8d67e7bdd8c9'",
      )
      .first<Record<string, unknown>>(),
  ).toEqual({ token_version: 0 })
  await execSql(f.db, "DROP TRIGGER revoke_on_work")
  await execSql(
    f.db,
    "CREATE TRIGGER ignore_work_audit BEFORE INSERT ON system_audit_events BEGIN SELECT RAISE(IGNORE); END;",
  )
  expect(await submitted.repository.append(submitted.next, first.next)).toBeInstanceOf(
    SystemWorkItemError,
  )
  expect(
    await f.db
      .prepare("SELECT count(*) AS total FROM system_work_item_revisions")
      .first<Record<string, unknown>>(),
  ).toEqual({
    total: 2,
  })
  expect(
    await f.db
      .prepare("SELECT count(*) AS total FROM system_audit_events WHERE target_id=?1")
      .bind(f.command.id)
      .first<Record<string, unknown>>(),
  ).toEqual({ total: 2 })
})

test("受領で責任者と閲覧資格が切り替わり、管理者も人の受領を省略できない", async () => {
  const f = await fixture()
  const requested = await f.transition(
    f.entity,
    "request_handover",
    "282b84eb-787d-4655-a88b-c072960fc970",
    {
      toAccountId: "86bb9cb9-9f16-4b64-865d-2e7954cf484d",
    },
  )
  expect(await requested.repository.append(requested.next, f.entity)).toBeUndefined()
  expect(String(requested.next.snapshot.accountable.accountId)).toBe(
    "45712a13-6a79-4dff-b2b0-d518052d6101",
  )
  expect(requested.next.snapshot.recovery).toBe(true)
  const accepted = await f.transition(
    requested.next,
    "accept_handover",
    "86bb9cb9-9f16-4b64-865d-2e7954cf484d",
    {
      handoverId: requested.next.snapshot.handover?.id,
    },
  )
  expect(await accepted.repository.append(accepted.next, requested.next)).toBeUndefined()
  expect(await f.owner.repository.findCurrent(f.command.id)).toBeNull()
  const current = await (
    await f.authorized("86bb9cb9-9f16-4b64-865d-2e7954cf484d")
  ).repository.findCurrent(f.command.id)
  if (current instanceof Error) throw current
  expect(String(current?.snapshot.accountable.accountId)).toBe(
    "86bb9cb9-9f16-4b64-865d-2e7954cf484d",
  )
})

test("証拠のclaimと添付linkが成果と同時に保存され、部分成功を許さない", async () => {
  const f = await fixture()
  const accepted = await f.transition(f.entity, "accept")
  expect(await accepted.repository.append(accepted.next, f.entity)).toBeUndefined()
  await f.db
    .prepare(`INSERT INTO system_attachments (id,owner_account_id,object_key,status,content_type,byte_size,file_name,plaintext_sha256,
    wrapped_dek,wrapped_dek_iv,content_iv,kek_version,created_at)
    VALUES ('evidence','caf47224-b967-45fd-85b2-8d67e7bdd8c9','att/evidence','pending','text/plain',5,'evidence.txt',?1,'wrapped','iv','iv',1,100)`)
    .bind("b".repeat(64))
    .run()
  const submitted = await f.transition(
    accepted.next,
    "submit",
    "caf47224-b967-45fd-85b2-8d67e7bdd8c9",
    {
      result: {
        summary: "添付を参照",
        evidence: [{ attachmentId: "evidence", sha256: "b".repeat(64) }],
      },
    },
  )
  await execSql(
    f.db,
    "CREATE TRIGGER ignore_evidence BEFORE INSERT ON system_work_evidence BEGIN SELECT RAISE(IGNORE); END;",
  )
  expect(await submitted.repository.append(submitted.next, accepted.next)).toMatchObject({
    kind: "invalid",
  })
  expect(
    await f.db.prepare("SELECT status FROM system_attachments").first<Record<string, unknown>>(),
  ).toEqual({
    status: "pending",
  })
  await execSql(f.db, "DROP TRIGGER ignore_evidence")
  expect(await submitted.repository.append(submitted.next, accepted.next)).toBeUndefined()
  expect(
    await f.db.prepare("SELECT status FROM system_attachments").first<Record<string, unknown>>(),
  ).toEqual({
    status: "linked",
  })
  expect(
    await f.db
      .prepare("SELECT work_item_id FROM system_work_evidence")
      .first<Record<string, unknown>>(),
  ).toEqual({
    work_item_id: f.command.id,
  })
  await expect(execSql(f.db, "DELETE FROM system_work_evidence")).rejects.toThrow("immutable")
  await expect(
    execSql(f.db, "UPDATE system_work_item_revisions SET state='completed'"),
  ).rejects.toThrow("immutable")
  await expect(execSql(f.db, "DELETE FROM system_work_items")).rejects.toThrow("immutable")
})

test("現在のpermission、credential、step-upを失った主体を拒否する", async () => {
  const f = await fixture()
  await execSql(
    f.db,
    "DELETE FROM system_iam_role_permissions WHERE role_id=(SELECT id FROM system_iam_roles WHERE key='role:worker') AND permission_key='system:work:perform'",
  )
  expect(
    await f
      .adapter("caf47224-b967-45fd-85b2-8d67e7bdd8c9")
      .prepare({ permission: "system:work:perform", stepUpToken: null }),
  ).toMatchObject({ kind: "forbidden" })
  expect(
    await f
      .adapter("45712a13-6a79-4dff-b2b0-d518052d6101")
      .prepare({ permission: "system:work:review", stepUpToken: "invalid" }),
  ).toMatchObject({ kind: "forbidden" })
  await f.db
    .prepare(
      "UPDATE system_machine_credentials SET status='revoked',revoked_at=?1,updated_at=?1 WHERE id='087f472e-41a4-42b5-a66f-c625597754b0'",
    )
    .bind(f.clock.now.getTime())
    .run()
  expect(await f.worker.repository.findCurrent(f.command.id)).toMatchObject({ kind: "forbidden" })
})

test("domainを迂回する直接SQLでも不正な遷移、主体の差替え、欠落した状態を拒否する", async () => {
  const f = await fixture()
  const accepted = await f.transition(f.entity, "accept")
  const value = accepted.next.snapshot
  const corruptions = [
    { ...value, state: "completed", action: "approve" },
    {
      ...value,
      assignee: {
        accountId: "28689052-c77f-42e5-8f85-1b461d9f5514",
        principalId: "84054a0d-7615-4858-876c-f52bcd25a6c1",
        kind: "human",
      },
      actor: {
        accountId: "28689052-c77f-42e5-8f85-1b461d9f5514",
        principalId: "84054a0d-7615-4858-876c-f52bcd25a6c1",
        kind: "human",
      },
      authentication: { tokenVersion: 0, credentialId: null, stepUpGrantId: null },
    },
    { ...value, revision: 3 },
    { ...value, recordedAt: new Date(Date.parse(value.createdAt) - 1).toISOString() },
    { ...value, result: undefined },
    { ...value, recovery: true },
    {
      ...value,
      authentication: {
        tokenVersion: 1,
        credentialId: "087f472e-41a4-42b5-a66f-c625597754b0",
        stepUpGrantId: null,
      },
    },
  ]
  for (const corrupted of corruptions) {
    const snapshot = JSON.stringify(corrupted)
    const transaction = f.db.batch([
      f.db
        .prepare(`INSERT INTO system_audit_events (event_id,actor_account_id,action,target_type,target_id,outcome,
        authorization_json,before_json,after_json,occurred_at)
        SELECT json_extract(?1,'$.auditEventId'),json_extract(?1,'$.actor.accountId'),'system.work.'||json_extract(?1,'$.action'),
          'system:work-item',json_extract(?1,'$.id'),'succeeded',
          json_object('principal_id',json_extract(?1,'$.actor.principalId'),'principal_kind',json_extract(?1,'$.actor.kind'),
            'token_version',json_extract(?1,'$.authentication.tokenVersion'),'credential_id',json_extract(?1,'$.authentication.credentialId'),
            'step_up_grant_id',json_extract(?1,'$.authentication.stepUpGrantId'),'recovery',json_extract(?1,'$.recovery')),
          ?2,?1,?3`)
        .bind(snapshot, JSON.stringify(f.entity.snapshot), Date.parse(corrupted.recordedAt)),
      f.db
        .prepare(`INSERT INTO system_work_item_revisions (work_item_id,revision,command_id,action,state,actor_account_id,actor_principal_id,
        accountable_account_id,accountable_principal_id,assignee_account_id,assignee_principal_id,recorded_at,snapshot_json,audit_event_id)
        SELECT json_extract(?1,'$.id'),json_extract(?1,'$.revision'),json_extract(?1,'$.commandId'),json_extract(?1,'$.action'),json_extract(?1,'$.state'),
          json_extract(?1,'$.actor.accountId'),json_extract(?1,'$.actor.principalId'),json_extract(?1,'$.accountable.accountId'),json_extract(?1,'$.accountable.principalId'),
          json_extract(?1,'$.assignee.accountId'),json_extract(?1,'$.assignee.principalId'),?2,?1,json_extract(?1,'$.auditEventId')`)
        .bind(snapshot, Date.parse(corrupted.recordedAt)),
    ])
    await expect(transaction).rejects.toThrow("work_item_")
  }
  expect(
    await f.db
      .prepare("SELECT count(*) AS total FROM system_work_item_revisions")
      .first<Record<string, unknown>>(),
  ).toEqual({
    total: 1,
  })
  expect(
    await f.db
      .prepare("SELECT count(*) AS total FROM system_audit_events")
      .first<Record<string, unknown>>(),
  ).toEqual({
    total: 1,
  })
})

test("外部Identityで準備した作業認可は保存直前のIdentity失効と差替えを拒否する", async () => {
  const f = await createSystemWorkTestFixture()
  await f.db
    .prepare(`INSERT INTO system_identity_bindings
    (id,account_id,provider,subject,created_at,activated_at,revoked_at)
    VALUES ('efcee2ea-dc22-4eb2-8e42-31e4515c717f','45712a13-6a79-4dff-b2b0-d518052d6101','oidc','external-owner',0,0,NULL)`)
    .run()
  const adapter = f.adapter(
    "45712a13-6a79-4dff-b2b0-d518052d6101",
    "efcee2ea-dc22-4eb2-8e42-31e4515c717f",
  )
  const authorization = await adapter.prepare({
    permission: "system:work:create",
    stepUpToken: null,
  })
  if (authorization instanceof Error) throw authorization
  const assertions = authorization.assertions()
  if (assertions instanceof Error) throw assertions
  await f.db.batch([...assertions])
  await expect(
    f.db
      .prepare(
        "UPDATE system_identity_bindings SET subject='replacement-owner' WHERE id='efcee2ea-dc22-4eb2-8e42-31e4515c717f'",
      )
      .run(),
  ).rejects.toThrow("identity binding identity is immutable")
  await f.db
    .prepare(
      "UPDATE system_identity_bindings SET revoked_at=?1 WHERE id='efcee2ea-dc22-4eb2-8e42-31e4515c717f'",
    )
    .bind(f.clock.now.getTime())
    .run()
  await expect(f.db.batch([...assertions])).rejects.toThrow()
  expect(
    await adapter.prepare({ permission: "system:work:create", stepUpToken: null }),
  ).toBeInstanceOf(SystemWorkItemError)
})
