// 家庭記帳前端：純 vanilla JS + fetch API

const $ = (sel) => document.querySelector(sel);
const api = (url, opts) => fetch(url, opts).then((r) => r.json());

// 目前檢視的月份（Date 指向當月 1 號）
let current = new Date();
current.setDate(1);
let meta = { categories: [], members: [], methods: [] };
let kind = "expense";
let charts = {};

const ntd = (n) => "NT$" + Math.round(n).toLocaleString("en-US"); // 千分位
const monthStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

// ---------- 初始化 ----------
async function init() {
  $("#f-date").value = new Date().toISOString().slice(0, 10);
  bindNav();
  bindForm();
  bindSettings();
  meta = await api("/api/meta");
  fillSelects();
  fillStatsMember();
  renderSettings();
  $("#stats-member").onchange = (e) => { statsMember = e.target.value; renderStats(); };
  await refresh();
}

// ---------- 月份 ----------
function bindNav() {
  $("#prev-month").onclick = () => { current.setMonth(current.getMonth() - 1); refresh(); };
  $("#next-month").onclick = () => { current.setMonth(current.getMonth() + 1); refresh(); };
  document.querySelectorAll(".tabbar button").forEach((b) => {
    b.onclick = () => switchView(b.dataset.view, b);
  });
  document.querySelectorAll(".kind-btn").forEach((b) => {
    b.onclick = () => {
      kind = b.dataset.kind;
      document.querySelectorAll(".kind-btn").forEach((x) => x.classList.toggle("active", x === b));
    };
  });
}

function switchView(name, btn) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  $("#view-" + name).classList.add("active");
  document.querySelectorAll(".tabbar button").forEach((b) => b.classList.toggle("active", b === btn));
  if (name === "stats") renderStats();
}

async function refresh() {
  $("#month-label").textContent = `${current.getFullYear()} 年 ${current.getMonth() + 1} 月`;
  const month = monthStr(current);
  const [list, sum] = await Promise.all([
    api(`/api/expenses?month=${month}`),
    api(`/api/summary?month=${month}`),
  ]);
  renderList(list);
  $("#sum-income").textContent = ntd(sum.income);
  $("#sum-expense").textContent = ntd(sum.expense);
  $("#sum-balance").textContent = ntd(sum.balance);
  updateProgress(sum);
  if ($("#view-stats").classList.contains("active")) renderStats();
}

// 進度條：本月支出佔收入的比例，一眼看出花用情況
function updateProgress(sum) {
  const fill = $("#progress-fill");
  const text = $("#progress-text");
  const pct = sum.income > 0 ? (sum.expense / sum.income) * 100 : (sum.expense > 0 ? 100 : 0);
  fill.style.width = Math.min(100, pct) + "%";
  const over = sum.expense > sum.income;
  fill.style.background = over ? "#B91C1C" : "var(--expense)";
  if (sum.income === 0 && sum.expense === 0) {
    text.textContent = "本月還沒有紀錄";
  } else if (sum.income === 0) {
    text.textContent = `本月支出 ${ntd(sum.expense)}（尚無收入）`;
  } else if (over) {
    text.textContent = `⚠ 已超支 ${ntd(sum.expense - sum.income)}`;
  } else {
    text.textContent = `已花收入的 ${Math.round(pct)}%，結餘 ${ntd(sum.balance)}`;
  }
}

// ---------- 下拉選單 ----------
const ADD_OPT = '<option value="__add__">＋ 新增…</option>'; // 下拉最後的快速新增

function fillSelects() {
  const opts = (arr) => arr.map((x) => `<option>${x}</option>`).join("");
  $("#f-category").innerHTML = opts(meta.categories) + ADD_OPT;
  $("#f-member").innerHTML = opts(meta.members.map((m) => m.name)) + ADD_OPT; // 成員是物件
  $("#f-method").innerHTML = opts(meta.methods) + ADD_OPT;
}

// 下拉選「＋新增」→ 跳出輸入框，直接加進設定並選用
async function quickAdd(key, selectId, label) {
  const name = (prompt(`新增${label}`) || "").trim();
  const list = key === "members" ? meta.members.map((m) => m.name) : meta[key];
  if (!name) { $(selectId).value = list[0] || ""; return; } // 取消就還原
  if (!list.includes(name)) {
    meta[key].push(key === "members" ? { name, photo: "" } : name);
    await saveMeta(key); // 會重建下拉
  }
  $(selectId).value = name; // 選中新項目
}

