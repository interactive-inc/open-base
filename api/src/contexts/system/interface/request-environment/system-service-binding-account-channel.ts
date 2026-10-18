import type { VerifiedExternalAccessTokenAccount } from "@system/infrastructure/adapters/auth/resolve-bearer-account.adapter"

/**
 * Service Binding RPCが検証済みの主体をHTTP appへ渡す表。
 * moduleの外へ出さず、keyはattachが作ったenvの複製（object）そのものにする。
 * Worker runtimeがHTTP要求へ渡すenvはここへ登録されないため、HTTP要求のheaderや本文、
 * binding名からこの表の値を引くことはできない。
 */
const accounts = new WeakMap<object, VerifiedExternalAccessTokenAccount>()

/**
 * Service Binding RPCの検証済み主体を、app.fetchへ渡すenvの複製にだけ結び付けて読み出す。
 * 認証middlewareはAuthorization headerより先にここを確かめ、主体があればheaderを読まない。
 */
export class SystemServiceBindingAccountChannel<Env extends object> {
  constructor(private readonly c: Readonly<{ env: Env }>) {
    Object.freeze(this)
  }

  /** 主体を結び付けたenvの複製を返す。元のenvは変更しない。 */
  attach(account: VerifiedExternalAccessTokenAccount): Env {
    const env = { ...this.c.env }
    accounts.set(env, Object.freeze({ ...account }))
    return env
  }

  /** envに結び付いた主体を返す。無ければnull。 */
  read(): VerifiedExternalAccessTokenAccount | null {
    return accounts.get(this.c.env) ?? null
  }
}
