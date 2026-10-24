import type { RecordProcedureDecisionContext } from "@system/configuration/record-procedure-decision-context"
import type { SystemAttestationView } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import type { SystemProposalView } from "@system/domain/definitions/workflow/system-proposal-view.definition"

/** 撤去対象と、保存済み判断の再送時に現在の会社資格を検査する接続を受け取る。 */
export type RecordRetirementDecisionContext = RecordProcedureDecisionContext &
  Readonly<{
    env: Readonly<{ ATTACHMENT_KEKS?: string }>
    source: Readonly<{ planId: string; ownerContext: string; sourceNamespace: string }>
    prepareReplay: (
      input: Readonly<{
        proposal: SystemProposalView
        attestation: SystemAttestationView
        at: Date
      }>,
    ) => Promise<Readonly<{ guards: ReadonlyArray<D1PreparedStatement> }> | Error>
  }>
