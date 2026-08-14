# -*- coding: utf-8 -*-
"""本地 mock 数据服务器（仅用于 UI 渲染测试，返回与东财 F10 同构的模拟 JSON）"""
import json
import random
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

PORT = 8898

# ============ 模拟数据 ============
def mock_profile():
    return {"version": "mock", "result": {"data": [{
        "SECUCODE": "600519.SH", "SECURITY_CODE": "600519", "SECURITY_NAME_ABBR": "贵州茅台",
        "ORG_NAME": "贵州茅台酒股份有限公司", "ORG_NAME_EN": "Kweichow Moutai Co.,Ltd.",
        "FORMERNAME": "贵州茅台→G茅台", "SECURITY_TYPE": "上交所主板A股",
        "TRADE_MARKET": "上海证券交易所", "EM2016": "食品饮料-饮料-白酒",
        "INDUSTRYCSRC1": "制造业-酒、饮料和精制茶制造业",
        "CHAIRMAN": "陈华", "PRESIDENT": "王莉(代)", "SECRETARY": "余思明", "LEGAL_PERSON": "陈华",
        "INDEDIRECTORS": "盛雷鸣,郭田勇,王鑫", "ORG_TEL": "0851-22386002", "ORG_EMAIL": "mtdm@moutaichina.com",
        "ORG_FAX": "0851-22386193", "ORG_WEB": "www.moutaichina.com",
        "REG_ADDRESS": "贵州省仁怀市茅台镇", "ADDRESS": "贵州省仁怀市茅台镇",
        "REG_CAPITAL": "125619.78万元", "LISTING_DATE": "2001-08-27",
    }]}}

def mock_indicators():
    rows = []
    for i in range(8):
        date = f"2026-03-31" if i == 0 else f"2025-{12-i*3:02d}-31"
        inc = 547.03e8 * (1 - i * 0.05)
        profit = 272.43e8 * (1 - i * 0.04)
        rows.append({
            "REPORT_DATE": date + " 00:00:00", "REPORT_DATE_NAME": f"2026Q{8-i}",
            "EPSJB": round(profit / 12.56e8, 2), "EPSKCJB": round(profit / 12.56e8 * 0.9, 2),
            "BPS": 216.3, "MGJYXJJE": 21.5,
            "TOTALOPERATEREVE": inc, "TOTALOPERATEREVETZ": round(6.3 - i * 0.8, 2),
            "PARENTNETPROFIT": profit, "PARENTNETPROFITTZ": round(1.5 - i * 0.5, 2),
            "KCFJCXSYJLR": profit * 0.9, "ROEJQ": round(10.5 - i * 0.7, 2),
            "ROEKCJQ": round(10 - i * 0.7, 2), "XSMLL": 89.76, "XSJLL": 51.2,
            "ZCFZL": 21.5, "LD": 3.8, "SD": 3.1, "CHZZTS": 1300.5, "YSZKZZTS": 300.2,
            "ZZCZZTS": 0.4, "TOTAL_SHARE": 1256197800, "ROIC": 25.3,
        })
    return {"version": "mock", "result": {"data": rows}}

def mock_finance_list():
    names = [("600519", "贵州茅台"), ("601398", "工商银行"), ("601939", "建设银行"),
             ("600941", "中国移动"), ("601288", "农业银行"), ("601988", "中国银行"),
             ("300750", "宁德时代"), ("601857", "中国石油"), ("600036", "招商银行"),
             ("000858", "五粮液"), ("002594", "比亚迪"), ("600900", "长江电力")]
    rows = []
    for i, (code, name) in enumerate(names):
        rows.append({
            "SECURITY_CODE": code, "SECURITY_NAME_ABBR": name,
            "REPORTDATE": "2026-03-31 00:00:00",
            "TOTAL_OPERATE_INCOME": (1000 - i * 40) * 1e8,
            "YSTZ": round(8 - i * 0.5, 2),
            "PARENT_NETPROFIT": (500 - i * 20) * 1e8,
            "SJLTZ": round(3 - i * 0.3, 2),
            "WEIGHTAVG_ROE": round(12 - i * 0.5, 2),
            "XSMLL": round(50 - i * 2, 2),
            "BASIC_EPS": round(3 - i * 0.15, 2),
            "BPS": 20.5, "MGJYXJJE": 3.2, "PUBLISHNAME": "白酒Ⅱ" if i < 2 else "银行",
        })
    return {"version": "mock", "result": {"count": 6844, "data": rows}}

