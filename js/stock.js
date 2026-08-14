/* ===== 个股基本面逻辑：公司概况 / 财务指标 / 三大报表 / 主营构成 ===== */
(function () {
  "use strict";

  const params = new URLSearchParams(location.search);
  const CODE = params.get("code") || "600519";
  const NAME = params.get("name") || "";
  const market = CODE.startsWith("6") || CODE.startsWith("9") ? "SH" : "SZ";

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

  /* ============ 自选按钮 ============ */
  function initWatchBtn() {
    const btn = document.getElementById("watch-btn");
    const star = btn.querySelector(".star");
    const txt = btn.querySelector(".txt");
    const refresh = () => {
      const w = EM.isWatched(CODE);
      btn.classList.toggle("watched", w);
      star.textContent = w ? "★" : "☆";
      txt.textContent = w ? "已自选" : "加入自选";
    };
    refresh();
    btn.addEventListener("click", () => {
      if (EM.isWatched(CODE)) EM.removeWatch(CODE);
      else EM.addWatch(CODE, NAME || CODE, market);
      refresh();
    });
  }

  /* ============ 公司概况 ============ */
  async function loadProfile() {
    const box = document.getElementById("profile-card");
    try {
      const p = await EM.getCompanyProfile(CODE, market);
      document.title = `${p.name} ${p.code} · 股析`;
      box.innerHTML = `<div class="card-title">公司概况<button class="watch-btn" id="watch-btn"><span class="star">☆</span><span class="txt">加入自选</span></button></div>
        <div class="profile-grid">
          <div class="profile-item"><div class="p-label">公司全称</div><div class="p-value">${p.fullName || "--"}</div></div>
          <div class="profile-item"><div class="p-label">英文名称</div><div class="p-value">${p.enName || "--"}</div></div>
          <div class="profile-item"><div class="p-label">曾用名</div><div class="p-value">${p.formerName || "--"}</div></div>
          <div class="profile-item"><div class="p-label">证券类型</div><div class="p-value">${p.securityType || "--"}</div></div>
          <div class="profile-item"><div class="p-label">上市交易所</div><div class="p-value">${p.tradeMarket || "--"}</div></div>
          <div class="profile-item"><div class="p-label">行业（申万）</div><div class="p-value">${p.industryEM || "--"}</div></div>
          <div class="profile-item"><div class="p-label">证监会行业</div><div class="p-value">${p.industryCSRC || "--"}</div></div>
          <div class="profile-item"><div class="p-label">董事长</div><div class="p-value">${p.chairman || "--"}</div></div>
          <div class="profile-item"><div class="p-label">总经理</div><div class="p-value">${p.president || "--"}</div></div>
          <div class="profile-item"><div class="p-label">董秘</div><div class="p-value">${p.secretary || "--"}</div></div>
          <div class="profile-item"><div class="p-label">法定代表人</div><div class="p-value">${p.legalPerson || "--"}</div></div>
          <div class="profile-item"><div class="p-label">独立董事</div><div class="p-value">${p.independentDirectors || "--"}</div></div>
          <div class="profile-item"><div class="p-label">电话</div><div class="p-value">${p.tel || "--"}</div></div>
          <div class="profile-item"><div class="p-label">邮箱</div><div class="p-value">${p.email || "--"}</div></div>
          <div class="profile-item"><div class="p-label">网站</div><div class="p-value">${p.website ? `<a href="${p.website}" target="_blank" rel="noopener">${p.website}</a>` : "--"}</div></div>
          <div class="profile-item"><div class="p-label">注册地址</div><div class="p-value">${p.regAddress || "--"}</div></div>
          <div class="profile-item"><div class="p-label">办公地址</div><div class="p-value">${p.address || "--"}</div></div>
          <div class="profile-item"><div class="p-label">注册资本</div><div class="p-value">${p.regCapital || "--"}</div></div>
          <div class="profile-item"><div class="p-label">上市日期</div><div class="p-value">${p.listDate || "--"}</div></div>
        </div>`;
      initWatchBtn();
    } catch (e) {
      box.innerHTML = `<div class="card-title">公司概况</div><div class="state-box">公司概况加载失败：${e.message}</div>`;
    }
  }

  /* ============ 财务主要指标 ============ */
  async function loadIndicators() {
    const tbody = document.getElementById("ind-tbody");
    try {
      const rows = await EM.getMainIndicators(CODE, market, 8);
      if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="12"><div class="state-box">暂无财务数据（可能未披露）</div></td></tr>`;
        return;
      }
      tbody.innerHTML = rows
        .map((d) => `<tr>
          <td><div class="name-cell">${d.reportDate}</div></td>
          <td>${EM.fmtBig(d.income)}</td>
          <td class="${EM.clsOf(d.incomeYoy)}">${EM.fmtPct(d.incomeYoy)}</td>
          <td>${EM.fmtBig(d.netProfit)}</td>
          <td class="${EM.clsOf(d.netProfitYoy)}">${EM.fmtPct(d.netProfitYoy)}</td>
          <td>${EM.fmtNum(d.roe)}%</td>
          <td>${EM.fmtNum(d.grossMargin)}%</td>
          <td>${EM.fmtNum(d.netMargin)}%</td>
          <td>${EM.fmtNum(d.debtRatio)}%</td>
          <td>${EM.fmtNum(d.eps)}</td>
          <td>${EM.fmtNum(d.bps)}</td>
          <td>${EM.fmtNum(d.ocfPerShare)}</td>
        </tr>`)
        .join("");
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="12"><div class="state-box">财务指标加载失败：${e.message}</div></td></tr>`;
    }
  }

  /* ============ 三大报表摘要 ============ */
  async function loadStatements() {
    const bsGrid = document.getElementById("bs-grid");
    const isGrid = document.getElementById("is-grid");
    const cfGrid = document.getElementById("cf-grid");

    try {
      const bs = await EM.getBalanceSheet(CODE, market, 1);
      if (bs.length) {
        const b = bs[0];
        bsGrid.innerHTML = `<div class="metric-grid-title">资产负债表 · ${b.reportDate}</div>
          ${metric("总资产", b.totalAssets, "totalAssets")}
          ${metric("货币资金", b.monetaryFunds, "monetaryFunds")}
          ${metric("应收账款", b.accountsReceivable, "accountsReceivable")}
          ${metric("存货", b.inventory, "inventory")}
          ${metric("固定资产", b.fixedAssets, "fixedAssets")}
          ${metric("总负债", b.totalLiabilities, "totalLiabilities")}
          ${metric("应付账款", b.accountsPayable, "accountsPayable")}
          ${metric("短期借款", b.shortLoan, "shortLoan")}
          ${metric("股东权益", b.totalEquity, "totalEquity")}`;
      } else {
        bsGrid.innerHTML = `<div class="state-box">暂无资产负债表数据</div>`;
      }
    } catch (e) {
      bsGrid.innerHTML = `<div class="state-box">资产负债表加载失败：${e.message}</div>`;
    }

    try {
      const is = await EM.getIncomeStatement(CODE, market, 1);
      if (is.length) {
        const s = is[0];
        isGrid.innerHTML = `<div class="metric-grid-title">利润表 · ${s.reportDate}</div>
          ${metric("营业收入", s.income, "income")}
          ${metric("营业成本", s.cost, "operateCost")}
          ${metric("营业利润", s.operateProfit, "operateProfit")}
          ${metric("利润总额", s.totalProfit, "totalProfit")}
          ${metric("归母净利润", s.netProfit, "netProfit")}
          ${metric("扣非净利润", s.deductNetProfit, "deductNetProfit")}`;
      } else {
        isGrid.innerHTML = `<div class="state-box">暂无利润表数据</div>`;
      }
    } catch (e) {
      isGrid.innerHTML = `<div class="state-box">利润表加载失败：${e.message}</div>`;
    }

    try {
      const cf = await EM.getCashflow(CODE, market, 1);
      if (cf.length) {
        const c = cf[0];
        cfGrid.innerHTML = `<div class="metric-grid-title">现金流量表 · ${c.reportDate}</div>
          ${metric("经营活动现金流", c.operate, "cashOperate")}
          ${metric("投资活动现金流", c.invest, "cashInvest")}
          ${metric("筹资活动现金流", c.finance, "cashFinance")}
          ${metric("支付职工现金", c.payStaff, "payStaff")}`;
      } else {
        cfGrid.innerHTML = `<div class="state-box">暂无现金流量表数据</div>`;
      }
    } catch (e) {
      cfGrid.innerHTML = `<div class="state-box">现金流量表加载失败：${e.message}</div>`;
    }
  }

  function metric(label, v, key) {
    const c = EM.clsOf(v);
    const hint = key ? `<i class="hint" data-key="${key}">?</i>` : "";
    return `<div class="metric-item"><div class="m-label">${label}${hint}</div><div class="m-value ${c}">${EM.fmtBig(v)}</div></div>`;
  }

  /* ============ 主营构成 ============ */
  async function loadMainOp() {
    const box = document.getElementById("mainop-box");
    try {
      const { reportDate, groups } = await EM.getMainOperation(CODE, market, 30);
      if (!Object.keys(groups).length) {
        box.innerHTML = `<div class="state-box">暂无主营构成数据</div>`;
        return;
      }
      let html = `<div class="update-time" style="text-align:left;margin-bottom:8px;">报告期：${reportDate}</div>`;
      for (const [type, items] of Object.entries(groups)) {
        html += `<div class="metric-grid-title">${type}</div>
          <div class="table-wrap" style="margin-bottom:14px;">
            <table class="stock-table">
              <thead><tr><th>项目</th><th>收入<i class="hint" data-key="mainopIncome">?</i></th><th>收入占比<i class="hint" data-key="mainopRatio">?</i></th><th>成本<i class="hint" data-key="mainopCost">?</i></th><th>毛利率<i class="hint" data-key="mainopMargin">?</i></th></tr></thead>
              <tbody>
                ${items.map((d) => `<tr>
                  <td><div class="name-cell">${d.item}</div></td>
                  <td>${EM.fmtBig(d.income)}</td>
                  <td>${EM.fmtNum(d.incomeRatio)}%</td>
                  <td>${EM.fmtBig(d.cost)}</td>
                  <td>${EM.fmtNum(d.grossMargin)}%</td>
                </tr>`).join("")}
              </tbody>
            </table>
          </div>`;
      }
      box.innerHTML = html;
    } catch (e) {
      box.innerHTML = `<div class="state-box">主营构成加载失败：${e.message}</div>`;
    }
  }

  /* ============ 搜索（同首页）============ */
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
          box.innerHTML = list.length
            ? list.map((d) => `<div class="suggest-item" data-code="${d.code}" data-name="${encodeURIComponent(d.name)}">
                <span class="s-name">${d.name}</span><span class="s-code">${d.code}</span><span class="s-type">${d.type}</span>
              </div>`).join("")
            : `<div class="suggest-item"><span class="s-name" style="color:var(--text-3)">无匹配结果</span></div>`;
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
  }

  /* ============ 初始化 ============ */
  loadProfile();
  loadIndicators();
  loadStatements();
  loadMainOp();
  initSearch();
  initHints();
})();
