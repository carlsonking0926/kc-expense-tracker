"""家庭記帳 API（FastAPI）。

提供記帳 CRUD、月份統計、設定（分類/成員/付款方式），並托管前端靜態檔。
"""

from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import db

app = FastAPI(title="家庭記帳")
STATIC_DIR = Path(__file__).parent / "static"


@app.on_event("startup")
def _startup() -> None:
    db.init_db()


# ---------- 資料模型 ----------
class ExpenseIn(BaseModel):
    date: str  # YYYY-MM-DD
    amount: float = Field(gt=0)
    kind: str = "expense"  # expense / income
    category: str
    member: str | None = None
    method: str | None = None
    note: str | None = None


class Member(BaseModel):
    name: str
    photo: str = ""  # base64 data URL，空字串=未設頭像


class MetaIn(BaseModel):
    categories: list[str] | None = None
    members: list[Member] | None = None
    methods: list[str] | None = None


def _normalize_members(raw: list) -> list[dict]:
    """相容舊資料：成員可能是純字串，統一成 {name, photo}。"""
    out = []
    for m in raw:
        if isinstance(m, str):
            out.append({"name": m, "photo": ""})
        else:
            out.append({"name": m.get("name", ""), "photo": m.get("photo", "")})
    return out


# ---------- 設定（分類/成員/付款方式） ----------
@app.get("/api/meta")
def get_meta() -> dict:
    return {
        "categories": db.get_setting("categories"),
        "members": _normalize_members(db.get_setting("members")),
        "methods": db.get_setting("methods"),
    }


@app.post("/api/meta")
def update_meta(meta: MetaIn) -> dict:
    if meta.categories is not None:
        db.set_setting("categories", meta.categories)
    if meta.members is not None:
        db.set_setting("members", [m.model_dump() for m in meta.members])
    if meta.methods is not None:
        db.set_setting("methods", meta.methods)
    return get_meta()


# ---------- 記帳 ----------
@app.get("/api/expenses")
def list_expenses(month: str) -> list[dict]:
    """回傳某月（YYYY-MM）的所有紀錄，新到舊。"""
    with db.get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM expenses WHERE substr(date,1,7) = ? "
            "ORDER BY date DESC, id DESC",
            (month,),
        ).fetchall()
    return [dict(r) for r in rows]


@app.post("/api/expenses")
def add_expense(item: ExpenseIn) -> dict:
    if item.kind not in ("expense", "income"):
        raise HTTPException(400, "kind 必須是 expense 或 income")
    now = datetime.now(timezone.utc).isoformat()
    with db.get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO expenses (date, amount, kind, category, member, method, note, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (item.date, item.amount, item.kind, item.category,
             item.member, item.method, item.note, now),
        )
        new_id = cur.lastrowid
    return {"id": new_id}


@app.delete("/api/expenses/{expense_id}")
def delete_expense(expense_id: int) -> dict:
    with db.get_conn() as conn:
        conn.execute("DELETE FROM expenses WHERE id = ?", (expense_id,))
    return {"ok": True}


# ---------- 統計 ----------
@app.get("/api/summary")
def summary(month: str, member: str | None = None) -> dict:
    """某月統計。member 有值時，收支與分類只算該成員；成員圓餅圖一律全員比較。"""
    with db.get_conn() as conn:
        rows = conn.execute(
            "SELECT amount, kind, category, member FROM expenses "
            "WHERE substr(date,1,7) = ?",
            (month,),
        ).fetchall()

    # 篩選範圍：選了成員就只看該成員
    scope = [r for r in rows if not member or (r["member"] or "未指定") == member]

    income = sum(r["amount"] for r in scope if r["kind"] == "income")
    expense = sum(r["amount"] for r in scope if r["kind"] == "expense")

    by_category: dict[str, float] = {}
    for r in scope:
        if r["kind"] == "expense":
            by_category[r["category"]] = by_category.get(r["category"], 0) + r["amount"]

    # 成員佔比永遠用全部資料（供「誰花的」比較）
    by_member: dict[str, float] = {}
    for r in rows:
        if r["kind"] == "expense":
            m = r["member"] or "未指定"
            by_member[m] = by_member.get(m, 0) + r["amount"]

    return {
        "income": income,
        "expense": expense,
        "balance": income - expense,
        "by_category": by_category,
        "by_member": by_member,
    }


# ---------- 前端 ----------
@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
