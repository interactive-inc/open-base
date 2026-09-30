import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { MarkSystemNotificationRead } from "@system/application/notifications/mark-system-notification-read"
import { PublishSystemNotification } from "@system/application/notifications/publish-system-notification"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { NotificationDeliveryBatchValue } from "@system/domain/values/notifications/notification-delivery-batch.value"
import { NotificationDeliveryEntity } from "@system/domain/entities/notification-delivery.entity"
import { NotificationMessageEntity } from "@system/domain/entities/notification-message.entity"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { SystemNotificationRepository } from "@system/infrastructure/repositories/notifications/system-notification.repository"
import { prepareSystemNotificationPublicationBatch } from "@system/interface/operations/prepare-system-notification-publication-batch"
import { listExistingSystemNotificationPublicationKeys } from "@system/interface/operations/list-existing-system-notification-publications"
import { listSystemNotificationRecords } from "@system/interface/operations/list-system-notification-records"
import { markSelectedSystemNotificationRecordsRead } from "@system/interface/operations/mark-selected-system-notification-records-read"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { testAccountId, testLiteralId } from "@system/test/system-test-id.test-support"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const notificationSchema = `
PRAGMA foreign_keys = ON;

CREATE TABLE system_accounts (
  id TEXT PRIMARY KEY NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'suspended', 'locked')),
  token_version INTEGER NOT NULL DEFAULT 0,
  closed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE system_notification_messages (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  action_url TEXT,
  source_type TEXT,
  source_id TEXT,
  action_type TEXT,
  action_id TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  dedupe_key TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  CHECK ((source_type IS NULL AND source_id IS NULL) OR
         (source_type IS NOT NULL AND source_id IS NOT NULL))
);

CREATE TABLE system_notification_resource_scopes (
  message_id TEXT PRIMARY KEY NOT NULL REFERENCES system_notification_messages(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL
);

CREATE TABLE system_notification_deliveries (
  id TEXT PRIMARY KEY NOT NULL,
  message_id TEXT NOT NULL REFERENCES system_notification_messages(id) ON DELETE RESTRICT,
  recipient_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  delivered_at INTEGER NOT NULL,
  read_at INTEGER,
  dismissed_at INTEGER,
  UNIQUE (message_id, recipient_account_id),
  CHECK (read_at IS NULL OR read_at >= delivered_at),
  CHECK (dismissed_at IS NULL OR dismissed_at >= delivered_at)
);
`

