# 顧客と商品・サービス

顧客は `customer`、商品・サービスは `offering` がそれぞれの正本を所有する。受託、自社製品、その他の業務から利用できる。

## 有効化

`ENABLED_OPT_IN_APPS` に使用するcontext名を含める。在籍中の本人へ、顧客は `customer:read` と `customer:write`、商品は `offering:read` と `offering:write` のうち必要な権限を付与する。参照権限は台帳全体に適用する。

## 操作

- 顧客の名称、別名、利用状態を登録する。CLIは `base customer list` と `base customer save`。MCPは `customer_records` と `customer_save`。HTTPは `/api/customer/records`。
- 商品・サービスの名称、コード、種別、提供状態を登録する。CLIは `base offering list` と `base offering save`。MCPは `offering_records` と `offering_save`。HTTPは `/api/offering/records`。
- 作成・訂正にはUUID、期待版、理由、UUIDの冪等キーを指定する。作成の期待版はゼロ。訂正は記録全体を送る。同じ要求の再送には同じ内容とキーを使用する。
- 一覧から名称・別名・コードで候補を探し、UUIDで対象を確定する。同名の候補を自動で統合する仕組みは提供範囲外。変更と利用終了は履歴に残る。
