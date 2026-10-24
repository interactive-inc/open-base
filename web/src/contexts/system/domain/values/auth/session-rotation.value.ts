import { InvalidSessionError } from "@system/domain/errors"
import { SessionEntity } from "@system/domain/entities/session.entity"

/** 旧SessionEntityの消費と後継SessionEntityの作成を不可分な永続化意図として表す。 */
export class SessionRotationValue {
  private constructor(
    readonly previous: SessionEntity,
    readonly successor: SessionEntity,
  ) {
    Object.freeze(this)
  }

  static create(
    current: SessionEntity,
    successor: SessionEntity,
    rotatedAt: Date,
  ): SessionRotationValue | InvalidSessionError {
    const rotated = current.rotate(rotatedAt)

    if (rotated instanceof InvalidSessionError) return rotated
    if (!SessionRotationValue.isValidSuccessor(current, successor, rotatedAt)) {
      return new InvalidSessionError("invalid_rotation_successor")
    }

    return new SessionRotationValue(rotated, successor)
  }

  private static isValidSuccessor(
    current: SessionEntity,
    successor: SessionEntity,
    rotatedAt: Date,
  ): boolean {
    return (
      successor.accountId === current.accountId &&
      successor.familyId === current.familyId &&
      successor.tokenVersion === current.tokenVersion &&
      successor.authenticatedAt.getTime() === current.authenticatedAt.getTime() &&
      successor.id !== current.id &&
      successor.tokenHash !== current.tokenHash &&
      successor.createdAt.getTime() === rotatedAt.getTime() &&
      successor.rotatedAt === null &&
      successor.revokedAt === null &&
      successor.getUseRejection(rotatedAt) === null
    )
  }
}
