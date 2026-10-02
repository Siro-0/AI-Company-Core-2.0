AI Company Core 2.0
====================

Company Core 3.0 / Real Local Executor Edition


■ 構成
--------

GitHub Pages側：

1. index.html
2. style.css
3. app.js

PC側：

4. local_executor.py

説明：

5. README.txt


■ システム構成
----------------

Company Core
    ↓
CEO
    ↓
Strategy
    ↓
Internal Departments
    ↓
CEO Decision
    ↓
Task Core
    ↓
Python Local Executor
    ↓
実際のローカル処理
    ↓
成果物・実行結果
    ↓
Company Memory
    ↓
Evaluation
    ↓
次の戦略


■ GitHub側
-----------

以下の3ファイルをGitHubリポジトリへ配置します。

index.html
style.css
app.js

GitHub PagesからCompany Coreを開きます。


■ PC側 Local Executor
---------------------

local_executor.py はGitHub Pagesには置きません。

自分のPC上の任意のフォルダへ配置します。


例：

AI Company Local/
    local_executor.py


■ Pythonの起動
---------------

Windowsの場合、local_executor.py があるフォルダをターミナルで開きます。

次のどちらかを実行します。

py local_executor.py

または

python local_executor.py


正常に起動すると、

AI Company Core Local Executor
Listening on: http://127.0.0.1:8765

のような表示が出ます。


■ 接続確認
-----------

ブラウザで次のURLを開きます。

http://127.0.0.1:8765/health

正常ならJSON形式のヘルスチェック結果が表示されます。

その後、GitHub PagesのCompany Coreを開き、

「Executor接続確認」

を押します。

Company EngineのExecutor表示が、

Python Local Executor 接続済み

になれば接続成功です。


■ 実行
-------

Executorが起動している状態で、

「1サイクル実行」

を押します。

Company Coreが、

会社状態確認
↓
CEO戦略
↓
部署協議
↓
CEO判断
↓
Task生成
↓
Python Local Executor
↓
実ローカル処理
↓
結果取得
↓
CEO評価
↓
Company Memory

という流れで処理します。


■ Workspace
------------

local_executor.py を起動したフォルダに、

company_workspace/

が自動作成されます。

その中に、

company_workspace/
    reports/

が作成されます。


■ 現在のLocal Executorができること
------------------------------------

現在は安全な固定処理のみを実行します。

1. Workspace分析

company_workspace 内のファイル数、
合計サイズ、
拡張子別ファイル数などを確認し、
Markdownレポートを生成します。


2. 事業検証

事業・市場・検証・顧客などのタスクを受けると、
事業検証用ワークシートを生成します。


3. リスクスキャン

リスク・危険・安全・法務などのタスクを受けると、
Workspace内の注意候補を確認し、
リスク確認レポートを生成します。


■ 現時点の安全仕様
--------------------

Local Executorは任意のシェルコマンドを実行しません。

AI Company Coreから受け取ったタスクを、
local_executor.py 内で定義された処理へ振り分けます。

つまり現在、

「AIが勝手にWindowsコマンドを実行する」

という構造にはしていません。


■ Human Gate
-------------

以下のような重要操作は、
Company Core側でHuman Gateの対象にできます。

・送金
・銀行
・決済
・支払い
・購入
・契約
・署名
・公開
・削除
・外部サービス
・個人情報

これらは人間の確認を経ずにそのまま実行しない設計です。


■ Company Mode
---------------

守り：

リスク確認・安定運営を優先します。


通常：

業務改善・効率化・継続的な改善を優先します。


攻め：

新規事業・事業探索・検証候補の発見を優先します。


■ 自律運転
-----------

「自律運転開始」を押すとCompany Engineが定期的にサイクルを実行します。

現在の自律運転はブラウザ上のJavaScriptによるものです。

そのため、

ブラウザを閉じる
PCをスリープさせる
ブラウザのJavaScriptが停止する

などの場合、
Company Engineの自律運転も停止します。


■ 現在まだ未完成の部分
------------------------

現在のCEO・部署・戦略判断はルールベースです。

まだ本格的なLocal AI推論エンジンは接続していません。


現在：

Company Core
    ↓
ルールベースCEO
    ↓
Python Local Executor


将来：

Company Core
    ↓
CEO Brain / Local AI
    ↓
Strategy
    ↓
Departments
    ↓
Python Local Executor


■ 今後の拡張
------------

今後は以下を接続できます。

・実際のファイル処理
・Pythonによるデータ分析
・ローカルAI
・より高度な市場調査
・事業探索
・商品開発
・検証結果の取得
・売上・収益データ
・失敗分析
・自己改善
・より高度なHuman Gate
・PC上での常駐Engine


■ 重要
-------

現在のExecutorは「本物のローカル処理」を行いますが、
それだけで現実世界の事業成果が出るわけではありません。

例えば、

「市場検証を実行した」

という場合、

ローカルで検証用ファイルを作成することと、

「実際の市場から顧客反応や売上を得る」

ことは別です。

したがってCompany Memoryでは、
実行成功と事業上の成功を区別して扱います。


■ Company Coreの基本思想
--------------------------

会社は単なるタスク管理システムではありません。

目標
↓
状況確認
↓
戦略
↓
部署協議
↓
意思決定
↓
実行
↓
結果
↓
評価
↓
記憶
↓
改善
↓
次の意思決定

という循環を持つ
「自律的な会社システム」を目指します。
