"""本地开发服务器：静态文件 + 保存配置 + 自动编译 + 改动监视。

只监听 127.0.0.1，写操作限定在 config/*.yaml。
"""
import json
import os
import re
import shutil
import sys
import threading
import time
import subprocess
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PORT = 8080
ALLOWED_DIR = (ROOT / "config").resolve()
CONFIG_FILE = ROOT / "config" / "pet.yaml"

BACKUP_DIR = ROOT / "config" / ".backup"
BACKUP_KEEP = 20

# mtime: 最近一次成功编译对应的 pet.yaml 修改时间
# quiet_until: 刚有 API 写入时，看门狗先别插手（那一刻通常紧跟着一次显式编译）
# rev: 任何被监视文件变化时 +1，演示页据此判断要不要重载
STATE = {"mtime": 0.0, "quiet_until": 0.0, "rev": 0}
BUILD_LOCK = threading.Lock()

# 监视范围：配置文件 + 样式 + 宠物模块
WATCH_DIRS = [ROOT / "css", ROOT / "js" / "pet"]
WATCH_FILES = [CONFIG_FILE]
# 编译产物不监视，否则「编译 → 发现变化 → 再编译」会死循环
WATCH_IGNORE = {
    (ROOT / "js" / "pet" / "config.js").resolve(),
    (ROOT / "js" / "pet" / "package.json").resolve(),
}


LAST_BUILT = BACKUP_DIR / ".last-built.yaml"


def _prune_backups():
    for old in sorted(BACKUP_DIR.glob("pet-*.yaml"))[:-BACKUP_KEEP]:
        try:
            old.unlink()
        except OSError:
            pass


def _stamp_name(suffix=""):
    stamp = time.strftime("%Y%m%d-%H%M%S")
    dest = BACKUP_DIR / ("pet-%s%s.yaml" % (stamp, suffix))
    n = 1
    while dest.exists():
        dest = BACKUP_DIR / ("pet-%s%s-%d.yaml" % (stamp, suffix, n))
        n += 1
    return dest


def backup_config():
    """写配置前留一份快照，最多保留 20 份。"""
    src = CONFIG_FILE
    if not src.exists():
        return None
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    dest = _stamp_name()
    shutil.copy2(src, dest)
    _prune_backups()
    return dest


def remember_built():
    """把刚编译成功的内容存一份，用来看门狗回滚到“改动前”。"""
    if not CONFIG_FILE.exists():
        return
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(CONFIG_FILE, LAST_BUILT)


def backup_previous_edit():
    """手改之后：先把“改之前”的内容留成一份正式快照。"""
    if not LAST_BUILT.exists():
        return None
    try:
        same = LAST_BUILT.read_bytes() == CONFIG_FILE.read_bytes()
    except OSError:
        same = True
    if same:
        return None
    dest = _stamp_name("-edit")
    shutil.copy2(LAST_BUILT, dest)
    _prune_backups()
    return dest


def run_node(args, timeout=60):
    """跑 node 并把输出统一成 UTF-8 文本。

    不能用 text=True：Windows 上它会按 GBK 解码，遇到中文直接抛异常，
    结果 stdout 变成 None。
    """
    proc = subprocess.run(args, cwd=str(ROOT), capture_output=True, timeout=timeout)
    out = (proc.stdout or b"").decode("utf-8", "replace")
    err = (proc.stderr or b"").decode("utf-8", "replace")
    return proc.returncode, out, err


def run_build():
    """跑一次 build-config.js，返回 (ok, proc)。"""
    with BUILD_LOCK:
        try:
            code, out, err = run_node(["node", "tools/build-config.js"], timeout=60)
        except FileNotFoundError:
            return False, None

        class _P:
            returncode = code
            stdout = out
            stderr = err

        proc = _P()
        if proc.returncode == 0 and CONFIG_FILE.exists():
            STATE["mtime"] = CONFIG_FILE.stat().st_mtime
            remember_built()
        return proc.returncode == 0, proc


def snapshot_tree():
    """当前所有被监视文件的 mtime 快照。"""
    fp = {}
    for f in WATCH_FILES:
        try:
            if f.exists():
                fp[str(f)] = f.stat().st_mtime
        except OSError:
            pass
    for d in WATCH_DIRS:
        if not d.exists():
            continue
        for f in d.rglob("*"):
            try:
                if not f.is_file() or f.resolve() in WATCH_IGNORE:
                    continue
                fp[str(f)] = f.stat().st_mtime
            except OSError:
                pass
    return fp


