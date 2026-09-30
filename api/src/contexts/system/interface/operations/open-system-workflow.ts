import { SystemD1WorkflowAdapter } from "@system/infrastructure/adapters/workflow/system-d1-workflow.adapter"

/** 提案と判断lifecycleを呼び出し側の照合文と同じD1 batchで永続化する書込み口を開く。 */
export function openSystemWorkflow(
  context: ConstructorParameters<typeof SystemD1WorkflowAdapter>[0],
): SystemD1WorkflowAdapter {
  return new SystemD1WorkflowAdapter(context)
}
