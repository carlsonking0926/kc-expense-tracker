# 家庭記帳 app（全繁中自建版）

手機優先、全繁體中文的家庭記帳工具，全家共用＋跨裝置同步。
需求規格見 [SPEC.md](SPEC.md)。

## 技術架構
- 後端：FastAPI（`app/main.py`）+ SQLite（`app/db.py`）
- 前端：純 vanilla JS 單頁（`app/static/`），Chart.js 畫圓餅圖
- 資料庫：SQLite，檔放 `DATA_DIR`（部署掛 volume 持久化）
- 打包：Dockerfile → port 8080

## 功能
- 記帳：支出/收入切換、金額、日期、分類、付款人、付款方式、備註
- **成員頭像**：每位家人可上傳照片（前端裁成正方形縮 200px 存 base64），清單/統計用頭像分辨是誰花的
- 分類/成員/付款方式皆可在「設定」頁自行增刪
- 月份切換、結餘總覽（收入/支出/結餘，NT$ 千分位）
- 統計：分類佔比、成員花費兩個圓餅圖

## 本地開發
```bash
cd family_expense
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
DATA_DIR=./data .venv/bin/uvicorn app.main:app --reload --port 8099
# 開 http://localhost:8099
```

## 部署到 Zeabur（同 ExpenseOwl 那台新加坡伺服器）
1. 推到 GitHub repo（或用 Zeabur 的 Git/上傳）
2. Zeabur 在現有專案 → 建立服務 → 從 Git 部署（會讀 Dockerfile）
3. Networking 開 port 8080、綁 Zeabur 子網域
4. **掛 volume 到 `/app/data`**（資料持久化，務必做，否則重啟資料消失）

> 過渡版 ExpenseOwl 仍在 https://carlson-family-expense.zeabur.app ，這個自建版上線後可取代它。

## API
| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/meta` | 取分類/成員(含頭像)/付款方式 |
| POST | `/api/meta` | 更新上述清單 |
| GET | `/api/expenses?month=YYYY-MM` | 某月紀錄 |
| POST | `/api/expenses` | 新增一筆 |
| DELETE | `/api/expenses/{id}` | 刪一筆 |
| GET | `/api/summary?month=YYYY-MM` | 月統計（收支/結餘/分類/成員） |

## 待辦
- [ ] 部署到 Zeabur（含掛 volume）
- [ ] 設家庭成員真實姓名＋照片
- [ ] 之後考慮加存取保護（家庭密碼 / Cloudflare Access）
