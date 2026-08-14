# 📈 股析 · 全网股票行情分析

一个基于 GitHub Pages 的全网股票行情分析网站，覆盖 **A股（沪深京）/ 港股 / 美股** 实时行情、K线、分时、资金流向、行业板块与财务数据。

## 在线访问

主站（CloudStudio 永久链接）：
https://09d59cb578634ecebb933d0b98f36a3b.app.workbuddy.link

备用（GitHub Pages）：
https://2297603524.github.io/my-shell-site/

## 功能

- **市场总览**：上证/深证/创业板/科创50/恒生/纳指100 指数行情
- **涨跌榜单**：涨幅榜 / 跌幅榜 / 成交额榜 / 市值榜 / 换手率榜 / 主力资金榜（A股 / 港股 / 美股切换）
- **行业板块**：板块涨跌、领涨股、上涨/下跌家数
- **个股分析**：实时报价、分时图、日/周/月 K 线（前复权/不复权/后复权，MA5/10/20/60）、近 60 日资金流向、近 8 期财务业绩
- **智能搜索**：代码 / 名称 / 拼音实时搜索（如 `600519`、`茅台`、`GZMT`、`00700`、`AAPL`）

## 项目结构

```
my-shell-site/
├── index.html      # 市场总览首页
├── stock.html      # 个股分析页
├── css/styles.css  # 全局样式（深色金融风）
└── js/
    ├── api.js      # 数据层：东方财富公开接口封装（CORS 直连）
    ├── index.js    # 首页逻辑
    └── stock.js    # 个股页逻辑（ECharts 图表）
```

## 数据源

| 数据 | 接口 |
|------|------|
| A股/港股/美股行情列表 | 东方财富 `push2.eastmoney.com/api/qt/clist` |
| 指数行情 | `push2.eastmoney.com/api/qt/ulist.np` |
| 个股快照 | `push2.eastmoney.com/api/qt/stock/get` |
| 分时数据 | `push2.eastmoney.com/api/qt/stock/trends2` |
| K线（日/周/月） | `push2his.eastmoney.com/api/qt/stock/kline` |
| 资金流向 | `push2.eastmoney.com/api/qt/stock/fflow` |
| 行业/概念板块 | `push2.eastmoney.com/api/qt/clist (m:90)` |
| 财务业绩 | `datacenter.eastmoney.com RPT_LICO_FN_CPD` |
| 股票搜索 | `searchapi.eastmoney.com/api/suggest` |

所有接口均支持 CORS，纯前端直连，无需后端服务器。数据实时性取决于接口刷新频率（交易时段内基本实时）。

## 数据源双保险

| 数据 | 主源（东财） | 备源（腾讯） |
|------|------|------|
| 指数行情 | `push2/ulist.np` | `qt.gtimg.cn/q=` 批量快照 |
| 个股快照 | `push2/stock/get` | `qt.gtimg.cn/q=` |
| 分时数据 | `push2/trends2` | `web.ifzq.gtimg.cn/minute` |
| K线（日/周/月） | `push2his/kline` | `web.ifzq.gtimg.cn/fqkline` |
| 行情列表/板块/资金流/财务 | `push2/clist`、`fflow`、`datacenter` | — |

主源失败自动切换备源（腾讯接口 CORS `*`，兼容性好）；东财接口另有 JSONP 兜底，双重保障跨域取数。

## 本地预览

```bash
python -m http.server 8080
# 或
npx serve .
```

浏览器打开 http://localhost:8080

## 免责声明

行情数据仅供参考，不构成投资建议。市场有风险，投资需谨慎。
