/** モック専用のブラウザー認証境界。実キーやOSの認証画面を使わない。 */
const request = async (path: string, body?: unknown) => {
  const response = await fetch(`/api/auth${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return response.ok
    ? { data: await response.json(), error: null }
    : { data: null, error: { status: response.status } }
}
const device = Object.assign(
  (options: { query: { user_code: string } }) =>
    request(`/device?user_code=${encodeURIComponent(options.query.user_code)}`),
  {
    approve: (body: { userCode: string }) => request("/device/approve", body),
    deny: (body: { userCode: string }) => request("/device/deny", body),
  },
)
export const authClient = {
  signIn: {
    email: (body: { email: string; password: string }) => request("/sign-in/email", body),
    passkey: async () => ({ error: { status: 501 } }),
  },
  passkey: { addPasskey: async (_options: unknown) => ({ error: { status: 501 } }) },
  signOut: () => request("/sign-out", {}),
  device,
}
export function describeAuthError(error: { status?: number } | null) {
  if (!error) return ""
  if (error.status === 501) return "実パスキーの操作は通常の開発環境で確認してください。"
  if (error.status === 409) return "コードが無効または使用済みです。"
  return "モックの応答を確認してください。"
}
