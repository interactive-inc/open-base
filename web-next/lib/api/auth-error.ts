const AUTH_ERROR_DIGEST = "AUTH_REQUIRED"

/**
 * API が 401/403 を返したときに throw する例外。
 * Next.js の error boundary は `error.message` を本番でサニタイズするので、`digest` プロパティを
 * 明示的に設定し、`error.tsx` 側はそれで分岐する。
 */
export class AuthError extends Error {
  digest = AUTH_ERROR_DIGEST

  constructor() {
    super(AUTH_ERROR_DIGEST)

    this.name = "AuthError"
  }
}

export function isAuthErrorDigest(digest: string | undefined): boolean {
  return digest === AUTH_ERROR_DIGEST
}

export function isAuthError(error: unknown): error is AuthError {
  return (
    error instanceof AuthError ||
    (typeof error === "object" &&
      error !== null &&
      "digest" in error &&
      (error as { digest?: unknown }).digest === AUTH_ERROR_DIGEST)
  )
}
