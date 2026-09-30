import { ExternalAssertionEntity } from "@system/domain/entities/external-assertion.entity"
import { ReconciliationRunEntity } from "@system/domain/entities/reconciliation-run.entity"
import type {
  SystemReconciliationRepository,
  SystemReconciliationWriteResult,
} from "@system/infrastructure/repositories/integration/system-reconciliation.repository"

type Context = Readonly<{
  write: SystemReconciliationRepository["write"]
}>

type Command = Readonly<{
  assertion: unknown
  reconciliation: unknown
}>

/** immutable external assertionとsemantic item差分を不可分に記録する。 */
export class ReconcileIntegrationExchange {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(command: Command): Promise<SystemReconciliationWriteResult | Error> {
    const assertion = ExternalAssertionEntity.create(command.assertion)
    if (assertion instanceof Error) return assertion
    const run = ReconciliationRunEntity.create(command.reconciliation)
    if (run instanceof Error) return run
    return this.c.write(assertion, run)
  }
}
