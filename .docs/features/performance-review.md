# 目標管理と評価

## 所有境界

評価期間、本人の目標、自己評価、評価者の評価と版をperformance-review contextで所有する。承認の正本はSystem、現在の在籍と判断資格はCompanyが所有する。目標と評価結果には別の承認規程を使う。APIとMCPで同じapplication ruleを適用する。

給与や処遇を自動計算・自動決定しない。期間の日付は評価対象の期間であり、自動提出、締切処理、期末の自動確定は行わない。点数の集計は固定した制度に従う計算として行い、評価者同士の点数を自動で統合して最終評語を決めることはしない。

## 期間・目標・評価

評価期間の開始日、終了日、名称、評価制度と承認規程は作成後に変更しない。上期・下期・四半期などの名称と日付を自由に設定できる。制度や規程を変える場合は新しい期間を作る。期間ごと・従業員ごとにシートは一件とする。

フローを省略すると、目標と評価の両方で現在の直属上長に確認を求め、否定の判断は差戻しになる。フローを指定すると、複数段階、全員承認、必要人数、条件、期限、委任を既存基盤の制約内で設定できる。`review_cycles_show`で固定した規程を確認できる。

目標には安定したUUID、名称、測定可能な達成基準、重みとsection_keyを付ける。20件までで、提出時は区分ごとの目標の重みを100にする。自己評価には全目標の実績、点数、根拠コメントが必要になる。評価の承認時にも、評価者が全目標の点数と根拠を添える。目標IDの重複、欠落、別の目標の混入は拒否する。

## 評価制度のカスタマイズ

期間作成時のevaluation_policyで尺度と区分配分を指定する。省略時は1〜5点、mbo区分100％とする。目標のsection_keyを省略するとmboになる。

scaleには0〜100の範囲で異なる整数値と表示名を昇順に2〜20段階指定する。宣言していない値による採点は拒否する。sectionsには区分のkey、名称、配分を最大10件指定し、配分の合計を100にする。たとえばMBOを70％、行動評価を30％にできる。

```json
{
  "version": 1,
  "scale": [
    { "value": 1, "label": "改善" },
    { "value": 3, "label": "標準" },
    { "value": 7, "label": "期待超過" }
  ],
  "sections": [
    { "key": "mbo", "name": "目標", "weight": 70 },
    { "key": "behavior", "name": "行動", "weight": 30 }
  ]
}
```

シートは期間の制度をコピーし、作成後はDBでも変更を禁止する。提出内容と履歴にも同じ制度を保存する。区分内の目標の加重平均を求め、区分配分でさらに加重平均する。weighted_scoreは小数4桁、尺度の最低点を0・最高点を100とするnormalized_scoreは小数2桁に丸める。自己評価の集計は詳細のself_evaluation_summaryで返し、各評価者の集計は承認履歴のevaluation_summaryに保存する。

## 状態・版・判断

目標の下書きから目標承認待ちへ提出し、必要な承認が揃うと目標承認済みになる。差戻し・却下の後は内容を訂正して再提出する。提出中と目標承認後の目標は直接書き換えない。目標承認済みからreopen_goalsで改定を開始すると、現在の承認への参照と自己評価を外した新しい下書き版を作る。過去の承認と内容は履歴に残り、改定した目標は新たな承認が揃うまで評価へ進めない。評価承認待ちや確定後は改定を開始しない。

目標承認後に自己評価を記録して評価承認待ちへ提出し、必要な承認が揃うと確定する。差戻し・却下の後は自己評価を訂正して再提出する。確定済み・取消済みのシートは変更しない。

各提出は内容の版とdigestを持つ新しいSystem提案・案件を作り、シートとの参照を同じtransactionで保存する。承認はシートの期待版に加え、表示した提案版、digest、判断段階、roundを照合する。

判断時はCompanyが現在の資格、除外対象、委任、次の判断段階を再検査する。上長が未定義、候補ゼロ、在籍や資格が評価不能の場合は拒否する。管理権限を判断資格の代用にしない。Systemの判断、評価の状態、評価者の評価、理由、actor chainを同じtransactionで保存し、部分失敗では全体を巻き戻す。

## 権限

