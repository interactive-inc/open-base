import {
  RECORD_BINARY_MAGIC,
  RECORD_BINARY_PREFIX_SIZE,
  RECORD_BINARY_HEADER_MAX_SIZE,
  RECORD_BINARY_MAX_SIZE,
  RECORD_JSON_MAX_SIZE,
  RECORD_CONTENT_MAX_SIZE,
} from "@system/domain/catalogs/records/record-payload-format.catalog"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { PreservedRecordContentValue } from "@system/domain/values/records/preserved-record-content.value"
import { z } from "zod"

const payloadSchema = z
  .object({
    version: z.literal(1),
    source: z.unknown(),
    contentBase64: z
      .string()
      .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
  })
  .strict()

/** 保存形式・取得情報・本文digestを確認し、元のバイト列を復元する。 */
export class PreservedRecordPayloadValue {
  private constructor(
    readonly source: PreservedRecordSourceValue,
    readonly content: PreservedRecordContentValue,
  ) {
    Object.freeze(this)
  }

  static async create(source: PreservedRecordSourceValue, bytes: Uint8Array) {
    if (bytes.byteLength > RECORD_CONTENT_MAX_SIZE) return new Error("record content too large")
    const content = await PreservedRecordContentValue.create(source, bytes)
    if (content instanceof Error) return content
    return new PreservedRecordPayloadValue(source, content)
  }

  toBinary(): Uint8Array<ArrayBuffer> | Error {
    const content = this.content.toBytes()
    const header = new TextEncoder().encode(
      JSON.stringify({
        version: 2,
        source: this.source.props,
        contentByteLength: content.byteLength,
      }),
    )
    if (header.byteLength > RECORD_BINARY_HEADER_MAX_SIZE)
      return new Error("record header too large")
    const bytes = new Uint8Array(RECORD_BINARY_PREFIX_SIZE + header.byteLength + content.byteLength)
    bytes.set(new TextEncoder().encode(RECORD_BINARY_MAGIC))
    new DataView(bytes.buffer).setUint32(4, header.byteLength, false)
    bytes.set(header, RECORD_BINARY_PREFIX_SIZE)
    bytes.set(content, RECORD_BINARY_PREFIX_SIZE + header.byteLength)
    return bytes
  }

  static async restore(
    bytes: Uint8Array,
    expected: PreservedRecordSourceValue,
    format: "json" | "binary" = "json",
  ): Promise<PreservedRecordPayloadValue | Error> {
    if (format === "binary") return this.restoreBinary(bytes, expected)
    if (bytes.byteLength > RECORD_JSON_MAX_SIZE) return new Error("record payload too large")
    try {
      const parsed = payloadSchema.safeParse(
        JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
      )
      if (!parsed.success) return parsed.error
      const binary = atob(parsed.data.contentBase64)
      if (btoa(binary) !== parsed.data.contentBase64)
        return new Error("noncanonical record encoding")
      return this.restoreContent(
        parsed.data.source,
        Uint8Array.from(binary, (character) => character.charCodeAt(0)),
        expected,
      )
    } catch (cause) {
      return new Error("preserved record payload cannot be restored", { cause })
    }
  }

  private static async restoreBinary(bytes: Uint8Array, expected: PreservedRecordSourceValue) {
    if (bytes.byteLength < RECORD_BINARY_PREFIX_SIZE || bytes.byteLength > RECORD_BINARY_MAX_SIZE)
      return new Error("invalid binary record payload size")
    try {
      if (new TextDecoder().decode(bytes.subarray(0, 4)) !== RECORD_BINARY_MAGIC)
        return new Error("invalid binary record signature")
      const headerLength = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(
        4,
        false,
      )
      if (
        headerLength === 0 ||
        headerLength > RECORD_BINARY_HEADER_MAX_SIZE ||
        RECORD_BINARY_PREFIX_SIZE + headerLength > bytes.byteLength
      )
        return new Error("invalid binary record header size")
      const header = z
        .strictObject({
          version: z.literal(2),
          source: z.unknown(),
          contentByteLength: z.number().int().min(0).max(RECORD_CONTENT_MAX_SIZE),
        })
        .safeParse(
          JSON.parse(
            new TextDecoder("utf-8", { fatal: true }).decode(
              bytes.subarray(RECORD_BINARY_PREFIX_SIZE, RECORD_BINARY_PREFIX_SIZE + headerLength),
            ),
          ),
        )
      if (!header.success) return header.error
      const content = bytes.subarray(RECORD_BINARY_PREFIX_SIZE + headerLength)
      if (content.byteLength !== header.data.contentByteLength)
        return new Error("binary record length mismatch")
      return this.restoreContent(header.data.source, content, expected)
    } catch (cause) {
      return new Error("binary record payload cannot be restored", { cause })
    }
  }

  private static async restoreContent(
    input: unknown,
    bytes: Uint8Array,
    expected: PreservedRecordSourceValue,
  ) {
    const source = PreservedRecordSourceValue.create(input)
    if (source instanceof Error) return source
    if (!source.matchesSource(expected) || source.props.capturedAt !== expected.props.capturedAt)
      return new Error("preserved record source differs from expected snapshot")
    return this.create(source, bytes)
  }
}
