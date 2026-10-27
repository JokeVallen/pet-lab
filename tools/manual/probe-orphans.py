import json
from pathlib import Path

cfg = json.loads(Path(r"D:/Users/User/pet-lab/js/pet-config.json").read_text(encoding="utf-8"))
anims = cfg["animations"]

used = set()


def walk(node):
    if isinstance(node, dict):
        for v in node.values():
            walk(v)
    elif isinstance(node, list):
        for v in node:
            walk(v)
    elif isinstance(node, str):
        used.add(node)


walk(anims)
# 规则里 act 引用的也算
walk(cfg.get("rules", {}).get("items", []))
walk(cfg.get("zones", []))
walk(cfg.get("zoneReactions", {}))

files = {p.stem for p in Path(r"D:/Users/User/pet-lab/images/pet/anim").glob("*.webm")}
print("片段总数:", len(files))
print("被引用:", len(files & used))
print("未接线:", sorted(files - used))
print("引用了但不存在:", sorted(used - files - {"poster"}))
