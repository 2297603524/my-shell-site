/* ===== 全网行情数据层（东方财富公开接口）=====
 * 覆盖：A股(沪深京) / 港股 / 美股 / 指数 / K线 / 分时 / 资金流 / 板块 / 财务 / 搜索
 * 所有接口均支持 CORS，纯前端直连，无需后端。
 */
const EM = (() => {
  /* 测试模式：?mock=1 时数据源指向本地 mock 服务器（仅本地调试用，线上默认真实接口） */
  const MOCK = typeof location !== "undefined" && location.search.includes("mock=1");
  const MOCK_BASE = "http://127.0.0.1:8898";
  const BASE = MOCK ? MOCK_BASE + "/qt/" : "https://push2.eastmoney.com/api/qt/";
  const HIS = MOCK ? MOCK_BASE + "/his/" : "https://push2his.eastmoney.com/api/qt/";
  const DC = MOCK ? MOCK_BASE + "/dc" : "https://datacenter.eastmoney.com/securities/api/data/v1/get";
  const SEARCH = MOCK ? MOCK_BASE + "/search" : "https://searchapi.eastmoney.com/api/suggest/get";
  const UT = "fa5fd1943c7b386f172d6893dbfba10b";
  const SEARCH_TOKEN = "D43BF722C8E33BDC906FB84D85E326E8";

  /* 通用 fetch：超时 + JSON 解析，支持多域名轮换（防限流/单点故障） */
  async function getJson(url, timeout = 12000, hosts = null, useJsonp = true) {
    const tryList = hosts ? hosts.map((h) => url.replace(/^https:\/\/[^/]+/, "https://" + h)) : [url];
    let lastErr = null;
    for (const u of tryList) {
      try {
        return await fetchOnce(u, timeout);
      } catch (e) {
        lastErr = e;
      }
    }
    if (useJsonp) {
      try {
        return await jsonpOnce(url, timeout);
      } catch (e2) {
        throw lastErr || e2;
      }
    }
    throw lastErr;
  }

  /* JSONP 兜底：东财接口支持 cb= 回调，不受 CORS 限制 */
  function jsonpOnce(url, timeout) {
    return new Promise((resolve, reject) => {
      const cb = "emcb_" + Date.now() + "_" + Math.floor(Math.random() * 1e6);
      const script = document.createElement("script");
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("JSONP timeout"));
      }, timeout);
      function cleanup() {
        clearTimeout(timer);
        delete window[cb];
        if (script.parentNode) script.parentNode.removeChild(script);
      }
      window[cb] = (data) => {
        cleanup();
        resolve(data);
      };
      script.onerror = () => {
        cleanup();
        reject(new Error("JSONP error"));
      };
      script.src = url + (url.includes("?") ? "&" : "?") + "cb=" + cb;
      document.head.appendChild(script);
    });
  }

  async function fetchOnce(url, timeout) {
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

  /* K线接口多域名池 */
  const KLINE_HOSTS = MOCK ? null : ["push2his.eastmoney.com", "push2.eastmoney.com"];

  /* 安全取值 */
  const num = (v) => (v === null || v === undefined || v === "-" ? null : Number(v));
  const str = (v) => (v === null || v === undefined ? "" : String(v));

  /* ============ 指数行情 ============ */
  /* secids: 上证/深成/创业板/科创50/恒生 */
  async function getIndices() {
    const secids = "1.000001,0.399001,0.399006,1.000688,100.HSI,100.NDX";
    const url =
      BASE +
      "ulist.np/get?" +
      `ut=${UT}&fltt=2&invt=2&secids=${secids}` +
      "&fields=f2,f3,f4,f12,f14,f15,f16,f17,f18";
    const j = await getJson(url);
    const list = (j.data && j.data.diff) || [];
    return list.map((d) => ({
      code: str(d.f12),
      name: str(d.f14),
      price: num(d.f2),
      pct: num(d.f3),
      change: num(d.f4),
      high: num(d.f15),
      low: num(d.f16),
      open: num(d.f17),
      preClose: num(d.f18),
      market: str(d.f13),
    }));
  }

  /* ============ 行情列表（A股/港股/美股）============ */
  /* sortBy: f3涨跌幅 f6成交额 f20总市值 f8换手率 f5成交量 */
  async function getStockList({ market = "a", page = 1, pageSize = 60, sortBy = "f3", order = "desc" } = {}) {
    const fsMap = {
      a: "m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048",
      hk: "m:128+t:3,m:128+t:4,m:128+t:1,m:128+t:2",
      us: "m:105,m:106,m:107",
    };
    const fs = fsMap[market] || fsMap.a;
    const fields =
      "f2,f3,f4,f5,f6,f8,f9,f10,f12,f13,f14,f15,f16,f17,f18,f20,f21,f23,f24,f25,f62";
    const url =
      BASE +
      "clist/get?" +
      `ut=${UT}&pn=${page}&pz=${pageSize}&po=${order === "asc" ? 0 : 1}&np=1` +
      `&fltt=2&invt=2&fid=${sortBy}&fs=${encodeURIComponent(fs)}&fields=${fields}`;
    const j = await getJson(url);
    const data = j.data || {};
    const rows = (data.diff || []).map((d) => ({
      code: str(d.f12),
      name: str(d.f14),
      market: num(d.f13),
      price: num(d.f2),
      pct: num(d.f3),
      change: num(d.f4),
      volume: num(d.f5),
      amount: num(d.f6),
      turnover: num(d.f8),
      pe: num(d.f9),
      high: num(d.f15),
      low: num(d.f16),
      open: num(d.f17),
      preClose: num(d.f18),
      mktCap: num(d.f20),
      floatCap: num(d.f21),
      pb: num(d.f23),
      pct60: num(d.f24),
      pctYtd: num(d.f25),
      mainFlow: num(d.f62),
    }));
    return { total: data.total || 0, rows };
  }

  /* ============ 个股实时快照 ============ */
  async function getStockQuote(secid) {
    const url =
      BASE +
      "stock/get?" +
      `ut=${UT}&fltt=2&invt=2&secid=${secid}` +
      "&fields=f43,f44,f45,f46,f47,f48,f50,f51,f52,f57,f58,f60,f116,f117,f162,f167,f168,f169,f170,f171,f174,f175,f292,f164";
    const j = await getJson(url);
    const d = j.data || {};
    return {
      code: str(d.f57),
      name: str(d.f58),
      price: num(d.f43),
      high: num(d.f44),
      low: num(d.f45),
      open: num(d.f46),
      volume: num(d.f47),
      amount: num(d.f48),
      preClose: num(d.f60),
      mktCap: num(d.f116),
      floatCap: num(d.f117),
      pe: num(d.f162),
      pb: num(d.f167),
      turnover: num(d.f168),
      change: num(d.f169),
      pct: num(d.f170),
      high52w: num(d.f174),
      low52w: num(d.f175),
      pctYtd: num(d.f171),
    };
  }

  /* ============ K线 ============ */
  /* klt: 101日 102周 103月 60分时5分钟? 1=1分钟 5=5分钟 15 30 60 */
  /* fqt: 1前复权 2后复权 0不复权 */
  async function getKline(secid, klt = 101, fqt = 1, count = 320, end = 20500101) {
    const url =
      HIS +
      "stock/kline/get?" +
      `secid=${secid}&klt=${klt}&fqt=${fqt}` +
      `&beg=0&end=${end}&lmt=${count}` +
      "&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61";
    const j = await getJson(url, 12000, KLINE_HOSTS);
    const d = j.data || {};
    const klines = (d.klines || []).map((line) => {
      const p = line.split(",");
      return {
        date: p[0],
        open: Number(p[1]),
        close: Number(p[2]),
        high: Number(p[3]),
        low: Number(p[4]),
        volume: Number(p[5]),
        amount: Number(p[6]),
        pct: Number(p[8]),
      };
    });
    return { code: d.code, name: d.name, preClose: num(d.preKPrice), klines };
  }

  /* ============ 分时 ============ */
  async function getTrend(secid) {
    const url =
      BASE +
      "stock/trends2/get?" +
      `secid=${secid}&ndays=1&iscr=0&fields1=f1,f2,f3,f4,f5,f6,f7,f8&fields2=f51,f52,f53,f54,f55,f56,f57,f58`;
    const j = await getJson(url);
    const d = j.data || {};
    const trends = (d.trends || []).map((line) => {
      const p = line.split(",");
      return {
        time: p[0],
        price: Number(p[1]),
        avg: Number(p[6]),
        volume: Number(p[5]),
        amount: Number(p[7]),
      };
    });
    return { name: d.name, preClose: num(d.preClose), trends };
  }

  /* ============ 资金流向（日级历史）============ */
  async function getFundFlow(secid, days = 60) {
    const url =
      BASE +
      "stock/fflow/kline/get?" +
      `lmt=${days}&klt=1&secid=${secid}` +
      "&fields1=f1,f2,f3,f7&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61";
    const j = await getJson(url);
    const d = j.data || {};
    const klines = (d.klines || []).map((line) => {
      const p = line.split(",");
      return {
        date: p[0],
        main: Number(p[1]),
        small: Number(p[2]),
        mid: Number(p[3]),
        big: Number(p[4]),
        super: Number(p[5]),
        mainPct: Number(p[6]),
      };
    });
    return { name: d.name, klines };
  }

  /* ============ 板块列表 ============ */
  /* type: industry行业 concept概念 region地域 */
  async function getSectors(type = "industry", page = 1, pageSize = 60) {
    const fsMap = { industry: "m:90+t:2", concept: "m:90+t:3", region: "m:90+t:1" };
    const fs = fsMap[type] || fsMap.industry;
    const url =
      BASE +
      "clist/get?" +
      `ut=${UT}&pn=${page}&pz=${pageSize}&po=1&np=1&fltt=2&invt=2` +
      `&fid=f3&fs=${encodeURIComponent(fs)}&fields=f2,f3,f4,f5,f6,f8,f12,f13,f14,f20,f104,f105,f128,f140`;
    const j = await getJson(url);
    const data = j.data || {};
    const rows = (data.diff || []).map((d) => ({
      code: str(d.f12),
      name: str(d.f14),
      market: num(d.f13),
      price: num(d.f2),
      pct: num(d.f3),
      change: num(d.f4),
      amount: num(d.f6),
      upCount: num(d.f104),
      downCount: num(d.f105),
      leader: str(d.f128),
      leaderPct: num(d.f140),
    }));
    return { total: data.total || 0, rows };
  }

  /* ============ 财务业绩（季度）============ */
  async function getFinance(code, market = "SH") {
    const secucode = `${code}.${market === "SH" ? "SH" : market === "SZ" ? "SZ" : "HK"}`;
    const filter = encodeURIComponent(`(SECURITY_CODE="${code}")`);
    const url =
      DC +
      `?reportName=RPT_LICO_FN_CPD&columns=ALL&filter=${filter}` +
      "&pageNumber=1&pageSize=8&sortTypes=-1&sortColumns=REPORTDATE&source=HSF10&client=PC";
    const j = await getJson(url, 12000, null, false);
    const rows = (j.result && j.result.data) || [];
    return rows.map((d) => ({
      reportDate: str(d.REPORTDATE).slice(0, 10),
      eps: num(d.BASIC_EPS),
      income: num(d.TOTAL_OPERATE_INCOME),
      incomeYoy: num(d.YSTZ),
      netProfit: num(d.PARENT_NETPROFIT),
      profitYoy: num(d.SJLTZ),
      roe: num(d.WEIGHTAVG_ROE),
      grossMargin: num(d.XSMLL),
      bps: num(d.BPS),
      ocfPerShare: num(d.MGJYXJJE),
      industry: str(d.PUBLISHNAME),
    }));
  }

  /* ============ 股票搜索 ============ */
  async function searchStock(keyword) {
    if (!keyword) return [];
    const url =
      SEARCH + `?input=${encodeURIComponent(keyword)}&type=14&token=${SEARCH_TOKEN}&count=10`;
    const j = await getJson(url);
    const table = j && j.QuotationCodeTable;
    const data = (table && table.Data) || [];
    return data
      .filter((d) => d.Classify === "AStock" || d.Classify === "HKStock" || d.Classify === "USStock")
      .map((d) => ({
        code: str(d.Code),
        name: str(d.Name),
        pinyin: str(d.PinYin),
        secid: str(d.QuoteID),
        type: str(d.SecurityTypeName) || str(d.Classify),
      }));
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

  /* 由市场代码(f13)+股票代码构建 secid */
  function buildSecid(market, code) {
    if (market === 0 || market === 1) return market + "." + code;      // A股 沪1/深0
    if (market === 128) return "116." + code;                          // 港股
    return market + "." + code;                                        // 美股 105/106/107
  }

  function clsOf(v) {
    if (v === null || v === undefined || isNaN(v)) return "flat";
    if (v > 0) return "up";
    if (v < 0) return "down";
    return "flat";
  }

  return {
    getIndices,
    getStockList,
    getStockQuote,
    getKline,
    getTrend,
    getFundFlow,
    getSectors,
    getFinance,
    searchStock,
    fmtNum,
    fmtBig,
    fmtPct,
    clsOf,
    buildSecid,
  };
})();
