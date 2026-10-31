import pathlib
import re

ROOT = pathlib.Path(r"D:/Users/user/pet-lab")

PAGES = ["config-editor.html", "zone-editor.html", "rules-editor.html", "copy-editor.html"]

OLD = """let SERVER_OK = null;
async function hasServer() {
    if (SERVER_OK !== null) return SERVER_OK;
    try {
        const r = await fetch('/api/version', { cache: 'no-store', method: 'HEAD' });
        SERVER_OK = r.ok;
    } catch (e) {
        SERVER_OK = false;
    }
    if (!SERVER_OK) noteNoServer();
    return SERVER_OK;
}"""

NEW = """let SERVER_OK = null;
let SERVER_WHY = '';           /* 探测失败的原因，显示在提示里，便于排查 */
async function probeOnce(method) {
    const r = await fetch('/api/version', { cache: 'no-store', method: method });
    return r.ok;
}
async function hasServer() {
    if (SERVER_OK !== null) return SERVER_OK;
    /* HEAD 可能落到正在关闭的 keep-alive 连接上，或撞上服务刚启动的瞬间。
     * 因此：失败重试两次（间隔 150ms），HEAD 不行再回退 GET。
     * 只有三种都失败才认定「没有服务」——避免误报。 */
    const attempts = [
        ['HEAD', 0], ['HEAD', 150], ['GET', 0], ['GET', 300]
    ];
    for (let i = 0; i < attempts.length; i += 1) {
        const method = attempts[i][0];
        const wait = attempts[i][1];
        if (wait) await new Promise(function (r) { setTimeout(r, wait); });
        try {
            if (await probeOnce(method)) {
                SERVER_OK = true;
                SERVER_WHY = '';
                return true;
            }
            SERVER_WHY = 'HTTP ' + method + ' 未返回成功';
        } catch (e) {
            SERVER_WHY = (e && e.message) || 'net error';
        }
    }
    SERVER_OK = false;
    noteNoServer();
    return false;
}"""

for name in PAGES:
    p = ROOT / name
    t = p.read_text(encoding="utf-8")
    if NEW.split("\n")[0] in t and "SERVER_WHY" in t:
        print(name, "已是新版")
        continue
    if OLD not in t:
        print(name, "!! 未找到锚点")
        continue
    t = t.replace(OLD, NEW, 1)
    p.write_text(t, encoding="utf-8")
    print(name, "已替换探测逻辑")
