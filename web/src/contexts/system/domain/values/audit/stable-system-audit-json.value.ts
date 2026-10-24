import { SystemAuditJsonError } from "@system/domain/errors"

const maximumAuditJsonBytes = 65_536
const maximumAuditJsonDepth = 100
const maximumAuditValidationWorkUnits = 100_000
const maximumArrayLength = 0xffff_ffff
const redactedValue = "[REDACTED]"
const exactSensitiveKeys = new Set([
  "apikey",
  "password",
  "secret",
  "token",
  "authorization",
  "cookie",
  "setcookie",
  "privatekey",
  "clientsecret",
])

type SnapshotEntry = {
  key: string
  value: unknown
  sensitive: boolean
}

type DataPropertySnapshot = {
  configurable: boolean | undefined
  enumerable: boolean | undefined
  value: unknown
  writable: boolean | undefined
}

type AuditJsonObjectSnapshot = {
  kind: "object"
  entries: ReadonlyArray<SnapshotEntry>
  sortedEntries?: ReadonlyArray<SnapshotEntry>
}

type AuditJsonSnapshot = { kind: "array"; values: ReadonlyArray<unknown> } | AuditJsonObjectSnapshot

type ValidationState = {
  snapshots: WeakMap<object, AuditJsonSnapshot>
  heights: WeakMap<object, number>
  visiting: WeakSet<object>
  workUnits: number
}

type AuditJsonWriter = {
  byteLength: number
  chunks: string[]
}

const textEncoder = new TextEncoder()

/**
 * Converts an audit projection to canonical, redacted JSON for one SQL column.
 * Root null maps to SQL null; nested null remains JSON null.
 */
export class StableSystemAuditJsonValue {
  readonly #serialized: string

  private static invalidJson(options?: ErrorOptions): SystemAuditJsonError {
    return new SystemAuditJsonError("invalid_json", options)
  }

  private static payloadTooLarge(): SystemAuditJsonError {
    return new SystemAuditJsonError("payload_too_large")
  }

  private static consumeValidationWork(state: ValidationState, units = 1): void {
    state.workUnits += units
    if (state.workUnits > maximumAuditValidationWorkUnits) {
      throw StableSystemAuditJsonValue.payloadTooLarge()
    }
  }

  private static isSensitiveKey(key: string): boolean {
    const normalized = key.toLowerCase().replaceAll(/[_-]/g, "")

    return (
      exactSensitiveKeys.has(normalized) ||
      normalized.startsWith("password") ||
      normalized.endsWith("password") ||
      normalized.endsWith("secret") ||
      normalized.endsWith("token")
    )
  }

  private static toUnicodeCodePoints(value: string): ReadonlyArray<number> {
    return Array.from(value, (character) => {
      const codePoint = character.codePointAt(0)
      if (codePoint === undefined) throw StableSystemAuditJsonValue.invalidJson()

      return codePoint
    })
  }

  private static compareUnicodeCodePoints(left: string, right: string): number {
    const leftPoints = StableSystemAuditJsonValue.toUnicodeCodePoints(left)
    const rightPoints = StableSystemAuditJsonValue.toUnicodeCodePoints(right)
    const sharedLength = Math.min(leftPoints.length, rightPoints.length)

    for (let index = 0; index < sharedLength; index += 1) {
      const leftPoint = leftPoints[index]
      const rightPoint = rightPoints[index]
      if (leftPoint === undefined || rightPoint === undefined) {
        throw StableSystemAuditJsonValue.invalidJson()
      }

      const difference = leftPoint - rightPoint
      if (difference !== 0) return difference
    }

    return leftPoints.length - rightPoints.length
  }

  private static getDataDescriptor(
    descriptors: PropertyDescriptorMap,
    key: string,
  ): DataPropertySnapshot {
    const descriptor = descriptors[key]
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined
    ) {
      throw StableSystemAuditJsonValue.invalidJson()
    }

