# -*- coding: utf-8 -*-
"""本地 mock 数据服务器（仅用于 UI 渲染测试，返回与东财同构的模拟 JSON）"""
import json
import re
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs, unquote

PORT = 8898


def secid_of(qs):
    return qs.get("secid", ["1.600519"])[0]


def mock_indices():
    return {"rc": 0, "data": {"total": 6, "diff": [
        {"f2": 3927.18, "f3": 0.87, "f4": 33.72, "f12": "000001", "f14": "上证指数", "f13": "1"},
        {"f2": 14354.31, "f3": 1.42, "f4": 200.85, "f12": "399001", "f14": "深证成指", "f13": "0"},
        {"f2": 3626.30, "f3": 2.11, "f4": 74.90, "f12": "399006", "f14": "创业板指", "f13": "0"},
        {"f2": 1717.68, "f3": 0.05, "f4": -0.85, "f12": "000688", "f14": "科创50", "f13": "1"},
        {"f2": 25120.55, "f3": -0.36, "f4": -90.70, "f12": "HSI", "f14": "恒生指数", "f13": "100"},
        {"f2": 23765.90, "f3": 1.05, "f4": 247.50, "f12": "NDX", "f14": "纳斯达克100", "f13": "100"},
    ]}}


def mock_list():
    rows = [
        {"f2": 40.89, "f3": 29.97, "f4": 9.43, "f5": 523410, "f6": 2134567890.0, "f8": 18.62, "f9": 45.2, "f10": 3.21,
         "f12": "920083", "f13": 0, "f14": "金戈新材", "f15": 42.10, "f16": 33.20, "f17": 34.50, "f18": 31.46,
         "f20": 8200000000.0, "f21": 4100000000.0, "f23": 6.72, "f24": 89.5, "f25": 156.3, "f62": 123456789.0},
        {"f2": 17.33, "f3": 20.01, "f4": 2.89, "f5": 2310000, "f6": 4012345678.0, "f8": 9.45, "f9": 31.8, "f10": 2.05,
         "f12": "300017", "f13": 0, "f14": "网宿科技", "f15": 17.50, "f16": 15.01, "f17": 15.10, "f18": 14.44,
         "f20": 42200000000.0, "f21": 39400000000.0, "f23": 4.12, "f24": 45.6, "f25": 78.2, "f62": 98765432.0},
        {"f2": 53.56, "f3": 20.01, "f4": 8.93, "f5": 112300, "f6": 589123456.0, "f8": 4.86, "f9": 87.3, "f10": 1.88,
         "f12": "688286", "f13": 1, "f14": "敏芯股份", "f15": 53.56, "f16": 46.50, "f17": 47.20, "f18": 44.63,
         "f20": 2990000000.0, "f21": 1830000000.0, "f23": 5.94, "f24": 33.4, "f25": 55.8, "f62": 45678912.0},
        {"f2": 1358.98, "f3": 0.62, "f4": 8.38, "f5": 36147, "f6": 4898665275.0, "f8": 0.29, "f9": 24.5, "f10": 0.85,
         "f12": "600519", "f13": 1, "f14": "贵州茅台", "f15": 1363.35, "f16": 1346.00, "f17": 1355.00, "f18": 1350.60,
         "f20": 1707200000000.0, "f21": 1707200000000.0, "f23": 8.95, "f24": 2.3, "f25": -1.8, "f62": -234567890.0},
        {"f2": 12.34, "f3": -5.21, "f4": -0.68, "f5": 890000, "f6": 1100123456.0, "f8": 4.21, "f9": 28.6, "f10": 1.42,
         "f12": "000001", "f13": 0, "f14": "平安银行", "f15": 13.20, "f16": 12.20, "f17": 13.00, "f18": 13.02,
         "f20": 239400000000.0, "f21": 239400000000.0, "f23": 0.62, "f24": -8.4, "f25": -12.6, "f62": -345678901.0},
    ]
    return {"rc": 0, "data": {"total": 5896, "diff": rows}}


