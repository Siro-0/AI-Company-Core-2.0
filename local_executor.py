#!/usr/bin/env python3
"""
AI Company Core - Local Executor
Company Core 4.0 / Real Local Executor

役割:
- Company Core から localhost 経由でタスクを受け取る
- PC上で定義済みの安全なローカル処理を実行する
- 結果と成果物のパスをCompany Coreへ返す
- Research / Product / Salesの中間成果物をローカルに保存する

安全設計:
- 任意のシェルコマンドは実行しない
- 127.0.0.1 でのみ待ち受ける
- 実行処理はこのファイル内で定義されたものだけ
- 外部公開・決済・購入・顧客送信は行わない
- 市場調査はこの版では「調査設計・ローカル証跡生成」に限定する
"""

from __future__ import annotations

import json
import re
import sys
import traceback

from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlparse


# =====================================================
# Server Settings
# =====================================================

HOST = "127.0.0.1"
PORT = 8765
VERSION = "1.2"


# =====================================================
# Workspace
# =====================================================

BASE_DIR = Path.cwd() / "company_workspace"
REPORTS_DIR = BASE_DIR / "reports"
RESEARCH_DIR = BASE_DIR / "research"
PRODUCTS_DIR = BASE_DIR / "products"
SALES_DIR = BASE_DIR / "sales"

