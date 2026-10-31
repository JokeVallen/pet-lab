import pathlib

ROOT = pathlib.Path(r"D:/Users/user/pet-lab")
PAGES = ["config-editor.html", "zone-editor.html", "rules-editor.html", "copy-editor.html"]

for name in PAGES:
    p = ROOT / name
    t = p.read_text(encoding="utf-8")

    # 在提示条文本后追加探测详情
    marker = "    d.textContent = T('"
    i = t.find(marker)
    if i < 0:
        print(name, "!! 未找到提示条")
        continue

    # 找到该语句结尾的 ";"
    j = t.find(";\n", i)
    if j < 0:
        print(name, "!! 语句未闭合")
        continue

    stmt = t[i:j + 1]
    if "SERVER_WHY" in stmt:
        print(name, "已含详情")
        continue

    new_stmt = stmt[:-1] + " + (SERVER_WHY ? ' (' + SERVER_WHY + ')' : '');\n"
    t = t[:i] + new_stmt + t[j + 1:]
    p.write_text(t, encoding="utf-8")
    print(name, "提示条已带探测详情")