def mock_quote():
    return {"rc": 0, "data": {
        "f43": 1358.98, "f44": 1363.35, "f45": 1346.00, "f46": 1355.00,
        "f47": 36147, "f48": 4898665275.0, "f50": 1358.98, "f51": 0, "f52": 0,
        "f57": "600519", "f58": "贵州茅台", "f60": 1350.60,
        "f116": 1707200000000.0, "f117": 1707200000000.0,
        "f162": 24.53, "f167": 8.95, "f168": 0.29, "f169": 8.38, "f170": 0.62,
        "f171": -1.8, "f174": 1525.50, "f175": 1245.83, "f292": 0, "f164": 3.5,
    }}


def mock_kline():
    klines = []
    price = 1200.0
    for i in range(120):
        import random
        random.seed(i)
        chg = random.uniform(-2.5, 2.5)
        open_p = price
        close_p = round(price * (1 + chg / 100), 2)
        high = round(max(open_p, close_p) * (1 + random.uniform(0, 1.2) / 100), 2)
        low = round(min(open_p, close_p) * (1 - random.uniform(0, 1.2) / 100), 2)
        vol = int(random.uniform(20000, 60000))
        amount = round(vol * close_p * 100, 2)
        pct = round((close_p - price) / price * 100, 2)
        chg_v = round(close_p - price, 2)
        turnover = round(random.uniform(0.2, 1.0), 2)
        d = f"2026-{5 + i // 30:02d}-{1 + i % 28:02d}"
        klines.append(f"{d},{open_p},{close_p},{high},{low},{vol},{amount},1.5,{pct},{chg_v},{turnover}")
        price = close_p
    return {"rc": 0, "data": {"code": "600519", "name": "贵州茅台", "decimal": 2, "preKPrice": 1350.6, "klines": klines}}


def mock_trend():
    trends = []
    for i in range(241):
        t = 9 * 60 + 30 + i
        hh, mm = t // 60, t % 60
        if hh >= 11 and hh < 13:
            hh, mm = 13, mm if hh == 13 else 0
        price = round(1350 + i * 0.05, 2)
        vol = int((i % 30 + 1) * 300)
        amount = round(vol * price * 100, 2)
        trends.append(f"2026-08-14 {hh:02d}:{mm:02d},{price},{price},{price},{price},{vol},{amount},{round(1352 + i * 0.02, 2)}")
    return {"rc": 0, "data": {"code": "600519", "market": 1, "name": "贵州茅台", "preClose": 1355.29, "trends": trends}}


def mock_flow():
    klines = []
    for i in range(60):
        d = f"2026-{5 + i // 30:02d}-{1 + i % 28:02d}"
        import random
        random.seed(100 + i)
        main = random.uniform(-2e8, 3e8)
        super_v = main * random.uniform(0.3, 0.6)
        big = main * random.uniform(0.2, 0.4)
        mid = -main * random.uniform(0.1, 0.3)
        small = -main * random.uniform(0.3, 0.5)
        pct = main / 1e9 * 2
        klines.append(f"{d},{main:.2f},{small:.2f},{mid:.2f},{big:.2f},{super_v:.2f},{pct:.2f},0,0,0,0")
    return {"rc": 0, "data": {"code": "600519", "name": "贵州茅台", "klines": klines}}


