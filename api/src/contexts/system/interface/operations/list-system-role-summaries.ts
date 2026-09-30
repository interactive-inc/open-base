import { SystemRoleCatalogRepository } from "@system/infrastructure/repositories/iam/system-role-catalog.repository"
import type { SystemRoleSummary } from "@system/interface/operations/read-system-role-summary"

/** 他contextがresourceに割当可能なSystem roleを取得する読み取り契約。 */
export async function listSystemRoleSummaries(
  input: Readonly<{ database: D1Database; resourceType: string }>,
): Promise<ReadonlyArray<SystemRoleSummary> | Error> {
  if (
    !/^[a-z][a-z0-9_]*(?::[a-z][a-z0-9_]*)+$/.test(input.resourceType) ||
    input.resourceType.length > 100
  )
    return new Error("invalid System role resource type")

  const roles = await new SystemRoleCatalogRepository({ env: { DB: input.database } }).findMany()
  if (roles instanceof Error) return roles
  return Object.freeze(
    roles
      .filter((role) => role.resourceType === input.resourceType)
      .map((role) =>
        Object.freeze({
          id: role.id,
          resourceType: role.resourceType,
          name: role.name,
          kind: role.kind,
          permissionKeys: Object.freeze([...role.permissionKeys]),
        }),
      ),
  )
}
