import { describe, expect, test } from "bun:test"
import { ApplicationError } from "@system/application/errors"
import { PermissionValue } from "@system/domain/values/iam/permission.value"
import { requireAnyPermission } from "@system/interface/operations/require-any-permission"
import { Hono } from "hono"

type TestEnvironment = {
  Variables: { permissions: ReadonlySet<string> }
}

function appWith(permissions: ReadonlySet<string>) {
  return new Hono<TestEnvironment>()
    .onError((error, context) => {
      if (error instanceof ApplicationError) {
        return context.json(error.body, error.status)
      }
      throw error
    })
    .use("*", async (context, next) => {
      context.set("permissions", permissions)
      await next()
    })
    .get(
      "/resource",
      requireAnyPermission(
        PermissionValue.known("example:read"),
        PermissionValue.known("example:admin"),
      ),
      (context) => context.json({ allowed: true }),
    )
}

describe("requireAnyPermission", () => {
  test("指定permissionのどれかを持つrequestを通す", async () => {
    const response = await appWith(new Set(["example:read"])).request("/resource")

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('{"allowed":true}')
  })

  test("permissionを持たないrequestを403で拒否する", async () => {
    const response = await appWith(new Set()).request("/resource")

    expect(response.status).toBe(403)
  })
})
