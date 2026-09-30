import type {
  SystemAttachmentStorageContext,
  SystemClockContext,
  SystemD1Context,
  SystemDatabaseContext,
} from "@system/configuration/system-context"
import type { RecordPreservationSubmissionContext } from "@system/configuration/record-preservation-submission-context"
import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import type { RecordPreservationProposalValue } from "@system/domain/values/records/record-preservation-proposal.value"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"

/** 原記録の再検査と、承認時点・実行時点の判断資格を外部から受け取る。 */
export type RecordPreservationExecutionContext = SystemD1Context &
  SystemDatabaseContext &
  SystemAttachmentStorageContext &
  SystemClockContext &
  Readonly<{
    source: Pick<
      RecordPreservationSubmissionContext["source"],
      "ownerContext" | "recordKind" | "recordId" | "sourceNamespace"
    > &
      Readonly<{
        revalidate: (
          source: PreservedRecordSourceValue,
        ) => Promise<Readonly<{ assertions: ReadonlyArray<D1PreparedStatement> }> | Error>
      }>
    prepareExecution: (
      input: Readonly<{
        applicationId: number
        caseId: string
        seriesId: string
        proposal: RecordPreservationProposalValue
        executorAccountId: AccountId
        executedAt: Date
      }>,
    ) => Promise<ReadonlyArray<D1PreparedStatement> | Error>
  }>
