#!/usr/bin/env python3
"""
AI Company Core - Local Executor
Company Core 3.0 / Real Local Executor

役割:
- Company Core から localhost 経由でタスクを受け取る
- PC上で定義済みの安全なローカル処理を実行する
- 結果と成果物のパスをCompany Coreへ返す
- company_workspace/reports に実行レポートを保存する
- company_workspace/sales に販売準備ドラフトを保存する

安全設計:
- 任意のシェルコマンドは実行しない
- 127.0.0.1 でのみ待ち受ける
- 実行処理はこのファイル内で定義されたものだけ
- 外部への公開・送信・決済・購入は行わない
"""

from __future__ import annotations

import json
import re
import sys
import traceback

from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


# =====================================================
# Server Settings
# =====================================================

HOST = "127.0.0.1"
PORT = 8765


# =====================================================
# Workspace
# =====================================================

BASE_DIR = (
    Path.cwd()
    / "company_workspace"
)

REPORTS_DIR = (
    BASE_DIR
    / "reports"
)

SALES_DIR = (
    BASE_DIR
    / "sales"
)


BASE_DIR.mkdir(
    parents=True,
    exist_ok=True
)

REPORTS_DIR.mkdir(
    parents=True,
    exist_ok=True
)

SALES_DIR.mkdir(
    parents=True,
    exist_ok=True
)


# =====================================================
# Utility
# =====================================================

def iso_now() -> str:
    """UTC ISO timestampを返す。"""
    return datetime.now(
        timezone.utc
    ).isoformat()


def json_bytes(
    payload: dict[str, Any]
) -> bytes:
    """JSONレスポンスをUTF-8 bytesへ変換する。"""
    return json.dumps(
        payload,
        ensure_ascii=False,
        indent=2
    ).encode("utf-8")


def safe_filename(
    value: str,
    fallback: str = "task"
) -> str:
    """
    ファイル名として危険な文字を除去する。
    """

    value = re.sub(
        r"[^\w\u3040-\u30ff\u3400-\u9fff一-龯\- ]+",
        "",
        value
    )

    value = re.sub(
        r"\s+",
        "_",
        value
    )

    value = value.strip("_")

    if not value:
        return fallback

    return value[:80]


def relative_to_cwd(
    path: Path
) -> str:
    """
    CWDから見た相対パスを安全に返す。
    """

    cwd = Path.cwd().resolve()
    resolved = path.resolve()

    try:
        return str(
            resolved.relative_to(cwd)
        )
    except ValueError:
        return str(resolved)


# =====================================================
# Report Writer
# =====================================================

def write_report(
    prefix: str,
    title: str,
    body: str
) -> str:
    """
    Markdown形式の実ファイルを生成する。
    """

    timestamp = (
        datetime
        .now()
        .strftime("%Y%m%d_%H%M%S")
    )

    filename = (
        f"{timestamp}_"
        f"{safe_filename(prefix)}.md"
    )

    path = (
        REPORTS_DIR
        / filename
    )

    content = (
        f"# {title}\n\n"
        f"- 実行日時: {iso_now()}\n"
        f"- Executor: Python Local Executor\n\n"
        f"{body}\n"
    )

    path.write_text(
        content,
        encoding="utf-8"
    )

    return relative_to_cwd(path)


# =====================================================
# Workspace Inspection
# =====================================================

def workspace_files() -> list[Path]:
    """company_workspace内のファイル一覧を返す。"""

    return [
        path
        for path in BASE_DIR.rglob("*")
        if path.is_file()
    ]


def workspace_summary() -> dict[str, Any]:
    """Workspaceの基本統計を取得する。"""

    files = workspace_files()

    total_bytes = 0

    extension_counts: dict[
        str,
        int
    ] = {}

    for path in files:

        try:
            total_bytes += (
                path.stat().st_size
            )

        except OSError:
            continue

        extension = (
            path.suffix.lower()
            or "[no_extension]"
        )

        extension_counts[
            extension
        ] = (
            extension_counts.get(
                extension,
                0
            ) + 1
        )

    return {
        "file_count":
            len(files),

        "total_bytes":
            total_bytes,

        "extensions":
            extension_counts
    }


# =====================================================
# Task: Workspace Analysis
# =====================================================

