# 初期化

通常のセットアップでは、サンプル従業員や既定パスワードは投入しない。CLIの `bootstrap` から管理者と会社の確認済み情報を登録する。

## 公開デモのサンプルデータ

公開デモを用意するときだけ、`bun run --cwd api seed:demo` で架空の会社、組織、従業員、申請の例と、閲覧専用roleを持つ共有のデモAccountを投入できる。起動中のAPIへHTTPで接続し、migration直後の空のDBにだけ投入する。初期化済みのDBでは何も書かずに終了する。

接続先と秘密値は環境変数で渡す。リポジトリに既定値は置かない。

- `BASE_API` は接続先のAPI。未設定なら `http://127.0.0.1:18787`
- `BOOTSTRAP_TOKEN` はAPIに設定したbootstrap用の値
- `DEMO_ADMIN_EMAIL` と `DEMO_ADMIN_PASSWORD` は作成する管理者
- `DEMO_VIEWER_EMAIL` と `DEMO_VIEWER_PASSWORD` は作成する共有のデモAccount

パスワードは12文字以上にする。投入後はAPIから `BOOTSTRAP_TOKEN` を削除し、`READ_ONLY_MODE` を `true` にする。閲覧専用roleでは本人向けの操作（申請の提出、プロフィールの更新など）を止められないため、公開デモでは読み取り専用モードで書き込みを止める。
