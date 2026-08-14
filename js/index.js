/* ===== 首页逻辑：指数 + 涨跌榜 + 板块 + 搜索 ===== */
(function () {
  "use strict";

  let curMarket = "a"; // a / hk / us
  let curSort = "f3";
  let curOrder = "desc";

  /* ============ 指数行情 ============ */
  async function loadIndices() {
    const grid = document.getElementById("index-grid");
    try {
      const list = await EM.getIndices();
      const names = { "000001": "上证指数", "399001": "深证成指", "399006": "创业板指", "000688": "科创50", "HSI": "恒生指数", "NDX": "纳斯达克100" };
      grid.innerHTML = list
        .map((d) => {
          const c = EM.clsOf(d.pct);
          return `<div class="index-card">
            <div class="idx-name"><span>${d.name}</span><span class="idx-market">${d.code}</span></div>
            <div class="idx-price ${c}">${EM.fmtNum(d.price)}</div>
            <div class="idx-change ${c}">${EM.fmtPct(d.pct)}  ${d.change >= 0 ? "+" : ""}${EM.fmtNum(d.change)}</div>
          </div>`;
        })
        .join("");
      const now = new Date();
      document.getElementById("update-time").textContent =
        "数据更新时间：" + now.toLocaleString("zh-CN", { hour12: false });
    } catch (e) {
      grid.innerHTML = `<div class="state-box">指数行情加载失败：${e.message}（请检查网络或稍后重试）</div>`;
    }
  }

  /* ============ 涨跌榜 ============ */
  async function loadStocks() {
    const tbody = document.getElementById("stock-tbody");
    const label = document.getElementById("tab-market-label");
    label.textContent = curMarket === "a" ? "A股 · 沪深京" : curMarket === "hk" ? "港股 · 主板" : "美股 · 全市场";
    tbody.innerHTML = `<tr><td colspan="10"><div class="state-box"><div class="spin"></div>加载行情中…</div></td></tr>`;
    try {
      const { total, rows } = await EM.getStockList({
        market: curMarket,
        page: 1,
        pageSize: 60,
        sortBy: curSort,
        order: curOrder,
      });
      if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="10"><div class="state-box">暂无数据（可能已休市）</div></td></tr>`;
        return;
      }
      tbody.innerHTML = rows
        .map((d) => {
          const c = EM.clsOf(d.pct);
          const secid = EM.buildSecid(d.market, d.code);
          return `<tr onclick="location.href='stock.html?secid=${secid}&name=${encodeURIComponent(d.name)}'">
            <td><div class="name-cell">${d.name}</div><div class="code-cell">${d.code}</div></td>
            <td class="${c}">${EM.fmtNum(d.price)}</td>
            <td><span class="pct-badge ${c}">${EM.fmtPct(d.pct)}</span></td>
            <td class="${c}">${d.change >= 0 ? "+" : ""}${EM.fmtNum(d.change)}</td>
            <td>${EM.fmtBig(d.amount)}</td>
            <td>${EM.fmtNum(d.turnover)}%</td>
            <td>${EM.fmtNum(d.pe)}</td>
            <td>${EM.fmtNum(d.pb)}</td>
            <td>${EM.fmtBig(d.mktCap)}</td>
            <td class="${EM.clsOf(d.pctYtd)}">${EM.fmtPct(d.pctYtd)}</td>
          </tr>`;
        })
        .join("");
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="10"><div class="state-box">行情加载失败：${e.message}</div></td></tr>`;
    }
  }

  /* ============ 行业板块 ============ */
  async function loadSectors() {
    const tbody = document.getElementById("sector-tbody");
    try {
      const { rows } = await EM.getSectors("industry", 1, 30);
      tbody.innerHTML = rows
        .map((d) => {
          const c = EM.clsOf(d.pct);
          return `<tr>
            <td><div class="name-cell">${d.name}</div><div class="code-cell">${d.code}</div></td>
            <td><span class="pct-badge ${c}">${EM.fmtPct(d.pct)}</span></td>
            <td class="${c}">${d.change >= 0 ? "+" : ""}${EM.fmtNum(d.change)}</td>
            <td>${EM.fmtNum(d.upCount, 0)} / ${EM.fmtNum(d.downCount, 0)}</td>
            <td>${d.leader || "--"}</td>
          </tr>`;
        })
        .join("");
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="5"><div class="state-box">板块加载失败：${e.message}</div></td></tr>`;
    }
  }

  /* ============ 搜索建议 ============ */
  function initSearch() {
    const input = document.getElementById("search-input");
    const box = document.getElementById("search-suggest");
    let timer = null;

    input.addEventListener("input", () => {
      clearTimeout(timer);
      const kw = input.value.trim();
      if (!kw) { box.classList.remove("open"); return; }
      timer = setTimeout(async () => {
        try {
          const list = await EM.searchStock(kw);
          if (!list.length) {
            box.innerHTML = `<div class="suggest-item"><span class="s-name" style="color:var(--text-3)">无匹配结果</span></div>`;
            box.classList.add("open");
            return;
          }
          box.innerHTML = list
            .map((d) => `<div class="suggest-item" data-secid="${d.secid}" data-name="${encodeURIComponent(d.name)}">
              <span class="s-name">${d.name}</span><span class="s-code">${d.code}</span><span class="s-type">${d.type}</span>
            </div>`)
            .join("");
          box.classList.add("open");
          box.querySelectorAll(".suggest-item").forEach((el) => {
            el.addEventListener("click", () => {
              location.href = `stock.html?secid=${el.dataset.secid}&name=${el.dataset.name}`;
            });
          });
        } catch (e) { /* 静默 */ }
      }, 300);
    });

    document.addEventListener("click", (e) => {
      if (!box.contains(e.target) && e.target !== input) box.classList.remove("open");
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const first = box.querySelector(".suggest-item");
        if (first) location.href = `stock.html?secid=${first.dataset.secid}&name=${first.dataset.name}`;
      }
    });
  }

  /* ============ 事件绑定 ============ */
  function bindEvents() {
    document.querySelectorAll(".market-tabs a").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        document.querySelectorAll(".market-tabs a").forEach((x) => x.classList.remove("active"));
        a.classList.add("active");
        curMarket = a.dataset.market;
        loadStocks();
      });
    });

    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach((x) => x.classList.remove("active"));
        btn.classList.add("active");
        curSort = btn.dataset.sort;
        curOrder = btn.dataset.order || "desc";
        loadStocks();
      });
    });
  }

  /* ============ 初始化 ============ */
  loadIndices();
  loadStocks();
  loadSectors();
  initSearch();
  bindEvents();
})();