for directory in (
    BASE_DIR,
    REPORTS_DIR,
    RESEARCH_DIR,
    PRODUCTS_DIR,
    SALES_DIR,
):
    directory.mkdir(
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
    """ファイル名として危険な文字を除去する。"""

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
    """CWDから見た相対パスを返す。"""

    cwd = Path.cwd().resolve()
    resolved = path.resolve()

    try:
        return str(
            resolved.relative_to(cwd)
        )

    except ValueError:
        return str(resolved)


def write_text(
    path: Path,
    content: str
) -> str:
    """UTF-8でテキストを保存し、相対パスを返す。"""

    path.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    path.write_text(
        content,
        encoding="utf-8"
    )

    return relative_to_cwd(path)


# =====================================================
# Report Writer
# =====================================================

def write_report(
    prefix: str,
    title: str,
    body: str
) -> str:
    """Markdown形式の実ファイルを生成する。"""

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


def latest_directory(
    parent: Path
) -> Optional[Path]:
    """指定ディレクトリ直下から最も新しいディレクトリを取得する。"""

    candidates = [
        path
        for path in parent.iterdir()
        if path.is_dir()
    ]

    if not candidates:
        return None

    return max(
        candidates,
        key=lambda path:
            path.stat().st_mtime
    )


# =====================================================
# Task: Workspace Analysis
# =====================================================

def run_workspace_analysis(
    task: dict[str, Any]
) -> dict[str, Any]:
    """Workspaceを分析してMarkdownレポートを生成する。"""

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
        str(
            task.get(
                "title",
                "Workspace Analysis"
            )
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
    """事業検証用の実ファイルを生成する。"""

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
        str(
            task.get(
                "title",
                "Business Validation"
            )
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
# Task: Research Brief
# =====================================================

def run_research_brief(
    task: dict[str, Any]
) -> dict[str, Any]:
    """
    市場調査・競合調査の設計書と証跡ファイルを生成する。

    この版では外部サイトへの自動接続は行わない。
    実際の外部情報を取得したとは扱わず、
    調査項目とローカル証跡を残す。
    """

    title = str(
        task.get(
            "title",
            "市場調査"
        )
    )

    target = title

    if "市場調査:" in title:

        target = (
            title
            .split(
                "市場調査:",
                1
            )[1]
            .strip()
            or target
        )

    timestamp = (
        datetime
        .now()
        .strftime("%Y%m%d_%H%M%S")
    )

    package_dir = (
        RESEARCH_DIR
        / (
            f"{timestamp}_"
            f"{safe_filename(target, 'research')}"
        )
    )

    package_dir.mkdir(
        parents=True,
        exist_ok=True
    )

    summary = (
        workspace_summary()
    )

    latest_sales = (
        latest_directory(
            SALES_DIR
        )
    )

    research_plan = (
        f"# {target} - Research Brief\n\n"
    )

    research_plan += (
        f"- 作成日時: {iso_now()}\n"
    )

    research_plan += (
        "- 状態: 調査設計\n"
    )

    research_plan += (
        "- 外部サイト自動取得: 実施していない\n\n"
    )

    research_plan += (
        "## 調査対象\n\n"
    )

    research_plan += (
        f"{target}\n\n"
    )

    research_plan += (
        "## 確認項目\n\n"
    )

    research_plan += (
        "1. 顧客が抱える具体的な課題\n"
    )

    research_plan += (
        "2. 想定顧客の既存の代替手段\n"
    )

    research_plan += (
        "3. 競合サービスと提供価値\n"
    )

    research_plan += (
        "4. 価格帯と課金方式\n"
    )

    research_plan += (
        "5. 導入・提供コスト\n"
    )

    research_plan += (
        "6. 法務・規約・運営上の注意点\n"
    )

    research_plan += (
        "7. 小規模検証で測定する指標\n\n"
    )

    research_plan += (
        "## ローカル証跡\n\n"
    )

    research_plan += (
        f"- Workspace files: "
        f"{summary['file_count']}\n"
    )

    research_plan += (
        f"- Workspace bytes: "
        f"{summary['total_bytes']}\n"
    )

    research_plan += (
        f"- 最新Sales Package: "
        f"{latest_sales.name if latest_sales else 'なし'}\n\n"
    )

    research_plan += (
        "## 次の行動\n\n"
    )

    research_plan += (
        "外部の市場情報・競合情報・顧客反応を別工程で取得し、"
        "ここへ追記してから事業判断へ進む。\n"
    )

    brief_path = (
        package_dir
        / "research_brief.md"
    )

    write_text(
        brief_path,
        research_plan
    )

    manifest = {
        "target":
            target,

        "status":
            "research_plan",

        "created_at":
            iso_now(),

        "external_data_fetched":
            False,

        "next_step":
            "外部情報を取得し、仮説と照合する"
    }

    manifest_path = (
        package_dir
        / "manifest.json"
    )

    write_text(
        manifest_path,
        json.dumps(
            manifest,
            ensure_ascii=False,
            indent=2
        )
    )

    return {

        "action":
            "research_brief",

        "output_path":
            relative_to_cwd(
                package_dir
            ),

        "result":
            "市場調査の設計書とローカル証跡を生成しました。"
            "外部情報の取得はまだ行っていません。",

        "metrics": {

            "target":
                target,

            "external_data_fetched":
                False,

            "workspace_file_count":
                summary["file_count"]
        }
    }


# =====================================================
# Task: Product Prototype
# =====================================================

def run_product_prototype(
    task: dict[str, Any]
) -> dict[str, Any]:
    """商品仕様と最小プロトタイプ構成をローカル生成する。"""

    title = str(
        task.get(
            "title",
            "商品作成"
        )
    )

    product_name = title

    if "商品作成:" in title:

        product_name = (
            title
            .split(
                "商品作成:",
                1
            )[1]
            .strip()
            or product_name
        )

    timestamp = (
        datetime
        .now()
        .strftime("%Y%m%d_%H%M%S")
    )

    package_dir = (
        PRODUCTS_DIR
        / (
            f"{timestamp}_"
            f"{safe_filename(product_name, 'product')}"
        )
    )

    prototype_dir = (
        package_dir
        / "prototype"
    )

    prototype_dir.mkdir(
        parents=True,
        exist_ok=True
    )

    spec = (
        f"# {product_name}\n\n"
    )

    spec += (
        f"- 作成日時: {iso_now()}\n"
    )

    spec += (
        "- 状態: 最小プロトタイプ構成\n\n"
    )

    spec += (
        "## 目的\n\n"
    )

    spec += (
        "顧客課題を1つに絞った最小提供単位を検証する。\n\n"
    )

    spec += (
        "## 必須要件\n\n"
    )

    spec += (
        "- 顧客課題を1つ明確にする\n"
    )

    spec += (
        "- 価値提供を1つに絞る\n"
    )

    spec += (
        "- 継続コストを把握する\n"
    )

    spec += (
        "- 検証結果を測定できるようにする\n"
    )

    write_text(
        package_dir / "product_spec.md",
        spec
    )

    prototype_readme = (
        f"# Prototype - {product_name}\n\n"
    )

    prototype_readme += (
        "このディレクトリは最小プロトタイプの作業場所です。\n\n"
    )

    prototype_readme += (
        "## 次に作るもの\n\n"
    )

    prototype_readme += (
        "1. 最小機能\n"
    )

    prototype_readme += (
        "2. 動作確認\n"
    )

    prototype_readme += (
        "3. 顧客検証\n"
    )

    write_text(
        prototype_dir / "README.md",
        prototype_readme
    )

    checklist = (
        "# Prototype Checklist\n\n"
    )

    checklist += (
        f"対象: {product_name}\n\n"
    )

    checklist += (
        "- [ ] 最小機能を定義\n"
    )

    checklist += (
        "- [ ] 実装\n"
    )

    checklist += (
        "- [ ] ローカルテスト\n"
    )

    checklist += (
        "- [ ] 顧客検証\n"
    )

    checklist += (
        "- [ ] 改善\n"
    )

    write_text(
        package_dir / "prototype_checklist.md",
        checklist
    )

    manifest = {
        "product_name":
            product_name,

        "status":
            "prototype_draft",

        "created_at":
            iso_now(),

        "external_execution":
            False,

        "next_step":
            "販売準備と小規模検証"
    }

    write_text(
        package_dir / "manifest.json",
        json.dumps(
            manifest,
            ensure_ascii=False,
            indent=2
        )
    )

    return {

        "action":
            "product_prototype",

        "output_path":
            relative_to_cwd(
                package_dir
            ),

        "result":
            "商品仕様と最小プロトタイプ構成をローカル成果物として生成しました。",

        "metrics": {

            "product_name":
                product_name,

            "external_execution":
                False
        }
    }


# =====================================================
# Task: Sales Preparation Package
# =====================================================

def run_sales_package(
    task: dict[str, Any]
) -> dict[str, Any]:
    """販売準備用のドラフトパッケージを生成する。"""

    raw_title = str(
        task.get(
            "title",
            ""
        )
    ).strip()

    product_name = raw_title

    for prefix in (
        "販売準備:",
        "商品化:"
    ):

        if prefix in raw_title:

            product_name = (
                raw_title
                .split(
                    prefix,
                    1
                )[1]
                .strip()
                or product_name
            )

            break

    if not product_name:
        product_name = (
            "未定義商品"
        )

    timestamp = (
        datetime
        .now()
        .strftime("%Y%m%d_%H%M%S")
    )

    package_dir = (
        SALES_DIR
        / (
            f"{timestamp}_"
            f"{safe_filename(product_name, 'product')}"
        )
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

    latest_product = (
        latest_directory(
            PRODUCTS_DIR
        )
    )

    source_product = (
        latest_product.name
        if latest_product
        else None
    )

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

        "source_product_package":
            source_product,

        "description":
            "AI Company Coreが作成した販売準備用ドラフトです。",

        "target_customer":
            "市場検証によって具体化する",

        "problem":
            "顧客調査後に確定する",

        "value_proposition":
            "小規模検証で確認する"
    }

    write_text(
        package_dir
        / "product.json",

        json.dumps(
            product_data,
            ensure_ascii=False,
            indent=2
        )
    )

    sales_page = (
        f"# {product_name}\n\n"
    )

    sales_page += (
        "## この商品について\n\n"
    )

    sales_page += (
        f"{product_name} の販売ページ草案です。\n\n"
    )

    sales_page += (
        "## 解決したい課題\n\n"
    )

    sales_page += (
        "実際の顧客調査・市場検証によって確定します。\n\n"
    )

    sales_page += (
        "## 提供する価値\n\n"
    )

    sales_page += (
        "利用者にとって具体的な価値があるかを小規模検証します。\n\n"
    )

    sales_page += (
        "## 想定ユーザー\n\n"
    )

    sales_page += (
        "今後の顧客調査で具体化します。\n\n"
    )

    sales_page += (
        "## 価格\n\n"
    )

    sales_page += (
        "価格案は別ファイルの `pricing.md` に記載します。\n\n"
    )

    sales_page += (
        "## 注意\n\n"
    )

    sales_page += (
        "このページは販売準備用ドラフトです。"
        "まだ外部公開・決済・購入受付は行っていません。\n"
    )

    write_text(
        package_dir
        / "sales_page.md",

        sales_page
    )

    pricing = (
        f"# {product_name} - Pricing Draft\n\n"
    )

    pricing += (
        "## 状態\n\n"
        "販売価格の検討段階です。\n\n"
    )

    pricing += (
        "## 判断材料\n\n"
    )

    pricing += (
        "1. 顧客が感じる価値\n"
    )

    pricing += (
        "2. 提供コスト\n"
    )

    pricing += (
        "3. 継続運営コスト\n"
    )

    pricing += (
        "4. 競合価格\n"
    )

    pricing += (
        "5. 実際の購入意向\n\n"
    )

    pricing += (
        "## 注意\n\n"
        "実際の価格設定や販売開始は行っていません。\n"
    )

    write_text(
        package_dir
        / "pricing.md",

        pricing
    )

    delivery = (
        "# Delivery Draft\n\n"
    )

    delivery += (
        "## 想定納品方法\n\n"
    )

    delivery += (
        "- ダウンロード型\n"
    )

    delivery += (
        "- Webサービス型\n"
    )

    delivery += (
        "- ドキュメント型\n"
    )

    delivery += (
        "- 個別提供型\n\n"
    )

    delivery += (
        "## 現在の状態\n\n"
    )

    delivery += (
        "まだ実際の購入者への納品は行いません。\n"
    )

    write_text(
        delivery_dir
        / "README.md",

        delivery
    )

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

        "external_execution":
            False,

        "next_step":
            "販売評価 → Human Gate → 公開"
    }

    write_text(
        package_dir
        / "manifest.json",

        json.dumps(
            manifest,
            ensure_ascii=False,
            indent=2
        )
    )

    return {

        "action":
            "sales_package_generation",

        "output_path":
            relative_to_cwd(
                package_dir
            ),

        "result":
            "販売準備パッケージのドラフトを生成しました。",

        "metrics": {

            "product_name":
                product_name,

            "file_count":
                5,

            "external_execution":
                False,

            "source_product_package":
                source_product
        }
    }


# =====================================================
# Task: Sales Evaluation
# =====================================================

def run_sales_evaluation(
    task: dict[str, Any]
) -> dict[str, Any]:
    """最新のSales Packageの構成を検査し、評価資料を生成する。"""

    latest_sales = (
        latest_directory(
            SALES_DIR
        )
    )

    if latest_sales is None:

        output_path = write_report(
            "sales_evaluation",

            str(
                task.get(
                    "title",
                    "販売評価"
                )
            ),

            (
                "## 結果\n\n"
                "販売準備パッケージが存在しません。"
                "先に販売準備を実行してください。\n"
            )
        )

        return {

            "action":
                "sales_evaluation",

            "output_path":
                output_path,

            "result":
                "販売準備パッケージがないため、販売評価を保留しました。",

            "metrics": {

                "status":
                    "blocked",

                "ready_for_human_gate":
                    False
            }
        }

    required_files = [

        "product.json",

        "sales_page.md",

        "pricing.md",

        "manifest.json",

        "delivery/README.md"
    ]

    present = []
    missing = []

    for relative in required_files:

        path = (
            latest_sales
            / relative
        )

        if path.is_file():
            present.append(relative)

        else:
            missing.append(relative)

    product_name = (
        latest_sales.name
    )

    product_json = (
        latest_sales
        / "product.json"
    )

    if product_json.is_file():

        try:

            payload = json.loads(
                product_json.read_text(
                    encoding="utf-8"
                )
            )

            product_name = str(
                payload.get(
                    "product_name"
                )
                or product_name
            )

        except (
            OSError,
            json.JSONDecodeError
        ):

            pass

    status = (
        "構成確認済み"
        if not missing
        else
        "構成不足"
    )

    ready = (
        not missing
    )

    evaluation = (
        f"# Sales Evaluation - "
        f"{product_name}\n\n"
    )

    evaluation += (
        f"- 評価日時: "
        f"{iso_now()}\n"
    )

    evaluation += (
        f"- 対象パッケージ: "
        f"{latest_sales.name}\n"
    )

    evaluation += (
        f"- 構成状態: "
        f"{status}\n"
    )

    evaluation += (
        "\n## 存在確認\n\n"
    )

    for item in present:

        evaluation += (
            f"- [x] {item}\n"
        )

    for item in missing:

        evaluation += (
            f"- [ ] {item}\n"
        )

    evaluation += (
        "\n## 事業上まだ未確認の項目\n\n"
    )

    evaluation += (
        "- 顧客が実際に購入するか\n"
    )

    evaluation += (
        "- 市場規模・競合・価格受容性\n"
    )

    evaluation += (
        "- 実際の利用効果\n"
    )

    evaluation += (
        "- 継続収益性\n"
    )

    evaluation += (
        "- 外部公開後の安全性・規約適合性\n\n"
    )

    if ready:

        evaluation += (
            "## 次の段階\n\n"
            "Human Gateを通して公開判断へ進められる構成です。"
            "ただし、これは販売成功を意味しません。\n"
        )

    else:

        evaluation += (
            "## 次の段階\n\n"
            "不足ファイルを生成してから再評価します。\n"
        )

    output_path = write_text(
        latest_sales
        / "sales_evaluation.md",

        evaluation
    )

    return {

        "action":
            "sales_evaluation",

        "output_path":
            output_path,

        "result":
            "販売準備パッケージの構成と未確認項目を評価しました。",

        "metrics": {

            "product_name":
                product_name,

            "present_files":
                len(present),

            "missing_files":
                len(missing),

            "ready_for_human_gate":
                ready,

            "business_success_confirmed":
                False
        }
    }


# =====================================================
# Task: Risk Scan
# =====================================================

def run_risk_scan(
    task: dict[str, Any]
) -> dict[str, Any]:
    """Workspaceをスキャンして注意候補をレポートする。"""

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

    output_path = write_report(
        "risk_scan",

        str(
            task.get(
                "title",
                "Risk Scan"
            )
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

        "metrics": {

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
    """タスク内容に応じて定義済みのローカル処理を選択する。"""

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
            "法務"
        )
    ):

        return run_risk_scan(
            task
        )

    # ---------------------------------------------
    # Research
    # ---------------------------------------------

    if any(
        keyword in title
        for keyword in (
            "市場調査",
            "競合調査",
            "顧客調査",
            "リサーチ"
        )
    ):

        return run_research_brief(
            task
        )

    # ---------------------------------------------
    # Product
    # ---------------------------------------------

    if any(
        keyword in title
        for keyword in (
            "商品作成",
            "プロトタイプ",
            "試作品",
            "商品開発"
        )
    ):

        return run_product_prototype(
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
            "セールス"
        )
    ):

        return run_sales_package(
            task
        )

    # ---------------------------------------------
    # Sales Evaluation
    # ---------------------------------------------

    if any(
        keyword in title
        for keyword in (
            "販売評価",
            "販売審査",
            "販売判断"
        )
    ):

        return run_sales_evaluation(
            task
        )

    # ---------------------------------------------
    # Business Validation
    # ---------------------------------------------

    if any(
        keyword in title
        for keyword in (
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
        f"AICompanyCoreLocalExecutor/{VERSION}"
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

        if path == "/health":

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
                        VERSION,

                    "capabilities": [

                        "workspace_analysis",

                        "business_validation",

                        "research_brief",

                        "product_prototype",

                        "sales_package_generation",

                        "sales_evaluation",

                        "risk_scan"
                    ],

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

        if path != "/execute":

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
        f"Version: {VERSION}"
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
        "Research / Product / Sales pipeline: 有効"
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
