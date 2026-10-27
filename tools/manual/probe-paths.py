# 三条路径各跑一次，数一数 build-config 被调用了几次
import json
import re
import subprocess
import threading
import time
import urllib.request
from pathlib import Path

ROOT = Path(r"D:/Users/User/pet-lab")
BASE = "http://127.0.0.1:8140"
YAML = ROOT / "config" / "pet.yaml"


def post(path, payload):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(BASE + path, data=body, headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=90).read().decode("utf-8"))


def builds_in(log_path):
    text = Path(log_path).read_text(encoding="utf-8", errors="ignore")
    return len(re.findall(r"build-config", text)), text


proc = subprocess.Popen(
    [r"C:\Users\User\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe", "tools/serve.py", "8140"],
    cwd=str(ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
)
time.sleep(3.0)

original = YAML.read_text(encoding="utf-8")
try:
    print("== 1) 编辑器路径：/api/save + /api/build ==")
    before = YAML.read_text(encoding="utf-8")
    post("/api/save", {"path": "config/pet.yaml", "content": before.replace("  blur: 14", "  blur: 16", 1)})
    r = post("/api/build", {})
    print("   build ok:", r["ok"])
    time.sleep(5)   # 越过 quiet 窗口，看看看门狗会不会多编译一次

    print("== 2) 分区 / 规则编辑器路径：/api/patch ==")
    before = YAML.read_text(encoding="utf-8")
    r = post("/api/patch", {"patch": {"shadow": {"blur": 15}}})
    print("   patch ok:", r["ok"])
    time.sleep(5)

    print("== 3) 手改路径：直接写文件 ==")
    before = YAML.read_text(encoding="utf-8")
    YAML.write_text(before.replace("  blur: 15", "  blur: 17", 1), encoding="utf-8")
    time.sleep(3)

    print("\n== 结果 ==")
    print("   config.js 里的 blur:", json.loads((ROOT / "js" / "pet-config.json").read_text(encoding="utf-8"))["shadow"]["blur"])
    backups = sorted((ROOT / "config" / ".backup").glob("pet-*-edit.yaml"))
    print("   手改触发的快照数:", len(backups))
    if backups:
        snap = backups[-1].read_text(encoding="utf-8")
        print("   最新快照 blur:", re.search(r"blur:\s*(\d+)", snap).group(1))
finally:
    YAML.write_text(original, encoding="utf-8")
    time.sleep(0.5)
    post("/api/build", {})
    proc.terminate()