// 依成員名字找頭像，回傳 <img> 或文字圓圈
function memberAvatar(name) {
  const m = meta.members.find((x) => x.name === name);
  if (m && m.photo) return `<img class="avatar" src="${m.photo}" alt="${name}">`;
  return `<span class="avatar avatar-ph">${initial(name)}</span>`;
}

// 取頭像文字：第一個字（英文轉大寫），避免同尾字撞圖
function initial(name) {
  return name ? name.trim().charAt(0).toUpperCase() : "?";
}

// ---------- 記帳表單 ----------
function bindForm() {
  // 三個下拉選到「＋新增」就跳出輸入框
  $("#f-category").onchange = (e) => { if (e.target.value === "__add__") quickAdd("categories", "#f-category", "分類"); };
  $("#f-member").onchange = (e) => { if (e.target.value === "__add__") quickAdd("members", "#f-member", "成員"); };
  $("#f-method").onchange = (e) => { if (e.target.value === "__add__") quickAdd("methods", "#f-method", "付款方式"); };

  $("#expense-form").onsubmit = async (e) => {
    e.preventDefault();
    const body = {
      date: $("#f-date").value,
      amount: parseFloat($("#f-amount").value),
      kind,
      category: $("#f-category").value,
      member: $("#f-member").value,
      method: $("#f-method").value,
      note: $("#f-note").value,
    };
    await api("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    $("#f-amount").value = "";
    $("#f-note").value = "";
    await refresh();
    switchView("list", document.querySelector('.tabbar button[data-view="list"]'));
  };
}

// ---------- 清單 ----------
function renderList(list) {
  const ul = $("#expense-list");
  $("#list-empty").style.display = list.length ? "none" : "block";
  ul.innerHTML = list.map((it) => `
    <li>
      ${memberAvatar(it.member)}
      <div>
        <div class="cat">${it.category}</div>
        <div class="meta">${it.date.slice(5)} · ${it.member || ""} ${it.method ? "· " + it.method : ""} ${it.note ? "· " + it.note : ""}</div>
      </div>
      <div class="amt ${it.kind}">${it.kind === "income" ? "+" : "-"}${ntd(it.amount)}</div>
      <button class="del" data-id="${it.id}">✕</button>
    </li>`).join("");
  ul.querySelectorAll(".del").forEach((b) => {
    b.onclick = async () => {
      await api(`/api/expenses/${b.dataset.id}`, { method: "DELETE" });
      await refresh();
    };
  });
}

// ---------- 圖表 ----------
const fontFamily = "'Noto Sans TC', sans-serif";
// 分類用的彩色區塊（日系粉色系：櫻花粉、蜜桃、藕粉、淡紫…）
const CAT_COLORS = ["#F4A7B9", "#F6C1A8", "#E7B3D4", "#C9B3E0", "#F7B5C4", "#EFA3BC", "#F3D2A8", "#D9A8CE"];
// 成員固定色：第1位黃、第2位紫（Karen 黃 / Carlson 紫）
const MEMBER_COLORS = ["#FACC15", "#7C3AED", "#059669", "#2563EB", "#DB2777", "#0891B2"];
let statsMember = ""; // 統計頁篩選："" = 全部

// 依成員順序給固定顏色
function memberColor(name) {
  const i = meta.members.findIndex((m) => m.name === name);
  return i >= 0 ? MEMBER_COLORS[i % MEMBER_COLORS.length] : "#94A3B8";
}

function destroyChart(id) { if (charts[id]) charts[id].destroy(); delete charts[id]; }
function hasData(obj) { return Object.keys(obj).length > 0; }

// 分類花費 → 橫向柱狀圖，每條不同顏色區塊
function barChart(canvasId, dataObj) {
  destroyChart(canvasId);
  const entries = Object.entries(dataObj).sort((a, b) => b[1] - a[1]); // 由大到小
  charts[canvasId] = new Chart($("#" + canvasId), {
    type: "bar",
    data: {
      labels: entries.map((e) => e[0]),
      datasets: [{
        data: entries.map((e) => e[1]),
        backgroundColor: entries.map((_, i) => CAT_COLORS[i % CAT_COLORS.length]),
        borderRadius: 6, maxBarThickness: 28,
      }],
    },
    options: {
      indexAxis: "y", // 橫向
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => ` ${ntd(c.raw)}` } },
      },
      scales: {
        x: { ticks: { callback: (v) => ntd(v), font: { family: fontFamily, size: 11 }, color: "#64748B" },
             grid: { color: "#E2E8F0" } },
        y: { ticks: { font: { family: fontFamily, size: 13 }, color: "#0F172A" }, grid: { display: false } },
      },
    },
  });
}

