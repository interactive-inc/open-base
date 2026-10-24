import { ReadSystemWorkflowReferencesAdapter } from "@system/infrastructure/adapters/workflow/read-system-workflow-references.adapter"

/** Accountが参加したSystem workflowの最小参照情報を、保存schemaを漏らさずまとめて読む。 */
export function readSystemWorkflowReferences(
  context: ConstructorParameters<typeof ReadSystemWorkflowReferencesAdapter>[0],
  ...input: Parameters<ReadSystemWorkflowReferencesAdapter["readSystemWorkflowReferences"]>
): ReturnType<ReadSystemWorkflowReferencesAdapter["readSystemWorkflowReferences"]> {
  return new ReadSystemWorkflowReferencesAdapter(context).readSystemWorkflowReferences(...input)
}
