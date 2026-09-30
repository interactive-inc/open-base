/**
 * CORS_ORIGIN が設定されていれば本番相当の環境とみなす（app-base の NOW ガードと同一基準）。
 * ローカル開発・テストは CORS_ORIGIN を設定しないため false になる。
 * レート制限のような fail-open にできない保護を、本番だけ fail-closed に倒す判定に使う。
 */
export function isProductionEnvironment(env: { CORS_ORIGIN?: string }): boolean {
  return env.CORS_ORIGIN !== undefined && env.CORS_ORIGIN.trim() !== ""
}
