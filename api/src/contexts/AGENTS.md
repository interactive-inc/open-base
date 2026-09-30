# Contexts

バックエンドの機能は、最終的に次の構成で所有する。

```text
src/contexts/<context>/
  domain/
  application/
  infrastructure/
  interface/
  test/
```

- `system` は他のコンテキストへ依存しない。
- `company` は `system` だけを利用できる。
- 削除可能な各 App は独立した業務コンテキストにし、`system` と `company` だけを利用できる。業務同士では依存しない。
- 全コンテキストの合成と route 登録は `src/api` が担い、コンテキストから API root へ逆依存しない。
- `src/lib` はコンテキスト、API、DBに依存しない中立な共通処理だけを持つ。
- Interface は Hono、Infrastructure は Drizzle・D1などの実装技術を利用してよい。
- Infrastructure 直下は技術的責務の `repositories/`、`adapters/`、`schema/` と、必要な所有単位の `errors.ts` だけにする。業務機能名のディレクトリは `repositories/` または `adapters/` の内側へ置く。
- `*.repository.ts` は集約ルートまたは Entity の永続化を担う、ファイル名と一致した単一の `XxxRepository` class だけに使う。照会、外部通信、通知、base64変換などは `adapters/` の単一 `XxxAdapter` class にする。
- Application は Domain model を生成または更新する write class だけを1ファイル1クラスで置き、D1、Drizzle、Infrastructure schemaへ直接依存しない。
- Application、Repository、Adapter の constructor は、必要な依存をまとめた `constructor(private readonly c: Context)` だけにする。
- Application の `Context` は、HTTP runtime の `Context`（`@/env`）ではなく、利用する Repository と Adapter を port として並べた application 固有の `type Context = Readonly<{ ... }>` にしてよい。port は `Pick<XxxRepository, "findById" | "save">` のように実装 class から使うmethodだけを `import type` で切り出し、組み立ては interface（route、scheduled）が `new XxxRepository(c)` で行う。業務判断のテストは port へ型付きfakeを渡し、DBなしで検証する。fakeは D1、Drizzle、SQLのAPIを模倣せず、Repositoryのmethodが返す Domain model と失敗だけを返す。SQLの意味（upsert、条件付き更新、制約、transaction）は Repository の `*.d1.test.ts` でローカルD1に対して検証する。
- 型のためだけの `contracts` 層は作らず、型の所有レイヤーから `import type` する。
- `lib` は利用する最小のresourceまで下げる。`interface/lib`、`application/lib`、`http/utils`のようにlayer全体を覆う汎用bucketは作らない。
- context直下の各libraryはresource直下に`AGENTS.md`と直接テストを持ち、責務、対象外、公開入口、検証方法を固定する。配置だけを`lib`へ変えず、純粋な入力と出力、独立した変更理由、consumerが必要とする最小の公開面を維持する。
- Error classと失敗型は所有単位の`errors.ts`にまとめる。`errors/`、`*.error.ts`、`*.errors.ts`は作らず、別ファイルからre-exportしない。
- re-exportは禁止する。利用側は定義元を直接importする。
- 単一層のテストは実装の隣、複数層を横断するテストはcontext直下の単数形 `test/` に置く。複数形 `tests/` は作らない。

機能を削除するときは、対象コンテキストのディレクトリと API root の登録だけを削除する。他のコンテキストの変更を必要とする依存は追加しない。

## 所有境界

- `system` は認証、認可、案件、タスク、判断、承認、実行許可、監査、通知、非同期処理、外部連携の汎用機構を所有する。
- `company` は法人、従業員、雇用、組織、所属、責任、権限、System Accountとの対応を所有する。
- その他は削除可能な App であり、`contexts/` 直下へ `attendance`、`expense` のように機能名で置く。
- dashboard、inbox、directory、search は正本を持たず、`src/api` または利用側で複数コンテキストを合成する。

申請内容と業務上の実行規則は各 App が所有する。System は申請内容の変更不能な参照と digest、状態遷移、判断、承認、実行許可を所有し、Company は判断者の会社上の資格を解決する。System に Employee、Department、Company 固有のpermissionを追加しない。
