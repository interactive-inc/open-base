# System auth internal library

製品に依存しないSystemの認証materialを生成、署名、検証し、AccountとSessionのdomain modelへ接続する内部ライブラリです。

## 責務

- password、reset token、login code、MCP grant tokenのhashと検証。
- access token、JWT、PKCE、session rotation materialの生成と検証。
- 暗号処理の失敗をSystem domainの結果へ変換し、秘密値を公開面へ漏らさない。

cookie、hostname、HTTP response、画面用profile、Company Employee、製品固有のlogin responseは扱いません。それらは製品のAPI rootが合成します。利用側は必要なclassまたは関数の定義元を直接importし、全認証操作を束ねるfacade、barrel、re-exportは作りません。

Systemを共有する製品はこのdirectoryを全ファイル同一に保ちます。暗号primitive、期限、署名改ざん、用途違い、rotation監査を直接テストし、秘密値や実運用鍵をfixtureへ保存しません。

## 検証

```bash
bun test src/contexts/system/lib/auth
```
