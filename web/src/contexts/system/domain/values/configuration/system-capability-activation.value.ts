import {
  REQUIRED_SYSTEM_CAPABILITY_NAMES,
  SYSTEM_CAPABILITY_NAMES,
  type SystemCapabilityName,
} from "@system/domain/catalogs/configuration/system-capability.catalog"
import {
  InvalidSystemCapabilityActivationError,
  type SystemCapabilityActivationProblem,
} from "@system/domain/errors"

type Props = Readonly<{
  implementedCapabilities: ReadonlyArray<string>
  enabledCapabilities: ReadonlyArray<string>
}>

const knownCapabilities = new Set<string>(SYSTEM_CAPABILITY_NAMES)

export class SystemCapabilityActivationValue {
  readonly implementedCapabilities: ReadonlyArray<SystemCapabilityName>
  readonly enabledCapabilities: ReadonlyArray<SystemCapabilityName>
  readonly #enabledCapabilities: ReadonlySet<SystemCapabilityName>

  private static isProps(input: unknown): input is Props {
    if (typeof input !== "object" || input === null || Array.isArray(input)) return false

    const value = input as Readonly<Record<string, unknown>>
    const fields = Object.keys(value).toSorted()

    return (
      fields.length === 2 &&
      fields[0] === "enabledCapabilities" &&
      fields[1] === "implementedCapabilities" &&
      Array.isArray(value.implementedCapabilities) &&
      value.implementedCapabilities.every((capability) => typeof capability === "string") &&
      Array.isArray(value.enabledCapabilities) &&
      value.enabledCapabilities.every((capability) => typeof capability === "string")
    )
  }

  private static collectCapabilities(
    values: ReadonlyArray<string>,
    kind: "enabled" | "implemented",
    problems: SystemCapabilityActivationProblem[],
  ): Set<SystemCapabilityName> {
    const capabilities = new Set<SystemCapabilityName>()

    for (const capability of values) {
      if (!knownCapabilities.has(capability)) {
        problems.push({ code: `unknown_${kind}_capability`, capability })
        continue
      }

      const typedCapability = capability as SystemCapabilityName

      if (capabilities.has(typedCapability)) {
        problems.push({ code: `duplicate_${kind}_capability`, capability })
        continue
      }

      capabilities.add(typedCapability)
    }

    return capabilities
  }

  private constructor(props: {
    implementedCapabilities: ReadonlySet<SystemCapabilityName>
    enabledCapabilities: ReadonlySet<SystemCapabilityName>
  }) {
    this.implementedCapabilities = Object.freeze(
      SYSTEM_CAPABILITY_NAMES.filter((capability) => props.implementedCapabilities.has(capability)),
    )
    this.enabledCapabilities = Object.freeze(
      SYSTEM_CAPABILITY_NAMES.filter((capability) => props.enabledCapabilities.has(capability)),
    )
    this.#enabledCapabilities = new Set(this.enabledCapabilities)
    Object.freeze(this)
  }

  static create(
    input: unknown,
  ): SystemCapabilityActivationValue | InvalidSystemCapabilityActivationError {
    if (!SystemCapabilityActivationValue.isProps(input)) {
      return new InvalidSystemCapabilityActivationError([
        { code: "invalid_activation_shape", capability: null },
      ])
    }

    const problems: SystemCapabilityActivationProblem[] = []
    const implementedCapabilities = SystemCapabilityActivationValue.collectCapabilities(
      input.implementedCapabilities,
      "implemented",
      problems,
    )
    const enabledCapabilities = SystemCapabilityActivationValue.collectCapabilities(
      input.enabledCapabilities,
      "enabled",
      problems,
    )

    for (const capability of REQUIRED_SYSTEM_CAPABILITY_NAMES) {
      if (!implementedCapabilities.has(capability)) {
        problems.push({ code: "missing_required_implementation", capability })
      }
      if (!enabledCapabilities.has(capability)) {
        problems.push({ code: "missing_required_activation", capability })
      }
    }

    for (const capability of enabledCapabilities) {
      if (!implementedCapabilities.has(capability)) {
        problems.push({ code: "capability_not_implemented", capability })
      }
    }

    if (problems.length > 0) {
      return new InvalidSystemCapabilityActivationError(problems)
    }

    return new SystemCapabilityActivationValue({ implementedCapabilities, enabledCapabilities })
  }

  isEnabled(capability: SystemCapabilityName): boolean {
    return this.#enabledCapabilities.has(capability)
  }
}
