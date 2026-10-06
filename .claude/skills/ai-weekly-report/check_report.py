"""AI 情報週報格式檢查（ai-weekly-report skill 第 7 步）。

用法：python .claude/skills/ai-weekly-report/check_report.py AI情報週報/YYYYMMDD.md

錯誤（exit 1）：編碼不是 UTF-8 無 BOM／LF、主推條目缺標籤或四欄位、查證欄數量不對、
頂部總覽表或引言數字與實際條數不符、殘留舊式三空格縮排欄位。
警告（不影響 exit code）：標題過長或過短、類別配比低於下限。
"""

import re
import sys
from dataclasses import dataclass, field

FIELDS = ("**新聞內容**", "**為什麼對我們有意義**", "**建議後續**", "**來源**")
VERDICT_LINE = re.compile(r"^> 🔍 \*\*查證\*\*：")
VERDICT_MARK = re.compile(r"✅|⚠️|❌")
OLD_FIELD = re.compile(r"^ {3,}(新聞內容|為什麼對我們有意義|建議後續|來源)[：:]")
TITLE_MIN, TITLE_MAX = 15, 60
# 類別下限比例：(總覽表類別名開頭, 下限)
RATIO_FLOORS = (("GitHub 趨勢", 0.15), ("產業應用", 0.15), ("資安", 0.25))


@dataclass
class Item:
    title: str
    line: int
    category: str
    body: list = field(default_factory=list)


@dataclass
class Result:
    errors: list = field(default_factory=list)
    warnings: list = field(default_factory=list)


def check_bytes(data, res):
    if data.startswith(b"\xef\xbb\xbf"):
        res.errors.append("檔案有 UTF-8 BOM，應為無 BOM")
    if b"\r\n" in data:
        res.errors.append("檔案含 CRLF 行尾，應為 LF")
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError as e:
        res.errors.append(f"不是合法 UTF-8（位置 {e.start}），可能是 cp950 亂碼")
        return None
    if chr(0xFFFD) in text:
        res.errors.append("含替換字元 U+FFFD，內容可能已損壞")
    return text.replace("\r\n", "\n")


def parse_table(lines):
    """頂部總覽表：{類別: 條數}，只讀第一個 ## 之前的表格。"""
    table = {}
    for ln in lines:
        if ln.startswith("## "):
            break
        m = re.match(r"^\|\s*([^|]+?)\s*\|\s*(\d+)\s*\|", ln)
        if m:
            table[m.group(1)] = int(m.group(2))
    return table


def parse_items(lines, categories):
    """回傳主推條目，以及每個主推類別的 ## 標題。

    主推類別 = 標題以總覽表類別名開頭的 ## 區段；其他 ## 區段（其他值得留意、選題…）裡的 ### 不算。
    """
    items, sections = [], {}
    current_cat, current = None, None
    for i, ln in enumerate(lines, 1):
        if ln.startswith("## "):
            name = ln[3:].strip()
            current_cat = next((c for c in categories if name.startswith(c)), None)
            if current_cat:
                sections[current_cat] = name
            current = None
        elif ln.startswith("### ") and current_cat:
            current = Item(ln[4:].strip(), i, current_cat)
            items.append(current)
        elif current is not None:
            current.body.append(ln)
    return items, sections


def verdict_of(line):
    m = VERDICT_MARK.search(line)
    return m.group(0) if m else None


def check_item(item, res):
    where = f"第 {item.line} 行〈{item.title}〉"
    n = len(item.title)
    if n > TITLE_MAX or n < TITLE_MIN:
        res.warnings.append(f"{where}：標題 {n} 字，建議 {TITLE_MIN}–{TITLE_MAX} 字")
    first = next((ln for ln in item.body if ln.strip()), "")
    if not re.match(r"^`[^`]+`\s*$", first):
        res.errors.append(f"{where}：標題下一行應為 `分類標籤`")
    for f in FIELDS:
        if not any(ln.startswith(f) for ln in item.body):
            res.errors.append(f"{where}：缺欄位 {f}")
    verdicts = [ln for ln in item.body if VERDICT_LINE.match(ln)]
    if len(verdicts) != 1:
        res.errors.append(f"{where}：應有 1 個 > 🔍 **查證** 欄，實際 {len(verdicts)} 個")
        return None
    v = verdict_of(verdicts[0])
    if v is None:
        res.errors.append(f"{where}：查證欄沒有 ✅／⚠️／❌ 結論")
    return v


def check_intro(text, items, verdicts, res):
    intro = text.split("\n## ", 1)[0]
    m = re.search(r"\*\*(\d+) 則主推條目\*\*", intro)
    if not m:
        res.errors.append("引言找不到「**K 則主推條目**」")
    elif int(m.group(1)) != len(items):
        res.errors.append(f"引言寫 {m.group(1)} 則主推條目，實際 {len(items)} 則")
    for mark in ("✅", "⚠️", "❌"):
        m = re.search(r"(\d+) 條 " + mark, intro)
        actual = verdicts.count(mark)
        if m and int(m.group(1)) != actual:
            res.errors.append(f"引言寫 {m.group(1)} 條 {mark}，實際 {actual} 條")
        elif not m and actual:
            res.errors.append(f"引言沒寫 {mark} 條數，實際 {actual} 條")


def check(data):
    res = Result()
    text = check_bytes(data, res)
    if text is None:
        return res, []
    lines = text.split("\n")
    for i, ln in enumerate(lines, 1):
        if OLD_FIELD.match(ln):
            res.errors.append(f"第 {i} 行：舊式三空格縮排欄位，改用 template.md 的 **欄位** 段落")
            break
    table = parse_table(lines)
    if not table:
        res.errors.append("找不到頂部「類別／條數／重點」總覽表")
        return res, []
    items, sections = parse_items(lines, list(table))
    if not items:
        res.errors.append("找不到任何主推條目（### 標題需在總覽表列出的 ## 類別底下）")
        return res, items
    verdicts = [check_item(it, res) for it in items]
    for cat, n in table.items():
        actual = sum(1 for it in items if it.category == cat)
        if cat not in sections and n:
            res.errors.append(f"總覽表有「{cat}」{n} 條，但內文沒有對應的 ## 區段")
        elif actual != n:
            res.errors.append(f"總覽表「{cat}」寫 {n} 條，內文實際 {actual} 條")
    check_intro(text, items, verdicts, res)
    total = len(items)
    for prefix, floor in RATIO_FLOORS:
        n = sum(1 for it in items if it.category.startswith(prefix))
        if n < total * floor:
            res.warnings.append(
                f"「{prefix}」{n}/{total} 條，低於下限 {floor:.0%}；"
                "候選不足時要在引言註明「本期 X 類僅 N 條，因……」")
    return res, items


def main(argv):
    if len(argv) != 2:
        print(__doc__.strip().split("\n")[2])
        return 2
    sys.stdout.reconfigure(encoding="utf-8")
    with open(argv[1], "rb") as f:
        res, items = check(f.read())
    for w in res.warnings:
        print("警告：" + w)
    for e in res.errors:
        print("錯誤：" + e)
    status = "不通過" if res.errors else "通過"
    print(f"{status}：主推條目 {len(items)} 則，錯誤 {len(res.errors)}，警告 {len(res.warnings)}")
    return 1 if res.errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
