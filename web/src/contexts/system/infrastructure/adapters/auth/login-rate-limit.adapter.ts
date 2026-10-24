import type {
  SystemClockContext,
  SystemDatabase,
  SystemDatabaseContext,
} from "@system/configuration/system-context"
import { systemAuthenticationAttempts } from "@system/infrastructure/schema/system-core"
import { LoginRateLimitKeyValue } from "@system/domain/values/auth/login-rate-limit-key.value"
import { and, count, eq, gt, lte } from "drizzle-orm"

/**
 * ログイン総当たり防止のレートリミット 。
 *
 * 失敗した認証試行を D1 の system_authentication_attempts に 1 行 1 件で記録し、窓 (15 分) 内の行数が上限以上なら
 * 拒否する分散カウンタ。全 isolate が同じテーブルを見るため、旧実装 (module-scope in-memory Map) で
 * 攻撃面が isolate 数だけ倍増していた問題を解消する 。
 *
 * このファイルは 2 系統の API を持つ。
 *
 * 1. 単一キーの素朴な API (isLoginRateLimited / recordLoginAttempt / resetLoginAttempts)。
 *    keyはLoginRateLimitKeyValueが生成し、forgot-password (パスワードリセット要求) と
 *    internal-verify (外部認証の委譲検証) が使う。呼び出し側が「認証前に上限判定 →
 *    失敗した試行だけ記録 → 成功したらリセット」の順で呼ぶ、check-then-act の構成。
 *
 * 2. ログイン (login.ts) 専用の原子的ゲート (recordAndCheckLoginAttempt /
 *    resetLoginAttemptsForIdentifier)。単一の IP|識別子 bucket だけだと、IP を変えれば同一アカウントへの
 *    試行がリセットされ、識別子を変えれば同一 IP からの password spray が別 bucket に逃げられた。
 *    さらに check と increment が別クエリだと、並列リクエストが同時に上限未満判定を通過できる
 *    TOCTOU が残っていた 。pair (IP+識別子) / account (識別子単独) / ip (IP単独) の
 *    3 バケットを、check の前に自分の試行行を insert してから 1 回の db.batch で count する
 *    insert-then-count に変えることで両方を解消する。
 *
 * 窓は「直近 WINDOW_MS の行数」で判定する sliding window。上限に達したリクエストは自分の行を
 * 削除して拒否するため、429 が続いても窓が延びない (最後に許可された失敗から WINDOW_MS 経過で
 * 自然に窓が空く)。
 *
 * DB 障害時は fail-open。record 系の best-effort な監査書き込み (record-auth-audit-log.ts) と同じく、
 * レートリミットの読み書き失敗でログイン処理自体を巻き戻さない。レートリミットは Basic 認証の背後に
 * 置く defense-in-depth であり、正の認証は verifyPassword 側で行われる。D1 が実際に落ちていれば
 * ログインの identity 参照も同じ DB で失敗するため、fail-open が認証バイパスを生むことはない。
 * ここでの throw 禁止 (T | Error でなく boolean/void を返す) はこの best-effort 方針に合わせたもの。
 */

const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 10

type Db = SystemDatabase
type Context = SystemDatabaseContext & SystemClockContext

export class LoginRateLimitAdapter {
  constructor(private readonly c: Context) {}

  static loginKey(ip: string | null, identifier: string): string {
    return LoginRateLimitKeyValue.login(ip, identifier).toString()
  }

  static internalVerifyKey(ip: string | null, userId: string): string {
    return LoginRateLimitKeyValue.internalVerify(ip, userId).toString()
  }

  isLimited(props: Readonly<{ key: string; now?: number }>): Promise<boolean> {
    return isLoginRateLimited(
      this.c.var.database,
      props.key,
      props.now ?? this.c.var.now().getTime(),
    )
  }

  record(props: Readonly<{ key: string; now?: number }>): Promise<void> {
    return recordLoginAttempt(
      this.c.var.database,
      props.key,
      props.now ?? this.c.var.now().getTime(),
    )
  }

  reset(props: Readonly<{ key: string }>): Promise<void> {
    return resetLoginAttempts(this.c.var.database, props.key)
  }

  recordAndCheck(
    props: Readonly<{ identifier: string; ip: string | null; now?: number }>,
  ): Promise<LoginRateLimitGateResult> {
    return recordAndCheckLoginAttempt(
      this.c.var.database,
      props.identifier,
      props.ip,
      props.now ?? this.c.var.now().getTime(),
    )
  }

  resetForIdentifier(props: Readonly<{ identifier: string }>): Promise<void> {
    return resetLoginAttemptsForIdentifier(this.c.var.database, props.identifier)
  }
}

function toIpPart(ip: string | null): string {
  return ip !== null && ip.length > 0 ? ip : "anonymous"
}

/**
 * ---------------------------------------------------------------------------
 * 単一キーの素朴な API (forgot-password / internal-verify 用)
 * ---------------------------------------------------------------------------
 */