# 测试面板可单独运行的套件：id 必须在白名单里，命令是固定拼出来的
SUITES = {
    "kernel": (["tools/tests/kernel.test.js"], "内核", 60),
    "rules": (["tools/tests/rules.test.js"], "规则编译器", 60),
    "rules-data": (["tools/tests/rules-data.test.js"], "规则数据", 60),
    "levels": (["tools/tests/levels.test.js"], "意图级别", 60),
    "states-data": (["tools/tests/states-data.test.js"], "状态数据", 60),
    "states-weights": (["tools/tests/states-weights.test.js"], "状态权重", 60),
    "zones": (["tools/tests/zones.test.js"], "分区引擎", 60),
    "smoke": (["tools/smoke.js"], "端到端冒烟", 180),
    "i18n": (["tools/i18n-check.js"], "中英一致性", 180),
    "unit": (None, "全部单元", 120),
    "all": (None, "全量", 400),
}


def run_suite(suite):
    """跑一个套件，返回 (ok, code, 输出文本, 耗时毫秒)。"""
    if suite not in SUITES:
        return False, -1, "unknown suite: %s" % suite, 0
    files, _label, timeout = SUITES[suite]
    if files is None:
        args = ["node", "tools/run-tests.js"] + (["--all"] if suite == "all" else [])
    else:
        args = ["node"] + files

    started = time.time()
    try:
        code, out, err = run_node(args, timeout=timeout)
        text = out + err
        ok = code == 0
    except subprocess.TimeoutExpired:
        text = "timeout after %ss" % timeout
        ok, code = False, -1
    except FileNotFoundError:
        text = "node not found in PATH"
        ok, code = False, -1

    ms = int((time.time() - started) * 1000)
    sys.stderr.write("[test] %s -> %s (%sms)\n" % (suite, "ok" if ok else "fail", ms))
    return ok, code, text, ms


def watch_files():
    """配置文件 → 自动编译；样式 / 模块 → 只通知前端重载。"""
    if CONFIG_FILE.exists():
        STATE["mtime"] = CONFIG_FILE.stat().st_mtime
        remember_built()
    prev = snapshot_tree()
    while True:
        time.sleep(1.0)
        try:
            if time.time() < STATE["quiet_until"]:
                prev = snapshot_tree()
                continue
            cur = snapshot_tree()
            if cur == prev:
                continue
            changed = [k for k in cur if prev.get(k) != cur[k]]
            changed += [k for k in prev if k not in cur]
            prev = cur
            if not changed:
                continue

            yaml_changed = any(Path(k) == CONFIG_FILE for k in changed)
            if yaml_changed:
                snap = backup_previous_edit()
                ok, proc = run_build()
                if ok:
                    sys.stderr.write("[watch] pet.yaml rebuilt%s\n"
                                     % (" (snapshot: %s)" % snap.name if snap else ""))
                else:
                    detail = (proc.stderr if proc else "node not found") or ""
                    sys.stderr.write("[watch] build failed: %s\n" % detail.strip()[:200])
            STATE["rev"] += 1
            if not yaml_changed:
                names = ", ".join(Path(k).name for k in changed[:3])
                sys.stderr.write("[watch] reload: %s\n" % names)
        except Exception as e:  # 监视线程不能挂
            sys.stderr.write("[watch] %s\n" % e)