def mock_mainop():
    rows = []
    for i, item in enumerate(["茅台酒", "系列酒", "其他业务"]):
        rows.append({
            "MAINOP_TYPE": "1", "REPORT_DATE": "2025-12-31 00:00:00",
            "ITEM_NAME": item,
            "MAIN_BUSINESS_INCOME": (1000 - i * 300) * 1e8,
            "MBI_RATIO": round(0.65 - i * 0.2, 4),
            "MAIN_BUSINESS_COST": (100 - i * 20) * 1e8,
            "MAIN_BUSINESS_RPOFIT": (900 - i * 280) * 1e8,
            "GROSS_RPOFIT_RATIO": round(0.91 - i * 0.05, 4),
        })
    for i, item in enumerate(["国内", "国外"]):
        rows.append({
            "MAINOP_TYPE": "3", "REPORT_DATE": "2025-12-31 00:00:00",
            "ITEM_NAME": item,
            "MAIN_BUSINESS_INCOME": (1500 - i * 600) * 1e8,
            "MBI_RATIO": round(0.9 - i * 0.4, 4),
            "MAIN_BUSINESS_COST": (150 - i * 60) * 1e8,
            "MAIN_BUSINESS_RPOFIT": (1350 - i * 540) * 1e8,
            "GROSS_RPOFIT_RATIO": round(0.9 - i * 0.05, 4),
        })
    return {"version": "mock", "result": {"data": rows}}

def mock_balance():
    return {"version": "mock", "result": {"data": [{
        "REPORT_DATE": "2026-03-31 00:00:00",
        "TOTAL_ASSETS": 2900e8, "MONETARYFUNDS": 800e8, "ACCOUNTS_RECE": 5e8,
        "INVENTORY": 400e8, "FIXED_ASSET": 200e8, "TOTAL_LIABILITIES": 600e8,
        "ACCOUNTS_PAYABLE": 30e8, "SHORT_LOAN": 10e8, "TOTAL_EQUITY": 2300e8,
    }]}}

def mock_income():
    return {"version": "mock", "result": {"data": [{
        "REPORT_DATE": "2026-03-31 00:00:00",
        "TOTAL_OPERATE_INCOME": 547e8, "TOTAL_OPERATE_COST": 56e8, "OPERATE_COST": 56e8,
        "OPERATE_PROFIT": 380e8, "TOTAL_PROFIT": 380e8,
        "PARENT_NETPROFIT": 272e8, "DEDUCT_PARENT_NETPROFIT": 272e8,
    }]}}

def mock_cashflow():
    return {"version": "mock", "result": {"data": [{
        "REPORT_DATE": "2026-03-31 00:00:00",
        "NETCASH_OPERATE": 270e8, "NETCASH_INVEST": -30e8, "NETCASH_FINANCE": -80e8,
        "PAY_STAFF_CASH": 40e8,
    }]}}

def mock_search():
    return {"QuotationCodeTable": {"Data": [
        {"Code": "600519", "Name": "贵州茅台", "PinYin": "GZMT", "QuoteID": "1.600519",
         "Classify": "AStock", "SecurityTypeName": "沪A"},
        {"Code": "00700", "Name": "腾讯控股", "PinYin": "TXKG", "QuoteID": "116.00700",
         "Classify": "HKStock", "SecurityTypeName": "港股"},
        {"Code": "AAPL", "Name": "苹果", "PinYin": "AAPL", "QuoteID": "105.AAPL",
         "Classify": "USStock", "SecurityTypeName": "美股"},
    ], "Status": 0, "Message": "成功", "TotalCount": 3}}