def run_workspace_analysis(
    task: dict[str, Any]
) -> dict[str, Any]:
    """
    Workspaceを実際に分析して
    Markdownレポートを生成する。
    """

    summary = (
        workspace_summary()
    )

    body = (
        "## Workspace Analysis\n\n"

        f"- ファイル数: "
        f"{summary['file_count']}\n"

        f"- 合計サイズ(bytes): "
        f"{summary['total_bytes']}\n\n"

        "### 拡張子別ファイル数\n\n"
    )

    if summary["extensions"]:

        for (
            extension,
            count
        ) in sorted(
            summary["extensions"].items()
        ):

            body += (
                f"- `{extension}`: "
                f"{count}\n"
            )

    else:

        body += (
            "- まだ対象ファイルはありません。\n"
        )

    output_path = write_report(
        "workspace_analysis",
        task.get(
            "title",
            "Workspace Analysis"
        ),
        body
    )

    return {

        "action":
            "workspace_analysis",

        "output_path":
            output_path,

        "result":
            "ワークスペースを実際に分析し、"
            "ファイル構成レポートを生成しました。",

        "metrics":
            summary
    }


# =====================================================
# Task: Business Validation
# =====================================================

def run_business_validation(
    task: dict[str, Any]
) -> dict[str, Any]:
    """
    事業検証用の実ファイルを生成する。
    """

    summary = (
        workspace_summary()
    )

    body = (
        "## Business Validation Worksheet\n\n"

        f"検証対象タスク: "
        f"{task.get('title', '')}\n\n"

        "### 現在取得できるローカル情報\n\n"

        f"- ワークスペースのファイル数: "
        f"{summary['file_count']}\n"

        f"- 合計データ量(bytes): "
        f"{summary['total_bytes']}\n\n"

        "### 次に確認する項目\n\n"

        "- 顧客課題\n"
        "- 検証方法\n"
        "- 作成コスト\n"
        "- 継続可能性\n"
        "- 実際の利用反応\n"
    )

    output_path = write_report(
        "business_validation",
        task.get(
            "title",
            "Business Validation"
        ),
        body
    )

    return {

        "action":
            "business_validation",

        "output_path":
            output_path,

        "result":
            "事業検証用ワークシートを実ファイルとして生成しました。",

        "metrics":
            summary
    }


# =====================================================
# Task: Sales Preparation Package
# =====================================================

def run_sales_package(
    task: dict[str, Any]
) -> dict[str, Any]:
    """
    販売準備用のドラフトパッケージを生成する。

    生成するもの:
    - product.json
    - sales_page.md
    - pricing.md
    - manifest.json
    - delivery/README.md

    この処理では、
    実際の外部公開・決済・購入受付・メール送信・
    外部サービスへのデータ送信は行わない。
    """

    raw_title = str(
        task.get(
            "title",
            ""
        )
    ).strip()

    product_name = raw_title

    if "販売準備:" in raw_title:
        product_name = (
            raw_title.split(
                "販売準備:",
                1
            )[1].strip()
        )

    if not product_name:
        product_name = "未定義商品"

    timestamp = datetime.now().strftime(
        "%Y%m%d_%H%M%S"
    )

    package_name = (
        f"{timestamp}_"
        f"{safe_filename(product_name, 'product')}"
    )

    package_dir = (
        SALES_DIR
        / package_name
    )

    delivery_dir = (
        package_dir
        / "delivery"
    )

    package_dir.mkdir(
        parents=True,
        exist_ok=True
    )

    delivery_dir.mkdir(
        parents=True,
        exist_ok=True
    )

    # ---------------------------------------------
    # Product specification
    # ---------------------------------------------

    product_data = {
        "product_name":
            product_name,

        "status":
            "販売準備ドラフト",

        "created_at":
            iso_now(),

        "executor":
            "Python Local Executor",

        "external_actions":
            False,

        "description":
            "AI Company Coreが作成した販売準備用ドラフトです。",

        "target_customer":
            "今後の市場検証によって具体化する",

        "problem":
            "実際の顧客調査後に確定する",

        "value_proposition":
            "実際の利用価値を小規模検証して確定する"
    }

    product_path = (
        package_dir
        / "product.json"
    )

    product_path.write_text(
        json.dumps(
            product_data,
            ensure_ascii=False,
            indent=2
        ),
        encoding="utf-8"
    )

    # ---------------------------------------------
    # Sales page draft
    # ---------------------------------------------

    sales_page = f"""# {product_name}

## この商品について

{product_name} の販売ページ草案です。

この文書は販売準備用のドラフトであり、
実際の公開前に人間による確認が必要です。

## 解決したい課題

実際の顧客調査・市場検証によって確定します。

## 提供する価値

利用者にとって具体的な価値があるかを
小規模な検証によって確認します。

## 想定ユーザー

今後の顧客調査で具体化します。

## 提供内容

販売する具体的な内容は、
商品検証と実装結果をもとに確定します。

## 価格

価格案は別ファイルの `pricing.md` に記載しています。

## 利用方法

購入後の具体的な利用手順・納品形式は、
商品仕様確定後に決定します。

## 注意

このページは販売準備用ドラフトです。

まだ外部公開・決済・購入受付は行っていません。
"""

    sales_page_path = (
        package_dir
        / "sales_page.md"
    )

    sales_page_path.write_text(
        sales_page,
        encoding="utf-8"
    )

    # ---------------------------------------------
    # Pricing draft
    # ---------------------------------------------

    pricing = f"""# {product_name} - Pricing Draft

## 状態

販売価格の検討段階です。

## 初期価格案

- 仮価格：小規模検証後に決定
- 無料検証：必要に応じて実施
- 本販売価格：顧客価値と提供コストから決定

## 判断材料

1. 顧客が感じる価値
2. 提供コスト
3. 継続運営コスト
4. 競合価格
5. 実際の購入意向

## 注意

このファイルは価格検討用のドラフトです。
実際の価格設定や販売開始は行っていません。
"""

    pricing_path = (
        package_dir
        / "pricing.md"
    )

    pricing_path.write_text(
        pricing,
        encoding="utf-8"
    )

    # ---------------------------------------------
    # Delivery draft
    # ---------------------------------------------

    delivery = """# Delivery Draft

## 想定納品方法

商品形式に応じて以下から決定する。

- ダウンロード型
- Webサービス型
- ドキュメント型
- 個別提供型

## 現在の状態

まだ実際の購入者への納品は行いません。

Human Gateで承認されるまで、
外部サービスへの公開や顧客への送信は行いません。
"""

    delivery_path = (
        delivery_dir
        / "README.md"
    )

    delivery_path.write_text(
        delivery,
        encoding="utf-8"
    )

    # ---------------------------------------------
    # Manifest
    # ---------------------------------------------

    manifest = {
        "product_name":
            product_name,

        "status":
            "draft",

        "created_at":
            iso_now(),

        "files": [
            "product.json",
            "sales_page.md",
            "pricing.md",
            "manifest.json",
            "delivery/README.md"
        ],

        "next_step":
            "市場検証 → 商品改善 → Human Gate → 公開",

        "external_execution":
            False
    }

    manifest_path = (
        package_dir
        / "manifest.json"
    )

    manifest_path.write_text(
        json.dumps(
            manifest,
            ensure_ascii=False,
            indent=2
        ),
        encoding="utf-8"
    )

    output_path = relative_to_cwd(
        package_dir
    )

    return {

        "action":
            "sales_package_generation",

        "output_path":
            output_path,

        "result":
            "販売準備パッケージのドラフトを生成しました。",

        "metrics": {

            "product_name":
                product_name,

            "file_count":
                5,

            "external_execution":
                False
        }
    }


