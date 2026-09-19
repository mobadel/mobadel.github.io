#!/usr/bin/env python3
"""گرفتن دادهٔ سرچ کنسول تبدکس و ذخیرهٔ آن در یک فایل JSON.

کلید سرویس‌اکانت هیچ‌وقت داخل مخزن نمی‌آید؛ مسیرش از متغیر محیطی
GSC_KEY یا سوییچ --key خوانده می‌شود. سرویس‌اکانت باید در سرچ کنسول
روی property دسترسی داشته باشد، وگرنه گوگل ۴۰۳ می‌دهد.

    pip install google-auth google-api-python-client
    GSC_KEY=~/gsc-key.json python3 scripts/gsc/pull.py -o gsc.json

خروجی را scripts/gsc/report.py می‌خواند.
"""

import argparse
import datetime as dt
import json
import os
import sys

from google.oauth2 import service_account
from googleapiclient.discovery import build

# property از نوع Domain است، نه URL-prefix. نسخهٔ URL-prefix
# (https://tabdex.ir/) دسترسی جدا می‌خواهد و ساب‌دامین‌ها را هم نمی‌گیرد.
SITE = "sc-domain:tabdex.ir"
SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"
DIMENSIONS = ["query", "page", "device", "country"]
PAGE_SIZE = 25000


def service(key_path):
    credentials = service_account.Credentials.from_service_account_file(key_path, scopes=[SCOPE])
    return build("searchconsole", "v1", credentials=credentials, cache_discovery=False)


def query(api, start, end, dimensions):
    """یک گزارش کامل را صفحه‌به‌صفحه می‌گیرد.

    گوگل حداکثر ۲۵۰۰۰ ردیف در هر درخواست می‌دهد؛ بدون این حلقه
    گزارش بی‌صدا سر ۲۵۰۰۰ قطع می‌شود و آمار ناقص به نظر درست می‌آید.
    """
    rows = []
    start_row = 0
    while True:
        response = api.searchanalytics().query(siteUrl=SITE, body={
            "startDate": start,
            "endDate": end,
            "dimensions": dimensions,
            "rowLimit": PAGE_SIZE,
            "startRow": start_row,
            # dataState پیش‌فرض داده‌های ناتمام دو روز آخر را هم می‌دهد
            # که افت جعلی در انتهای نمودار می‌سازد.
            "dataState": "final"
        }).execute()
        batch = response.get("rows", [])
        rows += batch
        if len(batch) < PAGE_SIZE:
            return rows
        start_row += PAGE_SIZE


def flatten(rows):
    return [{"k": r["keys"][0], "c": r["clicks"], "i": r["impressions"],
             "ctr": r["ctr"], "p": r["position"]} for r in rows]


def main():
    parser = argparse.ArgumentParser(description="دریافت دادهٔ سرچ کنسول تبدکس")
    parser.add_argument("--key", default=os.environ.get("GSC_KEY"), help="مسیر فایل JSON سرویس‌اکانت (یا متغیر GSC_KEY)")
    parser.add_argument("--days", type=int, default=28, help="طول بازه از آخرین روز دارای داده")
    parser.add_argument("-o", "--out", default="gsc.json", help="فایل خروجی")
    args = parser.parse_args()

    if not args.key:
        parser.error("کلید سرویس‌اکانت داده نشده؛ GSC_KEY را ست کنید یا --key بدهید.")

    api = service(args.key)

    # بازهٔ واقعی دادهٔ property از پیش معلوم نیست: پراپرتی ممکن است تازه
    # ساخته شده باشد و خواستن ۲۸ روز از آن گزارش خالی بدهد.
    today = dt.date.today()
    daily = query(api, (today - dt.timedelta(days=480)).isoformat(), today.isoformat(), ["date"])
    if not daily:
        sys.exit("هیچ داده‌ای برنگشت؛ دسترسی سرویس‌اکانت به property را بررسی کنید.")

    dates = sorted(r["keys"][0] for r in daily)
    end = dt.date.fromisoformat(dates[-1])
    start = max(dt.date.fromisoformat(dates[0]), end - dt.timedelta(days=args.days - 1))

    out = {
        "site": SITE,
        "range": [start.isoformat(), end.isoformat()],
        "available": [dates[0], dates[-1]],
        "daily": [{"d": r["keys"][0], "c": r["clicks"], "i": r["impressions"],
                   "ctr": r["ctr"], "p": r["position"]} for r in daily
                  if start.isoformat() <= r["keys"][0] <= end.isoformat()],
    }
    for dimension in DIMENSIONS:
        out[dimension] = flatten(query(api, start.isoformat(), end.isoformat(), [dimension]))

    with open(args.out, "w", encoding="utf-8") as handle:
        json.dump(out, handle, ensure_ascii=False)

    print(f"بازهٔ موجود: {dates[0]} تا {dates[-1]} ({len(dates)} روز)")
    print(f"گزارش {start} تا {end} در {args.out} ذخیره شد "
          f"({len(out['query'])} کوئری، {len(out['page'])} صفحه).")


if __name__ == "__main__":
    main()
