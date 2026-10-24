import {
  REQUIRED_SYSTEM_CAPABILITY_NAMES,
  SYSTEM_CAPABILITY_NAMES,
} from "@system/domain/catalogs/configuration/system-capability.catalog"
import { InvalidSystemCapabilityActivationError } from "@system/domain/errors"
import { SystemCapabilityActivationValue } from "@system/domain/values/configuration/system-capability-activation.value"
import { describe, expect, test } from "bun:test"

describe("SystemCapabilityActivationValue", () => {
  test("共通supersetから有効なcapabilityをcanonical順で確定する", () => {
    const activation = SystemCapabilityActivationValue.create({
      implementedCapabilities: [...SYSTEM_CAPABILITY_NAMES].toReversed(),
      enabledCapabilities: [...SYSTEM_CAPABILITY_NAMES].toReversed(),
    })

    expect(activation).not.toBeInstanceOf(Error)
    if (activation instanceof Error) return

    expect(activation.implementedCapabilities).toEqual(SYSTEM_CAPABILITY_NAMES)
    expect(activation.enabledCapabilities).toEqual(SYSTEM_CAPABILITY_NAMES)
    expect(activation.isEnabled("events")).toBe(true)
    expect(Object.isFrozen(activation)).toBe(true)
    expect(Object.isFrozen(activation.enabledCapabilities)).toBe(true)
    expect(Object.isFrozen(SYSTEM_CAPABILITY_NAMES)).toBe(true)
    expect(Object.isFrozen(REQUIRED_SYSTEM_CAPABILITY_NAMES)).toBe(true)
  })

  test("shape・未知名・重複をfail closedで拒否する", () => {
    const invalidInputs: unknown[] = [
      null,
      { implementedCapabilities: "all", enabledCapabilities: [] },
      {
        implementedCapabilities: SYSTEM_CAPABILITY_NAMES,
        enabledCapabilities: SYSTEM_CAPABILITY_NAMES,
        ignoredCapabilities: ["oauth"],
      },
      {
        implementedCapabilities: [...SYSTEM_CAPABILITY_NAMES, "unknown", "audit"],
        enabledCapabilities: [...SYSTEM_CAPABILITY_NAMES, "unknown", "audit"],
      },
    ]

    for (const input of invalidInputs) {
      expect(SystemCapabilityActivationValue.create(input)).toBeInstanceOf(
        InvalidSystemCapabilityActivationError,
      )
    }
  })

  test("security coreの未実装・無効化と未実装capabilityの有効化を拒否する", () => {
    const activation = SystemCapabilityActivationValue.create({
      implementedCapabilities: REQUIRED_SYSTEM_CAPABILITY_NAMES.filter(
        (capability) => capability !== "identity",
      ),
      enabledCapabilities: [...REQUIRED_SYSTEM_CAPABILITY_NAMES, "oauth"].filter(
        (capability) => capability !== "http",
      ),
    })

    expect(activation).toBeInstanceOf(InvalidSystemCapabilityActivationError)
    if (!(activation instanceof InvalidSystemCapabilityActivationError)) return

    expect(activation.problems).toContainEqual({
      code: "missing_required_implementation",
      capability: "identity",
    })
    expect(activation.problems).toContainEqual({
      code: "missing_required_activation",
      capability: "http",
    })
    expect(activation.problems).toContainEqual({
      code: "capability_not_implemented",
      capability: "oauth",
    })
    expect(Object.isFrozen(activation.problems)).toBe(true)
  })
})