    return {
      configurable: descriptor.configurable,
      enumerable: descriptor.enumerable,
      value: descriptor.value,
      writable: descriptor.writable,
    }
  }

  private static getArrayLength(descriptors: PropertyDescriptorMap): number {
    const descriptor = StableSystemAuditJsonValue.getDataDescriptor(descriptors, "length")
    if (
      typeof descriptor.value !== "number" ||
      !Number.isSafeInteger(descriptor.value) ||
      descriptor.value < 0 ||
      descriptor.value > maximumArrayLength ||
      typeof descriptor.writable !== "boolean" ||
      descriptor.enumerable !== false ||
      descriptor.configurable !== false
    ) {
      throw StableSystemAuditJsonValue.invalidJson()
    }

    return descriptor.value
  }

  private static toArrayIndex(key: string, length: number): number {
    const index = Number(key)
    if (!Number.isInteger(index) || index < 0 || index >= length || String(index) !== key) {
      throw StableSystemAuditJsonValue.invalidJson()
    }

    return index
  }

  private static captureSnapshot(value: object, state: ValidationState): AuditJsonSnapshot {
    const cached = state.snapshots.get(value)
    if (cached !== undefined) return cached

    const isArray = Array.isArray(value)
    if (!isArray) {
      const prototype = Object.getPrototypeOf(value)
      if (prototype !== Object.prototype && prototype !== null) {
        throw StableSystemAuditJsonValue.invalidJson()
      }
    }

    // This is the only property snapshot. All symbol, accessor, enumerability, array-shape,
    // validation, and serialization decisions below are made from this immutable map.
    const descriptors = Object.getOwnPropertyDescriptors(value)
    const ownKeys = Reflect.ownKeys(descriptors)
    StableSystemAuditJsonValue.consumeValidationWork(state, ownKeys.length)

    const descriptorKeys: string[] = []
    for (const key of ownKeys) {
      if (typeof key === "symbol") throw StableSystemAuditJsonValue.invalidJson()
      StableSystemAuditJsonValue.getDataDescriptor(descriptors, key)
      descriptorKeys.push(key)
    }

    let snapshot: AuditJsonSnapshot
    if (isArray) {
      const length = StableSystemAuditJsonValue.getArrayLength(descriptors)
      if (descriptorKeys.length !== length + 1) throw StableSystemAuditJsonValue.invalidJson()

      const values: unknown[] = Array.from({ length })
      for (const key of descriptorKeys) {
        if (key === "length") continue
        const index = StableSystemAuditJsonValue.toArrayIndex(key, length)
        values[index] = StableSystemAuditJsonValue.getDataDescriptor(descriptors, key).value
      }
      snapshot = { kind: "array", values }
    } else {
      const entries: SnapshotEntry[] = []
      for (const key of descriptorKeys) {
        const descriptor = StableSystemAuditJsonValue.getDataDescriptor(descriptors, key)
        if (descriptor.enumerable !== true) continue
        entries.push({
          key,
          value: descriptor.value,
          sensitive: StableSystemAuditJsonValue.isSensitiveKey(key),
        })
      }
      snapshot = { kind: "object", entries }
    }

    state.snapshots.set(value, snapshot)
    return snapshot
  }

  private static validateValue(value: unknown, depth: number, state: ValidationState): number {
    StableSystemAuditJsonValue.consumeValidationWork(state)
    if (depth > maximumAuditJsonDepth) throw StableSystemAuditJsonValue.invalidJson()

    if (value === null || typeof value === "boolean" || typeof value === "string") {
      return 0
    }
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw StableSystemAuditJsonValue.invalidJson()
      return 0
    }
    if (typeof value !== "object") throw StableSystemAuditJsonValue.invalidJson()

    if (state.visiting.has(value)) throw StableSystemAuditJsonValue.invalidJson()
    const cachedHeight = state.heights.get(value)
    if (cachedHeight !== undefined) {
      if (depth + cachedHeight > maximumAuditJsonDepth) {
        throw StableSystemAuditJsonValue.invalidJson()
      }
      return cachedHeight
    }

    const snapshot = StableSystemAuditJsonValue.captureSnapshot(value, state)
    state.visiting.add(value)
    try {
      let height = 0
      if (snapshot.kind === "array") {
        for (const childValue of snapshot.values) {
          const childHeight = StableSystemAuditJsonValue.validateValue(childValue, depth + 1, state)
          height = Math.max(height, childHeight + 1)
        }
      } else {
        for (const entry of snapshot.entries) {
          const childHeight = StableSystemAuditJsonValue.validateValue(
            entry.value,
            depth + 1,
            state,
          )
          height = Math.max(height, childHeight + 1)
        }
      }
      if (depth + height > maximumAuditJsonDepth) {
        throw StableSystemAuditJsonValue.invalidJson()
      }

      state.heights.set(value, height)
      return height
    } finally {
      state.visiting.delete(value)
    }
  }

  private static remainingAuditJsonBytes(writer: AuditJsonWriter): number {
    return maximumAuditJsonBytes - writer.byteLength
  }

  private static writeAuditJsonChunk(writer: AuditJsonWriter, chunk: string): void {
    // UTF-16 length is a safe lower bound for UTF-8 bytes. Check it before
    // allocating an encoded copy, especially for a single oversized string.
    if (chunk.length > StableSystemAuditJsonValue.remainingAuditJsonBytes(writer)) {
      throw StableSystemAuditJsonValue.payloadTooLarge()
    }

    const chunkBytes = textEncoder.encode(chunk).byteLength
    if (chunkBytes > StableSystemAuditJsonValue.remainingAuditJsonBytes(writer)) {
      throw StableSystemAuditJsonValue.payloadTooLarge()
    }

    writer.chunks.push(chunk)
    writer.byteLength += chunkBytes
  }

  private static writeAuditJsonString(writer: AuditJsonWriter, value: string): void {
    if (value.length + 2 > StableSystemAuditJsonValue.remainingAuditJsonBytes(writer)) {
      throw StableSystemAuditJsonValue.payloadTooLarge()
    }
    StableSystemAuditJsonValue.writeAuditJsonChunk(writer, JSON.stringify(value))
  }

  private static getSortedEntries(
    snapshot: AuditJsonObjectSnapshot,
    remainingBytes: number,
  ): ReadonlyArray<SnapshotEntry> {
    // For a non-empty object, braces/commas/colons/quotes and the shortest JSON
    // value require at least five bytes per key plus one. UTF-16 key length is a
    // lower bound for its encoded/escaped bytes. Reject before an avoidable sort.
    let minimumBytes = snapshot.entries.length === 0 ? 2 : 1
    for (const entry of snapshot.entries) {
      minimumBytes += entry.key.length + 5
      if (minimumBytes > remainingBytes) throw StableSystemAuditJsonValue.payloadTooLarge()
    }

    if (snapshot.sortedEntries === undefined) {
      snapshot.sortedEntries = snapshot.entries
        .slice()
        .sort((left, right) =>
          StableSystemAuditJsonValue.compareUnicodeCodePoints(left.key, right.key),
        )
    }
    return snapshot.sortedEntries
  }

  private static serializeValue(
    value: unknown,
    state: ValidationState,
    writer: AuditJsonWriter,
  ): void {
    if (value === null) {
      StableSystemAuditJsonValue.writeAuditJsonChunk(writer, "null")
      return
    }
    if (typeof value === "boolean" || typeof value === "number") {
      StableSystemAuditJsonValue.writeAuditJsonChunk(writer, JSON.stringify(value))
      return
    }
    if (typeof value === "string") {
      StableSystemAuditJsonValue.writeAuditJsonString(writer, value)
      return
    }
    if (typeof value !== "object") throw StableSystemAuditJsonValue.invalidJson()

    const snapshot = state.snapshots.get(value)
    if (snapshot === undefined) throw StableSystemAuditJsonValue.invalidJson()

    if (snapshot.kind === "array") {
      StableSystemAuditJsonValue.writeAuditJsonChunk(writer, "[")
      for (let index = 0; index < snapshot.values.length; index += 1) {
        if (index > 0) StableSystemAuditJsonValue.writeAuditJsonChunk(writer, ",")
        StableSystemAuditJsonValue.serializeValue(snapshot.values[index], state, writer)
      }
      StableSystemAuditJsonValue.writeAuditJsonChunk(writer, "]")
      return
    }

    const entries = StableSystemAuditJsonValue.getSortedEntries(
      snapshot,
      StableSystemAuditJsonValue.remainingAuditJsonBytes(writer),
    )
    StableSystemAuditJsonValue.writeAuditJsonChunk(writer, "{")
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index]
      if (entry === undefined) throw StableSystemAuditJsonValue.invalidJson()
      if (index > 0) StableSystemAuditJsonValue.writeAuditJsonChunk(writer, ",")
      StableSystemAuditJsonValue.writeAuditJsonString(writer, entry.key)
      StableSystemAuditJsonValue.writeAuditJsonChunk(writer, ":")
      if (entry.sensitive) {
        StableSystemAuditJsonValue.writeAuditJsonString(writer, redactedValue)
      } else {
        StableSystemAuditJsonValue.serializeValue(entry.value, state, writer)
      }
    }
    StableSystemAuditJsonValue.writeAuditJsonChunk(writer, "}")
  }

  private constructor(serialized: string) {
    this.#serialized = serialized
    Object.freeze(this)
  }

  static create(value: unknown): StableSystemAuditJsonValue | null | SystemAuditJsonError {
    if (value === null) return null

    try {
      const state: ValidationState = {
        snapshots: new WeakMap(),
        heights: new WeakMap(),
        visiting: new WeakSet(),
        workUnits: 0,
      }
      StableSystemAuditJsonValue.validateValue(value, 0, state)

      const writer: AuditJsonWriter = { byteLength: 0, chunks: [] }
      StableSystemAuditJsonValue.serializeValue(value, state, writer)
      return new StableSystemAuditJsonValue(writer.chunks.join(""))
    } catch (error) {
      return error instanceof SystemAuditJsonError
        ? error
        : StableSystemAuditJsonValue.invalidJson({ cause: error })
    }
  }

  equals(other: StableSystemAuditJsonValue): boolean {
    return this.#serialized === other.#serialized
  }

  toString(): string {
    return this.#serialized
  }
}