/**
 * 認証を試みる前の上限判定。窓内の失敗数が上限に達していれば true (=拒否) を返す。
 * 副作用を持たない参照専用で、行の生成・削除はしない (掃除は recordLoginAttempt 側)。
 * DB エラー時は fail-open で false を返す。
 */
async function isLoginRateLimited(db: Db, key: string, now: number = Date.now()): Promise<boolean> {
  try {
    const rows = await db
      .select({ total: count() })
      .from(systemAuthenticationAttempts)
      .where(
        and(
          eq(systemAuthenticationAttempts.identifier, key),
          gt(systemAuthenticationAttempts.attemptedAt, new Date(now - WINDOW_MS)),
        ),
      )

    const total = rows[0]?.total ?? 0

    return total >= MAX_ATTEMPTS
  } catch (error) {
    console.error("login rate limit check failed", error)

    return false
  }
}

/**
 * 失敗した試行 1 回分を記録する。ログインでは失敗した試行だけ、パスワードリセット要求では
 * 毎リクエストを 1 回分として呼ぶ (数える対象の判断は呼び出し側の責務)。記録に続けて同 identifier の
 * 窓外の古い行を opportunistic に削除し、行の際限ない蓄積を防ぐ (全表 sweep はしない)。best-effort。
 */
async function recordLoginAttempt(db: Db, key: string, now: number = Date.now()): Promise<void> {
  try {
    await db.insert(systemAuthenticationAttempts).values({
      id: crypto.randomUUID(),
      identifier: key,
      attemptedAt: new Date(now),
    })

    await db
      .delete(systemAuthenticationAttempts)
      .where(
        and(
          eq(systemAuthenticationAttempts.identifier, key),
          lte(systemAuthenticationAttempts.attemptedAt, new Date(now - WINDOW_MS)),
        ),
      )
  } catch (error) {
    console.error("login rate limit record failed", error)
  }
}

/**
 * 認証成功時に該当キーの試行行をすべて削除する。成功を境に窓をリセットすることで、直前に失敗が
 * 続いていても正規ログイン後の再試行がすぐ上限に当たらないようにする 。best-effort。
 */
async function resetLoginAttempts(db: Db, key: string): Promise<void> {
  try {
    await db
      .delete(systemAuthenticationAttempts)
      .where(eq(systemAuthenticationAttempts.identifier, key))
  } catch (error) {
    console.error("login rate limit reset failed", error)
  }
}

/**
 * IP とログイン識別子 (メール or 社員番号) を組み合わせたキー。IP のみだと NAT 配下の正常ユーザを
 * 巻き込み、識別子のみだと単一アカウントを狙う攻撃者が同 IP から複数識別子を試して既存ユーザ列挙
 * できてしまうので、両方を結合する。
 *
 * 正規化は呼び出し側の責務 。メールは normalizeEmail (trim + 小文字化)、社員番号は trim のみ
 * (英字入り社員番号の大文字を保つ) 済みの識別子を渡す。ここで一律に小文字化すると社員番号の
 * 大小を潰し Emp-A01 と emp-a01 が同一バケットに落ちるため、builder では小文字化しない
 * (internal verify key と同じく正規化済み前提)。
 */
/**
 * ---------------------------------------------------------------------------
 * ログイン専用の原子的ゲート
 * ---------------------------------------------------------------------------
 */

/**
 * account (識別子単独、IP を跨いで効く) の上限。IP を分散させた単一アカウントへの総当たりを
 * 頭打ちにする一方、複数拠点から使う正規ユーザーの入力ミスを締め出しすぎないよう pair の 2 倍に緩和する。
 */
const MAX_ATTEMPTS_PER_ACCOUNT = MAX_ATTEMPTS * 2

/**
 * ip (IP単独、識別子を跨いで効く) の上限。単一 IP からの password spray (識別子を変えながらの
 * 総当たり) を頭打ちにする一方、施設の NAT 共有で複数職員が同一 IP から失敗し得るため大きく緩める。
 */
const MAX_ATTEMPTS_PER_IP = 50

export type LoginRateLimitGateResult = { limited: boolean }

