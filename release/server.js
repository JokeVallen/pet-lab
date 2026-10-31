/* server.js —— 本地服务（纯 Node，无第三方依赖）
 *
 * 静态文件 + 配置写盘 + 编译 + 备份，与 tools/serve.py 的接口一一对应：
 *   GET  /api/assets?kind=clips|images|json
 *   GET  /api/version          （前端只用来探活，HEAD 也算）
 *   GET  /api/backups
 *   POST /api/save   { path, content }
 *   POST /api/patch  { patch }
 *   POST /api/restore { name }
 *   POST /api/build
 *
 * 只监听 127.0.0.1；写操作限定在 config/*.yaml。
 *
 * 用法：node server.js [端口]   （默认 8080；被占用时自动顺延）
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = __dirname;
const CONFIG_DIR = path.join(ROOT, 'config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'pet.yaml');
const BACKUP_DIR = path.join(CONFIG_DIR, '.backup');
const BACKUP_KEEP = 20;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.yaml': 'text/yaml; charset=utf-8',
    '.yml': 'text/yaml; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webm': 'video/webm',
    '.ico': 'image/x-icon'
};

/* ---------- 工具 ---------- */

let busy = false;

function stamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}

function pruneBackups() {
    try {
        const files = fs.readdirSync(BACKUP_DIR).filter((f) => /^pet-.*\.yaml$/.test(f)).sort();
        while (files.length > BACKUP_KEEP) {
            try { fs.unlinkSync(path.join(BACKUP_DIR, files.shift())); } catch (e) { /* ignore */ }
        }
    } catch (e) { /* 目录还不存在 */ }
}

function backupConfig() {
    if (!fs.existsSync(CONFIG_FILE)) return null;
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    let name = 'pet-' + stamp() + '.yaml';
    let n = 1;
    while (fs.existsSync(path.join(BACKUP_DIR, name))) {
        name = 'pet-' + stamp() + '-' + n + '.yaml';
        n += 1;
    }
    fs.copyFileSync(CONFIG_FILE, path.join(BACKUP_DIR, name));
    pruneBackups();
    return name;
}

function runNode(args) {
    const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', timeout: 60000 });
    return {
        code: r.status == null ? 1 : r.status,
        out: r.stdout || '',
        err: r.stderr || ''
    };
}

function runBuild() {
    const r = runNode([path.join('tools', 'build-config.js')]);
    return { ok: r.code === 0, stdout: r.out.trim(), stderr: r.err.trim() };
}

function readPetCfg() {
    try {
        const text = fs.readFileSync(CONFIG_FILE, 'utf8');
        /* 只取两个键，不想为它引入 YAML 解析：夹在冒号和行尾之间的简单值 */
        const pick = (key, dflt) => {
            const m = new RegExp('^' + key + ':\\s*(.+)$', 'm').exec(text);
            return m ? m[1].trim().replace(/^["']|["']$/g, '') : dflt;
        };
        return { animDir: pick('animDir', '/images/pet/anim/'), clipExt: pick('clipExt', 'webm') };
    } catch (e) {
        return { animDir: '/images/pet/anim/', clipExt: 'webm' };
    }
}

function sendJson(res, code, payload) {
    const body = Buffer.from(JSON.stringify(payload), 'utf8');
    res.writeHead(code, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': body.length,
        'Cache-Control': 'no-store'
    });
    res.end(body);
}

function walk(dir, out) {
    let ents = [];
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
    for (const ent of ents) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(p, out);
        else out.push(p);
    }
    return out;
}

/* ---------- 路由 ---------- */