# =====================================================
# Task: Risk Scan
# =====================================================

def run_risk_scan(
    task: dict[str, Any]
) -> dict[str, Any]:
    """
    Workspaceをスキャンして、
    注意候補をレポートする。
    """

    files = workspace_files()

    suspicious_names: list[str] = []

    for path in files:

        name = (
            path.name.lower()
        )

        if any(
            keyword in name
            for keyword in (
                ".env",
                "password",
                "secret",
                "token",
                "private",
            )
        ):

            suspicious_names.append(
                str(
                    path.relative_to(
                        BASE_DIR
                    )
                )
            )

    body = (
        "## Local Risk Scan\n\n"

        f"- 対象ファイル数: "
        f"{len(files)}\n"

        f"- 注意候補数: "
        f"{len(suspicious_names)}\n\n"

        "### 注意候補\n\n"
    )

    if suspicious_names:

        for item in suspicious_names:

            body += (
                f"- `{item}`\n"
            )

    else:

        body += (
            "- 自動検出された注意候補はありません。\n"
        )

    output_path = write_report(
        "risk_scan",
        task.get(
            "title",
            "Risk Scan"
        ),
        body
    )

    return {

        "action":
            "risk_scan",

        "output_path":
            output_path,

        "result":
            "ワークスペースを実際にスキャンし、"
            "リスク確認レポートを生成しました。",

        "metrics":
            {
                "file_count":
                    len(files),

                "suspicious_count":
                    len(
                        suspicious_names
                    )
            }
    }


# =====================================================
# Task Router
# =====================================================

