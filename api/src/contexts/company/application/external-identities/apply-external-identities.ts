import {
  ExternalIdentityImportEntity,
  type ExternalIdentityImportInput,
} from "@/contexts/company/domain/entities/external-identity-import.entity"
import {
  ExternalIdentityImportRepository,
  type ExternalIdentityImportResult,
} from "@/contexts/company/infrastructure/repositories/external-identities/external-identity-import.repository"
import type { SystemMachineOperationActor } from "@system/infrastructure/adapters/iam/system-machine-operation-authorization.adapter"

type Context = Readonly<{
  repository: ExternalIdentityImportRepository
  actor: SystemMachineOperationActor
  now: () => Date
}>

/** 機械主体が外部identityの版付き変更を会社の正本へ取り込む。 */
export class ApplyExternalIdentities {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(input: ExternalIdentityImportInput): Promise<ExternalIdentityImportResult> {
    const command = ExternalIdentityImportEntity.create(input)
    if (command instanceof Error) return { kind: "invalid", reason: "input" }
    return this.c.repository.apply(command, this.c.actor, this.c.now())
  }
}