function handleAssets(res, query) {
    const kind = (query.get('kind') || 'clips').trim();
    const cfg = readPetCfg();
    const animDir = cfg.animDir.replace(/^\/|\/$/g, '');
    const ext = '.' + cfg.clipExt.replace(/^\./, '');
    const imgDir = animDir.indexOf('/') >= 0 ? animDir.slice(0, animDir.lastIndexOf('/')) : animDir;

    const roots = {
        clips: { dir: animDir, exts: [ext] },
        images: { dir: imgDir, exts: ['.webp', '.png', '.jpg', '.jpeg', '.gif', '.svg'] },
        json: { dir: 'js', exts: ['.json'] }
    };
    const spec = roots[kind];
    if (!spec) return sendJson(res, 400, { ok: false, error: 'unknown kind' });

    const base = path.resolve(ROOT, spec.dir);
    const rootN = path.resolve(ROOT).toLowerCase() + path.sep;
    if ((path.resolve(base).toLowerCase() + path.sep).indexOf(rootN) !== 0) {
        return sendJson(res, 403, { ok: false, error: 'outside workspace' });
    }

    let files = walk(base, []);
    if (kind === 'json') files = files.concat(walk(path.join(ROOT, 'js'), []));

    const seen = new Set();
    const items = [];
    for (const f of files.sort()) {
        if (spec.exts.indexOf(path.extname(f).toLowerCase()) < 0) continue;
        const rel = '/' + path.relative(ROOT, f).replace(/\\/g, '/');
        if (seen.has(rel)) continue;
        seen.add(rel);
        items.push({ name: kind === 'clips' ? path.basename(f, path.extname(f)) : path.basename(f), path: rel });
    }
    sendJson(res, 200, { ok: true, kind: kind, items: items });
}

function handleBackups(res) {
    const items = [];
    try {
        for (const f of fs.readdirSync(BACKUP_DIR).filter((n) => /^pet-.*\.yaml$/.test(n)).sort().reverse()) {
            const st = fs.statSync(path.join(BACKUP_DIR, f));
            items.push({ name: f, size: st.size, mtime: Math.round(st.mtimeMs / 1000) });
        }
    } catch (e) { /* 还没有备份 */ }
    sendJson(res, 200, { ok: true, items: items.slice(0, 50) });
}

function handlePost(req, res, body) {
    let data;
    try { data = JSON.parse(body || '{}'); } catch (e) {
        return sendJson(res, 400, { ok: false, error: 'bad json: ' + e.message });
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return sendJson(res, 400, { ok: false, error: 'payload must be an object' });
    }

    const url = req.url.split('?')[0];

    if (url === '/api/save') {
        const rel = String(data.path || '');
        const content = data.content;
        if (!rel || content == null) return sendJson(res, 400, { ok: false, error: 'path/content required' });
        if (String(content).indexOf('\ufffd') >= 0) {
            return sendJson(res, 422, {
                ok: false,
                error: 'content contains U+FFFD (encoding damage); aborted to protect the file',
                hint: 'reload the page and paste the text again'
            });
        }
        const target = path.resolve(ROOT, rel);
        if (path.dirname(target) !== CONFIG_DIR || ['.yaml', '.yml'].indexOf(path.extname(target)) < 0) {
            return sendJson(res, 403, { ok: false, error: 'only config/*.yaml can be written' });
        }
        backupConfig();
        fs.writeFileSync(target, String(content), 'utf8');
        return sendJson(res, 200, { ok: true, path: path.relative(ROOT, target).replace(/\\/g, '/') });
    }

    if (url === '/api/patch') {
        const patch = data.patch || {};
        const tmp = path.join(CONFIG_DIR, '.patch.json');
        backupConfig();
        fs.writeFileSync(tmp, JSON.stringify(patch), 'utf8');
        let proc;
        try {
            proc = runNode([path.join('tools', 'apply-patch.js'), path.join('config', '.patch.json')]);
        } finally {
            try { fs.unlinkSync(tmp); } catch (e) { /* ignore */ }
        }
        if (proc.code !== 0) {
            return sendJson(res, 400, {
                ok: false,
                error: (proc.err || proc.out || '').trim(),
                hint: 'patch supports zones / zoneReactions / rulesItems / stateRules / personaCopy'
            });
        }
        const build = runBuild();
        return sendJson(res, build.ok ? 200 : 500, {
            ok: build.ok,
            patch: proc.out.trim(),
            stdout: build.stdout,
            stderr: build.stderr
        });
    }

    if (url === '/api/restore') {
        const name = String(data.name || '');
        if (!/^pet-[0-9A-Za-z-]+\.yaml$/.test(name)) return sendJson(res, 400, { ok: false, error: 'invalid backup name' });
        const src = path.join(BACKUP_DIR, name);
        if (path.dirname(path.resolve(src)) !== path.resolve(BACKUP_DIR) || !fs.existsSync(src)) {
            return sendJson(res, 404, { ok: false, error: 'backup not found' });
        }
        backupConfig();
        fs.copyFileSync(src, CONFIG_FILE);
        const build = runBuild();
        return sendJson(res, build.ok ? 200 : 500, { ok: build.ok, restored: name, stdout: build.stdout, stderr: build.stderr });
    }

    if (url === '/api/build') {
        const build = runBuild();
        return sendJson(res, build.ok ? 200 : 500, { ok: build.ok, code: build.ok ? 0 : 1, stdout: build.stdout, stderr: build.stderr });
    }

    return sendJson(res, 404, { ok: false, error: 'unknown endpoint' });
}

