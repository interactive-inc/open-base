/**
 * 本番issuerはHTTPS、ローカル開発だけloopback HTTPを許可する。
 */
export function isSecureIdentityIssuer(issuer: URL): boolean {
  if (issuer.protocol === "https:") {
    return true
  }

  return (
    issuer.protocol === "http:" &&
    (issuer.hostname === "localhost" ||
      issuer.hostname === "127.0.0.1" ||
      issuer.hostname === "[::1]")
  )
}
