import {
  systemProposalNumbers,
  systemProposalSeries,
} from "@system/infrastructure/schema/system-procedure"
import { systemCases } from "@system/infrastructure/schema/system-workflow"

/** 業務のdrizzle schemaが外部キーで参照してよいSystem workflowの列。参照整合性だけに使う。 */
export const systemWorkflowTableReferences = Object.freeze({
  proposalNumber: () => systemProposalNumbers.number,
  proposalSeriesId: () => systemProposalSeries.id,
  caseId: () => systemCases.id,
})
