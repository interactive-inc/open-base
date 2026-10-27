import { SystemManagedJobRunnerAdapter } from "@system/infrastructure/adapters/events/system-managed-job-runner.adapter"

/** 登録した処理をServiceのleaseで動かし、業務変更と完了記録を一括で確定する。 */
export function runSystemManagedJob(
  context: ConstructorParameters<typeof SystemManagedJobRunnerAdapter>[0],
  ...input: Parameters<SystemManagedJobRunnerAdapter["run"]>
): ReturnType<SystemManagedJobRunnerAdapter["run"]> {
  return new SystemManagedJobRunnerAdapter(context).run(...input)
}
