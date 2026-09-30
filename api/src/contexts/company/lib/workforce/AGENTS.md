# Company workforce internal library

Companyの組織、雇用、所属、責任を同一revisionと基準日で解決し、製品から独立したWorkforceの正本を提供する内部ライブラリです。

## 責務

- append-only projectionから組織とWorkforceの時点状態を復元する。
- 組織変更の整合性を検証し、変更後のWorkforceを決定する。
- System AccountとEmployeeの対応、組織上の資格、既存lifecycle projectionとの一致を解決する。

HTTP、DB query、Drizzle schema、cookie、hostname、製品固有profileは扱いません。I/OはCompany domainが所有するportから受け、利用側は必要なclassまたは関数の定義元を直接importします。全操作を束ねるfacade、barrel、re-exportは作りません。

Companyを共有する製品はこのdirectoryを全ファイル同一に保ちます。変更時は純粋な変換を直接テストし、portを使う処理は成功、競合、不整合、利用不能をCompanyの語彙で検証します。

## 検証

```bash
bun test src/contexts/company/lib/workforce
```