def execute_task(
    task: dict[str, Any]
) -> dict[str, Any]:
    """
    タスク内容に応じて、
    定義済みのローカル処理を選択する。
    """

    title = str(
        task.get(
            "title",
            ""
        )
    )

    # ---------------------------------------------
    # Risk
    # ---------------------------------------------

    if any(
        keyword in title
        for keyword in (
            "リスク",
            "危険",
            "安全",
            "法務",
        )
    ):

        return run_risk_scan(
            task
        )

    # ---------------------------------------------
    # Sales Preparation
    # ---------------------------------------------

    if any(
        keyword in title
        for keyword in (
            "販売準備",
            "販売ページ",
            "商品化",
            "価格案",
            "セールス",
        )
    ):

        return run_sales_package(
            task
        )

    # ---------------------------------------------
    # Business
    # ---------------------------------------------

    if any(
        keyword in title
        for keyword in (
            "事業",
            "市場",
            "検証",
            "顧客",
            "サービス",
            "商品",
        )
    ):

        return run_business_validation(
            task
        )

    # ---------------------------------------------
    # Default
    # ---------------------------------------------

    return run_workspace_analysis(
        task
    )


# =====================================================
# HTTP Handler
# =====================================================

class ExecutorHandler(
    BaseHTTPRequestHandler
):

    server_version = (
        "AICompanyCoreLocalExecutor/1.1"
    )

    # ---------------------------------------------
    # JSON response
    # ---------------------------------------------

    def _send_json(
        self,
        status: int,
        payload: dict[str, Any]
    ) -> None:

        body = json_bytes(
            payload
        )

        self.send_response(
            status
        )

        self.send_header(
            "Content-Type",
            "application/json; charset=utf-8"
        )

        self.send_header(
            "Access-Control-Allow-Origin",
            "*"
        )

        self.send_header(
            "Access-Control-Allow-Methods",
            "GET, POST, OPTIONS"
        )

        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type"
        )

        self.send_header(
            "Content-Length",
            str(
                len(body)
            )
        )

        self.end_headers()

        self.wfile.write(
            body
        )

    # ---------------------------------------------
    # OPTIONS
    # ---------------------------------------------

    def do_OPTIONS(
        self
    ) -> None:

        self._send_json(
            204,
            {}
        )

    # ---------------------------------------------
    # GET
    # ---------------------------------------------

    def do_GET(
        self
    ) -> None:

        path = (
            urlparse(
                self.path
            ).path
        )

        if (
            path ==
            "/health"
        ):

            self._send_json(

                200,

                {
                    "ok":
                        True,

                    "service":
                        "AI Company Core Local Executor",

                    "executor":
                        "Python Local Executor",

                    "version":
                        "1.1",

                    "sales_preparation":
                        True,

                    "external_actions":
                        False,

                    "time":
                        iso_now()
                }
            )

            return

        self._send_json(

            404,

            {
                "ok":
                    False,

                "error":
                    "Not Found"
            }
        )

    # ---------------------------------------------
    # POST
    # ---------------------------------------------

    def do_POST(
        self
    ) -> None:

        path = (
            urlparse(
                self.path
            ).path
        )

        if (
            path !=
            "/execute"
        ):

            self._send_json(

                404,

                {
                    "ok":
                        False,

                    "error":
                        "Not Found"
                }
            )

            return

        try:

            length = int(
                self.headers.get(
                    "Content-Length",
                    "0"
                )
            )

            raw = (
                self.rfile.read(
                    length
                )
            )

            request = json.loads(
                raw.decode(
                    "utf-8"
                )
            )

            task = request.get(
                "task"
            )

            if not isinstance(
                task,
                dict
            ):

                raise ValueError(
                    "task object is required"
                )

            result = (
                execute_task(
                    task
                )
            )

            self._send_json(

                200,

                {
                    "ok":
                        True,

                    **result,

                    "time":
                        iso_now()
                }
            )

        except Exception as exc:

            traceback.print_exc()

            self._send_json(

                500,

                {
                    "ok":
                        False,

                    "error":
                        str(exc)
                }
            )

    # ---------------------------------------------
    # Logging
    # ---------------------------------------------

    def log_message(
        self,
        format: str,
        *args: Any
    ) -> None:

        sys.stdout.write(

            f"[{iso_now()}] "
            f"{format % args}\n"
        )


# =====================================================
# Main
# =====================================================

def main() -> None:

    server = (
        ThreadingHTTPServer(
            (
                HOST,
                PORT
            ),
            ExecutorHandler
        )
    )

    print(
        "AI Company Core Local Executor"
    )

    print(
        f"Listening on: "
        f"http://{HOST}:{PORT}"
    )

    print(
        f"Health check: "
        f"http://{HOST}:{PORT}/health"
    )

    print(
        f"Workspace: "
        f"{BASE_DIR.resolve()}"
    )

    print(
        "Sales preparation: 有効"
    )

    print(
        "外部公開・決済・購入受付・任意のシェルコマンドは実行しません。"
    )

    print(
        "停止する場合は Ctrl+C を押してください。"
    )

    try:

        server.serve_forever()

    except KeyboardInterrupt:

        print(
            "\nStopping Local Executor..."
        )

    finally:

        server.server_close()


if __name__ == "__main__":
    main()
