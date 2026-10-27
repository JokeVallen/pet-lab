import json
import urllib.request

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "pet-lab-probe"})
    return urllib.request.urlopen(req, timeout=30).read()

tree = json.loads(get("https://api.github.com/repos/PC2005-cloud/dsh-pet/git/trees/fdd5d64d67b8579978eff599d3eb038ad3156f0b"))["tree"]
names = [t["path"] for t in tree if t["type"] == "blob"]
total = sum(t["size"] for t in tree if t["type"] == "blob")

print("upstream webm count:", len(names))
print("upstream webm total MB:", round(total / 1048576, 1))

groups = {}
for n in names:
    if "-" in n:
        key = n.split("-")[0]
    elif "、" in n:
        key = n.split("、")[0]
    else:
        key = "其他"
    groups.setdefault(key, []).append(n[:-5])

for k, v in sorted(groups.items(), key=lambda x: -len(x[1])):
    print(f"  {k}: {len(v)}")

cfg = get("https://raw.githubusercontent.com/PC2005-cloud/dsh-pet/main/dsh-pet/assets/config.jsonc").decode("utf-8")
print("\nconfig.jsonc length:", len(cfg))
import re
# 顶层键
top = re.findall(r'^\s{0,4}"?([A-Za-z_][A-Za-z0-9_]*)"?\s*:', cfg, re.M)
print("top-level-ish keys (first 40):", sorted(set(top))[:40])
