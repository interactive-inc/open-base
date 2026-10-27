import { AttachmentPreservationRepository } from "@system/infrastructure/repositories/attachments/attachment-preservation.repository"

/** 添付の保全を、現在の操作資格と監査の検査を含むtransactionで扱う保存口を開く。 */
export function openSystemAttachmentPreservations(
  context: ConstructorParameters<typeof AttachmentPreservationRepository>[0],
): AttachmentPreservationRepository {
  return new AttachmentPreservationRepository(context)
}
