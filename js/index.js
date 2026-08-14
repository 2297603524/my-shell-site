/* ===== 首页逻辑：自选股 + 行业分类 + 盈利预测列表 + 快速选股 ===== */
(function () {
  "use strict";

  let allStocks = [];        // 全量预测数据
  let curIndustry = "全部";
  let filtered = [];         // 当前行业股票
  let sortKey = "orgNum";    // 默认按机构数排序

  /* ============ 指标释义问号 ============ */
  function initHints() {
    const tip = document.createElement("div");
    tip.className = "tip-float";
    document.body.appendChild(tip);
    let hideTimer = null;

    document.addEventListener("mouseover", (e) => {
      const h = e.target.closest(".hint");
      if (!h) return;
      const text = EM.METRIC_TIPS[h.dataset.key];
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

  /* ============ 行业分类 + 股票列表 ============ */
  async function loadIndustries() {
    const nav = document.getElementById("industry-nav");
    const tbody = document.getElementById("fin-tbody");
    try {
      allStocks = await EM.getAllForecast();
      if (!allStocks.length) throw new Error("无数据");
      // 聚合行业
      const indCount = {};
      allStocks.forEach((s) => {
        const ind = s.industry || "未分类";
        indCount[ind] = (indCount[ind] || 0) + 1;
      });
      const industries = Object.keys(indCount).sort((a, b) => indCount[b] - indCount[a]);
      nav.innerHTML =
        `<button class="chip active" data-ind="全部">全部<span class="ind-count">${allStocks.length}</span></button>` +
        industries
          .map((i) => `<button class="chip" data-ind="${i}">${i}<span class="ind-count">${indCount[i]}</span></button>`)
          .join("");
      nav.querySelectorAll(".chip").forEach((btn) => {
        btn.addEventListener("click", () => {
          nav.querySelectorAll(".chip").forEach((x) => x.classList.remove("active"));
          btn.classList.add("active");
          curIndustry = btn.dataset.ind;
          applyFilter();
        });
      });
      applyFilter();
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="state-box">数据加载失败：${e.message}</div></td></tr>`;
    }
  }

  function applyFilter() {
    filtered = curIndustry === "全部"
      ? allStocks.slice()
      : allStocks.filter((s) => (s.industry || "未分类") === curIndustry);
    sortRows();
    renderRows();
  }

  function sortRows() {
    const map = { orgNum: "orgNum", epsNext: "epsNext", growth: "growth" };
    const key = map[sortKey] || "orgNum";
    filtered.sort((a, b) => {
      const va = a[key] === null || a[key] === undefined ? -Infinity : a[key];
      const vb = b[key] === null || b[key] === undefined ? -Infinity : b[key];
      return vb - va;
    });
  }

  function renderRows() {
    const tbody = document.getElementById("fin-tbody");
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="state-box">该行业暂无机构预测覆盖的股票</div></td></tr>`;
      return;
    }
    tbody.innerHTML = filtered
      .map((d) => {
        const growth = EM.forecastGrowth(d);
        const aim = d.aimPriceMax ? `${EM.fmtNum(d.aimPriceMin)} ~ ${EM.fmtNum(d.aimPriceMax)}` : "--";
        const rating = d.orgNum ? `买入${d.buyNum || 0} · 增持${d.addNum || 0} · ${d.orgNum}家` : "--";
        return `<tr onclick="location.href='stock.html?code=${d.code}&name=${encodeURIComponent(d.name)}'">
          <td><div class="name-cell">${d.name}</div><div class="code-cell">${d.code}</div></td>
          <td>${d.industry || "--"}</td>
          <td>${rating}</td>
          <td>${EM.fmtNum(d.epsNext)}</td>
          <td>${EM.fmtNum(d.epsNext2)}</td>
          <td class="${EM.clsOf(growth)}">${growth !== null ? EM.fmtPct(growth) : "--"}</td>
          <td>${aim}</td>
        </tr>`;
      })
      .join("");
  }

  /* ============ 快速选股（本地过滤 + 键盘导航）============ */
  function initQuickPick() {
    const input = document.getElementById("search-input");
    const box = document.getElementById("search-suggest");
    let timer = null;
    let curIdx = -1;

    function render(list, kw) {
      if (!list.length) {
        box.innerHTML = `<div class="suggest-item"><span class="s-name" style="color:var(--text-3)">无匹配结果</span></div>`;
        curIdx = -1;
        return;
      }
      box.innerHTML = list
        .map(
          (d, i) => `<div class="suggest-item ${i === curIdx ? "active" : ""}" data-code="${d.code}" data-name="${encodeURIComponent(d.name)}">
            <span class="s-name">${d.name}</span><span class="s-code">${d.code}</span>
            <span class="s-type">${d.industry || "股票"}</span>
          </div>`
        )
        .join("");
    }

    function jump(el) {
      if (el) location.href = `stock.html?code=${el.dataset.code}&name=${el.dataset.name}`;
    }

    input.addEventListener("input", () => {
      clearTimeout(timer);
      curIdx = -1;
      const kw = input.value.trim();
      if (!kw) { box.classList.remove("open"); return; }
      timer = setTimeout(() => {
        // 优先本地全量数据过滤（快）
        let local = [];
        if (allStocks.length) {
          const k = kw.toLowerCase();
          local = allStocks.filter((s) => s.code.includes(k) || s.name.toLowerCase().includes(k)).slice(0, 8);
        }
        if (local.length) {
          render(local);
          box.classList.add("open");
        } else {
          // 本地无结果 → 走搜索接口（支持拼音）
          EM.searchStock(kw).then((list) => {
            render(list, kw);
            box.classList.add("open");
          }).catch(() => {});
        }
      }, 200);
    });

    input.addEventListener("keydown", (e) => {
      const items = box.querySelectorAll(".suggest-item");
      if (e.key === "ArrowDown") {
        e.preventDefault();
        curIdx = Math.min(curIdx + 1, items.length - 1);
        render(items.length ? [...allStocks].slice(0, items.length) : [], "");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        curIdx = Math.max(curIdx - 1, 0);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const active = box.querySelector(".suggest-item.active") || box.querySelector(".suggest-item");
        jump(active);
      }
      if (curIdx >= 0 && items.length) {
        items.forEach((el, i) => el.classList.toggle("active", i === curIdx));
      }
    });

    document.addEventListener("click", (e) => {
      if (!box.contains(e.target) && e.target !== input) box.classList.remove("open");
    });
    box.addEventListener("click", (e) => {
      const item = e.target.closest(".suggest-item");
      if (item) jump(item);
    });
  }

  /* ============ 初始化 ============ */
  loadWatchlist();
  loadIndustries();
  initQuickPick();
  initHints();
  const now = new Date();
  document.getElementById("update-time").textContent = "数据更新时间：" + now.toLocaleString("zh-CN", { hour12: false });
})();
