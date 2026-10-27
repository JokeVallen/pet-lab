import re, pathlib

p = pathlib.Path(r"D:/Users/User/pet-lab/js/pet/index.js")
text = p.read_text(encoding="utf-8")
lines = text.split("\n")

persona = re.compile(r"大肥鱼|鲸|鱼|米饭|投喂")
hits = [(i + 1, l.strip()) for i, l in enumerate(lines) if persona.search(l)]
strings = [h for h in hits if re.search(r"['\"`][^'\"`]*(大肥鱼|鲸|鱼|米饭|投喂)[^'\"`]*['\"`]", h[1])]

print("总行数:", len(lines))
print("带人设字样的行:", len(hits))
print("其中字符串字面量:", len(strings))
print("--- 前 12 条 ---")
for n, l in strings[:12]:
    print(n, l[:110])

# 结构：哪些是"文案"，哪些是"逻辑"
logic = [h for h in hits if not re.search(r"['\"`]", h[1])]
print("非字符串（注释/逻辑）:", len(logic))

cfg = pathlib.Path(r"D:/Users/User/pet-lab/config/pet.yaml").read_text(encoding="utf-8")
keys = re.findall(r"^([a-zA-Z][\w]*):", cfg, re.M)
print("config 顶层键:", ", ".join(dict.fromkeys(keys)))
