# クライアント案件

受託案件とその時間予実を扱う独立した業務context。案件と工数の正本を所有する。担当者はCompanyの従業員IDを参照する。顧客と商品は外部参照IDとして記録する。入力元が参照先を解決し、案件側から他の業務contextへ直接アクセスしない。工数の用途は案件への時間配分で、勤怠・給与・請求の正本は各領域が担う。

## 有効化と権限

`ENABLED_OPT_IN_APPS` に `client-project` を含める。現在在籍している本人に、必要な操作権限を付与する。

- `client_project:read` は全件と履歴の参照。案件単位の公開範囲が必要な配備では、全件参照権限の付与先を限定する。
- `client_project:write` は案件の作成と訂正。
- `client_project:record` は本人の工数の作成、訂正、取消。

## 操作と予実

MCPの `client_project_records` と `client_project_save`、CLIの `base client-project list` と `base client-project save`、HTTPの `GET /api/client-project/records` と `POST /api/client-project/records` が同じ記録を扱う。

保存時は記録の種類、UUID、理由、期待版、全項目とUUIDの冪等キーを指定する。作成の期待版はゼロ。訂正では取得した版を指定し、競合時は読み直す。同じ書き込みを再送する場合は同じ内容とキーを使う。取消済みの工数は履歴に残り、実績の合計から外れる。

案件の予定と残り見込みは分単位で記録する。実績は有効な工数の合計。完了時見込みは実績と残り見込みの合計、差は完了時見込みから現在の予定を引いた値。未入力の予定や見込みは不明として返す。初版の予定は当初値として参照できる。
