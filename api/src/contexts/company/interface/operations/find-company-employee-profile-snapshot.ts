import { EmployeeProfileSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-profile-snapshot.adapter"

/** 本人の人物表示と編集対象の版を読む公開境界。 */
export function findCompanyEmployeeProfileSnapshot(
  c: ConstructorParameters<typeof EmployeeProfileSnapshotAdapter>[0],
  ...input: Parameters<EmployeeProfileSnapshotAdapter["find"]>
): ReturnType<EmployeeProfileSnapshotAdapter["find"]> {
  return new EmployeeProfileSnapshotAdapter(c).find(...input)
}
