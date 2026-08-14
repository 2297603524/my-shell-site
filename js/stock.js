/* ===== 个股详情页逻辑：行情 / 分时 / K线 / 资金流 / 财务 ===== */
(function () {
  "use strict";

  const params = new URLSearchParams(location.search);
  const SECID = params.get("secid") || "1.600519";
  const NAME = params.get("name") || "";

  let chart = null;          // 主图（分时/K线）
  let flowChart = null;      // 资金流柱状图
  let curKind = "trend";     // trend | kline
  let curKlt = 101;
  let curFqt = 1;
  let quote = null;

  const UP = "#f04438";
  const DOWN = "#12b76a";
  const GRID_LINE = "rgba(45,54,72,0.35)";
  const TEXT_2 = "#9aa7b8";

  /* ============ 头部信息 ============ */
  async function loadQuote() {
    const head = document.getElementById("stock-head");
    const grid = document.getElementById("quote-grid");
    try {
      quote = await EM.getStockQuote(SECID);
      document.title = `${quote.name || NAME} ${quote.code} · 股析`;
      const c = EM.clsOf(quote.pct);
      head.innerHTML = `<div class="stock-name-block">
          <h1>${quote.name || NAME}<span class="code-line">${quote.code} · 实时</span></h1>
        </div>
        <div class="price-block">
          <div class="price ${c}">${EM.fmtNum(quote.price)}</div>
          <div class="change-line ${c}">${EM.fmtPct(quote.pct)}  ${quote.change >= 0 ? "+" : ""}${EM.fmtNum(quote.change)}</div>
        </div>`;

      const items = [
        ["今开", EM.fmtNum(quote.open)],
        ["昨收", EM.fmtNum(quote.preClose)],
        ["最高", EM.fmtNum(quote.high)],
        ["最低", EM.fmtNum(quote.low)],
        ["成交量", EM.fmtBig(quote.volume)],
        ["成交额", EM.fmtBig(quote.amount)],
        ["换手率", EM.fmtNum(quote.turnover) + "%"],
        ["市盈率(TTM)", EM.fmtNum(quote.pe)],
        ["市净率", EM.fmtNum(quote.pb)],
        ["总市值", EM.fmtBig(quote.mktCap)],
        ["流通市值", EM.fmtBig(quote.floatCap)],
        ["年初至今", EM.fmtPct(quote.pctYtd)],
      ];
      grid.innerHTML = items
        .map(([k, v]) => `<div class="quote-item"><div class="q-label">${k}</div><div class="q-value">${v}</div></div>`)
        .join("");
    } catch (e) {
      head.innerHTML = `<div class="state-box">个股数据加载失败：${e.message}</div>`;
    }
  }

  /* ============ ECharts 初始化 ============ */
  function initCharts() {
    if (!window.echarts) {
      document.getElementById("main-chart").innerHTML =
        `<div class="state-box">图表库加载失败，请检查网络</div>`;
      return;
    }
    chart = echarts.init(document.getElementById("main-chart"));
    flowChart = echarts.init(document.getElementById("flow-chart"));
    window.addEventListener("resize", () => {
      chart && chart.resize();
      flowChart && flowChart.resize();
    });
  }

  /* ============ 分时图 ============ */
  async function drawTrend() {
    chart.showLoading({ text: "加载分时数据…", textColor: TEXT_2, maskColor: "rgba(13,17,23,0.6)" });
    try {
      const { preClose, trends } = await EM.getTrend(SECID);
      const times = trends.map((t) => t.time.slice(11));
      const prices = trends.map((t) => t.price);
      const avgs = trends.map((t) => t.avg);
      const vols = trends.map((t) => t.volume);

      const base = preClose || quote?.preClose || prices[0];
      const min = Math.min(...prices, base) * 0.997;
      const max = Math.max(...prices, base) * 1.003;

      const option = {
        backgroundColor: "transparent",
        animation: false,
        tooltip: {
          trigger: "axis",
          backgroundColor: "#1c2333",
          borderColor: "#2d3648",
          textStyle: { color: "#e6edf3" },
          axisPointer: { lineStyle: { color: "#6e7d92" } },
        },
        axisPointer: { link: [{ xAxisIndex: "all" }] },
        grid: [
          { left: 55, right: 20, top: 15, height: "62%" },
          { left: 55, right: 20, top: "78%", height: "14%" },
        ],
        xAxis: [
          { type: "category", data: times, boundaryGap: false, axisLine: { lineStyle: { color: GRID_LINE } }, axisLabel: { color: TEXT_2, fontSize: 11 } },
          { type: "category", gridIndex: 1, data: times, boundaryGap: false, axisLine: { lineStyle: { color: GRID_LINE } }, axisLabel: { show: false }, splitLine: { show: false } },
        ],
        yAxis: [
          {
            type: "value", min: min, max: max, scale: true, splitNumber: 4,
            axisLabel: { color: TEXT_2, fontSize: 11, formatter: (v) => v.toFixed(2) },
            splitLine: { lineStyle: { color: GRID_LINE } },
          },
          {
            type: "value", gridIndex: 1, splitNumber: 2,
            axisLabel: { color: TEXT_2, fontSize: 11, formatter: (v) => (v >= 10000 ? (v / 10000).toFixed(0) + "万" : v) },
            splitLine: { show: false },
          },
        ],
        dataZoom: [{ type: "inside", xAxisIndex: [0, 1], start: 0, end: 100 }],
        series: [
          {
            name: "价格", type: "line", data: prices, showSymbol: false, lineStyle: { width: 1.4 },
            markLine: {
              silent: true, symbol: "none",
              lineStyle: { color: "#6e7d92", type: "dashed", width: 0.8 },
              label: { color: TEXT_2, fontSize: 11, formatter: "昨收 " + base.toFixed(2) },
              data: [{ yAxis: base }],
            },
            areaStyle: { color: "rgba(59,130,246,0.08)" },
          },
          { name: "均价", type: "line", data: avgs, showSymbol: false, lineStyle: { width: 1, color: "#eab308", type: "dashed" } },
          {
            name: "成交量", type: "bar", xAxisIndex: 1, yAxisIndex: 1, data: vols,
            itemStyle: { color: (p) => (prices[p.dataIndex] >= base ? UP : DOWN) },
          },
        ],
      };
      chart.hideLoading();
      chart.setOption(option, true);
    } catch (e) {
      chart.hideLoading();
      chart.clear();
      document.getElementById("main-chart").innerHTML = `<div class="state-box">分时数据加载失败：${e.message}</div>`;
    }
  }

  /* ============ K线图 ============ */
  async function drawKline() {
    chart.showLoading({ text: "加载K线数据…", textColor: TEXT_2, maskColor: "rgba(13,17,23,0.6)" });
    try {
      const { klines } = await EM.getKline(SECID, curKlt, curFqt, 320);
      if (!klines.length) throw new Error("无K线数据");
      const dates = klines.map((k) => k.date);
      const ohlc = klines.map((k) => [k.open, k.close, k.low, k.high]);
      const vols = klines.map((k) => k.volume);
      const ma5 = calcMA(klines, 5);
      const ma10 = calcMA(klines, 10);
      const ma20 = calcMA(klines, 20);
      const ma60 = calcMA(klines, 60);

      const option = {
        backgroundColor: "transparent",
        animation: false,
        tooltip: {
          trigger: "axis",
          backgroundColor: "#1c2333",
          borderColor: "#2d3648",
          textStyle: { color: "#e6edf3" },
          axisPointer: { type: "cross", lineStyle: { color: "#6e7d92" }, crossStyle: { color: "#6e7d92" } },
        },
        axisPointer: { link: [{ xAxisIndex: "all" }] },
        grid: [
          { left: 55, right: 20, top: 15, height: "58%" },
          { left: 55, right: 20, top: "79%", height: "14%" },
        ],
        xAxis: [
          { type: "category", data: dates, boundaryGap: true, axisLine: { lineStyle: { color: GRID_LINE } }, axisLabel: { color: TEXT_2, fontSize: 11 } },
          { type: "category", gridIndex: 1, data: dates, boundaryGap: true, axisLine: { lineStyle: { color: GRID_LINE } }, axisLabel: { show: false }, splitLine: { show: false } },
        ],
        yAxis: [
          {
            type: "value", scale: true, splitNumber: 4,
            axisLabel: { color: TEXT_2, fontSize: 11, formatter: (v) => v.toFixed(2) },
            splitLine: { lineStyle: { color: GRID_LINE } },
          },
          {
            type: "value", gridIndex: 1, splitNumber: 2,
            axisLabel: { color: TEXT_2, fontSize: 11, formatter: (v) => (v >= 10000 ? (v / 10000).toFixed(0) + "万" : v) },
            splitLine: { show: false },
          },
        ],
        dataZoom: [
          { type: "inside", xAxisIndex: [0, 1], start: 55, end: 100 },
          { type: "slider", xAxisIndex: [0, 1], start: 55, end: 100, height: 16, bottom: 4, borderColor: GRID_LINE, textStyle: { color: TEXT_2, fontSize: 10 }, backgroundColor: "rgba(13,17,23,0.4)" },
        ],
        series: [
          {
            name: "K线", type: "candlestick", data: ohlc,
            itemStyle: {
              color: UP, color0: DOWN, borderColor: UP, borderColor0: DOWN,
            },
          },
          { name: "MA5", type: "line", data: ma5, smooth: true, showSymbol: false, lineStyle: { width: 1, color: "#eab308" } },
          { name: "MA10", type: "line", data: ma10, smooth: true, showSymbol: false, lineStyle: { width: 1, color: "#60a5fa" } },
          { name: "MA20", type: "line", data: ma20, smooth: true, showSymbol: false, lineStyle: { width: 1, color: "#c084fc" } },
          { name: "MA60", type: "line", data: ma60, smooth: true, showSymbol: false, lineStyle: { width: 1, color: "#f472b6" } },
          {
            name: "成交量", type: "bar", xAxisIndex: 1, yAxisIndex: 1, data: vols,
            itemStyle: { color: (p) => (ohlc[p.dataIndex][1] >= ohlc[p.dataIndex][0] ? UP : DOWN) },
          },
        ],
      };
      chart.hideLoading();
      chart.setOption(option, true);
    } catch (e) {
      chart.hideLoading();
      chart.clear();
      document.getElementById("main-chart").innerHTML = `<div class="state-box">K线数据加载失败：${e.message}</div>`;
    }
  }

  function calcMA(klines, n) {
    const out = [];
    let sum = 0;
    for (let i = 0; i < klines.length; i++) {
      sum += klines[i].close;
      if (i >= n) sum -= klines[i - n].close;
      out.push(i >= n - 1 ? +(sum / n).toFixed(2) : null);
    }
    return out;
  }

  /* ============ 资金流向 ============ */
  async function drawFlow() {
    const metrics = document.getElementById("flow-metrics");
    try {
      const { klines } = await EM.getFundFlow(SECID, 60);
      if (!klines.length) throw new Error("无资金流数据");
      const last = klines[klines.length - 1];
      const items = [
        ["今日主力净流入", last.main, last.mainPct],
        ["超大单", last.super],
        ["大单", last.big],
        ["中单", last.mid],
        ["小单", last.small],
      ];
      metrics.innerHTML = items
        .map(([k, v, sub]) => {
          const c = EM.clsOf(v);
          return `<div class="metric-item">
            <div class="m-label">${k}</div>
            <div class="m-value ${c}">${v >= 0 ? "+" : ""}${EM.fmtBig(v)}</div>
            ${sub !== undefined ? `<div class="m-sub ${c}">占比 ${EM.fmtPct(sub)}</div>` : ""}
          </div>`;
        })
        .join("");

      const dates = klines.map((k) => k.date);
      const main = klines.map((k) => k.main);
      const big = klines.map((k) => k.big);
      const mid = klines.map((k) => k.mid);
      const small = klines.map((k) => k.small);
      const superBig = klines.map((k) => k.super);

      flowChart.setOption({
        backgroundColor: "transparent",
        animation: false,
        tooltip: {
          trigger: "axis",
          backgroundColor: "#1c2333",
          borderColor: "#2d3648",
          textStyle: { color: "#e6edf3" },
          axisPointer: { type: "cross", lineStyle: { color: "#6e7d92" } },
        },
        grid: { left: 55, right: 20, top: 20, bottom: 30 },
        xAxis: { type: "category", data: dates, axisLine: { lineStyle: { color: GRID_LINE } }, axisLabel: { color: TEXT_2, fontSize: 11 } },
        yAxis: {
          type: "value",
          axisLabel: { color: TEXT_2, fontSize: 11, formatter: (v) => EM.fmtBig(v) },
          splitLine: { lineStyle: { color: GRID_LINE } },
        },
        legend: { textStyle: { color: TEXT_2, fontSize: 11 }, top: 0 },
        series: [
          { name: "主力", type: "bar", data: main, stack: "f", itemStyle: { color: (p) => (main[p.dataIndex] >= 0 ? UP : DOWN) }, barMaxWidth: 14 },
          { name: "超大单", type: "bar", data: superBig, stack: "f", itemStyle: { color: "rgba(240,68,56,0.45)" }, barMaxWidth: 14 },
          { name: "大单", type: "bar", data: big, stack: "f", itemStyle: { color: "rgba(18,183,106,0.45)" }, barMaxWidth: 14 },
          { name: "中单", type: "line", data: mid, showSymbol: false, lineStyle: { width: 1, color: "#60a5fa" } },
          { name: "小单", type: "line", data: small, showSymbol: false, lineStyle: { width: 1, color: "#c084fc" } },
        ],
      }, true);
    } catch (e) {
      metrics.innerHTML = `<div class="state-box">资金流加载失败：${e.message}</div>`;
    }
  }

  /* ============ 财务数据 ============ */
  async function loadFinance() {
    const tbody = document.getElementById("fin-tbody");
    try {
      const code = SECID.split(".")[1];
      const market = SECID.startsWith("0.") ? "SZ" : SECID.startsWith("1.") ? "SH" : SECID.startsWith("116.") ? "HK" : "US";
      const rows = await EM.getFinance(code, market);
      tbody.innerHTML = rows
        .map((d) => {
          return `<tr>
            <td><div class="name-cell">${d.reportDate}</div></td>
            <td>${EM.fmtBig(d.income)}</td>
            <td class="${EM.clsOf(d.incomeYoy)}">${EM.fmtPct(d.incomeYoy)}</td>
            <td>${EM.fmtBig(d.netProfit)}</td>
            <td class="${EM.clsOf(d.profitYoy)}">${EM.fmtPct(d.profitYoy)}</td>
            <td>${EM.fmtNum(d.roe)}%</td>
            <td>${EM.fmtNum(d.grossMargin)}%</td>
            <td>${EM.fmtNum(d.eps)}</td>
            <td>${EM.fmtNum(d.bps)}</td>
          </tr>`;
        })
        .join("");
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="9"><div class="state-box">财务数据加载失败：${e.message}</div></td></tr>`;
    }
  }

  /* ============ 搜索（复用首页逻辑）============ */
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
            ? list.map((d) => `<div class="suggest-item" data-secid="${d.secid}" data-name="${encodeURIComponent(d.name)}">
                <span class="s-name">${d.name}</span><span class="s-code">${d.code}</span><span class="s-type">${d.type}</span>
              </div>`).join("")
            : `<div class="suggest-item"><span class="s-name" style="color:var(--text-3)">无匹配结果</span></div>`;
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
  }

  /* ============ 工具栏事件 ============ */
  function bindToolbar() {
    document.querySelectorAll(".chart-toolbar .chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const { kind, klt, fqt } = btn.dataset;
        if (kind) {
          document.querySelectorAll(".chart-toolbar .chip[data-kind]").forEach((x) => x.classList.remove("active"));
          btn.classList.add("active");
          curKind = kind;
          curKlt = Number(klt || curKlt);
          curKind === "trend" ? drawTrend() : drawKline();
        } else if (fqt !== undefined) {
          document.querySelectorAll(".chart-toolbar .chip[data-fqt]").forEach((x) => x.classList.remove("active"));
          btn.classList.add("active");
          curFqt = Number(fqt);
          if (curKind === "kline") drawKline();
        }
      });
    });
  }

  /* ============ 初始化 ============ */
  initCharts();
  bindToolbar();
  initSearch();
  loadQuote();
  drawTrend();
  drawFlow();
  loadFinance();
})();
