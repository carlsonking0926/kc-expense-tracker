"""SQLite 資料層：記帳資料 + 設定（分類/成員/付款方式）。

資料庫檔放在 DATA_DIR（部署時掛 Zeabur volume，重啟不丟）。
"""

import json
import os
import sqlite3
from pathlib import Path

DATA_DIR = Path(os.getenv("DATA_DIR", Path(__file__).parent.parent / "data"))
DB_PATH = DATA_DIR / "family_expense.db"

# 預設設定（使用者可在設定頁自行增刪）
DEFAULT_CATEGORIES = ["電信", "停車", "吃喝", "教育", "衣服", "車子", "旅遊", "購物"]
# 成員是物件：name 名字、photo 頭像（base64 data URL，空字串代表沒設）
DEFAULT_MEMBERS = [{"name": "Karen", "photo": ""}, {"name": "Carlson", "photo": ""}]
DEFAULT_METHODS = ["現金", "信用卡", "行動支付"]


def get_conn() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,              -- YYYY-MM-DD
                amount REAL NOT NULL,            -- 一律存正數
                kind TEXT NOT NULL,              -- 'expense' 或 'income'
                category TEXT NOT NULL,
                member TEXT,
                method TEXT,
                note TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
        )
        # 第一次啟動時塞預設值
        for key, default in (
            ("categories", DEFAULT_CATEGORIES),
            ("members", DEFAULT_MEMBERS),
            ("methods", DEFAULT_METHODS),
        ):
            row = conn.execute("SELECT 1 FROM settings WHERE key = ?", (key,)).fetchone()
            if row is None:
                conn.execute(
                    "INSERT INTO settings (key, value) VALUES (?, ?)",
                    (key, json.dumps(default, ensure_ascii=False)),
                )


def get_setting(key: str) -> list[str]:
    with get_conn() as conn:
        row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    return json.loads(row["value"]) if row else []


def set_setting(key: str, values: list[str]) -> None:
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, json.dumps(values, ensure_ascii=False)),
        )
