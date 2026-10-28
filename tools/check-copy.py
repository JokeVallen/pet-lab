#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""check-copy.py —— 找出 js/pet 里还写死的中文文案

代码与内容分离之后，"给访客看的字"应该只在 js/pet/content/*.js 里。
这个脚本扫一遍其它文件，把可疑的字符串字面量列出来（注释不算）。

用法：
    python tools/check-copy.py

已知豁免（白名单，写死在 ALLOW 里）：
  · console.warn / throw new Error —— 给开发者看的，不进界面
  · modules/rules.js 的 label —— 是 i18n 的键（编辑器里用 T(label) 翻）
  · CONFIG 里的默认 name —— 兜底的 profile 名，真实值来自 pet.yaml / content
"""
import pathlib
import re
import sys

QUOTES = "'\"`"
ROOT = pathlib.Path(__file__).resolve().parent.parent
PET = ROOT / "js" / "pet"

ALLOW = {
    "core.js": ["throw new Error("],
    "index.js": ["console.warn(", "name: '大肥鱼'"],
    "adapter.js": ["console.warn("],
    "modules/player.js": ["console.warn("],
    "modules/rules.js": ["label:", "legacyLabel:"],
}


def strip_comment(line):
    out, i, q = [], 0, None
    while i < len(line):
        ch = line[i]
        if q:
            if ch == "\\":
                out.append(ch)
                i += 1
                if i < len(line):
                    out.append(line[i])
                    i += 1
                continue
            if ch == q:
                q = None
            out.append(ch)
            i += 1
            continue
        if ch in QUOTES:
            q = ch
            out.append(ch)
            i += 1
            continue
        if ch == "/" and i + 1 < len(line) and line[i + 1] == "/":
            break
        if ch == "/" and i + 1 < len(line) and line[i + 1] == "*":
            end = line.find("*/", i + 2)
            if end < 0:
                break            # 行内块注释没闭合，后面的都算注释
            i = end + 2
            continue
        out.append(ch)
        i += 1
    return "".join(out)


def scan():
    hits = []
    for f in sorted(PET.rglob("*.js")):
        rel = f.relative_to(PET).as_posix()
        if rel.startswith("content/") or rel == "config.js":
            continue
        allow = ALLOW.get(rel, [])
        in_block = False
        for i, line in enumerate(f.read_text(encoding="utf-8").split("\n"), 1):
            s = line.strip()
            if in_block:
                if "*/" in s:
                    in_block = False
                continue
            if s.startswith("/*"):
                if "*/" not in s:
                    in_block = True
                continue
            code = strip_comment(line)
            if not re.search(r"['\"`][^'\"`]*[\u4e00-\u9fa5]", code):
                continue
            if any(a in code for a in allow):
                continue
            hits.append((rel, i, code.strip()))
    return hits


def main():
    hits = scan()
    if not hits:
        print("OK js/pet 里没有写死的中文文案（content/ 除外）")
        return 0
    print("FAIL 这些行还写死了中文，应该搬到 js/pet/content/<lang>.js：")
    for rel, i, code in hits:
        print("  %s:%d  %s" % (rel, i, code[:100]))
    return 1


if __name__ == "__main__":
    sys.exit(main())
