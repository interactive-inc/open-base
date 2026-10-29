const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

/** Workersのmanual応答も拒否し、転送先の要求やredirect本文の読取へ進まない。 */
export function assertNoRedirect(response: Response): void {
  if (!REDIRECT_STATUSES.has(response.status)) return

  void response.body?.cancel().catch(() => undefined)
  throw new TypeError("HTTP redirect is not allowed")
}
