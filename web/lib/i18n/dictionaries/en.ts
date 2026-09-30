/**
 * 英語辞書。キーは日本語ソース文字列そのもの。ここに無いキーは日本語へフォールバックする。
 * 現時点は login 画面分のみ登録する。
 */
export const en: Record<string, string> = {
  "open-base にサインイン": "Sign in to open-base",
  "アカウントのメールアドレスとパスワードを入力してください。":
    "Enter your account email address and password.",
  メールアドレス: "Email address",
  パスワード: "Password",
  "サインイン中...": "Signing in...",
  サインイン: "Sign in",
  メールアドレスとパスワードを入力してください: "Please enter your email address and password",
  メールアドレスまたはパスワードが正しくありません: "Incorrect email address or password",
}
