/** 本番issuerはHTTPS、ローカル開発だけloopback HTTPを許可する。 */
export class SystemIdentityIssuerValue {
  readonly #issuer: URL

  constructor(issuer: URL) {
    this.#issuer = new URL(issuer.toString())
    Object.freeze(this.#issuer)
    Object.freeze(this)
  }

  get isSecure(): boolean {
    if (this.#issuer.protocol === "https:") return true

    return (
      this.#issuer.protocol === "http:" &&
      (this.#issuer.hostname === "localhost" ||
        this.#issuer.hostname === "127.0.0.1" ||
        this.#issuer.hostname === "[::1]")
    )
  }
}
