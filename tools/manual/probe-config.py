import json
import re
from pathlib import Path

p = Path(r"D:/Download/dsh-pet-main/dsh-pet-main/dsh-pet/assets/config.jsonc")
raw = p.read_text(encoding="utf-8")

# 去掉 // 注释（够用即可）
clean = re.sub(r"^\s*//[^\n]*$", "", raw, flags=re.M)
clean = re.sub(r"\s//[^\n\"]*$", "", clean, flags=re.M)
cfg = json.loads(clean)

print("顶层键 (%d):" % len(cfg))
print("  " + ", ".join(cfg.keys()))

for key in ("categories", "events", "clicks", "idle", "memes", "moves", "animations", "balance", "physics"):
    v = cfg.get(key)
    if isinstance(v, dict):
        print(f"\n{key}: dict, {len(v)} 项")
        for k, sub in list(v.items())[:8]:
            if isinstance(sub, dict):
                print(f"   - {k}: {list(sub.keys())[:6]}")
            elif isinstance(sub, list):
                print(f"   - {k}: [{len(sub)}] {[str(x)[:14] for x in sub[:5]]}")
            else:
                print(f"   - {k}: {str(sub)[:40]}")
    elif isinstance(v, list):
        print(f"\n{key}: list, {len(v)} 项 → {[str(x)[:16] for x in v[:6]]}")
    else:
        print(f"\n{key}: {str(v)[:120]}")

print("\nworkStatusTexts:", json.dumps(cfg.get("workStatusTexts"), ensure_ascii=False)[:300])
