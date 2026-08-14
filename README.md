# 📊 股析 · 股票基本面分析

一个基于 CloudStudio 托管的基本面分析网站，专注 **A 股公司基本面数据**（不含行情），覆盖公司概况、财务指标、三大报表与主营构成。

## 在线访问

主站（CloudStudio 永久链接）：
https://09d59cb578634ecebb933d0b98f36a3b.app.workbuddy.link

备用（GitHub Pages）：
https://2297603524.github.io/my-shell-site/

## 功能

- **财务排行**：A股 6800+ 家公司按 归母净利润 / 营业收入 / ROE / 毛利率 / 净利增速 / 营收增速 / 每股收益 排序，支持分页
- **公司概况**：公司全称、行业（申万/证监会）、上市交易所、管理层（董事长/总经理/董秘）、联系方式、注册信息等 19 项
- **财务主要指标**：近 8 期报告的营收、净利、同比增速、ROE、毛利率、净利率、资产负债率、EPS、每股净资产、每股经营现金流
- **三大报表摘要**：资产负债表（总资产/货币资金/存货/负债/权益）、利润表（营收/营业利润/净利/扣非）、现金流量表（经营/投资/筹资）
- **主营构成**：按产品 / 行业 / 地区的收入、占比与毛利率
- **智能搜索**：代码 / 名称 / 拼音搜索（如 `600519`、`茅台`、`GZMT`）

## 项目结构

```
my-shell-site/
├── index.html      # 财务排行首页
├── stock.html      # 个股基本面详情页
├── css/styles.css  # 全局样式（深色金融风）
└── js/
    ├── api.js      # 数据层：东方财富 F10 公开接口封装（CORS 直连）
    ├── index.js    # 首页逻辑
    └── stock.js    # 个股页逻辑
```

## 数据源（东方财富 F10 公开数据）

| 数据 | 报表接口 |
|------|---------|
| 公司概况 | `RPT_F10_BASIC_ORGINFO` |
| 财务主要指标 | `RPT_F10_FINANCE_MAINFINADATA` |
| 业绩排行（A股全市场） | `RPT_LICO_FN_CPD` |
| 主营构成 | `RPT_F10_FN_MAINOP` |
| 资产负债表 | `RPT_DMSK_FN_BALANCE` |
| 利润表 | `RPT_DMSK_FN_INCOME` |
| 现金流量表 | `RPT_DMSK_FN_CASHFLOW` |
| 股票搜索 | `searchapi.eastmoney.com/api/suggest` |

所有接口支持 CORS，纯前端直连，无需后端。数据来自上市公司定期报告（东财 F10 聚合）。

## 本地预览

```bash
python -m http.server 8080
# 或
npx serve .
```

浏览器打开 http://localhost:8080

## 免责声明

基本面数据仅供参考，不构成投资建议。市场有风险，投资需谨慎。
