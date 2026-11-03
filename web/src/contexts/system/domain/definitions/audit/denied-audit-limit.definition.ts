/** 認証以外の拒否記録を、アカウントごとに直近の時間窓で制限する。 */
export const DENIED_AUDIT_WINDOW_MILLISECONDS = 15 * 60 * 1000
export const DENIED_AUDIT_LIMIT_PER_WINDOW = 20
