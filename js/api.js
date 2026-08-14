/* ===== 基本面数据层（东方财富 F10 / datacenter 公开接口）=====
 * 覆盖：公司概况 / 财务主要指标 / 业绩报表 / 主营构成 / 资产负债表 / 利润表 / 现金流量表 / 搜索
 * 仅基本面数据，不含行情。接口支持 CORS，纯前端直连。
 */
const EM = (() => {
  /* 测试模式：?mock=1 时数据源指向本地 mock 服务器（仅本地调试用，线上默认真实接口） */
  const MOCK = typeof location !== "undefined" && location.search.includes("mock=1");
  const MOCK_BASE = "http://127.0.0.1:8898";
  const DC = MOCK
    ? MOCK_BASE + "/dc"
    : "https://datacenter.eastmoney.com/securities/api/data/v1/get";
  const SEARCH = MOCK
    ? MOCK_BASE + "/search"
    : "https://searchapi.eastmoney.com/api/suggest/get";
  const SEARCH_TOKEN = "D43BF722C8E33BDC906FB84D85E326E8";
  /* 盈利预测/估值接口（datacenter-web） */
  const DCW = MOCK
    ? MOCK_BASE + "/dcw"
    : "https://datacenter-web.eastmoney.com/api/data/v1/get";

  /* datacenter-web 通用查询 */
  async function dcwJson(reportName, filter, page = 1, pageSize = 10, sortColumn = null, sortType = -1) {
    let url = DCW + `?reportName=${reportName}&columns=ALL&pageNumber=${page}&pageSize=${pageSize}`;
    if (filter) url += `&filter=${encodeURIComponent(filter)}`;
    if (sortColumn) url += `&sortTypes=${sortType}&sortColumns=${sortColumn}`;
    const j = await getJson(url);
    return j.result || {};
  }

  /* ============ 盈利预测（分析师一致预期）============ */
  /* 返回：未来3年预测EPS、机构评级、目标价区间、行业 */
  async function getProfitForecast(code) {
    const r = await dcwJson("RPT_WEB_RESPREDICT", `(SECURITY_CODE="${code}")`, 1, 10);
    const rows = r.data || [];
    if (!rows.length) return null;
    const d = rows[0];
    return {
      code: str(d.SECURITY_CODE),
      name: str(d.SECURITY_NAME_ABBR),
      industry: str(d.INDUSTRY_BOARD),
      orgNum: num(d.RATING_ORG_NUM),
      buyNum: num(d.RATING_BUY_NUM),
      addNum: num(d.RATING_ADD_NUM),
      neutralNum: num(d.RATING_NEUTRAL_NUM),
      reduceNum: num(d.RATING_REDUCE_NUM),
      saleNum: num(d.RATING_SALE_NUM),
      epsActual: num(d.EPS1),          // 已实现 EPS
      yearActual: num(d.YEAR1),
      epsNext: num(d.EPS2),            // 明年预测
      yearNext: num(d.YEAR2),
      epsNext2: num(d.EPS3),           // 后年预测
      yearNext2: num(d.YEAR3),
      epsNext3: num(d.EPS4),           // 大后年预测
      yearNext3: num(d.YEAR4),
      aimPriceMax: num(d.DEC_AIMPRICEMAX),
      aimPriceMin: num(d.DEC_AIMPRICEMIN),
      orgLongNum: num(d.RATING_LONG_NUM),
    };
  }

  /* ============ 估值快照（PE/PB/总股本）============ */
  async function getValuation(code, market) {
    const su = secucode(code, market);
    const r = await dcwJson("RPT_VALUEANALYSIS_DET", `(SECUCODE="${su}")`, 1, 5);
    const rows = r.data || [];
    if (!rows.length) return null;
    const d = rows[0];
    return {
      code: str(d.SECURITY_CODE),
      name: str(d.SECURITY_NAME_ABBR),
      price: num(d.CLOSE_PRICE),
      peTtm: num(d.PE_TTM),
      peLar: num(d.PE_LAR),
      pbMrq: num(d.PB_MRQ),
      psTtm: num(d.PS_TTM),
      pegCar: num(d.PEG_CAR),
      totalShares: num(d.TOTAL_SHARES),
      mktCap: num(d.TOTAL_MARKET_CAP),
      changeRate: num(d.CHANGE_RATE),
      tradeDate: str(d.TRADE_DATE).slice(0, 10),
    };
  }

  /* ============ 全市场盈利预测列表（首页行业分类用）============ */
  async function getAllForecast() {
    const pageSize = 500;
    const first = await dcwJson("RPT_WEB_RESPREDICT", null, 1, pageSize, "RATING_ORG_NUM");
    const pages = Math.max(1, first.pages || 1);
    const all = (first.data || []).slice();
    for (let p = 2; p <= Math.min(pages, 8); p++) {
      try {
        const r = await dcwJson("RPT_WEB_RESPREDICT", null, p, pageSize, "RATING_ORG_NUM");
        all.push(...((r.data || [])));
      } catch (e) { /* 部分页失败不阻断 */ }
    }
    return all.map((d) => ({
      code: str(d.SECURITY_CODE),
      name: str(d.SECURITY_NAME_ABBR),
      industry: str(d.INDUSTRY_BOARD),
      orgNum: num(d.RATING_ORG_NUM),
      buyNum: num(d.RATING_BUY_NUM),
      addNum: num(d.RATING_ADD_NUM),
      epsActual: num(d.EPS1),
      epsNext: num(d.EPS2),
      epsNext2: num(d.EPS3),
      epsNext3: num(d.EPS4),
      aimPriceMax: num(d.DEC_AIMPRICEMAX),
      aimPriceMin: num(d.DEC_AIMPRICEMIN),
    }));
  }

  /* ============ 估值打分模型（100分，越高越高估）============ */
  /*
   * 维度1 PEG（40分）：PE_TTM ÷ 预测复合增速
   * 维度2 PE 绝对水平（30分）
   * 维度3 目标价空间（30分）：(目标价均值-现价)/现价
   */
  function calcValuationScore(valuation, forecast) {
    if (!valuation) return null;
    let total = 0;
    const parts = [];

    /* 维度1 PEG 40分 */
    let pegScore = null;
    let peg = null;
    const pe = valuation.peTtm;
    const growth = forecast ? forecastGrowth(forecast) : null;
    if (pe && growth && growth > 0) {
      peg = pe / growth;
      if (peg <= 0.5) pegScore = 8;
      else if (peg <= 1) pegScore = 16;
      else if (peg <= 2) pegScore = 24;
      else if (peg <= 3) pegScore = 32;
      else pegScore = 40;
      total += pegScore;
    }
    parts.push({ name: "PEG（估值/增速匹配）", score: pegScore, weight: 40, note: peg !== null ? `PE ${pe.toFixed(1)} ÷ 预测增速 ${growth.toFixed(1)}% = ${peg.toFixed(2)}` : "无增速数据" });

    /* 维度2 PE 绝对水平 30分 */
    let peScore = null;
    if (pe) {
      if (pe < 15) peScore = 6;
      else if (pe < 25) peScore = 12;
      else if (pe < 40) peScore = 18;
      else if (pe < 60) peScore = 24;
      else peScore = 30;
      total += peScore;
    }
    parts.push({ name: "PE 绝对水平", score: peScore, weight: 30, note: pe ? `PE(TTM) ${pe.toFixed(1)}` : "无PE数据" });

    /* 维度3 目标价空间 30分 */
    let aimScore = null;
    let aimGap = null;
    if (forecast && forecast.aimPriceMax && forecast.aimPriceMin && valuation.price) {
      const aim = (forecast.aimPriceMax + forecast.aimPriceMin) / 2;
      aimGap = (aim - valuation.price) / valuation.price * 100;
      if (aimGap > 30) aimScore = 4;
      else if (aimGap > 10) aimScore = 10;
      else if (aimGap > -10) aimScore = 20;
      else aimScore = 30;
      total += aimScore;
    }
    parts.push({ name: "目标价空间", score: aimScore, weight: 30, note: aimGap !== null ? `目标价均值 vs 现价 ${aimGap >= 0 ? "+" : ""}${aimGap.toFixed(1)}%` : "无目标价数据" });

    /* 标签 */
    let label, cls;
    if (total >= 75) { label = "高估"; cls = "danger"; }
    else if (total >= 60) { label = "偏高"; cls = "warn"; }
    else if (total >= 50) { label = "合理"; cls = "mid"; }
    else if (total >= 30) { label = "偏低"; cls = "ok"; }
    else { label = "低估"; cls = "good"; }

    return { total: Math.round(total), label, cls, parts, peg, growth };
  }

  function forecastGrowth(f) {
    /* 用未来两年预测 EPS 的复合增速 */
    if (f && f.epsNext && f.epsNext2 && f.epsNext > 0) {
      return (f.epsNext2 / f.epsNext - 1) * 100;
    }
    if (f && f.epsActual && f.epsNext && f.epsActual > 0) {
      return (f.epsNext / f.epsActual - 1) * 100;
    }
    return null;
  }

  /* 预测净利润（EPS × 总股本） */
  function forecastProfit(f, totalShares) {
    if (!f || !totalShares) return null;
    return {
      next: f.epsNext ? f.epsNext * totalShares : null,
      next2: f.epsNext2 ? f.epsNext2 * totalShares : null,
      next3: f.epsNext3 ? f.epsNext3 * totalShares : null,
    };
  }

  /* 通用 fetch：超时 + JSON 解析 */
  async function getJson(url, timeout = 15000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  const num = (v) => (v === null || v === undefined || v === "-" || v === "" ? null : Number(v));
  const str = (v) => (v === null || v === undefined ? "" : String(v));

  /* 构造 datacenter 查询 URL */
  function dcUrl(reportName, filter, page = 1, pageSize = 10, sortColumn = "REPORT_DATE", sortType = -1) {
    const f = encodeURIComponent(filter);
    return (
      DC +
      `?reportName=${reportName}&columns=ALL&filter=${f}` +
      `&pageNumber=${page}&pageSize=${pageSize}` +
      `&sortTypes=${sortType}&sortColumns=${sortColumn}` +
      "&source=HSF10&client=PC"
    );
  }

  /* 把 6 位代码转 SECUCODE（.SH/.SZ） */
  function secucode(code, market) {
    if (market === "SH") return `${code}.SH`;
    if (market === "SZ") return `${code}.SZ`;
    if (market === "HK") return `${code}.HK`;
    // 自动判断：6开头/9开头 -> 沪，0/2/3开头 -> 深
    return code.startsWith("6") || code.startsWith("9") ? `${code}.SH` : `${code}.SZ`;
  }

  /* ============ 公司概况 ============ */
  async function getCompanyProfile(code, market) {
    const su = secucode(code, market);
    // 注意：该报表无 REPORT_DATE 排序列，不能带排序参数
    const f = encodeURIComponent(`(SECUCODE="${su}")`);
    const url = DC +
      `?reportName=RPT_F10_BASIC_ORGINFO&columns=ALL&filter=${f}` +
      "&pageNumber=1&pageSize=1&source=HSF10&client=PC";
    const j = await getJson(url);
    const rows = (j.result && j.result.data) || [];
    if (!rows.length) throw new Error("未找到公司概况");
    const d = rows[0];
    return {
      code: str(d.SECURITY_CODE),
      name: str(d.SECURITY_NAME_ABBR),
      fullName: str(d.ORG_NAME),
      enName: str(d.ORG_NAME_EN),
      formerName: str(d.FORMERNAME),
      securityType: str(d.SECURITY_TYPE),
      tradeMarket: str(d.TRADE_MARKET),
      industryEM: str(d.EM2016),
      industryCSRC: str(d.INDUSTRYCSRC1),
      chairman: str(d.CHAIRMAN),
      president: str(d.PRESIDENT),
      secretary: str(d.SECRETARY),
      legalPerson: str(d.LEGAL_PERSON),
      independentDirectors: str(d.INDEDIRECTORS),
      tel: str(d.ORG_TEL),
      email: str(d.ORG_EMAIL),
      fax: str(d.ORG_FAX),
      website: str(d.ORG_WEB),
      address: str(d.ADDRESS),
      regAddress: str(d.REG_ADDRESS),
      regCapital: str(d.REG_CAPITAL),
      foundDate: str(d.FOUND_DATE),
      listDate: str(d.LISTING_DATE),
      businessScope: str(d.MAIN_BUSINESS),
    };
  }

  /* ============ 财务主要指标（近 N 期）============ */
  async function getMainIndicators(code, market, pageSize = 8) {
    const su = secucode(code, market);
    const url = dcUrl("RPT_F10_FINANCE_MAINFINADATA", `(SECUCODE="${su}")`, 1, pageSize);
    const j = await getJson(url);
    const rows = (j.result && j.result.data) || [];
    return rows.map((d) => ({
      reportDate: str(d.REPORT_DATE).slice(0, 10),
      reportName: str(d.REPORT_DATE_NAME),
      eps: num(d.EPSJB),
      epsDeduct: num(d.EPSKCJB),
      bps: num(d.BPS),
      ocfPerShare: num(d.MGJYXJJE),
      income: num(d.TOTALOPERATEREVE),
      incomeYoy: num(d.TOTALOPERATEREVETZ),
      netProfit: num(d.PARENTNETPROFIT),
      netProfitYoy: num(d.PARENTNETPROFITTZ),
      deductProfit: num(d.KCFJCXSYJLR),
      roe: num(d.ROEJQ),
      roeDeduct: num(d.ROEKCJQ),
      grossMargin: num(d.XSMLL),
      netMargin: num(d.XSJLL),
      debtRatio: num(d.ZCFZL),
      currentRatio: num(d.LD),
      quickRatio: num(d.SD),
      inventoryTurnover: num(d.CHZZTS),
      receivableTurnover: num(d.YSZKZZTS),
      totalAssetsTurnover: num(d.ZZCZZTS),
      totalShare: num(d.TOTAL_SHARE),
      roic: num(d.ROIC),
    }));
  }

  /* ============ 业绩报表（A股全市场列表 / 个股历史）============ */
  /* list=true 时 filter 传空、按 sortColumn 排序，用于首页财务排行 */
  async function getFinanceList({ page = 1, pageSize = 60, sortColumn = "PARENT_NETPROFIT", reportDate = "2026-03-31" } = {}) {
    const filter = `(REPORTDATE>='${reportDate}')`;
    const url = dcUrl("RPT_LICO_FN_CPD", filter, page, pageSize, sortColumn, -1);
    const j = await getJson(url);
    const r = j.result || {};
    const rows = (r.data || []).map((d) => ({
      code: str(d.SECURITY_CODE),
      name: str(d.SECURITY_NAME_ABBR),
      reportDate: str(d.REPORTDATE).slice(0, 10),
      income: num(d.TOTAL_OPERATE_INCOME),
      incomeYoy: num(d.YSTZ),
      netProfit: num(d.PARENT_NETPROFIT),
      profitYoy: num(d.SJLTZ),
      roe: num(d.WEIGHTAVG_ROE),
      grossMargin: num(d.XSMLL),
      eps: num(d.BASIC_EPS),
      bps: num(d.BPS),
      ocfPerShare: num(d.MGJYXJJE),
      industry: str(d.PUBLISHNAME),
    }));
    return { total: r.count || 0, rows };
  }

  /* ============ 主营构成 ============ */
  async function getMainOperation(code, market, pageSize = 30) {
    const su = secucode(code, market);
    const url = dcUrl("RPT_F10_FN_MAINOP", `(SECUCODE="${su}")`, 1, pageSize);
    const j = await getJson(url);
    const rows = (j.result && j.result.data) || [];
    // 只取最新一期
    const latest = rows.length ? rows[0].REPORT_DATE : "";
    const latestRows = rows.filter((d) => d.REPORT_DATE === latest);
    const typeMap = { "1": "按产品", "2": "按行业", "3": "按地区" };
    const groups = {};
    for (const d of latestRows) {
      const t = typeMap[str(d.MAINOP_TYPE)] || "其他";
      if (!groups[t]) groups[t] = [];
      groups[t].push({
        item: str(d.ITEM_NAME),
        income: num(d.MAIN_BUSINESS_INCOME),
        incomeRatio: num(d.MBI_RATIO) !== null ? num(d.MBI_RATIO) * 100 : null,
        cost: num(d.MAIN_BUSINESS_COST),
        profit: num(d.MAIN_BUSINESS_RPOFIT),
        grossMargin: num(d.GROSS_RPOFIT_RATIO) !== null ? num(d.GROSS_RPOFIT_RATIO) * 100 : null,
      });
    }
    return { reportDate: str(latest).slice(0, 10), reportName: "", groups };
  }

  /* ============ 资产负债表 ============ */
  async function getBalanceSheet(code, market, pageSize = 1) {
    const su = secucode(code, market);
    const url = dcUrl("RPT_DMSK_FN_BALANCE", `(SECUCODE="${su}")`, 1, pageSize);
    const j = await getJson(url);
    const rows = (j.result && j.result.data) || [];
    if (!rows.length) return [];
    return rows.map((d) => ({
      reportDate: str(d.REPORT_DATE).slice(0, 10),
      totalAssets: num(d.TOTAL_ASSETS),
      monetaryFunds: num(d.MONETARYFUNDS),
      accountsReceivable: num(d.ACCOUNTS_RECE),
      inventory: num(d.INVENTORY),
      fixedAssets: num(d.FIXED_ASSET),
      totalLiabilities: num(d.TOTAL_LIABILITIES),
      accountsPayable: num(d.ACCOUNTS_PAYABLE),
      shortLoan: num(d.SHORT_LOAN),
      totalEquity: num(d.TOTAL_EQUITY),
    }));
  }

  /* ============ 利润表 ============ */
  async function getIncomeStatement(code, market, pageSize = 1) {
    const su = secucode(code, market);
    const url = dcUrl("RPT_DMSK_FN_INCOME", `(SECUCODE="${su}")`, 1, pageSize);
    const j = await getJson(url);
    const rows = (j.result && j.result.data) || [];
    if (!rows.length) return [];
    return rows.map((d) => ({
      reportDate: str(d.REPORT_DATE).slice(0, 10),
      income: num(d.TOTAL_OPERATE_INCOME),
      cost: num(d.TOTAL_OPERATE_COST),
      operateCost: num(d.OPERATE_COST),
      operateProfit: num(d.OPERATE_PROFIT),
      totalProfit: num(d.TOTAL_PROFIT),
      netProfit: num(d.PARENT_NETPROFIT),
      deductNetProfit: num(d.DEDUCT_PARENT_NETPROFIT),
    }));
  }

  /* ============ 现金流量表 ============ */
  async function getCashflow(code, market, pageSize = 1) {
    const su = secucode(code, market);
    const url = dcUrl("RPT_DMSK_FN_CASHFLOW", `(SECUCODE="${su}")`, 1, pageSize);
    const j = await getJson(url);
    const rows = (j.result && j.result.data) || [];
    if (!rows.length) return [];
    return rows.map((d) => ({
      reportDate: str(d.REPORT_DATE).slice(0, 10),
      operate: num(d.NETCASH_OPERATE),
      invest: num(d.NETCASH_INVEST),
      finance: num(d.NETCASH_FINANCE),
      payStaff: num(d.PAY_STAFF_CASH),
    }));
  }

  /* ============ 股票搜索（代码/名称/拼音）============ */
  /* 注意：searchapi 接口无 CORS 头，浏览器 fetch 会被拦截，必须用 JSONP（cb= 参数） */
  async function searchStock(keyword) {
    if (!keyword) return [];
    return searchJsonp(keyword);
  }  function searchJsonp(keyword) {
    return new Promise((resolve, reject) => {
      const cb = "em_s_" + Date.now() + "_" + Math.floor(Math.random() * 1e6);
      const script = document.createElement("script");
      const timer = setTimeout(() => { cleanup(); reject(new Error("搜索超时")); }, 8000);
      function cleanup() {
        clearTimeout(timer);
        delete window[cb];
        if (script.parentNode) script.parentNode.removeChild(script);
      }
      window[cb] = (data) => {
        cleanup();
        try {
          const table = data && data.QuotationCodeTable;
          const list = (table && table.Data) || [];
          resolve(
            list
              .filter((d) => d.Classify === "AStock" || d.Classify === "HKStock" || d.Classify === "USStock")
              .map((d) => ({
                code: str(d.Code),
                name: str(d.Name),
                pinyin: str(d.PinYin),
                secid: str(d.QuoteID),
                type: str(d.SecurityTypeName) || str(d.Classify),
              }))
          );
        } catch (e) {
          reject(new Error("搜索解析失败"));
        }
      };
      script.onerror = () => { cleanup(); reject(new Error("搜索网络错误")); };
      script.src =
        SEARCH +
        `?input=${encodeURIComponent(keyword)}&type=14&token=${SEARCH_TOKEN}&count=10&cb=${cb}`;
      document.head.appendChild(script);
    });
  }

  /* ============ 工具函数 ============ */
  function fmtNum(v, digits = 2) {
    if (v === null || v === undefined || isNaN(v)) return "--";
    return Number(v).toFixed(digits);
  }

  function fmtBig(v) {
    if (v === null || v === undefined || isNaN(v)) return "--";
    const abs = Math.abs(v);
    if (abs >= 1e12) return (v / 1e12).toFixed(2) + "万亿";
    if (abs >= 1e8) return (v / 1e8).toFixed(2) + "亿";
    if (abs >= 1e4) return (v / 1e4).toFixed(2) + "万";
    return Number(v).toFixed(2);
  }

  function fmtPct(v) {
    if (v === null || v === undefined || isNaN(v)) return "--";
    const s = v > 0 ? "+" : "";
    return s + Number(v).toFixed(2) + "%";
  }

  function clsOf(v) {
    if (v === null || v === undefined || isNaN(v)) return "flat";
    if (v > 0) return "up";
    if (v < 0) return "down";
    return "flat";
  }

  function buildSecid(market, code) {
    if (market === 0 || market === 1) return market + "." + code;
    if (market === 128) return "116." + code;
    return market + "." + code;
  }

  /* ============ 自选股（localStorage）============ */
  const WL_KEY = "em_watchlist_v1";

  function getWatchlist() {
    try {
      return JSON.parse(localStorage.getItem(WL_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function isWatched(code) {
    return getWatchlist().some((s) => s.code === code);
  }

  function addWatch(code, name, market) {
    const list = getWatchlist();
    if (!list.some((s) => s.code === code)) {
      list.push({ code, name, market: market || (code.startsWith("6") || code.startsWith("9") ? "SH" : "SZ"), time: Date.now() });
      localStorage.setItem(WL_KEY, JSON.stringify(list));
    }
    return list;
  }

  function removeWatch(code) {
    const list = getWatchlist().filter((s) => s.code !== code);
    localStorage.setItem(WL_KEY, JSON.stringify(list));
    return list;
  }

  /* 指标释义字典：悬停问号显示 */
  const METRIC_TIPS = {
    income: "报告期内公司销售商品、提供劳务等主营业务活动产生的收入合计（营业总收入）",
    incomeYoy: "本报告期营业总收入与上年同期相比的增长百分比",
    netProfit: "归属于母公司股东的净利润，即扣除少数股东损益后、归上市公司股东享有的利润",
    profitYoy: "本报告期归母净利润与上年同期相比的增长百分比",
    roe: "净资产收益率 = 净利润 ÷ 净资产，衡量股东投入资金的盈利能力，越高越好",
    grossMargin: "毛利率 = (营业收入 - 营业成本) ÷ 营业收入，反映产品或服务的盈利空间",
    netMargin: "净利率 = 净利润 ÷ 营业收入，反映公司整体盈利水平",
    debtRatio: "资产负债率 = 总负债 ÷ 总资产，衡量财务杠杆与偿债压力，过高有风险",
    eps: "每股收益 = 归母净利润 ÷ 总股本，衡量每股股票创造的净利润",
    bps: "每股净资产 = 股东权益 ÷ 总股本，反映每股股票对应的账面价值",
    ocfPerShare: "每股经营现金流 = 经营活动现金流量净额 ÷ 总股本，反映公司现金造血能力",
    reportDate: "财务数据对应的报告期（季度/年度财报截止日）",
    industry: "公司所属的申万行业分类",
    totalAssets: "公司拥有的全部资产总额（资产负债表左半边合计）",
    monetaryFunds: "货币资金：公司持有的现金及银行存款，流动性最强的资产",
    accountsReceivable: "应收账款：已销售商品但尚未收回的款项，过高说明回款能力弱",
    inventory: "存货：尚未销售的产品、半成品与原材料，过高可能滞销",
    fixedAssets: "固定资产：厂房、设备等长期资产净值",
    totalLiabilities: "总负债：公司全部债务总额（资产负债表右半边合计）",
    accountsPayable: "应付账款：采购后尚未支付的款项，属于对供应商的占款",
    shortLoan: "短期借款：一年内到期的银行借款等有息负债",
    totalEquity: "股东权益：净资产 = 总资产 - 总负债，归股东所有的部分",
    operateCost: "营业总成本：与营业收入匹配的全部成本费用",
    operateProfit: "营业利润 = 营业收入 - 营业成本 - 期间费用等，反映主营经营成果",
    totalProfit: "利润总额 = 营业利润 + 营业外收支，缴纳所得税前的利润",
    deductNetProfit: "扣非净利润：剔除政府补助、资产处置等非经常性损益后的净利润，更能反映主业质量",
    cashOperate: "经营活动现金流：主营经营产生的现金净流入，持续为正说明造血能力强",
    cashInvest: "投资活动现金流：购建资产、投资等活动的现金净额，通常为负表示扩张投入",
    cashFinance: "筹资活动现金流：借款、发股、分红等融资活动的现金净额",
    payStaff: "支付给职工以及为职工支付的现金",
    mainopIncome: "主营构成中该项目的营业收入",
    mainopRatio: "该项目收入占公司营业总收入的比例",
    mainopCost: "该项目对应的营业成本",
    mainopMargin: "该项目毛利率 = (收入 - 成本) ÷ 收入，反映单一业务的盈利空间",
    rating: "券商机构评级：买入/增持/中性/减持/卖出，数字为给出该评级的机构家数",
    epsNext: "券商一致预期：机构预测的公司下一年度每股收益（EPS）",
    epsNext2: "券商一致预期：机构预测的公司后一年度每股收益（EPS）",
    forecastGrowth: "券商一致预期的未来盈利增速（基于预测 EPS 推算的复合增长率）",
    aimPrice: "券商机构给出的目标价区间：若现价远低于区间下沿，机构认为存在上涨空间；反之亦然",
    scoreExplain: "估值打分（0-100分）：综合 PEG（40分）、PE 绝对水平（30分）、目标价空间（30分）三个维度，分数越高代表估值越贵（高估），越低代表越便宜（低估）",
    scorePeg: "PEG = PE(TTM) ÷ 预测盈利增速，衡量估值与成长性的匹配度：PEG≤1 通常视为合理，越低越便宜",
    scorePe: "PE(TTM) = 股价 ÷ 近12个月每股收益，绝对水平越高代表估值越贵",
    scoreAim: "目标价空间 = (机构目标价均值 - 现价) ÷ 现价，空间越大代表机构认为越被低估",
  };

  return {
    getCompanyProfile,
    getMainIndicators,
    getFinanceList,
    getMainOperation,
    getBalanceSheet,
    getIncomeStatement,
    getCashflow,
    getProfitForecast,
    getValuation,
    getAllForecast,
    calcValuationScore,
    forecastGrowth,
    forecastProfit,
    searchStock,
    fmtNum,
    fmtBig,
    fmtPct,
    clsOf,
    buildSecid,
    secucode,
    getWatchlist,
    isWatched,
    addWatch,
    removeWatch,
    METRIC_TIPS,
  };
})();