/**
 * ログイン専用の原子的レートリミットゲート 。
 *
 * verifyPassword を呼ぶ前に必ず呼ぶ。まず試行行を 1 行 insert し、同じ db.batch 往復内で
 * pair (identifier+ip) / account (identifier 単独) / ip (ip 単独) の 3 バケットを、自分の行を
 * 含めて count する。D1 は 1 つの D1 database につき単一の SQLite 接続を直列実行するため、
 * db.batch でまとめた insert→count は 1 つの実行単位として他リクエストの書込と割り込まない。
 * 「上限確認 → (別リクエストの insert が割り込む) → 記録」の TOCTOU ( の指摘) はこれで消える。
 *
 * いずれかのバケットが閾値を超えていれば、自分の行だけを削除して limited:true を返す
 * (呼び出し側は verifyPassword を呼ばない。高コストな PBKDF2 を上限到達後に走らせないためであり、
 * 429 が続いても行が残らないので窓も延びない)。閾値未満なら行を残したまま limited:false を返す。
 *
 * 呼び出し側 (login.ts) の後続の扱い:
 * - 認証失敗 → 何もしない (この行がそのまま失敗 1 回として残る)。
 * - 認証成功 → resetLoginAttemptsForIdentifier で該当 identifier の行を全削除する
 *   (この行も含めて消える。account/pair 双方がリセットされ、ip 単独バケットだけ残る)。
 *
 * 閾値の根拠:
 * - pair (IP+識別子) 10回/15分: 従来値を維持。
 * - account (識別子単独) 20回/15分 (pair の2倍): IP を分散させた単一アカウント総当たりの上限。
 * - ip (IP単独) 50回/15分: 単一 IP からの password spray の上限。NAT 共有拠点の正常利用を
 *   巻き込まないよう pair より大きく緩める。
 *
 * 解除は窓 (15分) 経過による自動回復のみ。手動で解除したい場合は system_authentication_attempts の該当行を
 * 直接 DELETE する (専用の管理 API は用意しない)。
 *
 * DB エラー時は fail-open で limited:false を返す (他の関数と同じ best-effort 方針)。
 */
async function recordAndCheckLoginAttempt(
  db: Db,
  identifier: string,
  ip: string | null,
  now: number = Date.now(),
): Promise<LoginRateLimitGateResult> {
  const ipPart = toIpPart(ip)
  const id = crypto.randomUUID()
  const attemptedAt = new Date(now)
  const windowStart = new Date(now - WINDOW_MS)

  try {
    const insert = db
      .insert(systemAuthenticationAttempts)
      .values({ id, identifier, ip: ipPart, attemptedAt })
    const pairCount = db
      .select({ total: count() })
      .from(systemAuthenticationAttempts)
      .where(
        and(
          eq(systemAuthenticationAttempts.identifier, identifier),
          eq(systemAuthenticationAttempts.ip, ipPart),
          gt(systemAuthenticationAttempts.attemptedAt, windowStart),
        ),
      )
    const accountCount = db
      .select({ total: count() })
      .from(systemAuthenticationAttempts)
      .where(
        and(
          eq(systemAuthenticationAttempts.identifier, identifier),
          gt(systemAuthenticationAttempts.attemptedAt, windowStart),
        ),
      )
    const ipCount = db
      .select({ total: count() })
      .from(systemAuthenticationAttempts)
      .where(
        and(
          eq(systemAuthenticationAttempts.ip, ipPart),
          gt(systemAuthenticationAttempts.attemptedAt, windowStart),
        ),
      )
    /**
     * 窓外に出た自分の identifier の古い行を opportunistic に掃除する (単一キー API の
     * recordLoginAttempt と同じ方針、全表 sweep はしない)。
     */
    const cleanup = db
      .delete(systemAuthenticationAttempts)
      .where(
        and(
          eq(systemAuthenticationAttempts.identifier, identifier),
          lte(systemAuthenticationAttempts.attemptedAt, windowStart),
        ),
      )

    const [, pairRows, accountRows, ipRows] = await db.batch([
      insert,
      pairCount,
      accountCount,
      ipCount,
      cleanup,
    ])

    const pairTotal = pairRows[0]?.total ?? 0
    const accountTotal = accountRows[0]?.total ?? 0
    const ipTotal = ipRows[0]?.total ?? 0

    const limited =
      pairTotal > MAX_ATTEMPTS ||
      accountTotal > MAX_ATTEMPTS_PER_ACCOUNT ||
      ipTotal > MAX_ATTEMPTS_PER_IP

    if (limited) {
      await db.delete(systemAuthenticationAttempts).where(eq(systemAuthenticationAttempts.id, id))
    }

    return { limited }
  } catch (error) {
    console.error("login rate limit gate failed", error)

    return { limited: false }
  }
}

/**
 * 認証成功時に該当 identifier の試行行をすべて削除する 。
 *
 * pair (identifier+ip) は identifier=X の部分集合なので、この 1 クエリで account・pair の
 * 両方がリセットされる。ip 単独バケットは削除条件に identifier を含まないため対象外のまま残り、
 * 攻撃者が手持ちの正規資格情報でログインして spray カウンタを洗い流す抜け道を防ぐ
 * (他の識別子が同じ IP から残した失敗行はそのまま残る)。
 */
async function resetLoginAttemptsForIdentifier(db: Db, identifier: string): Promise<void> {
  try {
    await db
      .delete(systemAuthenticationAttempts)
      .where(eq(systemAuthenticationAttempts.identifier, identifier))
  } catch (error) {
    console.error("login rate limit reset failed", error)
  }
}
