/**
 * 画面のBetter Authのclientを、ブラウザで使うときにだけ読み込む。
 * サーバーで画面を描くときにclientのpackageを読み込まないようにする。
 */
export function loadAuthClient() {
  return import("@/client/auth-client")
}
