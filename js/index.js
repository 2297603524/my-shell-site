/* ===== 首页逻辑：自选股 + A股财务排行 + 搜索 + 指标释义 ===== */
(function () {
  "use strict";

  let curSort = "PARENT_NETPROFIT";
  let curPage = 1;
  const PAGE_SIZE = 50;

  /* ============ 指标释义问号 ============ */
  function initHints() {
    const tip = document.createElement("div");
    tip.className = "tip-float";
    document.body.appendChild(tip);
    let hideTimer = null;

    document.addEventListener("mouseover", (e) => {
      const h = e.target.closest(".hint");
      if (!h) return;
      const key = h.dataset.key;
      const text = EM.METRIC_TIPS[key];
      if (!text) return;
      tip.textContent = text;
      tip.classList.add("show");
      const rect = h.getBoundingClientRect();
      let left = rect.left + rect.width / 2;
      let top = rect.top - 10;
      const tw = tip.offsetWidth;
      const th = tip.offsetHeight;
      left = Math.min(Math.max(8, left - tw / 2), window.innerWidth - tw - 8);
      if (top - th < 0) top = rect.bottom + 10;
      else top = top - th;
      tip.style.left = left + "px";
      tip.style.top = top + "px";
      clearTimeout(hideTimer);
    });
    document.addEventListener("mouseout", (e) => {
      if (e.target.closest(".hint")) {
        hideTimer = setTimeout(() => tip.classList.remove("show"), 80);
      }
    });
  }

  /* ============ 自选股 ============ */
  async function loadWatchlist() {
    const box = document.getElementById("watch-list");
    const list = EM.getWatchlist();
    if (!list.length) {
      box.innerHTML = `<div class="watch-empty">暂无自选股票 — 在个股详情页点击 ☆ 按钮即可加入自选</div>`;
      return;
    }
    box.innerHTML = `<div class="state-box"><div class="spin"></div>加载自选数据中…</div>`;
    try {
      const items = await Promise.all(
        list.map(async (s) => {
          try {
            const rows = await EM.getMainIndicators(s.code, s.market || "SH", 1);
            const r = rows[0] || {};
            return { ...s, reportDate: r.reportDate, income: r.income, netProfit: r.netProfit, roe: r.roe };
          } catch (e) {
            return { ...s, error: true };
          }
        })
      );
      box.innerHTML = items
        .map(
          (s) => `<div class="watch-item" onclick="location.href='stock.html?code=${s.code}&name=${encodeURIComponent(s.name)}'">
            <span class="w-name">${s.name}</span>
            <span class="w-code">${s.code}</span>
            <span class="w-nums">
              <span>${s.error ? "数据加载失败" : EM.fmtBig(s.netProfit)}</span>
              <span>${s.error ? "" : EM.fmtNum(s.roe) + "%"}</span>
            </span>
            <span class="w-del" data-code="${s.code}" title="移除自选">×</span>
          </div>`
        )
        .join("");
      box.querySelectorAll(".w-del").forEach((el) => {
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          EM.removeWatch(el.dataset.code);
          loadWatchlist();
        });
      });
    } catch (e) {
      box.innerHTML = `<div class="state-box">自选数据加载失败：${e.message}</div>`;
    }
  }

  /* ============ 财务排行列表 ============ */
  async function loadList() {
    const tbody = document.getElementById("fin-tbody");
    tbody.innerHTML = `<tr><td colspan="10"><div class="state-box"><div class="spin"></div>加载财务数据中…</div></td></tr>`;
    try {
      const { total, rows } = await EM.getFinanceList({
        page: curPage,
        pageSize: PAGE_SIZE,
        sortColumn: curSort,
      });
      if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="10"><div class="state-box">暂无数据</div></td></tr>`;
        return;
      }
      const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      document.getElementById("page-info").textContent = `第 ${curPage} / ${totalPages} 页 · 共 ${total} 家`;
      document.getElementById("prev-btn").disabled = curPage <= 1;
      document.getElementById("next-btn").disabled = curPage >= totalPages;

      tbody.innerHTML = rows
        .map((d) => {
          const market = d.code.startsWith("6") ? 1 : 0;
          return `<tr onclick="location.href='stock.html?code=${d.code}&name=${encodeURIComponent(d.name)}'">
            <td><div class="name-cell">${d.name}</div><div class="code-cell">${d.code}</div></td>
            <td>${d.reportDate}</td>
            <td>${EM.fmtBig(d.income)}</td>
            <td class="${EM.clsOf(d.incomeYoy)}">${EM.fmtPct(d.incomeYoy)}</td>
            <td>${EM.fmtBig(d.netProfit)}</td>
            <td class="${EM.clsOf(d.profitYoy)}">${EM.fmtPct(d.profitYoy)}</td>
            <td>${EM.fmtNum(d.roe)}%</td>
            <td>${EM.fmtNum(d.grossMargin)}%</td>
            <td>${EM.fmtNum(d.eps)}</td>
            <td>${d.industry || "--"}</td>
          </tr>`;
        })
        .join("");
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="10"><div class="state-box">财务数据加载失败：${e.message}（请检查网络后重试）</div></td></tr>`;
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
            .map((d) => `<div class="suggest-item" data-code="${d.code}" data-name="${encodeURIComponent(d.name)}">
              <span class="s-name">${d.name}</span><span class="s-code">${d.code}</span><span class="s-type">${d.type}</span>
            </div>`)
            .join("");
          box.classList.add("open");
          box.querySelectorAll(".suggest-item").forEach((el) => {
            el.addEventListener("click", () => {
              location.href = `stock.html?code=${el.dataset.code}&name=${el.dataset.name}`;
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
        if (first) location.href = `stock.html?code=${first.dataset.code}&name=${first.dataset.name}`;
      }
    });
  }

  /* ============ 事件绑定 ============ */
  function bindEvents() {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach((x) => x.classList.remove("active"));
        btn.classList.add("active");
        curSort = btn.dataset.sort;
        curPage = 1;
        loadList();
      });
    });
    document.getElementById("prev-btn").addEventListener("click", () => {
      if (curPage > 1) { curPage--; loadList(); }
    });
    document.getElementById("next-btn").addEventListener("click", () => {
      curPage++;
      loadList();
    });
  }

  /* ============ 初始化 ============ */
  loadWatchlist();
  loadList();
  initSearch();
  bindEvents();
  initHints();
  const now = new Date();
  document.getElementById("update-time").textContent = "数据更新时间：" + now.toLocaleString("zh-CN", { hour12: false });
})();
