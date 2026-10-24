import { RecordCoveragePageRepository } from "@system/infrastructure/repositories/records/record-coverage-page.repository"

/** 記録網羅ページを照合文付きで読み書きするSystemの保存口を開く。 */
export function openSystemRecordCoveragePages(
  context: ConstructorParameters<typeof RecordCoveragePageRepository>[0],
): RecordCoveragePageRepository {
  return new RecordCoveragePageRepository(context)
}
