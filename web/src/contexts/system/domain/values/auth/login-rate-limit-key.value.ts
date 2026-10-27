export class LoginRateLimitKeyValue {
  private constructor(readonly value: string) {
    Object.freeze(this)
  }

  static login(ip: string | null, normalizedIdentifier: string): LoginRateLimitKeyValue {
    return new LoginRateLimitKeyValue(
      `${LoginRateLimitKeyValue.ipPart(ip)}|${normalizedIdentifier}`,
    )
  }

  static internalVerify(ip: string | null, userId: string): LoginRateLimitKeyValue {
    return new LoginRateLimitKeyValue(
      `internal-verify|${LoginRateLimitKeyValue.ipPart(ip)}|${userId}`,
    )
  }

  /**
   * 認証済みの利用者が自分のパスワードを再入力する操作 (再認証・パスワード変更) の試行キー。
   * 盗まれたセッションからの総当たりを Account 単位で止めるため IP を含めない。名前空間を分けて
   * ログインの識別子 (メール・社員番号) と同じ行を数えないようにする。
   */
  static passwordReauthentication(accountId: string): LoginRateLimitKeyValue {
    return new LoginRateLimitKeyValue(`password-reauthentication|${accountId}`)
  }

  /**
   * パスワードの後に求める二段階目（ワンタイムコード・復旧コード）の試行キー。ログインの 2 段目と、
   * 二段階認証の無効化・復旧コード再発行での本人確認が共有する。パスワードを知る者が 2 段目の
   * challenge を作り直して総当たりを続けられないよう、challenge ではなく Account 単位で数える。
   */
  static secondFactor(accountId: string): LoginRateLimitKeyValue {
    return new LoginRateLimitKeyValue(`second-factor|${accountId}`)
  }

  toString(): string {
    return this.value
  }

  private static ipPart(ip: string | null): string {
    return ip !== null && ip.length > 0 ? ip : "anonymous"
  }
}
