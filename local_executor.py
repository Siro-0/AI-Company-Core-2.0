#!/usr/bin/env python3
"""
AI Company Core - Local Executor

AI Company Core 2.0 / Company Core 3.0

役割:
- Company Coreからlocalhost経由でタスクを受け取る
- PC上で実際のローカル処理を行う
- 結果をCompany Coreへ返す
- 実行結果をcompany_workspace/reports/へ保存する

安全設計:
- 任意のシェルコマンドは実行しない
- 実行可能な処理はこのファイル内で定義されたものだけ
- localhost (127.0.0.1) のみで待ち受ける
"""

from __future__ import annotations

import json
import re
import sys
import traceback

from datetime import datetime, timezone
from http.server import (
    BaseHTTPRequestHandler,
    ThreadingHTTPServer,
)
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


BASE_DIR.mkdir(
    parents=True,
    exist_ok=True
)

REPORTS_DIR.mkdir(
    parents=True,
    exist_ok=True
)


# =====================================================
# Utility
# =====================================================

def iso_now() -> str:
    """
    UTC ISO timestamp.
    """
    return (
        datetime
        .now(timezone.utc)
        .isoformat()
    )


def json_bytes(
    payload: dict[str, Any]
) -> bytes:
    """
    JSONレスポンスをUTF-8 bytesへ変換。
    """
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
    ファイル名として安全な文字だけにする。
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

    value = value.strip(
        "_"
    )

    if not value:
        return fallback

    return value[
        :80
    ]


# =====================================================
# Report Writer
# =====================================================

def write_report(
    prefix: str,
    title: str,
    body: str
) -> str:
    """
    Markdown形式の実ファイルを生成。
    """

    timestamp =
        datetime
        .now()
        .strftime(
            "%Y%m%d_%H%M%S"
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

    return str(
        path.relative_to(
            Path.cwd()
        )
    )


# =====================================================
# Workspace Inspection
# =====================================================

def workspace_files() -> list[Path]:
    """
    company_workspace内のファイル一覧。
    """

    return [
        path
        for path
        in BASE_DIR.rglob("*")
        if path.is_file()
    ]


def workspace_summary() -> dict[str, Any]:
    """
    Workspaceの基本統計を取得。
    """

    files =
        workspace_files()

    total_bytes = 0

    extension_counts: dict[
        str,
        int
    ] = {}

    for path in files:

        try:

            total_bytes += (
                path.stat()
                .st_size
            )

        except OSError:

            continue

        suffix =
            path.suffix.lower()

        if not suffix:
            suffix = (
                "[no_extension]"
            )

        extension_counts[
            suffix
        ] = (
            extension_counts.get(
                suffix,
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
    Workspaceを実際に分析して、
    Markdownレポートを生成。
    """

    summary =
        workspace_summary()

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
            summary[
                "extensions"
            ].items()
        ):

            body += (
                f"- `{extension}`: "
                f"{count}\n"
            )

    else:

        body += (
            "- まだ対象ファイルはありません。\n"
        )

    output_path =
        write_report(
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
    事業検証用の実ファイルを生成。
    """

    summary =
        workspace_summary()

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

    output_path =
        write_report(
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
# Task: Risk Scan
# =====================================================

def run_risk_scan(
    task: dict[str, Any]
) -> dict[str, Any]:
    """
    Workspaceをスキャンして、
    危険そうな名前のファイル候補をレポート。
    """

    files =
        workspace_files()

    suspicious_names = []

    for path in files:

        name =
            path.name.lower()

        if any(
            keyword
            in name
            for keyword
            in (
                ".env",
                "password",
                "secret",
                "token",
                "private"
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

    output_path =
        write_report(
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
    許可されたローカル処理を選択する。
    """

    title =
        task.get(
            "title",
            ""
        )

    # ---------------------------------------------
    # Risk
    # ---------------------------------------------

    if any(
        keyword
        in title
        for keyword
        in (
            "リスク",
            "危険",
            "安全",
            "法務"
        )
    ):

        return run_risk_scan(
            task
        )

    # ---------------------------------------------
    # Business
    # ---------------------------------------------

    if any(
        keyword
        in title
        for keyword
        in (
            "事業",
            "市場",
            "検証",
            "顧客",
            "サービス",
            "商品"
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
        "AICompanyCoreLocalExecutor/1.0"
    )

    # ---------------------------------------------
    # JSON response
    # ---------------------------------------------

    def _send_json(
        self,
        status: int,
        payload: dict[str, Any]
    ) -> None:

        body =
            json_bytes(
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

        path =
            urlparse(
                self.path
            ).path

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

        path =
            urlparse(
                self.path
            ).path

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

            length =
                int(
                    self.headers.get(
                        "Content-Length",
                        "0"
                    )
                )

            raw =
                self.rfile.read(
                    length
                )

            request =
                json.loads(
                    raw.decode(
                        "utf-8"
                    )
                )

            task =
                request.get(
                    "task"
                )

            if not isinstance(
                task,
                dict
            ):

                raise ValueError(
                    "task object is required"
                )

            result =
                execute_task(
                    task
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

    server =
        ThreadingHTTPServer(
            (
                HOST,
                PORT
            ),
            ExecutorHandler
        )

    print(
        "AI Company Core "
        "Local Executor"
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
        "任意のシェルコマンドは実行しません。"
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
