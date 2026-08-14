/* ===== 首页逻辑：A股财务排行 + 搜索 ===== */
(function () {
  "use strict";

  let curSort = "PARENT_NETPROFIT";
  let curPage = 1;
  const PAGE_SIZE = 50;

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
          const secid = EM.buildSecid(market, d.code);
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
  loadList();
  initSearch();
  bindEvents();
  const now = new Date();
  document.getElementById("update-time").textContent = "数据更新时间：" + now.toLocaleString("zh-CN", { hour12: false });
})();