// 成員花費 → 圓餅圖，成員固定色
function pieChart(canvasId, dataObj) {
  destroyChart(canvasId);
  const labels = Object.keys(dataObj);
  charts[canvasId] = new Chart($("#" + canvasId), {
    type: "doughnut",
    data: { labels, datasets: [{ data: Object.values(dataObj), backgroundColor: labels.map(memberColor), borderWidth: 2, borderColor: "#fff" }] },
    options: {
      plugins: {
        legend: { position: "bottom", labels: { font: { family: fontFamily, size: 13 }, padding: 14, usePointStyle: true } },
        tooltip: { callbacks: { label: (c) => ` ${c.label}: ${ntd(c.raw)}` } },
      },
    },
  });
}

// 統計頁成員篩選下拉
function fillStatsMember() {
  const sel = $("#stats-member");
  sel.innerHTML = `<option value="">全部</option>` + meta.members.map((m) => `<option>${m.name}</option>`).join("");
  sel.value = statsMember;
}

// 抓篩選後的統計並畫圖（成員圓餅圖永遠全員）
async function renderStats() {
  const q = `month=${monthStr(current)}` + (statsMember ? `&member=${encodeURIComponent(statsMember)}` : "");
  const s = await api(`/api/summary?${q}`);
  if (hasData(s.by_category)) barChart("chart-category", s.by_category); else destroyChart("chart-category");
  if (hasData(s.by_member)) pieChart("chart-member", s.by_member); else destroyChart("chart-member");
}

// ---------- 設定（分類/成員/付款方式） ----------
function renderSettings() {
  document.querySelectorAll(".setting-group").forEach((g) => {
    const key = g.dataset.key;
    const chips = g.querySelector(".chips");
    if (key === "members") {
      // 成員：頭像 + 名字 + 換照片 + 刪除
      chips.innerHTML = meta.members.map((m, i) => `
        <div class="member-card">
          <label class="avatar-wrap">
            ${m.photo ? `<img class="avatar lg" src="${m.photo}">` : `<span class="avatar lg avatar-ph">${initial(m.name)}</span>`}
            <input type="file" accept="image/*" data-i="${i}" hidden>
          </label>
          <span class="m-name">${m.name}</span>
          <button class="m-del" data-i="${i}">✕</button>
        </div>`).join("");
      chips.querySelectorAll('input[type="file"]').forEach((inp) => {
        inp.onchange = () => uploadPhoto(inp.dataset.i, inp.files[0]);
      });
      chips.querySelectorAll(".m-del").forEach((b) => {
        b.onclick = () => { meta.members.splice(b.dataset.i, 1); saveMeta("members"); };
      });
    } else {
      chips.innerHTML = meta[key].map((v, i) =>
        `<span class="chip">${v}<button data-i="${i}">✕</button></span>`).join("");
      chips.querySelectorAll("button").forEach((b) => {
        b.onclick = () => { meta[key].splice(b.dataset.i, 1); saveMeta(key); };
      });
    }
  });
}

function bindSettings() {
  document.querySelectorAll(".setting-group .add-row button").forEach((btn) => {
    btn.onclick = () => {
      const group = btn.closest(".setting-group");
      const input = group.querySelector("input");
      const val = input.value.trim();
      if (!val) return;
      const key = group.dataset.key;
      meta[key].push(key === "members" ? { name: val, photo: "" } : val);
      input.value = "";
      saveMeta(key);
    };
  });
}

// 讀照片 → 縮成 200px 方形 → 存成 data URL（避免 base64 太大）
function uploadPhoto(index, file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const size = 200;
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const ctx = c.getContext("2d");
      const s = Math.min(img.width, img.height); // 置中裁切成正方形
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      meta.members[index].photo = c.toDataURL("image/jpeg", 0.8);
      saveMeta("members");
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function saveMeta(key) {
  meta = await api("/api/meta", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [key]: meta[key] }),
  });
  fillSelects();
  fillStatsMember();
  renderSettings();
  refresh(); // 改了成員/照片後，清單頭像即時更新
}

init();
