import pathlib
import re

p = pathlib.Path(r"D:/Users/user/pet-lab/assets/i18n.js")
t = p.read_text(encoding="utf-8")

FULL_ZH = ('它在对话里怎么称呼自己，以及状态存在哪个键下面。'
           '她说的话不在这一页，去 <a href="copy-editor.html">文案编辑</a>；'
           '那边的每一条都支持 {pet} 等占位符（名字、时间、标题、标签……），改名字会自动跟着变。')

FULL_EN = ('How it refers to itself in chat, and which key its state lives under. '
           'What it says is not on this page — go to <a href="copy-editor.html">Copy editor</a>; '
           'every line there supports placeholders such as {pet} (name, time, title, tags…), '
           'so renaming updates them automatically.')

if FULL_ZH in t:
    print("already present")
else:
    # 在 TERMS 开头的已知锚点前插入
    anchor = "        '气泡和对话里的自称'"
    i = t.find(anchor)
    assert i > 0, "anchor missing"
    esc = lambda s: s.replace("\\", "\\\\").replace("'", "\\'")
    line = "        '" + esc(FULL_ZH) + "': '" + esc(FULL_EN) + "',\n"
    t = t[:i] + line + t[i:]
    p.write_text(t, encoding="utf-8")
    print("added full sentence")
