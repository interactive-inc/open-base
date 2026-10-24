import { InvalidSystemProposalError } from "@system/domain/errors"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import {
  proposalDigestSchema,
  type ProposalDigest,
} from "@system/domain/schemas/workflow/system-case-reference.schema"

/** canonical proposal JSONと一対一に対応する、変更不能なSHA-256 digest。 */
export class ProposalDigestValue {
  readonly #value: ProposalDigest

  private constructor(value: ProposalDigest) {
    this.#value = value
    Object.freeze(this)
  }

  static async create(
    canonicalJson: CanonicalSystemJsonValue,
  ): Promise<ProposalDigestValue | InvalidSystemProposalError> {
    const bytes = new TextEncoder().encode(canonicalJson.toString())
    const digest = await crypto.subtle.digest("SHA-256", bytes)
    const hexadecimal = [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
    const parsed = proposalDigestSchema.safeParse(hexadecimal)

    return parsed.success
      ? new ProposalDigestValue(parsed.data)
      : new InvalidSystemProposalError("invalid_shape")
  }

  equals(other: ProposalDigestValue): boolean {
    return this.#value === other.#value
  }

  toString(): ProposalDigest {
    return this.#value
  }
}