describe("canonical System Notification Application + D1 repository", () => {
  test("旧通知もAccount・scope付きで読め、選択済みdeliveryだけを既読にする", async () => {
    const database = await createLocalD1Database({ schema: notificationSchema })
    await insertAccount(database, "4f810255-55d5-43c8-b43f-2df5e7bf5a3c", "active")
    await insertAccount(database, "cd2c4c4e-c038-4a89-8411-6f779077ac7e", "active")
    await execSql(
      database,
      `
      INSERT INTO system_notification_messages
        (id, kind, title, body, action_url, priority, created_at)
      VALUES ('legacy', 'chat', '旧通知', NULL, '/chat/channels/abc', 'normal', 1000);
      INSERT INTO system_notification_resource_scopes (message_id, resource_type, resource_id)
      VALUES ('legacy', 'care:facility', 'f1');
      INSERT INTO system_notification_deliveries
        (id, message_id, recipient_account_id, delivered_at)
      VALUES ('owner-delivery', 'legacy', '4f810255-55d5-43c8-b43f-2df5e7bf5a3c', 1000),
             ('other-delivery', 'legacy', 'cd2c4c4e-c038-4a89-8411-6f779077ac7e', 1000);
    `,
    )
    const owner = zAccountId.parse("4f810255-55d5-43c8-b43f-2df5e7bf5a3c")
    const other = zAccountId.parse("cd2c4c4e-c038-4a89-8411-6f779077ac7e")
    const ownerRecords = await listSystemNotificationRecords({
      database,
      recipientAccountId: owner,
    })
    expect(ownerRecords).toEqual([
      {
        id: "owner-delivery",
        messageId: "legacy",
        deliveredAt: 1000,
        readAt: null,
        kind: "chat",
        title: "旧通知",
        body: null,
        priority: "normal",
        actionUrl: "/chat/channels/abc",
        actionType: null,
        actionId: null,
        resourceScope: { type: "care:facility", id: "f1" },
      },
    ])
    expect(
      await markSelectedSystemNotificationRecordsRead({
        database,
        recipientAccountId: owner,
        deliveryIds: ["owner-delivery", "other-delivery"],
        readAt: new Date(2000),
      }),
    ).toBe(1)
    expect(
      await listSystemNotificationRecords({ database, recipientAccountId: owner, read: false }),
    ).toEqual([])
    expect(
      await listSystemNotificationRecords({ database, recipientAccountId: other, read: false }),
    ).toHaveLength(1)
  })

  test("公開済みkeyの照会は旧形式のMessageも含め、存在しないkeyを返さない", async () => {
    const database = await createLocalD1Database({ schema: notificationSchema })
    await database
      .prepare(
        `INSERT INTO system_notification_messages
           (id, kind, title, body, priority, dedupe_key, created_at)
         VALUES ('old-message', 'shift_request', '旧通知', '本文', 'high', 'shift_request:old', 1000)`,
      )
      .run()
    const found = await listExistingSystemNotificationPublicationKeys({
      database,
      publicationKeys: ["shift_request:old", "shift_request:missing"],
    })
    expect(found).toEqual(new Set(["shift_request:old"]))
    expect(
      await listExistingSystemNotificationPublicationKeys({ database, publicationKeys: [""] }),
    ).toBeInstanceOf(Error)
  })

  test("公開操作はplainな入力を検証し、業務statementと同じbatchに参加できる", async () => {
    const database = await createLocalD1Database({ schema: notificationSchema })
    await execSql(database, "CREATE TABLE business_effects (id TEXT PRIMARY KEY)")
    await insertAccount(database, "account-public", "active")
    const input = {
      database,
      publications: [
        {
          message: {
            id: testLiteralId("message-public"),
            kind: "chat:message",
            title: "通知",
            body: "本文",
            source: { type: "chat:message", id: "chat-public" },
            action: { type: "chat:channel", id: "channel-public" },
            resourceScope: { type: "care:facility", id: "facility-public" },
            priority: "normal" as const,
            publicationKey: "chat:public:account-public",
            createdAt: new Date(1_000),
          },
          deliveries: [
            {
              id: testLiteralId("delivery-public"),
              recipientAccountId: testAccountId("account-public"),
              deliveredAt: new Date(1_000),
            },
          ],
        },
      ],
    }
    const statements = prepareSystemNotificationPublicationBatch(input)
    if (statements instanceof Error) throw statements
    expect(statements).toHaveLength(4)
    await database.batch([
      database.prepare("INSERT INTO business_effects (id) VALUES ('business-public')"),
      ...statements,
    ])
    expect(
      await database.prepare("SELECT count(*) FROM business_effects").first<number>("count(*)"),
    ).toBe(1)
    expect(
      await database
        .prepare("SELECT count(*) FROM system_notification_deliveries")
        .first<number>("count(*)"),
    ).toBe(1)
    expect(
      prepareSystemNotificationPublicationBatch({
        ...input,
        publications: [{ ...input.publications[0]!, deliveries: [] }],
      }),
    ).toBeInstanceOf(Error)
  })

  test("複数のMessageとDeliveryを件数非依存の4 queryで原子的にpublish・retryする", async () => {
    let queryCount = 0
    const database = await createLocalD1Database({
      schema: notificationSchema,
      onQuery: () => {
        queryCount += 1
      },
    })
    const accounts = Array.from({ length: 200 }, (_, index) =>
      testAccountId(`account-${index + 1}`),
    )
    await database.batch(
      accounts.map((accountId) =>
        database
          .prepare(
            `INSERT INTO system_accounts
               (id, status, token_version, created_at, updated_at)
             VALUES (?1, 'active', 0, 1000, 1000)`,
          )
          .bind(accountId),
      ),
    )
    const repository = new SystemNotificationRepository({ context: { env: { DB: database } } })
    const publications = accounts.map((accountId, index) => {
      const message = createMessage(
        `message-${index + 1}`,
        `system:test:batch-${index + 1}`,
        `source-${index + 1}`,
      )
      return {
        message,
        deliveries: createDeliveryBatch([
          createDelivery({
            id: `delivery-${index + 1}`,
            messageId: message.id,
            recipientAccountId: accountId,
          }),
        ]),
      }
    })
    const statements = repository.preparePublishBatch(publications)
    if (statements instanceof Error) throw statements
    expect(statements).toHaveLength(4)
    queryCount = 0
    await database.batch([...statements])
    expect(queryCount).toBe(4)
    const retries = accounts.map((accountId, index) => {
      const message = createMessage(
        `retry-${index + 1}`,
        `system:test:batch-${index + 1}`,
        `source-${index + 1}`,
      )
      return {
        message,
        deliveries: createDeliveryBatch([
          createDelivery({
            id: `retry-delivery-${index + 1}`,
            messageId: message.id,
            recipientAccountId: accountId,
          }),
        ]),
      }
    })
    const replayStatements = repository.preparePublishBatch(retries)
    if (replayStatements instanceof Error) throw replayStatements
    queryCount = 0
    await database.batch([...replayStatements])
    expect(queryCount).toBe(4)
    expect(
      await database
        .prepare("SELECT count(*) FROM system_notification_messages")
        .first<number>("count(*)"),
    ).toBe(200)
    expect(
      await database
        .prepare("SELECT count(*) FROM system_notification_deliveries")
        .first<number>("count(*)"),
    ).toBe(200)
  })

  test("業務statementと複数通知は無効Account時に全rollbackする", async () => {
    const database = await createLocalD1Database({ schema: notificationSchema })
    await execSql(database, "CREATE TABLE business_effects (id TEXT PRIMARY KEY)")
    await insertAccount(database, "account-active", "active")
    await insertAccount(database, "account-suspended", "suspended")
    const publications = ["account-active", "account-suspended"].map((accountId, index) => {
      const message = createScopedMessage(
        `message-batch-${index + 1}`,
        `care:shift:batch-${index + 1}`,
      )
      return {
        message,
        deliveries: createDeliveryBatch([
          createDelivery({
            id: `delivery-batch-${index + 1}`,
            messageId: message.id,
            recipientAccountId: accountId,
          }),
        ]),
      }
    })
    const repository = new SystemNotificationRepository({ context: { env: { DB: database } } })
    const statements = repository.preparePublishBatch(publications)
    if (statements instanceof Error) throw statements
    await expect(
      database.batch([
        database.prepare("INSERT INTO business_effects (id) VALUES ('business-1')"),
        ...statements,
      ]),
    ).rejects.toThrow()
    for (const table of [
      "business_effects",
      "system_notification_messages",
      "system_notification_resource_scopes",
      "system_notification_deliveries",
    ]) {
      expect(
        await database.prepare(`SELECT count(*) FROM ${table}`).first<number>("count(*)"),
      ).toBe(0)
    }
  })

  test("複数通知の再送で内容・scope・宛先の相違を全件拒否する", async () => {
    const database = await createLocalD1Database({ schema: notificationSchema })
    await insertAccount(database, "account-one", "active")
    await insertAccount(database, "account-two", "active")
    const repository = new SystemNotificationRepository({ context: { env: { DB: database } } })
    const original = createScopedMessage("original-message", "care:shift:batch-retry")
    const first = repository.preparePublishBatch([
      {
        message: original,
        deliveries: createDeliveryBatch([
          createDelivery({
            id: "original-delivery",
            messageId: original.id,
            recipientAccountId: "account-one",
          }),
        ]),
      },
    ])
    if (first instanceof Error) throw first
    await database.batch([...first])

    for (const [index, change] of [
      { priority: "critical" },
      { resourceScope: { type: "care:facility", id: "facility-2" } },
    ].entries()) {
      const changed = NotificationMessageEntity.create({
        id: testLiteralId(`changed-message-${index}`),
        kind: original.kind,
        title: original.title,
        body: original.body,
        source: original.source,
        action: original.action,
        resourceScope: original.resourceScope,
        priority: original.priority,
        publicationKey: original.publicationKey,
        createdAt: original.createdAt,
        ...change,
      })
      if (changed instanceof Error) throw changed
      const replay = repository.preparePublishBatch([
        {
          message: changed,
          deliveries: createDeliveryBatch([
            createDelivery({
              id: `changed-delivery-${index}`,
              messageId: changed.id,
              recipientAccountId: "account-one",
            }),
          ]),
        },
      ])
      if (replay instanceof Error) throw replay
      await expect(database.batch([...replay])).rejects.toThrow()
    }

    const changedRecipient = createScopedMessage("changed-recipient", "care:shift:batch-retry")
    const replay = repository.preparePublishBatch([
      {
        message: changedRecipient,
        deliveries: createDeliveryBatch([
          createDelivery({
            id: "changed-recipient-delivery",
            messageId: changedRecipient.id,
            recipientAccountId: "account-two",
          }),
        ]),
      },
    ])
    if (replay instanceof Error) throw replay
    await expect(database.batch([...replay])).rejects.toThrow()
    expect(
      await database
        .prepare("SELECT count(*) FROM system_notification_deliveries")
        .first<number>("count(*)"),
    ).toBe(1)
  })

  test("200 AccountへのMessageとDeliveryを件数非依存の3 queryで不可分にfan-outする", async () => {
    let queryCount = 0
    const database = await createLocalD1Database({
      schema: notificationSchema,
      onQuery: () => {
        queryCount += 1
      },
    })
    const accounts = Array.from({ length: 200 }, (_, index) =>
      testAccountId(`account-${index + 1}`),
    )

    await database.batch(
      accounts.map((accountId) =>
        database
          .prepare(
            `INSERT INTO system_accounts
               (id, status, token_version, created_at, updated_at)
             VALUES (?1, 'active', 0, 1000, 1000)`,
          )
          .bind(accountId),
      ),
    )

    const message = createMessage("message-fan-out")
    const deliveries = createDeliveryBatch(
      accounts.map((accountId, index) =>
        createDelivery({
          id: `delivery-${index + 1}`,
          messageId: message.id,
          recipientAccountId: accountId,
        }),
      ),
    )
    const repository = new SystemNotificationRepository({ context: { env: { DB: database } } })
    const publish = new PublishSystemNotification({ notificationRepository: repository })

    queryCount = 0
    expect(await publish.execute({ message, deliveries })).toEqual({ kind: "published" })
    expect(queryCount).toBe(3)

    const deliveryCount = await database
      .prepare("SELECT count(*) AS count FROM system_notification_deliveries")
      .first<number>("count")
    expect(deliveryCount).toBe(200)
  })

  test("1 Accountでも無効ならMessageと他のDeliveryを含め全rollbackする", async () => {
    const database = await createLocalD1Database({ schema: notificationSchema })
    await insertAccount(database, "account-active", "active")
    await insertAccount(database, "account-suspended", "suspended")

    const message = createMessage("message-rollback")
    const deliveries = createDeliveryBatch([
      createDelivery({
        id: "delivery-active",
        messageId: message.id,
        recipientAccountId: "account-active",
      }),
      createDelivery({
        id: "delivery-suspended",
        messageId: message.id,
        recipientAccountId: "account-suspended",
      }),
    ])
    const repository = new SystemNotificationRepository({ context: { env: { DB: database } } })
    const publish = new PublishSystemNotification({ notificationRepository: repository })

    expect(await publish.execute({ message, deliveries })).toBeInstanceOf(Error)
    expect(
      await database
        .prepare("SELECT count(*) AS count FROM system_notification_messages")
        .first<number>("count"),
    ).toBe(0)
    expect(
      await database
        .prepare("SELECT count(*) AS count FROM system_notification_deliveries")
        .first<number>("count"),
    ).toBe(0)
  })

  test("同じpublication keyの再送は元のMessageとDeliveryへ収束する", async () => {
    const database = await createLocalD1Database({ schema: notificationSchema })
    await insertAccount(database, "4f810255-55d5-43c8-b43f-2df5e7bf5a3c", "active")
    const repository = new SystemNotificationRepository({ context: { env: { DB: database } } })
    const publish = new PublishSystemNotification({ notificationRepository: repository })
    const first = createMessage("message-original", "system:test:publication-1", "source-1")
    const firstDeliveries = createDeliveryBatch([
      createDelivery({
        id: "delivery-original",
        messageId: first.id,
        recipientAccountId: "4f810255-55d5-43c8-b43f-2df5e7bf5a3c",
      }),
    ])
    expect(await publish.execute({ message: first, deliveries: firstDeliveries })).toEqual({
      kind: "published",
    })

    const retry = createMessage("message-retry", "system:test:publication-1", "source-1")
    const retryDeliveries = createDeliveryBatch([
      createDelivery({
        id: "delivery-retry",
        messageId: retry.id,
        recipientAccountId: "4f810255-55d5-43c8-b43f-2df5e7bf5a3c",
      }),
    ])
    expect(await publish.execute({ message: retry, deliveries: retryDeliveries })).toEqual({
      kind: "published",
    })
    expect(
      await database
        .prepare("SELECT id FROM system_notification_messages WHERE dedupe_key = ?1")
        .bind("system:test:publication-1")
        .first<string>("id"),
    ).toBe(testLiteralId("message-original"))
    expect(
      await database.prepare("SELECT id FROM system_notification_deliveries").first<string>("id"),
    ).toBe(testLiteralId("delivery-original"))
    const stored = await repository.findByDeliveryIdForAccount(
      firstDeliveries.deliveries[0]!.id,
      zAccountId.parse("4f810255-55d5-43c8-b43f-2df5e7bf5a3c"),
    )
    expect(stored).not.toBeInstanceOf(Error)
    if (stored instanceof Error || stored === null) throw stored ?? new Error("missing delivery")
    expect(stored.message.publicationKey).toBe("system:test:publication-1")
  })

  test("同じpublication keyで本文や宛先を変えた再送は全件rollbackする", async () => {
    const database = await createLocalD1Database({ schema: notificationSchema })
    await insertAccount(database, "4f810255-55d5-43c8-b43f-2df5e7bf5a3c", "active")
    await insertAccount(database, "account-extra", "active")
    const repository = new SystemNotificationRepository({ context: { env: { DB: database } } })
    const publish = new PublishSystemNotification({ notificationRepository: repository })
    const original = createMessage("message-original", "system:test:publication-2", "source-2")
    const originalDeliveries = createDeliveryBatch([
      createDelivery({
        id: "delivery-original",
        messageId: original.id,
        recipientAccountId: "4f810255-55d5-43c8-b43f-2df5e7bf5a3c",
      }),
    ])
    expect(await publish.execute({ message: original, deliveries: originalDeliveries })).toEqual({
      kind: "published",
    })

    const changedContent = NotificationMessageEntity.create({
      id: testLiteralId("message-changed"),
      kind: original.kind,
      title: "Different content",
      body: original.body,
      source: original.source,
      publicationKey: original.publicationKey,
      createdAt: original.createdAt,
    })
    if (changedContent instanceof Error) throw changedContent
    expect(
      await publish.execute({
        message: changedContent,
        deliveries: createDeliveryBatch([
          createDelivery({
            id: "delivery-changed",
            messageId: changedContent.id,
            recipientAccountId: "4f810255-55d5-43c8-b43f-2df5e7bf5a3c",
          }),
        ]),
      }),
    ).toBeInstanceOf(Error)

    const changedRecipient = createMessage("message-extra", "system:test:publication-2", "source-2")
    expect(
      await publish.execute({
        message: changedRecipient,
        deliveries: createDeliveryBatch([
          createDelivery({
            id: "delivery-extra",
            messageId: changedRecipient.id,
            recipientAccountId: "account-extra",
          }),
        ]),
      }),
    ).toBeInstanceOf(Error)
    expect(
      await database
        .prepare("SELECT count(*) FROM system_notification_deliveries")
        .first<number>("count(*)"),
    ).toBe(1)
  })

  test("publication key付きでも無効なAccountを含めば全件rollbackする", async () => {
    const database = await createLocalD1Database({ schema: notificationSchema })
    await insertAccount(database, "account-active", "active")
    await insertAccount(database, "account-suspended", "suspended")
    const message = createMessage("message-keyed-rollback", "system:test:publication-3")
    const deliveries = createDeliveryBatch([
      createDelivery({
        id: "delivery-active",
        messageId: message.id,
        recipientAccountId: "account-active",
      }),
      createDelivery({
        id: "delivery-suspended",
        messageId: message.id,
        recipientAccountId: "account-suspended",
      }),
    ])
    const repository = new SystemNotificationRepository({ context: { env: { DB: database } } })
    expect(
      await new PublishSystemNotification({ notificationRepository: repository }).execute({
        message,
        deliveries,
      }),
    ).toBeInstanceOf(Error)
    expect(
      await database
        .prepare("SELECT count(*) FROM system_notification_messages")
        .first<number>("count(*)"),
    ).toBe(0)
    expect(
      await database
        .prepare("SELECT count(*) FROM system_notification_deliveries")
        .first<number>("count(*)"),
    ).toBe(0)
  })

  test("優先度・opaque action・resource scopeを保存し、属性を変えた再送は拒否する", async () => {
    const database = await createLocalD1Database({ schema: notificationSchema })
    await insertAccount(database, "4f810255-55d5-43c8-b43f-2df5e7bf5a3c", "active")
    const repository = new SystemNotificationRepository({ context: { env: { DB: database } } })
    const publish = new PublishSystemNotification({ notificationRepository: repository })
    const message = createScopedMessage("message-scoped", "care:shift:reminder-1")
    const deliveries = createDeliveryBatch([
      createDelivery({
        id: "delivery-scoped",
        messageId: message.id,
        recipientAccountId: "4f810255-55d5-43c8-b43f-2df5e7bf5a3c",
      }),
    ])
    expect(await publish.execute({ message, deliveries })).toEqual({ kind: "published" })
    const saved = await repository.findByDeliveryIdForAccount(
      deliveries.deliveries[0]!.id,
      zAccountId.parse("4f810255-55d5-43c8-b43f-2df5e7bf5a3c"),
    )
    expect(saved).not.toBeInstanceOf(Error)
    if (saved instanceof Error || saved === null) throw saved ?? new Error("missing delivery")
    expect(saved.message).toMatchObject({
      priority: "high",
      action: { type: "care:shift_request", id: "facility-1" },
      resourceScope: { type: "care:facility", id: "facility-1" },
    })

    for (const [index, changedField] of [
      { priority: "critical" },
      { action: { type: "care:shift_request", id: "facility-2" } },
      { resourceScope: { type: "care:facility", id: "facility-2" } },
      { resourceScope: null },
    ].entries()) {
      const changed = NotificationMessageEntity.create({
        id: testLiteralId(`message-scoped-retry-${index}`),
        kind: message.kind,
        title: message.title,
        body: message.body,
        source: message.source,
        action: message.action,
        resourceScope: message.resourceScope,
        priority: message.priority,
        publicationKey: message.publicationKey,
        createdAt: message.createdAt,
        ...changedField,
      })
      if (changed instanceof Error) throw changed
      expect(
        await publish.execute({
          message: changed,
          deliveries: createDeliveryBatch([
            createDelivery({
              id: `delivery-scoped-retry-${index}`,
              messageId: changed.id,
              recipientAccountId: "4f810255-55d5-43c8-b43f-2df5e7bf5a3c",
            }),
          ]),
        }),
      ).toBeInstanceOf(Error)
    }
    expect(
      await database
        .prepare("SELECT count(*) FROM system_notification_resource_scopes")
        .first<number>("count(*)"),
    ).toBe(1)
  })

  test("resource scope付き配信の一部失敗はMessage・scope・Deliveryを全rollbackする", async () => {
    const database = await createLocalD1Database({ schema: notificationSchema })
    await insertAccount(database, "account-active", "active")
    await insertAccount(database, "account-suspended", "suspended")
    const message = createScopedMessage("message-scoped-failure", "care:shift:reminder-2")
    const deliveries = createDeliveryBatch([
      createDelivery({
        id: "delivery-scoped-active",
        messageId: message.id,
        recipientAccountId: "account-active",
      }),
      createDelivery({
        id: "delivery-scoped-suspended",
        messageId: message.id,
        recipientAccountId: "account-suspended",
      }),
    ])
    const repository = new SystemNotificationRepository({ context: { env: { DB: database } } })
    expect(
      await new PublishSystemNotification({ notificationRepository: repository }).execute({
        message,
        deliveries,
      }),
    ).toBeInstanceOf(Error)
    for (const table of [
      "system_notification_messages",
      "system_notification_resource_scopes",
      "system_notification_deliveries",
    ]) {
      expect(
        await database.prepare(`SELECT count(*) FROM ${table}`).first<number>("count(*)"),
      ).toBe(0)
    }
  })

  test("他Accountからreceiptを隠し、既読時刻を最初の遷移から後退も上書きもしない", async () => {
    const database = await createLocalD1Database({ schema: notificationSchema })
    await insertAccount(database, "4f810255-55d5-43c8-b43f-2df5e7bf5a3c", "active")
    await insertAccount(database, "cd2c4c4e-c038-4a89-8411-6f779077ac7e", "active")

    const message = createMessage("message-read")
    const deliveries = createDeliveryBatch([
      createDelivery({
        id: "delivery-read",
        messageId: message.id,
        recipientAccountId: "4f810255-55d5-43c8-b43f-2df5e7bf5a3c",
      }),
    ])
    const repository = new SystemNotificationRepository({ context: { env: { DB: database } } })
    const publish = new PublishSystemNotification({ notificationRepository: repository })
    const markRead = new MarkSystemNotificationRead({ notificationRepository: repository })
    const ownerAccountId = zAccountId.parse("4f810255-55d5-43c8-b43f-2df5e7bf5a3c")
    const otherAccountId = zAccountId.parse("cd2c4c4e-c038-4a89-8411-6f779077ac7e")

    expect(await publish.execute({ message, deliveries })).toEqual({ kind: "published" })
    expect(
      await repository.findDeliveryByIdForAccount(deliveries.deliveries[0]!.id, otherAccountId),
    ).toBeNull()
    expect(
      await markRead.execute({
        deliveryId: deliveries.deliveries[0]!.id,
        recipientAccountId: otherAccountId,
        readAt: new Date(3_000),
      }),
    ).toEqual({ kind: "not_found" })
    expect(
      await markRead.execute({
        deliveryId: deliveries.deliveries[0]!.id,
        recipientAccountId: ownerAccountId,
        readAt: new Date(1_999),
      }),
    ).toEqual({ kind: "rejected", reason: "read_before_delivery" })

    const marked = await markRead.execute({
      deliveryId: deliveries.deliveries[0]!.id,
      recipientAccountId: ownerAccountId,
      readAt: new Date(3_000),
    })
    expect(marked).not.toBeInstanceOf(Error)
    if (marked instanceof Error) throw marked
    expect(marked.kind).toBe("marked")
    if (marked.kind !== "marked") return
    expect(marked.delivery.readAt).toEqual(new Date(3_000))

    expect(
      await markRead.execute({
        deliveryId: deliveries.deliveries[0]!.id,
        recipientAccountId: ownerAccountId,
        readAt: new Date(2_500),
      }),
    ).toEqual({ kind: "rejected", reason: "transition_before_last_update" })

    const idempotent = await markRead.execute({
      deliveryId: deliveries.deliveries[0]!.id,
      recipientAccountId: ownerAccountId,
      readAt: new Date(4_000),
    })
    expect(idempotent).not.toBeInstanceOf(Error)
    if (idempotent instanceof Error) throw idempotent
    expect(idempotent.kind).toBe("marked")
    if (idempotent.kind !== "marked") return
    expect(idempotent.delivery.readAt).toEqual(new Date(3_000))
  })

  test("Account単位の一覧・未読件数・一括既読・破棄をcanonical Deliveryだけで処理する", async () => {
    const database = await createLocalD1Database({ schema: notificationSchema })
    await insertAccount(database, "4f810255-55d5-43c8-b43f-2df5e7bf5a3c", "active")
    await insertAccount(database, "cd2c4c4e-c038-4a89-8411-6f779077ac7e", "active")
    const repository = new SystemNotificationRepository({ context: { env: { DB: database } } })

    for (const [index, accountId] of [
      "4f810255-55d5-43c8-b43f-2df5e7bf5a3c",
      "4f810255-55d5-43c8-b43f-2df5e7bf5a3c",
      "cd2c4c4e-c038-4a89-8411-6f779077ac7e",
    ].entries()) {
      const message = createMessage(`message-list-${index + 1}`)
      const deliveries = createDeliveryBatch([
        createDelivery({
          id: `delivery-list-${index + 1}`,
          messageId: message.id,
          recipientAccountId: accountId,
        }),
      ])
      expect(
        await new PublishSystemNotification({ notificationRepository: repository }).execute({
          message,
          deliveries,
        }),
      ).toEqual({ kind: "published" })
    }

    const accountId = zAccountId.parse("4f810255-55d5-43c8-b43f-2df5e7bf5a3c")
    expect(await repository.countUnreadForAccount(accountId)).toBe(2)

    const page = await repository.findMany({
      recipientAccountId: accountId,
      read: false,
      limit: 1,
      offset: 0,
    })
    expect(page).not.toBeInstanceOf(Error)
    if (page instanceof Error) throw page
    expect(page.total).toBe(2)
    expect(page.items).toHaveLength(1)
    expect(page.items[0]?.message.title).toBe("System test notification")
    expect(String(page.items[0]?.delivery.recipientAccountId)).toBe(
      "4f810255-55d5-43c8-b43f-2df5e7bf5a3c",
    )

    expect(await repository.markAllDeliveriesRead(accountId, new Date(3_000))).toBe(2)
    expect(await repository.countUnreadForAccount(accountId)).toBe(0)
    expect(
      await repository.dismissDelivery(
        page.items[0]!.delivery.id,
        zAccountId.parse("cd2c4c4e-c038-4a89-8411-6f779077ac7e"),
        new Date(4_000),
      ),
    ).toBe(false)
    expect(
      await repository.dismissDelivery(page.items[0]!.delivery.id, accountId, new Date(4_000)),
    ).toBe(true)
    expect(
      await repository.findByDeliveryIdForAccount(page.items[0]!.delivery.id, accountId),
    ).toBeNull()
  })

  test("dismiss後の同一publication再送はDeliveryを復活させない", async () => {
    const database = await createLocalD1Database({ schema: notificationSchema })
    await insertAccount(database, "4f810255-55d5-43c8-b43f-2df5e7bf5a3c", "active")
    const repository = new SystemNotificationRepository({ context: { env: { DB: database } } })
    const message = createMessage("dismiss-message", "system:test:dismiss-1", "source-dismiss")
    const deliveries = createDeliveryBatch([
      createDelivery({
        id: "dismiss-delivery",
        messageId: message.id,
        recipientAccountId: "4f810255-55d5-43c8-b43f-2df5e7bf5a3c",
      }),
    ])
    expect(
      await new PublishSystemNotification({ notificationRepository: repository }).execute({
        message,
        deliveries,
      }),
    ).toEqual({ kind: "published" })
    const accountId = zAccountId.parse("4f810255-55d5-43c8-b43f-2df5e7bf5a3c")
    expect(
      await repository.dismissDelivery(deliveries.deliveries[0]!.id, accountId, new Date(3_000)),
    ).toBe(true)
    const retry = createMessage("retry-message", "system:test:dismiss-1", "source-dismiss")
    const replay = repository.preparePublishBatch([
      {
        message: retry,
        deliveries: createDeliveryBatch([
          createDelivery({
            id: "retry-delivery",
            messageId: retry.id,
            recipientAccountId: "4f810255-55d5-43c8-b43f-2df5e7bf5a3c",
          }),
        ]),
      },
    ])
    if (replay instanceof Error) throw replay
    await database.batch([...replay])
    expect(await repository.countUnreadForAccount(accountId)).toBe(0)
    expect(
      await repository.findMany({
        recipientAccountId: accountId,
        read: null,
        limit: 10,
        offset: 0,
      }),
    ).toMatchObject({ total: 0, items: [] })
    expect(
      await database
        .prepare("SELECT count(*) FROM system_notification_deliveries")
        .first<number>("count(*)"),
    ).toBe(1)
    expect(
      await database
        .prepare("SELECT dismissed_at FROM system_notification_deliveries")
        .first<number>("dismissed_at"),
    ).toBe(3_000)
  })
})

