import { isoBase64URL, isoCBOR, isoUint8Array } from "@simplewebauthn/server/helpers"

type Flags = Readonly<{
  userPresent?: boolean
  userVerified?: boolean
  backupEligible?: boolean
  backupState?: boolean
}>

type CeremonyProps = Readonly<{
  challenge: string
  origin: string
  rpId: string
}> &
  Flags

type Bytes = Uint8Array<ArrayBuffer>

/** 認証器が使う署名方式。ES384 は検証側が許していない方式の例として使う。 */
export type SoftwareWebauthnAlgorithm = "ES256" | "ES384" | "RS256"

const ALGORITHMS = {
  ES256: {
    coseAlgorithm: -7,
    keyParams: { name: "ECDSA", namedCurve: "P-256" },
    signParams: { name: "ECDSA", hash: "SHA-256" },
    coseCurve: 1,
  },
  ES384: {
    coseAlgorithm: -35,
    keyParams: { name: "ECDSA", namedCurve: "P-384" },
    signParams: { name: "ECDSA", hash: "SHA-384" },
    coseCurve: 2,
  },
  RS256: {
    coseAlgorithm: -257,
    keyParams: {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: Uint8Array.of(1, 0, 1),
      hash: "SHA-256",
    },
    signParams: { name: "RSASSA-PKCS1-v1_5" },
    coseCurve: null,
  },
} as const

const FLAG_USER_PRESENT = 0x01
const FLAG_USER_VERIFIED = 0x04
const FLAG_BACKUP_ELIGIBLE = 0x08
const FLAG_BACKUP_STATE = 0x10
const FLAG_ATTESTED_CREDENTIAL = 0x40

/**
 * テスト用のソフトウェア認証器（既定は ES256）。実ブラウザと同じ形のRegistrationResponseJSONと
 * AuthenticationResponseJSONを作る（attestationは `none`、ECDSAの署名はDER）。
 * 本人確認の有無・counter・backup状態・改竄を引数で変えて、検証の拒否を確かめるために使う。
 */
export class SoftwareWebauthnAuthenticator {
  readonly credentialId: string
  readonly userHandle: string
  readonly #keyPair: CryptoKeyPair
  readonly #credentialIdBytes: Bytes
  readonly #algorithm: SoftwareWebauthnAlgorithm

  private constructor(
    keyPair: CryptoKeyPair,
    credentialIdBytes: Bytes,
    userHandle: string,
    algorithm: SoftwareWebauthnAlgorithm,
  ) {
    this.#keyPair = keyPair
    this.#credentialIdBytes = credentialIdBytes
    this.#algorithm = algorithm
    this.credentialId = isoBase64URL.fromBuffer(credentialIdBytes)
    this.userHandle = userHandle
  }

  static async create(
    userHandle: string,
    algorithm: SoftwareWebauthnAlgorithm = "ES256",
  ): Promise<SoftwareWebauthnAuthenticator> {
    const keyPair = await crypto.subtle.generateKey(ALGORITHMS[algorithm].keyParams, true, [
      "sign",
      "verify",
    ])
    const credentialIdBytes = crypto.getRandomValues(new Uint8Array(32))

    return new SoftwareWebauthnAuthenticator(keyPair, credentialIdBytes, userHandle, algorithm)
  }