def mock_sectors():
    rows = [
        {"f2": 10383.28, "f3": 5.82, "f4": 570.82, "f5": 0, "f6": 45678901234.0, "f8": 3.2,
         "f12": "BK1626", "f13": 90, "f14": "稀土", "f20": 0, "f104": 45, "f105": 3, "f128": "北方稀土", "f140": 9.87},
        {"f2": 24355.33, "f3": 5.33, "f4": 1231.92, "f5": 0, "f6": 38765432109.0, "f8": 4.1,
         "f12": "BK1592", "f13": 90, "f14": "通信线缆及配套", "f20": 0, "f104": 22, "f105": 1, "f128": "中天科技", "f140": 10.02},
        {"f2": 18508.82, "f3": 4.44, "f4": 787.34, "f5": 0, "f6": 29876543210.0, "f8": 2.8,
         "f12": "BK1409", "f13": 90, "f14": "半导体", "f20": 0, "f104": 89, "f105": 12, "f128": "中芯国际", "f140": 8.56},
        {"f2": 7736.89, "f3": 2.06, "f4": 156.12, "f5": 0, "f6": 12345678901.0, "f8": 1.9,
         "f12": "BK1215", "f13": 90, "f14": "通信", "f20": 0, "f104": 56, "f105": 8, "f128": "中兴通讯", "f140": 6.23},
    ]
    return {"rc": 0, "data": {"total": 496, "diff": rows}}


def mock_finance():
    rows = []
    for i, (date, inc, profit) in enumerate([
        ("2026-03-31", 54702912385.23, 27242512886.45),
        ("2025-12-31", 174139000000.0, 86228000000.0),
        ("2025-09-30", 123122456789.0, 60828000000.0),
        ("2025-06-30", 81908000000.0, 41696000000.0),
        ("2025-03-31", 45776901234.0, 20584000000.0),
        ("2024-12-31", 174144000000.0, 85715000000.0),
        ("2024-09-30", 123073000000.0, 60848000000.0),
        ("2024-06-30", 81931000000.0, 41670000000.0),
    ]):
        rows.append({
            "SECURITY_CODE": "600519", "SECURITY_NAME_ABBR": "贵州茅台",
            "REPORTDATE": date + " 00:00:00", "BASIC_EPS": round(profit / 1e8 / 12.56, 2),
            "TOTAL_OPERATE_INCOME": inc, "PARENT_NETPROFIT": profit,
            "WEIGHTAVG_ROE": round(10.5 - i * 0.8, 2), "YSTZ": round(6.3 - i, 2),
            "SJLTZ": round(1.5 - i * 0.5, 2), "BPS": 216.3, "MGJYXJJE": 21.5,
            "XSMLL": 89.76, "PUBLISHNAME": "白酒Ⅱ",
        })
    return {"version": "mock", "result": {"pages": 102, "data": rows}}


def mock_search():
    return {"QuotationCodeTable": {"Data": [
        {"Code": "600519", "Name": "贵州茅台", "PinYin": "GZMT", "ID": "6005191", "QuoteID": "1.600519",
         "Classify": "AStock", "SecurityTypeName": "沪A", "MarketType": "1", "MktNum": "1"},
        {"Code": "00700", "Name": "腾讯控股", "PinYin": "TXKG", "ID": "007001", "QuoteID": "116.00700",
         "Classify": "HKStock", "SecurityTypeName": "港股", "MarketType": "128", "MktNum": "128"},
        {"Code": "AAPL", "Name": "苹果", "PinYin": "AAPL", "ID": "AAPL1", "QuoteID": "105.AAPL",
         "Classify": "USStock", "SecurityTypeName": "美股", "MarketType": "105", "MktNum": "105"},
    ], "Status": 0, "Message": "成功", "TotalCount": 3}}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        path = parsed.path
        body = None
        if path.endswith("/qt/ulist.np/get") or "ulist.np" in path:
            body = mock_indices()
        elif "fflow/kline/get" in path:
            body = mock_flow()
        elif "clist/get" in path:
            body = mock_sectors() if "m:90" in unquote(parsed.query) else mock_list()
        elif "stock/get" in path:
            body = mock_quote()
        elif "kline/get" in path:
            body = mock_kline()
        elif "trends2/get" in path:
            body = mock_trend()
        elif path.endswith("/dc"):
            body = mock_finance()
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
