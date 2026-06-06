# K&C 記帳（全繁中自建家庭記帳 PWA）

手機優先、全繁體中文的家庭記帳，全家共用＋跨裝置同步。需求規格見 [SPEC.md](SPEC.md)。

## 線上資訊
- **正式網址**：https://kc-expense.zeabur.app
- App 名稱（加到主畫面）：**K&C 記帳**，圖示：粉底白「記」
- 平台：Zeabur，伺服器 Tencent Singapore 2C/4GB（同 ExpenseOwl 那台）
- 資料庫：SQLite，掛 volume `/app/data`（持久化）
- GitHub（公開）：https://github.com/carlsonking0926/kc-expense-tracker
- 映像：`ghcr.io/carlsonking0926/kc-expense-tracker:latest`（公開）

## 技術架構
- 後端：FastAPI（`app/main.py`）+ SQLite（`app/db.py`）
- 前端：vanilla JS 單頁（`app/static/`），Chart.js
- 設計：米白淡雅 + 玫瑰粉點綴；分類柱狀圖用日系粉色系；成員圓餅圖 Karen黃/Carlson紫
- 功能：記帳(支出/收入·金額·日期·分類·付款人·付款方式·備註)、清單(成員頭像、每筆可✎編輯/✕刪除，編輯走底部彈窗 PUT `/api/expenses/{id}`)、統計(分類橫向柱狀圖+成員圓餅圖+全部/成員篩選)、設定(分類/成員含照片/付款方式可增刪、下拉「＋新增」快速加)、收入vs支出進度條

## ⚠️ 部署重點（踩雷紀錄）
**Zeabur 自購伺服器（BYO server）不能從 Git 原始碼 build，只能跑現成 Docker 映像。**
- ❌ Git URL 部署 → 容器起不來、看不到 build log、persistent 502
- ✅ 正解：GitHub Actions 建映像推 GHCR → Zeabur「Docker 容器映像」部署
- GHCR 套件需設 **public** 才能匿名拉取（或在 Zeabur 填 registry 帳密）

## 更新流程（改 code 後重新部署）
1. 改 code → push 到 GitHub main
2. GitHub Actions 自動 build 新映像推 GHCR（`.github/workflows/build-image.yml`）
3. Zeabur 服務 → 服務狀態 → **重新部署**（重拉 latest 映像）

## 本地開發
```bash
cd family_expense
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
DATA_DIR=./data .venv/bin/uvicorn app.main:app --reload --app-dir . --port 8099
```

## 待辦
- [ ] 設家庭成員真實照片（設定頁點頭像上傳）
- [ ] 之後考慮加存取保護（家庭密碼 / Cloudflare Access）—— 目前無登入驗證
- [ ] 清掉 2 個 AWS Taipei 空專案；K&C 穩定後收掉過渡版 ExpenseOwl
