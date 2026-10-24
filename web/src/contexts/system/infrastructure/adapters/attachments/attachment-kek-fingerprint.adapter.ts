import { AttachmentKekRegistry } from "@system/application/attachments/lib/attachment-kek-registry"

type Context = Readonly<{ env: Readonly<{ ATTACHMENT_KEKS?: string }> }>

/** 実際に使用する版の鍵を照合できるdigestを作る。鍵の原文は返さない。 */
export class AttachmentKekFingerprintAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(versions: ReadonlyArray<number>) {
    if (versions.some((version) => !Number.isSafeInteger(version) || version <= 0))
      return new Error("invalid storage key version")
    if (versions.length === 0) return Object.freeze([])
    const registry = AttachmentKekRegistry.fromEnv(this.c.env.ATTACHMENT_KEKS)
    if (registry instanceof Error) return registry
    const fingerprints = []
    for (const version of [...new Set(versions)].toSorted((left, right) => left - right)) {
      const resolved = registry.resolve(version)
      if (resolved instanceof Error) return resolved
      const prefix = new TextEncoder().encode(`system-record-retirement-kek-v1:${version}:`)
      const material = new Uint8Array(prefix.length + resolved.key.length)
      material.set(prefix)
      material.set(resolved.key, prefix.length)
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", material))
      fingerprints.push(
        Object.freeze({
          version,
          digest: [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
        }),
      )
    }
    return Object.freeze(fingerprints)
  }
}
