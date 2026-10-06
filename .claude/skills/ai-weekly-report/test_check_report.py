"""check_report.py 的測試：python -m unittest .claude/skills/ai-weekly-report/test_check_report.py"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from check_report import check  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))


def item(title, verdict="✅ 確認屬實。", tag="`主推工具動態`"):
    return f"""### {title}

{tag}

**新聞內容**

內容。

**為什麼對我們有意義**

意義。

**建議後續**

後續。

**來源**：官方（ai_news 9/1）

> 🔍 **查證**：{verdict}

---
"""


def report(cats=None, intro=None, extra=""):
    """cats: [(類別名, [條目 md…])]；預設 4 類各 1 條、全 ✅。"""
    if cats is None:
        cats = [
            ("主推工具動態與成本", [item("Claude Code 週用量上限生效，名為加碼實為縮減")]),
            ("資安事件與漏洞", [item("GitSpawn：七款 coding agent 開專案即中毒")]),
            ("GitHub 趨勢", [item("Strix 破六萬星：開源自動滲透測試 agent")]),
            ("產業應用（美術／企劃／營運／QA）", [item("Roblox RDC 2026：Build 與 Scene Generator")]),
        ]
    n = sum(len(c[1]) for c in cats)
    if intro is None:
        intro = f"> 依選題標準挑出 **{n} 則主推條目**：**{n} 條 ✅**。"
    rows = "\n".join(f"| {name.split('（')[0]} | {len(its)} | … |" for name, its in cats)
    body = "\n".join(f"## {name}\n\n" + "\n".join(its) for name, its in cats)
    return (f"# AI 情報週報 2026-10-06\n\n{intro}\n\n| 類別 | 條數 | 重點 |\n|---|---|---|\n"
            f"{rows}\n\n{body}\n{extra}")


def run(md):
    data = md.encode("utf-8") if isinstance(md, str) else md
    res, items = check(data)
    return res, items


class CheckReportTest(unittest.TestCase):
    def assertError(self, md, needle):
        res, _ = run(md)
        self.assertTrue(any(needle in e for e in res.errors), res.errors)

    def test_valid_report_passes(self):
        res, items = run(report())
        self.assertEqual(res.errors, [])
        self.assertEqual(res.warnings, [])
        self.assertEqual(len(items), 4)

    def test_bom(self):
        self.assertError(b"\xef\xbb\xbf" + report().encode("utf-8"), "BOM")

    def test_crlf(self):
        self.assertError(report().replace("\n", "\r\n"), "CRLF")

    def test_cp950_bytes(self):
        self.assertError(report().encode("cp950", errors="replace"), "不是合法 UTF-8")

    def test_replacement_char(self):
        self.assertError(report().replace("內容。", "內" + chr(0xFFFD) + "容。", 1), "U+FFFD")

    def test_missing_field(self):
        self.assertError(report().replace("**建議後續**", "建議後續", 1), "缺欄位 **建議後續**")

    def test_missing_tag(self):
        self.assertError(report().replace("`主推工具動態`", "主推工具動態", 1), "分類標籤")

    def test_missing_verdict_line(self):
        self.assertError(report().replace("> 🔍 **查證**：", "查證：", 1), "實際 0 個")

    def test_verdict_without_mark(self):
        md = report().replace("> 🔍 **查證**：✅ 確認屬實。", "> 🔍 **查證**：待查。", 1)
        self.assertError(md, "沒有 ✅／⚠️／❌")

    def test_table_count_mismatch(self):
        self.assertError(report().replace("| GitHub 趨勢 | 1 |", "| GitHub 趨勢 | 3 |"),
                         "「GitHub 趨勢」寫 3 條，內文實際 1 條")

    def test_table_category_without_section(self):
        md = report().replace("| GitHub 趨勢 | 1 |", "| GitHub 趨勢 | 1 |\n| 法規合規 | 1 |")
        self.assertError(md, "沒有對應的 ## 區段")

    def test_intro_item_count_mismatch(self):
        self.assertError(report(intro="> 挑出 **5 則主推條目**：**4 條 ✅**。"), "引言寫 5 則")

    def test_intro_verdict_count_mismatch(self):
        cats = [("主推工具動態與成本", [item("Claude Code 週用量上限生效，名為加碼實為縮減"),
                                        item("GPT-6 Astra 發布：首個觸發網路安全門檻的模型",
                                             verdict="⚠️ 大致屬實，1 處已訂正。")])]
        self.assertError(report(cats, intro="> 挑出 **2 則主推條目**：**2 條 ✅**。"), "引言寫 2 條 ✅，實際 1 條")
        self.assertError(report(cats, intro="> 挑出 **2 則主推條目**：**1 條 ✅**。"), "引言沒寫 ⚠️ 條數")
        res, _ = run(report(cats, intro="> 挑出 **2 則主推條目**：**1 條 ✅、1 條 ⚠️**。"))
        self.assertEqual([e for e in res.errors if "引言" in e], [])

    def test_old_indented_format(self):
        self.assertError(report(extra="\n1. 舊條目\n   新聞內容：……\n"), "舊式三空格縮排")

    def test_other_section_not_counted(self):
        extra = "\n## 其他值得留意（未列為主推條目）\n\n### 成本情報\n- **9/1** 一句話。\n"
        res, items = run(report(extra=extra))
        self.assertEqual(res.errors, [])
        self.assertEqual(len(items), 4)

    def test_title_length_warning(self):
        res, _ = run(report().replace("Strix 破六萬星：開源自動滲透測試 agent", "Strix 破星", 1))
        self.assertTrue(any("標題 8 字" in w for w in res.warnings), res.warnings)
        self.assertEqual(res.errors, [])

    def test_ratio_warning(self):
        cats = [("主推工具動態與成本", [item(f"Claude Code 第 {i} 則更新：沙箱、防護、回歸一次看") for i in range(6)]),
                ("資安事件與漏洞", [item("GitSpawn：七款 coding agent 開專案即中毒")]),
                ("GitHub 趨勢", [item("Strix 破六萬星：開源自動滲透測試 agent")])]
        res, _ = run(report(cats))
        self.assertEqual(res.errors, [])
        msgs = " ".join(res.warnings)
        self.assertIn("「GitHub 趨勢」1/8", msgs)
        self.assertIn("「產業應用」0/8", msgs)
        self.assertIn("「資安」1/8", msgs)

    def test_real_report_20260916_passes(self):
        path = os.path.join(ROOT, "AI情報週報", "20260916.md")
        if not os.path.exists(path):
            self.skipTest("找不到 20260916.md")
        with open(path, "rb") as f:
            res, items = check(f.read())
        self.assertEqual(res.errors, [])
        self.assertEqual(len(items), 29)


if __name__ == "__main__":
    unittest.main()
