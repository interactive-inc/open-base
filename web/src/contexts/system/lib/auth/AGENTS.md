# System auth internal library

製品に依存しないSystemの認証materialを生成、署名、検証する内部ライブラリです。人のサインインとセッションはBetter Authが担い、ここでは扱いません。

## 責務

- パスキー招待、再認証grant、機械credentialの秘密値の生成とhash。
- 機械credentialと外部access tokenのJWTの署名と検証。
- 暗号処理の失敗をSystem domainの結果へ変換し、秘密値を公開面へ漏らさない。

cookie、hostname、HTTP response、画面用profile、Company Employee、製品固有のlogin responseは扱いません。それらは製品のAPI rootが合成します。利用側は必要なclassまたは関数の定義元を直接importし、全認証操作を束ねるfacade、barrel、re-exportは作りません。

暗号primitive、期限、署名改ざん、用途違いを直接テストし、秘密値や実運用鍵をfixtureへ保存しません。

## 検証

```bash
bun test src/contexts/system/lib/auth
```