- `performance_review:manage` は評価期間と承認規程を作る操作能力を表す。
- `performance_review:write` は本人の変更・提出・取消を許可する。
- `performance_review:read` は本人または現在の判断資格がある評価の閲覧を許可する。
- `performance_review:read:all` は全社のシート一覧を許可する。単体と履歴も読む場合はreadも付与する。
- `performance_review:decide` は判断の操作能力を表す。Companyの判断資格も必要になる。

所有者や判断者は任意引数から指定しない。CLIのデバイス認証で得た本人のセッションをMCPが使う。機械credentialによる評価の操作は拒否する。

Systemの共通提案履歴APIはSystem自身の案件だけを開示し、評価の提出内容は評価APIからだけ読む。共通の履歴閲覧権限や過去の判断参加を、評価の閲覧資格の代用にしない。

評価者の閲覧は現在または最後の判断段階に固定した候補と現在の会社資格を両方要求する。従業員番号が別人へ移っても、既存案件の資格を引き継がない。委任先には有効な委任、規程による委任許可、本人と委任元の在籍と現在の資格を要求する。閲覧資格の検査から開示までに資格・権限・委任が変われば409として内容を返さない。詳細・履歴・承認一覧を同じ境界で保護し、応答にはno-storeを付ける。

system:adminは現在の在籍確認を満たす場合に全評価を閲覧できるが、本人以外の目標変更や判断資格のない承認はできない。評価期間を作るmanageと全社閲覧のread:allは別の能力として付与する。部署配下の継続的な閲覧や非公開コメントは提供しない。

## MCPの手順

- `review_cycles_create`で期間を作る。必要なら二つのフローを指定する。
- `review_cycles_list`と`review_cycles_show`で期間と規程を確認する。
- `review_sheets_create`で本人の目標を作り、`review_sheets_show`でrevisionとdecision_targetを読む。
- `review_sheets_command`のsubmit_goalsで目標を提出する。
- 評価者は`review_sheets_list`の`scope: "inbox"`で案件を探し、showで内容を確認する。
- commandのdecideでapprove、reject、returnを行う。否定の判断は規程のrejection_behaviorと一致させる。
- 差戻し後はrevise_goalsまたはself_evaluateで訂正して再提出する。承認済み目標の改定はreopen_goalsから開始する。
- 目標承認後はself_evaluateとsubmit_evaluationを行い、評価者が全目標の評価を添えて承認する。
- cancelで未確定のシートを取り消す。`review_sheets_history`で提出内容、理由、判断者・委任元と版の履歴を確認する。

変更には期待版、理由、UUIDの冪等キーが必要になる。通信失敗時の再送には同じキーを使う。同じキーを別の内容へ使うと409になる。409では読み直し、変更内容を確認してから新しいキーで操作する。

一覧はlimit、offset、next_offsetで続きを読む。inboxは資格を失った案件を除外するため、空のページでもnext_offsetがあれば続きを確認する。

## APIと運用

CLIはbase reviewsを入口とする。cyclesのlist・show・create、sheetsのlist・show・history・createに加え、revise-goals・reopen-goals・submit-goals・self-evaluate・submit-evaluation・approve・return・reject・cancelを提供する。任意の対応済みcommand JSONを送る場合はsheets commandを使う。

```sh
base reviews cycles create --data period.json --idempotency-key <uuid>
base reviews sheets create --data sheet.json --idempotency-key <uuid>
base reviews sheets list --scope inbox
base reviews sheets show <sheet-id>
base reviews sheets approve <sheet-id> --data decision.json --idempotency-key <uuid>
base reviews sheets history <sheet-id>
```

変更するJSONにはreason、既存シートの変更にはexpected_revisionを指定する。判断では表示したdecision_targetをtargetとして指定する。操作名とJSONのoperation・actionが矛盾する場合は送信せず拒否する。再送は同じJSONとキーを使い、409では読み直す。CLI・MCP・HTTPは同じapplication ruleを使う。

APIは`/api/performance-review/cycles`、`/api/performance-review/sheets`配下に置く。操作は`POST /api/performance-review/sheets/{id}/commands`、履歴は`GET /api/performance-review/sheets/{id}/history`を使う。

`DISABLED_DEFAULT_APPS`へ`performance-review`を指定するとAPIを404で遮断する。無効化しても記録と履歴は消さない。

migrationは`0007_performance_review.sql`。稼働DBへは明示的に承認したときだけ適用する。ローカルではREADMEのDB移行手順を使う。
