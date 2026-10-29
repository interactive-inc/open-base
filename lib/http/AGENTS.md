# HTTPクライアントの技術部品

CLI・Web・MCPが共有するURLの組み立てと、失敗応答の本文読取を置きます。API・context・認証状態や業務上の識別子の形式に依存しません。

- Hono clientへ渡すpath parameterは、値を一つのsegmentとしてエンコードします。
- URL構造として扱うpathの固定部分やquery、JSON bodyはエンコード対象にしません。
- 空値と単独のdot segmentはURLの正規化で別のpathへ変わるため拒否します。
- 識別子の業務上の妥当性と認可はAPIで判断します。

- 失敗応答の本文は一度だけ読み、読取失敗を空本文と区別します。HTTP statusの診断形式は各clientが所有します。
- 呼出し側の中断を読取失敗へ置き換えません。
- HTTPの破損本文を作るtest-supportは、合成の応答だけを使い、APIやDBへ依存しません。
