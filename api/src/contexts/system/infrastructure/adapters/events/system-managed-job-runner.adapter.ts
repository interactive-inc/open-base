import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { SystemDeliveryEntity } from "@system/domain/entities/system-delivery.entity"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemDeliveryRepository } from "@system/infrastructure/repositories/events/system-delivery.repository"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemServiceOperationAuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-service-operation-authorization.adapter"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"

const systemManagedJobAuditActions = Object.freeze({
  claimed: SYSTEM_AUDIT_ACTIONS.systemManagedJobClaimed,
  succeeded: SYSTEM_AUDIT_ACTIONS.systemManagedJobSucceeded,
  failed: SYSTEM_AUDIT_ACTIONS.systemManagedJobFailed,
  recovered: SYSTEM_AUDIT_ACTIONS.systemManagedJobRecovered,
})

type Context = Readonly<{
  env: Readonly<{ DB: D1Database }>
  handlerKey: string
  workerAccountId: AccountId
  clock: () => Date
  /** 読取と保存文の準備だけを行い、副作用は返したtransaction内で確定する。 */
  prepare: (
    job: SystemDeliveryEntity,
    at: Date,
  ) => Promise<ReadonlyArray<D1PreparedStatement> | Error>
}>

type Outcome = Readonly<{ id: string; status: "succeeded" | "queued" | "dead_letter" | "conflict" }>

/** 登録した処理をServiceのleaseで動かし、業務変更と完了記録を一括で確定する。 */
export class SystemManagedJobRunnerAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(limit: number): Promise<ReadonlyArray<Outcome> | Error> {
    const repository = new SystemDeliveryRepository(this.c)
    const jobs = await repository.findReady({
      handlerKey: this.c.handlerKey,
      at: this.c.clock(),
      limit,
    })
    if (jobs instanceof Error) return jobs
    const outcomes: Outcome[] = []
    for (const job of jobs) {
      const outcome = await this.execute(job)
      if (outcome instanceof Error) return outcome
      outcomes.push(outcome)
    }
    return outcomes
  }

  private async authorization(at: Date) {
    try {
      const tokenVersion = await this.c.env.DB.prepare(
        "SELECT token_version FROM system_accounts WHERE id = ?1",
      )
        .bind(this.c.workerAccountId)
        .first<number>("token_version")
      if (tokenVersion === null) return new Error("managed job Service is unavailable")
      const authorization = await new SystemServiceOperationAuthorizationAdapter(this.c).prepare({
        accountId: this.c.workerAccountId,
        tokenVersion,
        permissions: ["batch:execute"],
        now: at,
      })
      if (authorization === "forbidden") return new Error("managed job Service is not authorized")
      return authorization
    } catch (cause) {
      return new Error("managed job authorization failed", { cause })
    }
  }

  private async execute(original: SystemDeliveryEntity): Promise<Outcome | Error> {
    const repository = new SystemDeliveryRepository(this.c)
    const now = this.c.clock()
    const authorization = await this.authorization(now)
    if (authorization instanceof Error) return authorization
    const recover = await this.recover(original, now, authorization.assertions)
    if (recover instanceof Error) return recover
    if (recover.status === "dead_letter" || recover.status === "conflict")
      return { id: original.id, status: recover.status }
    const current = recover.job
    const material = new SystemPrincipalSecretService()
    const rawToken = material.generateRawSecret()
    if (rawToken instanceof Error) return rawToken
    const hash = await material.hashRawSecret(rawToken)
    if (hash instanceof Error) return hash
    const leased = current.claim(this.c.workerAccountId, hash, now, 60_000)
    if (leased instanceof Error) return leased
    const claimAudit = this.audit(current.id, "claimed", now)
    if (claimAudit instanceof Error) return claimAudit
    const claimed = await repository.update(current, leased, [
      ...authorization.assertions,
      ...claimAudit,
    ])
    if (claimed instanceof Error) return claimed
    if (claimed === "conflict") return { id: current.id, status: "conflict" }
    const prepared = await this.c
      .prepare(leased, now)
      .catch((cause: unknown) => new Error("managed job preparation failed", { cause }))
    const finishedAt = this.c.clock()
    if (prepared instanceof Error) return this.fail(leased, hash, finishedAt)
    const completed = leased.succeed(this.c.workerAccountId, hash, finishedAt)
    if (completed instanceof Error) return completed
    const completion = repository.prepareUpdate(leased, completed)
    if (completion instanceof Error) return completion
    const audit = this.audit(current.id, "succeeded", finishedAt)
    if (audit instanceof Error) return audit
    const currentAuthorization = await this.authorization(finishedAt)
    if (currentAuthorization instanceof Error) return currentAuthorization
    try {
      const statements = [
        ...completion,
        ...authorization.assertions,
        ...currentAuthorization.assertions,
        ...prepared,
        ...audit,
      ]
      const results = await this.c.env.DB.batch(statements)
      if (results.length !== statements.length || results.some((result) => !result.success)) {
        return new Error("managed job completion batch did not succeed")
      }
      return { id: current.id, status: "succeeded" }
    } catch {
      return this.fail(leased, hash, this.c.clock())
    }
  }

  private async fail(
    leased: SystemDeliveryEntity,
    hash: string,
    at: Date,
  ): Promise<Outcome | Error> {
    const authorization = await this.authorization(at)
    if (authorization instanceof Error) return authorization
    const retryAt = new Date(
      at.getTime() + Math.min(3_600_000, 5_000 * 2 ** Math.min(leased.attempt, 10)),
    )
    const failed = leased.fail(this.c.workerAccountId, hash, "handler.failed", at, retryAt)
    if (failed instanceof Error) return failed
    const audit = this.audit(leased.id, "failed", at)
    if (audit instanceof Error) return audit
    const saved = await new SystemDeliveryRepository(this.c).update(leased, failed, [
      ...authorization.assertions,
      ...audit,
    ])
    if (saved instanceof Error) return saved
    if (saved === "conflict") return { id: leased.id, status: "conflict" }
    return { id: leased.id, status: failed.status === "dead_letter" ? "dead_letter" : "queued" }
  }

  private async recover(
    job: SystemDeliveryEntity,
    at: Date,
    assertions: ReadonlyArray<D1PreparedStatement>,
  ) {
    if (job.status === "queued") return { status: "queued" as const, job }
    const recovered = job.recover(at)
    if (recovered instanceof Error) return recovered
    const audit = this.audit(job.id, "recovered", at)
    if (audit instanceof Error) return audit
    const saved = await new SystemDeliveryRepository(this.c).update(job, recovered, [
      ...assertions,
      ...audit,
    ])
    if (saved instanceof Error) return saved
    if (saved === "conflict") return { status: "conflict" as const }
    if (recovered.status === "dead_letter") return { status: "dead_letter" as const }
    return { status: "queued" as const, job: recovered }
  }

  private audit(id: string, action: keyof typeof systemManagedJobAuditActions, at: Date) {
    const event = SystemAuditEventEntity.create({
      actorAccountId: this.c.workerAccountId,
      action: systemManagedJobAuditActions[action],
      targetType: "system:job",
      targetId: id,
      outcome: action === "failed" ? "failed" : "succeeded",
      reasonCode: action === "failed" ? "handler.failed" : null,
      authorizationJson: JSON.stringify({
        permission: "batch:execute",
        handlerKey: this.c.handlerKey,
      }),
      beforeJson: null,
      afterJson: null,
      metadataJson: null,
      occurredAt: at,
    })
    if (event instanceof Error) return event
    return new SystemAuditEventRepository(this.c).prepareAppend(event)
  }
}