def mock_forecast():
    return {"result": {"data": [{
        "SECURITY_CODE": "600519", "SECURITY_NAME_ABBR": "贵州茅台",
        "RATING_ORG_NUM": 44, "RATING_BUY_NUM": 37, "RATING_ADD_NUM": 7,
        "RATING_NEUTRAL_NUM": None, "RATING_REDUCE_NUM": None, "RATING_SALE_NUM": None,
        "YEAR1": 2025, "EPS1": 65.85, "YEAR2": 2026, "EPS2": 68.73,
        "YEAR3": 2027, "EPS3": 72.48, "YEAR4": 2028, "EPS4": 76.04,
        "INDUSTRY_BOARD": "白酒Ⅱ", "DEC_AIMPRICEMAX": 2030, "DEC_AIMPRICEMIN": 1430,
        "RATING_LONG_NUM": 44,
    }]}}


def mock_valuation():
    return {"result": {"data": [{
        "SECURITY_CODE": "600519", "SECURITY_NAME_ABBR": "贵州茅台",
        "CLOSE_PRICE": 1341.99, "PE_TTM": 20.28, "PE_LAR": 20.38, "PB_MRQ": 6.19,
        "PS_TTM": 9.57, "PEG_CAR": -4.89, "TOTAL_SHARES": 1250081601,
        "TOTAL_MARKET_CAP": 1677597007725.99, "CHANGE_RATE": -0.98,
        "TRADE_DATE": "2026-08-14 00:00:00",
    }]}}


def mock_all_forecast():
    rows = []
    names = [("600519", "贵州茅台", "白酒Ⅱ"), ("000858", "五粮液", "白酒Ⅱ"),
             ("000568", "泸州老窖", "白酒Ⅱ"), ("601398", "工商银行", "银行Ⅱ"),
             ("601939", "建设银行", "银行Ⅱ"), ("600941", "中国移动", "通信服务"),
             ("300750", "宁德时代", "电池"), ("002594", "比亚迪", "汽车整车")]
    for i, (code, name, ind) in enumerate(names):
        rows.append({
            "SECURITY_CODE": code, "SECURITY_NAME_ABBR": name, "INDUSTRY_BOARD": ind,
            "RATING_ORG_NUM": 40 - i * 3, "RATING_BUY_NUM": 30 - i * 2, "RATING_ADD_NUM": 8,
            "EPS1": 65 - i, "EPS2": 68 - i, "EPS3": 72 - i, "EPS4": 76 - i,
            "DEC_AIMPRICEMAX": 2000 - i * 100, "DEC_AIMPRICEMIN": 1400 - i * 50,
        })
    return {"result": {"count": 2818, "pages": 1, "data": rows}}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        path = parsed.path
        body = None
        if path.endswith("/dc"):
            report = qs.get("reportName", [""])[0]
            body = {
                "RPT_F10_BASIC_ORGINFO": mock_profile,
                "RPT_F10_FINANCE_MAINFINADATA": mock_indicators,
                "RPT_LICO_FN_CPD": mock_finance_list,
                "RPT_F10_FN_MAINOP": mock_mainop,
                "RPT_DMSK_FN_BALANCE": mock_balance,
                "RPT_DMSK_FN_INCOME": mock_income,
                "RPT_DMSK_FN_CASHFLOW": mock_cashflow,
            }.get(report, lambda: {"result": {"data": []}})()
        elif path.endswith("/dcw"):
            report = qs.get("reportName", [""])[0]
            if report == "RPT_WEB_RESPREDICT":
                sec = qs.get("filter", [""])[0]
                if "SECURITY_CODE" in sec:
                    body = mock_forecast()
                else:
                    body = mock_all_forecast()
            elif report == "RPT_VALUEANALYSIS_DET":
                body = mock_valuation()
            else:
                body = {"result": {"data": []}}
        elif path.endswith("/search"):
            body = mock_search()
        if body is None:
            self.send_response(404)
            self.end_headers()
            return
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        cb = qs.get("cb", [None])[0]
        if cb:
            data = (cb + "(" + data.decode("utf-8") + ")").encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    print(f"Mock server on http://127.0.0.1:{PORT}")
    HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
