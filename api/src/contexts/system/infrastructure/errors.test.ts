import { InfrastructureError, type InfrastructureErrorContext } from "@system/infrastructure/errors"
import { expect, test } from "bun:test"

class TestInfrastructureError extends InfrastructureError {
  constructor(context: InfrastructureErrorContext, options: ErrorOptions = {}) {
    super("TestInfrastructureError", "persistence failed", context, options)
  }
}

test("infrastructure errors preserve operation context and cause", () => {
  const cause = new Error("database unavailable")
  const error = new TestInfrastructureError(
    { entity: "account", entityId: "account-1", operation: "save" },
    { cause },
  )

  expect(error).toMatchObject({
    cause,
    entity: "account",
    entityId: "account-1",
    message: "persistence failed",
    name: "TestInfrastructureError",
    operation: "save",
  })
})

test("infrastructure errors normalize an omitted entity id to null", () => {
  expect(new TestInfrastructureError({ entity: "account", operation: "list" }).entityId).toBeNull()
})
