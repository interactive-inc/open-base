type Props = {
  searchParams: Promise<{ reason?: string }>
}

/**
 * SSO ログイン失敗の案内。reason に応じてメッセージを出し分ける。
 * ログインのやり直しはstateとPKCEを再生成する内部routeから始める。
 * identity login未設定ならトップへ誘導する。
 */
export default async function BrokerErrorPage(props: Props) {
  const searchParams = await props.searchParams

  const retryUrl = process.env.IDENTITY_LOGIN_URL ? "/auth/broker/login" : "/"

  const message =
    searchParams.reason === "account_not_found"
      ? "アカウントがありません。管理者に連絡してください。"
      : searchParams.reason === "step_up_failed"
        ? "再認証できませんでした。ログイン中のアカウントで認証し直してください。"
        : "ログインに失敗しました。もう一度お試しください。"

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-xl font-semibold">ログインできませんでした</h1>
        <p className="text-muted-foreground">{message}</p>
        <p>
          <a href={retryUrl} className="underline">
            ログインをやり直す
          </a>
        </p>
      </div>
    </main>
  )
}
