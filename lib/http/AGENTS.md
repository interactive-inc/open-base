# HTTPクライアントの技術部品

CLIとWebが共有するURLの組み立てを置きます。API・context・認証状態や業務上の識別子の形式に依存しません。

- Hono clientへ渡すpath parameterは、値を一つのsegmentとしてエンコードします。
- URL構造として扱うpathの固定部分やquery、JSON bodyはエンコード対象にしません。
- 空値と単独のdot segmentはURLの正規化で別のpathへ変わるため拒否します。
- 識別子の業務上の妥当性と認可はAPIで判断します。
