export class LoginRateLimitKeyValue {
  private constructor(readonly value: string) {
    Object.freeze(this)
  }

  static login(ip: string | null, normalizedIdentifier: string): LoginRateLimitKeyValue {
    return new LoginRateLimitKeyValue(
      `${LoginRateLimitKeyValue.ipPart(ip)}|${normalizedIdentifier}`,
    )
  }

  static internalVerify(ip: string | null, userId: string): LoginRateLimitKeyValue {
    return new LoginRateLimitKeyValue(
      `internal-verify|${LoginRateLimitKeyValue.ipPart(ip)}|${userId}`,
    )
  }

  toString(): string {
    return this.value
  }

  private static ipPart(ip: string | null): string {
    return ip !== null && ip.length > 0 ? ip : "anonymous"
  }
}
