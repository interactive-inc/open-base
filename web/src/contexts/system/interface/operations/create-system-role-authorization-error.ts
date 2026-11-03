import { SystemForbiddenError, SystemSelfAssignmentForbiddenError } from "@system/interface/errors"

/** 別の入口からも、ロール変更の拒否を同じ応答で返す。 */
export function createSystemRoleAuthorizationError(reason: "forbidden" | "self_assignment") {
  return reason === "self_assignment"
    ? new SystemSelfAssignmentForbiddenError()
    : new SystemForbiddenError()
}
