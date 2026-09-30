import { InvalidSystemProposalError } from "@system/domain/errors"
import type { SystemJsonValue } from "@system/domain/definitions/audit/system-json-value.definition"

const maximumJsonBytes = 1_000_000
const maximumJsonDepth = 100
const maximumWorkUnits = 200_000
const textEncoder = new TextEncoder()

type State = {
  readonly visiting: WeakSet<object>
  workUnits: number
}

/** JSON値の順序・形・容量を固定した、変更不能なSystem canonical JSON。 */
export class CanonicalSystemJsonValue {
  readonly #serialized: string

  private static normalize(
    value: unknown,
    depth: number,
    state: State,
  ): SystemJsonValue | InvalidSystemProposalError {
    state.workUnits += 1
    if (state.workUnits > maximumWorkUnits) {
      return new InvalidSystemProposalError("payload_too_large")
    }
    if (depth > maximumJsonDepth) return new InvalidSystemProposalError("invalid_json")
    if (value === null || typeof value === "boolean" || typeof value === "string") return value
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : new InvalidSystemProposalError("invalid_json")
    }
    if (typeof value !== "object") return new InvalidSystemProposalError("invalid_json")
    if (state.visiting.has(value)) return new InvalidSystemProposalError("invalid_json")

    const prototype = Object.getPrototypeOf(value)
    if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
      return new InvalidSystemProposalError("invalid_json")
    }

    const descriptors = Object.getOwnPropertyDescriptors(value)
    const keys = Reflect.ownKeys(descriptors)
    if (keys.some((key) => typeof key === "symbol")) {
      return new InvalidSystemProposalError("invalid_json")
    }

    state.workUnits += keys.length
    if (state.workUnits > maximumWorkUnits) {
      return new InvalidSystemProposalError("payload_too_large")
    }

    state.visiting.add(value)
    try {
      if (Array.isArray(value)) {
        const lengthDescriptor = descriptors.length
        if (
          lengthDescriptor === undefined ||
          !("value" in lengthDescriptor) ||
          typeof lengthDescriptor.value !== "number" ||
          !Number.isSafeInteger(lengthDescriptor.value) ||
          lengthDescriptor.value < 0 ||
          keys.length !== lengthDescriptor.value + 1
        ) {
          return new InvalidSystemProposalError("invalid_json")
        }

        const normalized: SystemJsonValue[] = []
        for (let index = 0; index < lengthDescriptor.value; index += 1) {
          const descriptor = descriptors[String(index)]
          if (
            descriptor === undefined ||
            !("value" in descriptor) ||
            descriptor.get !== undefined ||
            descriptor.set !== undefined
          ) {
            return new InvalidSystemProposalError("invalid_json")
          }
          const child = CanonicalSystemJsonValue.normalize(descriptor.value, depth + 1, state)
          if (child instanceof InvalidSystemProposalError) return child
          normalized.push(child)
        }

        return normalized
      }

      const normalized: Record<string, SystemJsonValue> = {}
      const stringKeys = keys.filter((key): key is string => typeof key === "string").toSorted()
      for (const key of stringKeys) {
        const descriptor = descriptors[key]
        if (
          descriptor === undefined ||
          !("value" in descriptor) ||
          descriptor.get !== undefined ||
          descriptor.set !== undefined
        ) {
          return new InvalidSystemProposalError("invalid_json")
        }
        if (descriptor.enumerable !== true) continue
        const child = CanonicalSystemJsonValue.normalize(descriptor.value, depth + 1, state)
        if (child instanceof InvalidSystemProposalError) return child
        normalized[key] = child
      }

      return normalized
    } finally {
      state.visiting.delete(value)
    }
  }

  private constructor(serialized: string) {
    this.#serialized = serialized
    Object.freeze(this)
  }

  static create(value: unknown): CanonicalSystemJsonValue | InvalidSystemProposalError {
    try {
      const state: State = { visiting: new WeakSet<object>(), workUnits: 0 }
      const normalized = CanonicalSystemJsonValue.normalize(value, 0, state)

      if (normalized instanceof InvalidSystemProposalError) return normalized

      const serialized = JSON.stringify(normalized)

      if (textEncoder.encode(serialized).byteLength > maximumJsonBytes) {
        return new InvalidSystemProposalError("payload_too_large")
      }

      return new CanonicalSystemJsonValue(serialized)
    } catch (cause) {
      return new InvalidSystemProposalError("invalid_json", { cause })
    }
  }

  equals(other: CanonicalSystemJsonValue): boolean {
    return this.#serialized === other.#serialized
  }

  toString(): string {
    return this.#serialized
  }
}