def _pet_cfg():
    """读 config/pet.yaml 的关键字段：素材目录、扩展名、首帧图。

    只做最小的字符串/缩进解析，不引入 YAML 依赖——这里只需要三个标量。
    """
    cfg = {"animDir": "/images/pet/anim/", "clipExt": "webm"}
    path = ROOT / "config" / "pet.yaml"
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return cfg
    for line in text.splitlines():
        m = re.match(r"^(animDir|clipExt|image)\s*:\s*(.+?)\s*$", line)
        if m:
            cfg[m.group(1)] = m.group(2).strip('"').strip("'")
    return cfg


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    # 明确给文本类型加 charset：Windows 上浏览器默认编码常是 GBK，
    # 缺 charset 时 fetch(...).text() 会按 GBK 解码，中文直接乱码。
    EXTRA_TYPES = {
        ".yaml": "text/yaml; charset=utf-8",
        ".yml": "text/yaml; charset=utf-8",
        ".md": "text/markdown; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".mjs": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".html": "text/html; charset=utf-8",
        ".txt": "text/plain; charset=utf-8",
        ".svg": "image/svg+xml; charset=utf-8",
    }

    def guess_type(self, path):
        ext = os.path.splitext(str(path))[1].lower()
        if ext in self.EXTRA_TYPES:
            return self.EXTRA_TYPES[ext]
        guessed = super().guess_type(path)
        if guessed.startswith("text/") and "charset" not in guessed:
            return guessed + "; charset=utf-8"
        return guessed

    def log_message(self, fmt, *args):
        try:
            msg = fmt % args if args else str(fmt)
        except Exception:
            msg = str(fmt)
        if "/api/" in msg:
            sys.stderr.write("%s - %s\n" % (self.address_string(), msg))

    def _json(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        # 开发服务器：一律不缓存，避免改了配置刷新还是旧模块
        if not getattr(self, "_cache_set", False):
            self.send_header("Cache-Control", "no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self._cache_set = True
        super().end_headers()

    def do_GET(self):
        if self.path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
            return
        if self.path.startswith("/api/assets"):
            from urllib.parse import urlparse, parse_qs
            q = parse_qs(urlparse(self.path).query)
            kind = (q.get("kind") or ["clips"])[0]
            cfg = _pet_cfg()
            anim_dir = cfg["animDir"].strip("/")          # images/pet/anim
            clip_ext = "." + cfg["clipExt"].lstrip(".")
            img_dir = anim_dir.rsplit("/", 1)[0] or anim_dir
            roots = {
                "clips": (anim_dir, (clip_ext,)),
                "images": (img_dir, (".webp", ".png", ".jpg", ".jpeg", ".gif", ".svg")),
                "json": ("js", (".json",)),
            }
            if kind not in roots:
                self._json(400, {"ok": False, "error": "unknown kind"})
                return
            reldir, exts = roots[kind]
            base = (ROOT / reldir).resolve()
            if not str(base).startswith(str(ROOT)):
                self._json(403, {"ok": False, "error": "outside workspace"})
                return
            items = []
            candidates = []
            if base.is_dir():
                if kind == "json":
                    # 构建期 JSON 通常就在仓库根和 js/ 下；rglob 整个仓库太慢
                    candidates += [f for f in base.iterdir() if f.is_file()]
                    js = ROOT / "js"
                    if js.is_dir():
                        candidates += [f for f in js.rglob("*.json") if f.is_file()]
                else:
                    candidates = [f for f in base.rglob("*") if f.is_file()]
            for f in sorted(set(candidates)):
                if f.suffix.lower() not in exts:
                    continue
                rel = "/" + str(f.relative_to(ROOT)).replace("\\", "/")
                items.append({"name": f.stem if kind == "clips" else f.name, "path": rel})
            self._json(200, {"ok": True, "kind": kind, "items": items})
            return

        if self.path == "/api/suites":
            self._json(200, {
                "ok": True,
                "items": [{"id": k, "label": v[1]} for k, v in SUITES.items()]
            })
            return
        if self.path == "/api/version":
            self._json(200, {"ok": True, "mtime": STATE["mtime"], "rev": STATE["rev"]})
            return
        if self.path == "/api/backups":
            items = []
            if BACKUP_DIR.exists():
                for f in sorted(BACKUP_DIR.glob("pet-*.yaml"), reverse=True):
                    st = f.stat()
                    items.append({"name": f.name, "size": st.st_size, "mtime": int(st.st_mtime)})
            self._json(200, {"ok": True, "items": items[:50]})
            return
        super().do_GET()

    def do_POST(self):
        try:
            self._do_post()
        except Exception as e:
            import traceback
            traceback.print_exc()
            self._json(500, {"ok": False, "error": str(e)})

    def _do_post(self):
        if self.path not in ("/api/save", "/api/build", "/api/patch", "/api/restore", "/api/test"):
            self._json(404, {"ok": False, "error": "unknown endpoint"})
            return

        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            data = json.loads(raw.decode("utf-8") or "{}")
        except Exception as e:
            self._json(400, {"ok": False, "error": "bad json: %s" % e})
            return

        if not isinstance(data, dict):
            self._json(400, {"ok": False, "error": "payload must be an object"})
            return

        # 接口自己会编译，别让看门狗跟着再编译一遍
        STATE["quiet_until"] = time.time() + 4.0
        STATE["rev"] += 1

        if self.path == "/api/test":
            suite = str(data.get("suite") or "unit")
            ok, code, out, ms = run_suite(suite)
            self._json(200 if ok else 500, {
                "ok": ok,
                "suite": suite,
                "code": code,
                "durationMs": ms,
                "output": out[-20000:]
            })
            return

        if self.path == "/api/save":
            rel = str(data.get("path") or "")
            content = data.get("content")
            if not rel or content is None:
                self._json(400, {"ok": False, "error": "path/content required"})
                return
            if "\ufffd" in content:
                # 典型的编码事故：UTF-8 被按 GBK 解码后再存回来
                self._json(422, {
                    "ok": False,
                    "error": "content contains U+FFFD (encoding damage); aborted to protect the file",
                    "hint": "reload the page and paste the text again"
                })
                return
            target = (ROOT / rel).resolve()
            if target.parent != ALLOWED_DIR or target.suffix not in (".yaml", ".yml"):
                self._json(403, {"ok": False, "error": "only config/*.yaml can be written"})
                return
            target.parent.mkdir(parents=True, exist_ok=True)
            backup_config()
            target.write_text(content, encoding="utf-8")
            self._json(200, {"ok": True, "path": str(target.relative_to(ROOT))})
            return

        if self.path == "/api/patch":
            patch = data.get("patch") or {}
            tmp = ROOT / "config" / ".patch.json"
            backup_config()
            tmp.write_text(json.dumps(patch, ensure_ascii=False), encoding="utf-8")
            try:
                code, out, err = run_node(["node", "tools/apply-patch.js", "config/.patch.json"], timeout=60)

                class _P:
                    returncode = code
                    stdout = out
                    stderr = err

                proc = _P()
            finally:
                try:
                    tmp.unlink()
                except OSError:
                    pass
            if proc.returncode != 0:
                # 补丁内容不支持（例如只给 shadow）属于请求问题，不是服务器故障
                self._json(400, {
                    "ok": False,
                    "error": (proc.stderr or proc.stdout or "").strip(),
                    "hint": "patch supports zones / zoneReactions / rulesItems / stateRules / personaCopy"
                })
                return
            ok, build = run_build()
            self._json(200 if ok else 500, {
                "ok": ok,
                "patch": (proc.stdout or "").strip(),
                "stdout": (build.stdout or "").strip() if build else "",
                "stderr": (build.stderr or "").strip() if build else "node not found"
            })
            return

        if self.path == "/api/restore":
            name = str(data.get("name") or "")
            if not re.match(r"^pet-[0-9A-Za-z\-]+\.yaml$", name):
                self._json(400, {"ok": False, "error": "invalid backup name"})
                return
            src = (BACKUP_DIR / name).resolve()
            if src.parent != BACKUP_DIR.resolve() or not src.exists():
                self._json(404, {"ok": False, "error": "backup not found"})
                return
            backup_config()
            shutil.copy2(src, CONFIG_FILE)
            ok, build = run_build()
            self._json(200 if ok else 500, {
                "ok": ok,
                "restored": name,
                "stdout": (build.stdout or "").strip() if build else "",
                "stderr": (build.stderr or "").strip() if build else "node not found"
            })
            return

        # /api/build
        ok, proc = run_build()
        if proc is None:
            self._json(500, {"ok": False, "error": "node not found in PATH"})
            return
        self._json(200 if ok else 500, {
            "ok": ok,
            "code": proc.returncode,
            "stdout": (proc.stdout or "").strip(),
            "stderr": (proc.stderr or "").strip()
        })


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    os.chdir(ROOT)
    threading.Thread(target=watch_files, daemon=True).start()
    print("宠物实验室 · http://127.0.0.1:%d/index.html" % port)
    print("写操作仅限 config/；pet.yaml 改动会自动编译（Ctrl+C 停止）")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
