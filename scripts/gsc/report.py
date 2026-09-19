#!/usr/bin/env python3
"""تحلیل خروجی scripts/gsc/pull.py.

    python3 scripts/gsc/report.py gsc.json

چهار چیزی را نشان می‌دهد که در بررسی شهریور ۱۴۰۵ به کار آمد:
خلاصهٔ بازه، کوئری‌های لب مرز صفحهٔ اول، صفحه‌هایی که نمایش می‌گیرند
ولی کلیک نه، و آدرس‌های قدیمی‌ای که باید ریدایرکت شده باشند.
"""

import argparse
import json
import re

# آدرس‌های قبل از مهاجرت به /convert/. .htaccess این‌ها را ۳۰۱ می‌کند،
# پس هر نمایشی روی آن‌ها یعنی گوگل هنوز نسخهٔ قدیمی را در ایندکس دارد.
LEGACY = re.compile(r"^https://tabdex\.ir/[a-z0-9]+-to-[a-z0-9]+/?$")


def line(row, label=None):
    return (f"  clicks={row['c']:>4}  impr={row['i']:>6}  ctr={row['ctr'] * 100:5.2f}%  "
            f"pos={row['p']:5.1f}  {label or row['k']}")


def totals(rows):
    clicks = sum(r["c"] for r in rows)
    impressions = sum(r["i"] for r in rows)
    return clicks, impressions


def section(title):
    print(f"\n=== {title} ===")


def main():
    parser = argparse.ArgumentParser(description="تحلیل دادهٔ سرچ کنسول")
    parser.add_argument("data", nargs="?", default="gsc.json")
    parser.add_argument("-n", "--top", type=int, default=20)
    args = parser.parse_args()

    with open(args.data, encoding="utf-8") as handle:
        data = json.load(handle)

    daily = sorted(data["daily"], key=lambda r: r["d"])
    clicks, impressions = totals(daily)
    section(f"خلاصه {data['range'][0]} تا {data['range'][1]} ({len(daily)} روز)")
    position = sum(r["p"] * r["i"] for r in daily) / impressions if impressions else 0
    print(f"  کلیک {clicks} · نمایش {impressions} · CTR {clicks / impressions * 100:.2f}% · "
          f"میانگین رتبه {position:.1f}" if impressions else "  داده‌ای نیست")

    section(f"{args.top} کوئری برتر")
    for row in sorted(data["query"], key=lambda r: -r["c"])[:args.top]:
        print(line(row))

    # رتبهٔ ۷ تا ۱۳ یعنی گوگل صفحه را مرتبط می‌داند ولی پایین صفحهٔ اول
    # نگهش داشته؛ یک پله جابه‌جایی اینجا بیشترین اثر را روی کلیک دارد.
    section("لب مرز صفحهٔ اول (رتبه ۷ تا ۱۳)")
    close = [r for r in data["query"] if 7 <= r["p"] <= 13 and r["i"] >= 40]
    for row in sorted(close, key=lambda r: -r["i"])[:args.top]:
        print(line(row))
    if not close:
        print("  موردی نیست")

    section("نمایش زیاد، کلیک صفر")
    dead = [r for r in data["page"] if r["c"] == 0 and r["i"] >= 100]
    for row in sorted(dead, key=lambda r: -r["i"])[:args.top]:
        print(line(row))
    if not dead:
        print("  موردی نیست")

    section("آدرس‌های قدیمی که هنوز ایندکس‌اند")
    legacy = [r for r in data["page"] if LEGACY.match(r["k"])]
    if legacy:
        legacy_clicks, legacy_impressions = totals(legacy)
        print(f"  {len(legacy)} آدرس · {legacy_clicks} کلیک · {legacy_impressions} نمایش")
        print("  اگر این عدد بعد از چند هفته صفر نشد، ریدایرکت یا سایت‌مپ ریدایرکت‌ها را بررسی کنید.")
        for row in sorted(legacy, key=lambda r: -r["i"])[:args.top]:
            print(line(row))
    else:
        print("  هیچ آدرس قدیمی‌ای باقی نمانده؛ سایت‌مپ ریدایرکت‌ها دیگر لازم نیست.")


if __name__ == "__main__":
    main()