function createMessage(
  id: string,
  publicationKey: string | null = null,
  sourceId = `source-${id}`,
): NotificationMessageEntity {
  const message = NotificationMessageEntity.create({
    id: notificationTestId(id),
    kind: "system:test.created",
    title: "System test notification",
    body: "plain text body",
    source: { type: "system:test.source", id: sourceId },
    publicationKey,
    createdAt: new Date(1_000),
  })

  if (message instanceof Error) throw message
  return message
}

function createScopedMessage(id: string, publicationKey: string): NotificationMessageEntity {
  const message = NotificationMessageEntity.create({
    id: notificationTestId(id),
    kind: "care:shift.reminder",
    title: "Shift reminder",
    body: "Submit your shift request",
    source: { type: "care:shift.request", id: "request-1" },
    action: { type: "care:shift_request", id: "facility-1" },
    resourceScope: { type: "care:facility", id: "facility-1" },
    priority: "high",
    publicationKey,
    createdAt: new Date(1_000),
  })
  if (message instanceof Error) throw message
  return message
}

function createDelivery(props: {
  id: string
  messageId: string
  recipientAccountId: string
}): NotificationDeliveryEntity {
  const delivery = NotificationDeliveryEntity.create({
    id: notificationTestId(props.id),
    messageId: notificationTestId(props.messageId),
    recipientAccountId: testAccountId(props.recipientAccountId),
    deliveredAt: new Date(2_000),
    readAt: null,
    dismissedAt: null,
  })

  if (delivery instanceof Error) throw delivery
  return delivery
}

function createDeliveryBatch(
  deliveries: Array<NotificationDeliveryEntity>,
): NotificationDeliveryBatchValue {
  const batch = NotificationDeliveryBatchValue.create(deliveries)

  if (batch instanceof Error) throw batch
  return batch
}

async function insertAccount(
  database: D1Database,
  accountId: string,
  status: "active" | "suspended",
): Promise<void> {
  await database
    .prepare(
      `INSERT INTO system_accounts
         (id, status, token_version, created_at, updated_at)
       VALUES (?1, ?2, 0, 1000, 1000)`,
    )
    .bind(testAccountId(accountId), status)
    .run()
}

/** テスト用の通知 ID を UUID にそろえる。UUID はそのまま返す。 */
function notificationTestId(value: string): string {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(value)
    ? value
    : testLiteralId(value)
}
