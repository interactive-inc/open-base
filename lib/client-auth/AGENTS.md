# クライアント認証設定の排他

CLIとMCPが共有するローカル認証設定の技術部品です。API、System、Companyの正本や業務上の判断を所有しません。

- 設定ファイルの読み直し、外部APIによるtokenの更新、保存は同じ排他区間で行います。
- 設定全体の書き込みも同じ排他に参加し、他の接続先と未知のfieldを保全します。
- SQLiteはOS管理の排他のためだけに使います。認証情報と業務データは保存しません。
- 取得順は保証しません。30秒で取得できなければ失敗を返し、lockを迂回しません。
- プロセス終了時はOSがlockを解放します。稼働中のlockファイルを削除しません。
- JSONは所有者だけが読める一時ファイルから原子的に置換します。秘密値や実データをテストへ持ち込みません。
- CLIの設定、異なるプロセスの同時更新、所有プロセスの終了、MCPの更新失敗を検証します。

```sh
(cd cli && bun test tests/lib/auth-file-lock.test.ts tests/lib/session-concurrency.test.ts tests/lib/config.test.ts)
(cd mcp && bun test lib)
```