function serveStatic(req, res) {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel === '/favicon.ico') { res.writeHead(204); return res.end(); }
    if (rel === '/') rel = '/index.html';
    const target = path.resolve(ROOT, '.' + rel);
    /* 路径穿越拦截：必须落在 ROOT 之内（Windows 下大小写与分隔符都要归一） */
    const rootNorm = path.resolve(ROOT).toLowerCase() + path.sep;
    if ((path.resolve(target).toLowerCase() + path.sep).indexOf(rootNorm) !== 0) {
        res.writeHead(403);
        return res.end('forbidden');
    }

    fs.readFile(target, (err, buf) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            return res.end('not found: ' + rel);
        }
        res.writeHead(200, {
            'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream',
            'Content-Length': buf.length,
            /* 开发/本地工具：一律不缓存，免得改了配置刷新还是旧模块 */
            'Cache-Control': 'no-store, must-revalidate'
        });
        res.end(buf);
    });
}

/* ---------- 启动 ---------- */

function listen(port, triesLeft) {
    const server = http.createServer((req, res) => {
        if (req.method === 'HEAD') {
            /* 前端用 HEAD /api/version 探活 */
            if (req.url.split('?')[0] === '/api/version') {
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
                return res.end();
            }
            return serveStatic(req, res);
        }
        if (req.method === 'GET') {
            const url = req.url.split('?')[0];
            const query = new URL('http://x' + req.url).searchParams;
            if (url === '/api/assets') return handleAssets(res, query);
            if (url === '/api/version') return sendJson(res, 200, { ok: true, mtime: 0, rev: 0 });
            if (url === '/api/backups') return handleBackups(res);
            return serveStatic(req, res);
        }
        if (req.method === 'POST') {
            let body = '';
            req.setEncoding('utf8');
            req.on('data', (c) => { body += c; if (body.length > 20 * 1024 * 1024) req.destroy(); });
            req.on('end', () => {
                try { handlePost(req, res, body); } catch (e) {
                    sendJson(res, 500, { ok: false, error: String(e && e.message || e) });
                }
            });
            return;
        }
        res.writeHead(405);
        res.end();
    });

    server.on('error', (e) => {
        if (e.code === 'EADDRINUSE' && triesLeft > 0) {
            console.log('端口 ' + port + ' 被占用，换 ' + (port + 1) + ' 试试…');
            return listen(port + 1, triesLeft - 1);
        }
        console.error('启动失败：' + e.message);
        process.exit(1);
    });

    server.listen(port, '127.0.0.1', () => {
        const url = 'http://127.0.0.1:' + port + '/index.html';
        console.log('');
        console.log('  桌宠工具集 · 本地服务已启动');
        console.log('  ------------------------------------------');
        console.log('  地址：' + url);
        console.log('  支持在页面里「保存并编译」');
        console.log('  关掉这个窗口即停止服务');
        console.log('');
        if (process.platform === 'win32') {
            try { spawnSync('cmd', ['/c', 'start', '', url], { stdio: 'ignore' }); } catch (e) { /* ignore */ }
        } else if (process.platform === 'darwin') {
            try { spawnSync('open', [url], { stdio: 'ignore' }); } catch (e) { /* ignore */ }
        } else {
            try { spawnSync('xdg-open', [url], { stdio: 'ignore' }); } catch (e) { /* ignore */ }
        }
    });
}

const argPort = parseInt(process.argv[2], 10);
listen(Number.isFinite(argPort) ? argPort : 8080, 20);
