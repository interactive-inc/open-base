import type {
  SystemAttachmentStorageContext,
  SystemClockContext,
  SystemD1Context,
  SystemDatabaseContext,
} from "@system/configuration/system-context"
import type { AttachmentBytes } from "@system/domain/definitions/attachments/attachment-bytes.definition"
import type { StartSystemProcedureTask } from "@system/domain/policies/decision-task.policy"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { ProcedureKey } from "@system/domain/schemas/workflow/procedure-key.schema"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import type { RecordPreservationProposalValue } from "@system/domain/values/records/record-preservation-proposal.value"

/** 所有元の取得資格・原文と、外部で解決した判断資格を明示的に受け取る。 */
export type RecordPreservationSubmissionContext = SystemD1Context &
  SystemDatabaseContext &
  SystemAttachmentStorageContext &
  SystemClockContext &
  Readonly<{
    source: Readonly<{
      ownerContext: string
      recordKind: string
      recordId: string
      sourceNamespace: string
      authorize: () => Promise<Readonly<{ assertions: ReadonlyArray<D1PreparedStatement> }> | Error>
      capture: () => Promise<
        | Readonly<{
            source: PreservedRecordSourceValue
            content: AttachmentBytes
            actorAccountId: string
            sourceAuthorizationRef: unknown
            assertions: ReadonlyArray<D1PreparedStatement>
          }>
        | Error
      >
    }>
    prepareTask: (
      input: Readonly<{
        procedureKey: ProcedureKey
        proposal: RecordPreservationProposalValue
        applicantAccountId: AccountId
        at: Date
      }>,
    ) => Promise<
      | Readonly<{
          definition: Readonly<{ key: string; revision: number }>
          resolved: Readonly<{
            task: StartSystemProcedureTask
            guards: ReadonlyArray<D1PreparedStatement>
          }>
        }>
      | Error
    >
  }>
