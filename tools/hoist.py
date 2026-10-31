import pathlib
import re

ROOT = pathlib.Path(r"D:/Users/user/pet-lab")

PAGES = [
    "config-editor.html",
    "zone-editor.html",
    "rules-editor.html",
    "copy-editor.html",
    "demo.html",
    "tests.html",
    "docs.html",
]

DECL = "const T = (x) => (window.PetI18n ? PetI18n.t(x) : x);"

for name in PAGES:
    p = ROOT / name
    t = p.read_text(encoding="utf-8")

    # demo/tests/docs 没有 T，补一条；其余把已有声明搬到脚本开头
    has = re.search(r"^[ \t]*const T = [^\n]*$", t, re.M)
    if has:
        decl_line = has.group(0)
        t = t.replace(has.group(0) + "\n", "", 1)
    else:
        decl_line = "    " + DECL

    # 找第一个 <script> 无 src 的开标签
    m = re.search(r"<script(?![^>]*\bsrc=)[^>]*>\n", t)
    if not m:
        print(name, "找不到内联脚本")
        continue

    insert_at = m.end()
    # 跳过紧随其后的空行与开头的块注释，尽量插在真正的代码前
    t = t[:insert_at] + decl_line + "\n" + t[insert_at:]
    p.write_text(t, encoding="utf-8")
    print(name, "已把 T 提到脚本开头")
