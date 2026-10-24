import type { RecordProcedureDecisionContext } from "@system/configuration/record-procedure-decision-context"
import type { RecordPreservationSubmissionContext } from "@system/configuration/record-preservation-submission-context"

/** 共通の判断資格に、保全する原記録の識別を組み合わせる。 */
export type RecordPreservationDecisionContext = RecordProcedureDecisionContext &
  Readonly<{
    source: Pick<
      RecordPreservationSubmissionContext["source"],
      "ownerContext" | "recordKind" | "recordId" | "sourceNamespace"
    >
  }>
