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

  /* ===== 腾讯数据源（备选，东财不可用时兜底）===== */
  const TX_QT = "https://qt.gtimg.cn/q=";                    // 快照(GBK文本)
  const TX_KLINE = "https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=";
  const TX_MINUTE = "https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=";

  /* secid -> 腾讯代码，如 1.600519 -> sh600519, 0.000001 -> sz000001, 116.00700 -> hk00700, 105.AAPL -> usAAPL */
  function txCode(secid) {
    const m = secid.split(".")[0];
    const c = secid.split(".")[1] || "";
    if (m === "1") return "sh" + c;
    if (m === "0") return "sz" + c;
    if (m === "116") return "hk" + c;
    return "us" + c;
  }

  /* 腾讯快照文本（GBK）解析 */
  async function txQuote(secid) {
    const res = await fetch(TX_QT + txCode(secid), { headers: { Accept: "*/*" } });
    if (!res.ok) throw new Error("TX HTTP " + res.status);
    const buf = await res.arrayBuffer();
    const text = new TextDecoder("gbk").decode(buf);
    const m = text.match(/"([^"]+)"/);
    if (!m) throw new Error("TX parse error");
    const p = m[1].split("~");
    return {
      code: p[2] || "",
      name: p[1] || "",
      price: num(p[3]),
      preClose: num(p[4]),
      open: num(p[5]),
      volume: num(p[6]),
      high: num(p[33]),
      low: num(p[34]),
      change: num(p[31]),
      pct: num(p[32]),
      amount: num(p[37]) ? num(p[37]) * 10000 : null,   // 万元 -> 元
      turnover: num(p[38]),
      pe: num(p[39]),
      pb: num(p[46]),
      floatCap: num(p[44]) ? num(p[44]) * 1e8 : null,   // 亿 -> 元
      mktCap: num(p[45]) ? num(p[45]) * 1e8 : null,     // 亿 -> 元
    };
  }

  /* 腾讯K线解析 */
  async function txKline(secid, klt, fqt, count) {
    const period = klt === 102 ? "week" : klt === 103 ? "month" : "day";
    const adjust = fqt === 2 ? "hfq" : fqt === 0 ? "" : "qfq";
    const res = await fetch(TX_KLINE + `${txCode(secid)},${period},,,${count},${adjust}`);
    if (!res.ok) throw new Error("TX HTTP " + res.status);
    const j = await res.json();
    const d = j.data && j.data[txCode(secid)];
    const key = adjust + period;
    const list = (d && d[key]) || (d && d["qfq" + period]) || (d && d["hfq" + period]) || (d && d["day"]) || [];
    if (!list.length) throw new Error("TX kline empty");
    return {
      code: secid.split(".")[1],
      name: (d && d.qt && d.qt[txCode(secid)] && d.qt[txCode(secid)][1]) || "",
      klines: list.map((r) => ({
        date: r[0], open: Number(r[1]), close: Number(r[2]), high: Number(r[3]), low: Number(r[4]), volume: Number(r[5]),
      })),
    };
  }

  /* 腾讯分时解析 */
  async function txTrend(secid) {
    const res = await fetch(TX_MINUTE + txCode(secid));
    if (!res.ok) throw new Error("TX HTTP " + res.status);
    const j = await res.json();
    const d = j.data && j.data[txCode(secid)];
    const lines = d && d.data && d.data.data;
    if (!lines || !lines.length) throw new Error("TX trend empty");
    const preClose = num(d.qt && d.qt[txCode(secid)] && d.qt[txCode(secid)][4]);
    const trends = lines.map((ln) => {
      const p = String(ln).split(" ");
      return {
        time: p[0].slice(0, 2) + ":" + p[0].slice(2),
        price: num(p[1]),
        volume: num(p[2]),
        amount: num(p[3]),
        avg: null,
      };
    });
    return { name: "", preClose, trends };
  }

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

  /* 指数兜底（腾讯）：secid 东财 -> 腾讯代码 */
  const TX_INDEX_MAP = {
    "1.000001": "sh000001", "0.399001": "sz399001", "0.399006": "sz399006",
    "1.000688": "sh000688", "100.HSI": "hkHSI", "100.NDX": "usNDX",
  };
  async function getIndicesSafe() {
    try {
      return await getIndices();
    } catch (e) {
      const codes = Object.values(TX_INDEX_MAP).join(",");
      const res = await fetch(TX_QT + codes, { headers: { Accept: "*/*" } });
      if (!res.ok) throw new Error("TX HTTP " + res.status);
      const buf = await res.arrayBuffer();
      const text = new TextDecoder("gbk").decode(buf);
      const out = [];
      for (const line of text.split(";")) {
        const m = line.match(/="([^"]+)"/);
        if (!m) continue;
        const p = m[1].split("~");
        if (p.length < 35) continue;
        out.push({
          code: p[2] || "",
          name: p[1] || "",
          price: num(p[3]),
          pct: num(p[32]),
          change: num(p[31]),
          high: num(p[33]),
          low: num(p[34]),
          open: num(p[5]),
          preClose: num(p[4]),
          market: p[0] === "1" ? "1" : p[0] === "51" ? "0" : "100",
        });
      }
      return out;
    }
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

  /* 个股快照（东财优先，失败切腾讯） */
  async function getStockQuoteSafe(secid) {
    try {
      return await getStockQuote(secid);
    } catch (e) {
      const q = await txQuote(secid);
      q.pctYtd = null;
      q.high52w = null;
      q.low52w = null;
      return q;
    }
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
    if (!klines.length) throw new Error("东财K线为空");
    return { code: d.code, name: d.name, preClose: num(d.preKPrice), klines };
  }

  /* K线（东财优先，失败切腾讯） */
  async function getKlineSafe(secid, klt, fqt, count) {
    try {
      return await getKline(secid, klt, fqt, count);
    } catch (e) {
      return await txKline(secid, klt, fqt, count);
    }
  }

  /* ============ 分时 ============ */
  async function getTrend(secid) {
    const url =
      BASE +
      "stock/trends2/get?" +
      `      secid=${secid}&ndays=1&iscr=0&fields1=f1,f2,f3,f4,f5,f6,f7,f8&fields2=f51,f52,f53,f54,f55,f56,f57,f58`;
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
    if (!trends.length) throw new Error("东财分时为空");
    return { name: d.name, preClose: num(d.preClose), trends };
  }

  /* 分时（东财优先，失败切腾讯） */
  async function getTrendSafe(secid) {
    try {
      return await getTrend(secid);
    } catch (e) {
      return await txTrend(secid);
    }
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
    getIndices: getIndicesSafe,
    getStockList,
    getStockQuote: getStockQuoteSafe,
    getKline: getKlineSafe,
    getTrend: getTrendSafe,
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
