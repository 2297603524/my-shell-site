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
  }

  function searchJsonp(keyword) {
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

  return {
    getCompanyProfile,
    getMainIndicators,
    getFinanceList,
    getMainOperation,
    getBalanceSheet,
    getIncomeStatement,
    getCashflow,
    searchStock,
    fmtNum,
    fmtBig,
    fmtPct,
    clsOf,
    buildSecid,
    secucode,
  };
})();
