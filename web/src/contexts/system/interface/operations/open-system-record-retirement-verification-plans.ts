import { RecordRetirementVerificationPlanRepository } from "@system/infrastructure/repositories/records/record-retirement-verification-plan.repository"

/** 撤去検査計画を照合文付きで読み書きするSystemの保存口を開く。 */
export function openSystemRecordRetirementVerificationPlans(
  context: ConstructorParameters<typeof RecordRetirementVerificationPlanRepository>[0],
): RecordRetirementVerificationPlanRepository {
  return new RecordRetirementVerificationPlanRepository(context)
}
