/** System 添付テスト用のインメモリ object storage。 */
export class SystemAttachmentTestBucket {
  private readonly objects = new Map<string, Uint8Array>()

  async put(
    key: string,
    value: unknown,
    options?: { onlyIf?: { etagDoesNotMatch?: string } },
  ): Promise<{ key: string } | null> {
    if (options?.onlyIf?.etagDoesNotMatch === "*" && this.objects.has(key)) return null
    this.objects.set(key, SystemAttachmentTestBucket.toBytes(value))

    return { key }
  }

  async get(key: string): Promise<{ arrayBuffer: () => Promise<ArrayBuffer> } | null> {
    const stored = this.objects.get(key)

    if (stored === undefined) return null

    return {
      arrayBuffer: async () => {
        const copy = new Uint8Array(stored.byteLength)

        copy.set(stored)

        return copy.buffer
      },
    }
  }

  async head(key: string): Promise<{ key: string } | null> {
    return this.objects.has(key) ? { key } : null
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key)
  }

  storedBytes(key: string): Uint8Array | null {
    return this.objects.get(key) ?? null
  }

  keys(): ReadonlyArray<string> {
    return [...this.objects.keys()]
  }

  size(): number {
    return this.objects.size
  }

  private static toBytes(value: unknown): Uint8Array {
    if (value instanceof Uint8Array) {
      const copy = new Uint8Array(value.byteLength)

      copy.set(value)

      return copy
    }

    if (value instanceof ArrayBuffer) return new Uint8Array(value)

    throw new Error("SystemAttachmentTestBucket は Uint8Array か ArrayBuffer だけを受け付けます")
  }
}
