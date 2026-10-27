/**
 * 製品のcompositionが検証したサインイン済みセッション。
 * Systemはセッションの署名や保存先を知らず、ここに渡された値をAccountの現在状態と照合するだけにする。
 */
export type SystemSignedInSession = Readonly<{
  accountId: string
  sessionId: string
  /** セッションを作った認証の時刻。再認証の新しさを判定する。 */
  authenticatedAt: Date | null
  /** セッションの発行時刻。外部の認証時刻を証明するものではない。 */
  createdAt: Date
  expiresAt: Date
  method: "password" | "passkey" | "oidc" | "device"
  /** セッション作成時のAccountのtoken版。現在の値と違えば失効扱いにする。 */
  accountTokenVersion: number
}>

/**
 * サインイン済みセッションをHTTP appへ渡す表。
 * keyはattachが作ったenvの複製（object）そのものにし、HTTP要求のheaderや本文から値を作れないようにする。
 */
const sessions = new WeakMap<object, SystemSignedInSession>()

export class SystemSignedInSessionChannel<Env extends object> {
  constructor(private readonly c: Readonly<{ env: Env }>) {
    Object.freeze(this)
  }

  /** セッションを結び付けたenvの複製を返す。元のenvは変更しない。 */
  attach(session: SystemSignedInSession): Env {
    const env = { ...this.c.env }
    sessions.set(env, Object.freeze({ ...session }))
    return env
  }

  /** envに結び付いたセッションを返す。無ければnull。 */
  read(): SystemSignedInSession | null {
    return sessions.get(this.c.env) ?? null
  }
}