  async createRegistrationResponse(props: CeremonyProps & Readonly<{ signCount?: number }>) {
    const clientDataJSON = encodeClientData("webauthn.create", props)
    const authenticatorData = isoUint8Array.concat([
      await rpIdHash(props.rpId),
      Uint8Array.of(toFlags(props) | FLAG_ATTESTED_CREDENTIAL),
      toSignCount(props.signCount ?? 0),
      new Uint8Array(16),
      Uint8Array.of(this.#credentialIdBytes.length >> 8, this.#credentialIdBytes.length & 0xff),
      this.#credentialIdBytes,
      await this.encodePublicKey(),
    ])
    const attestationObject = isoCBOR.encode(
      new Map<string, string | Bytes | Map<string, string>>([
        ["fmt", "none"],
        ["attStmt", new Map<string, string>()],
        ["authData", authenticatorData],
      ]),
    )

    return {
      id: this.credentialId,
      rawId: this.credentialId,
      type: "public-key" as const,
      response: {
        clientDataJSON: isoBase64URL.fromBuffer(clientDataJSON),
        attestationObject: isoBase64URL.fromBuffer(attestationObject),
        transports: ["internal", "hybrid"],
      },
    }
  }

  async createAuthenticationResponse(
    props: CeremonyProps &
      Readonly<{ signCount?: number; userHandle?: string | null; tamperSignature?: boolean }>,
  ) {
    const clientDataJSON = encodeClientData("webauthn.get", props)
    const authenticatorData = isoUint8Array.concat([
      await rpIdHash(props.rpId),
      Uint8Array.of(toFlags(props)),
      toSignCount(props.signCount ?? 0),
    ])
    const clientDataHash = new Uint8Array(await crypto.subtle.digest("SHA-256", clientDataJSON))
    const raw = new Uint8Array(
      await crypto.subtle.sign(
        ALGORITHMS[this.#algorithm].signParams,
        this.#keyPair.privateKey,
        isoUint8Array.concat([authenticatorData, clientDataHash]),
      ),
    )
    const signature = this.#algorithm === "RS256" ? raw : toDerSignature(raw)

    if (props.tamperSignature === true) {
      signature[signature.length - 1] = (signature.at(-1) ?? 0) ^ 0xff
    }

    const userHandle = props.userHandle === undefined ? this.userHandle : props.userHandle

    return {
      id: this.credentialId,
      rawId: this.credentialId,
      type: "public-key" as const,
      response: {
        clientDataJSON: isoBase64URL.fromBuffer(clientDataJSON),
        authenticatorData: isoBase64URL.fromBuffer(authenticatorData),
        signature: isoBase64URL.fromBuffer(signature),
        ...(userHandle === null ? {} : { userHandle: isoBase64URL.fromUTF8String(userHandle) }),
      },
    }
  }

  private async encodePublicKey(): Promise<Bytes> {
    const jwk = await crypto.subtle.exportKey("jwk", this.#keyPair.publicKey)
    const algorithm = ALGORITHMS[this.#algorithm]

    if (algorithm.coseCurve === null) {
      return isoCBOR.encode(
        new Map<number, number | Bytes>([
          [1, 3],
          [3, algorithm.coseAlgorithm],
          [-1, isoBase64URL.toBuffer(jwk.n ?? "")],
          [-2, isoBase64URL.toBuffer(jwk.e ?? "")],
        ]),
      )
    }

    return isoCBOR.encode(
      new Map<number, number | Bytes>([
        [1, 2],
        [3, algorithm.coseAlgorithm],
        [-1, algorithm.coseCurve],
        [-2, isoBase64URL.toBuffer(jwk.x ?? "")],
        [-3, isoBase64URL.toBuffer(jwk.y ?? "")],
      ]),
    )
  }
}

function encodeClientData(type: string, props: CeremonyProps): Bytes {
  return new TextEncoder().encode(
    JSON.stringify({ type, challenge: props.challenge, origin: props.origin, crossOrigin: false }),
  )
}

async function rpIdHash(rpId: string): Promise<Bytes> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rpId)))
}

function toFlags(flags: Flags): number {
  return (
    (flags.userPresent === false ? 0 : FLAG_USER_PRESENT) |
    (flags.userVerified === false ? 0 : FLAG_USER_VERIFIED) |
    (flags.backupEligible === true ? FLAG_BACKUP_ELIGIBLE : 0) |
    (flags.backupState === true ? FLAG_BACKUP_STATE : 0)
  )
}

function toSignCount(value: number): Bytes {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setUint32(0, value)

  return bytes
}

/** WebCryptoのECDSA署名（r‖s）を、WebAuthnが使うASN.1 DERへ変える。 */
function toDerSignature(raw: Bytes): Bytes {
  const half = raw.length / 2
  const r = toDerInteger(raw.slice(0, half))
  const s = toDerInteger(raw.slice(half))

  return isoUint8Array.concat([Uint8Array.of(0x30, r.length + s.length), r, s])
}

function toDerInteger(value: Bytes): Bytes {
  const start = value.findIndex((byte) => byte !== 0)
  const trimmed = start === -1 ? Uint8Array.of(0) : value.slice(start)
  const padded =
    (trimmed[0] ?? 0) >= 0x80 ? isoUint8Array.concat([Uint8Array.of(0), trimmed]) : trimmed

  return isoUint8Array.concat([Uint8Array.of(0x02, padded.length), padded])
}
