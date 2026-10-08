/**
 * 英語辞書。キーは日本語ソース文字列そのもの。ここに無いキーは日本語へフォールバックする。
 * 現時点は login 画面分のみ登録する。
 */
export const en: Record<string, string> = {
  "Open Base にログイン": "Sign in to Open Base",
  "アカウントのメールアドレスとパスワードを入力してください。":
    "Enter your account email address and password.",
  メールアドレス: "Email address",
  パスワード: "Password",
  "ログイン中…": "Signing in...",
  ログイン: "Sign in",
  "メールアドレスとパスワードを入力してください。": "Please enter your email address and password.",
  "メールアドレスまたはパスワードが正しくありません。": "Incorrect email address or password.",
}
