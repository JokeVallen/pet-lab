/*!
 * i18n-check.js —— 中英一致性回归测试
 *
 *   node tools/i18n-check.js
 *
 * 自带静态服务器 + 无头 Chrome，逐页检查：
 *   1. 英文模式下 [data-i18n] 元素里不能残留中文
 *   2. 英文模式下 <title> 不能残留中文
 *   3. 中文模式下 <title> 必须是中文
 * 跑完自动清理，失败退出码 1。
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = 4471;
const DBG = 9383;
const CHROME = (function () {
    const candidates = [
        process.env.CHROME_PATH,
        'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
    ].filter(Boolean);
    return candidates.find((p) => fs.existsSync(p)) || candidates[0];
})();
const PROFILE = path.join(ROOT, '.chrome-i18n');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.yaml': 'text/yaml; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.webm': 'video/webm',
    '.webp': 'image/webp',
    '.png': 'image/png'
};

/* 有 key 但仍是中文 —— 允许的例外（用户内容 / 角色名） */
const ALLOW = [/大肥鱼/, /^head(\.|$)/, /^body(\.|$)/, /^tail$/];

const PAGES = [
    { file: 'index.html', title: 'demo' },
    { file: 'home.html', title: 'home' },
    { file: 'config-editor.html', title: 'cfg' },
    { file: 'zone-editor.html', title: 'zone' },
    { file: 'rules-editor.html', title: 'rules' },
    { file: 'tests.html', title: 'tests' },
    { file: 'docs.html?f=STATUS.md', title: 'docs' },
    { file: 'docs.html?f=docs/INTERACTION.md', title: 'interaction' },
    { file: 'docs.html?f=KNOWN-ISSUES.md', title: 'issues' }
];

const CJK = /[\u4e00-\u9fa5]/;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function staticServer() {
    const server = http.createServer((req, res) => {
        let p = decodeURIComponent(req.url.split('?')[0]);
        if (p === '/') p = '/index.html';
        const file = path.join(ROOT, p);
        if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
            res.writeHead(404); res.end('not found'); return;
        }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
        fs.createReadStream(file).pipe(res);
    });
    return new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(server)));
}

async function connect() {
    for (let i = 0; i < 60; i++) {
        try {
            const list = await (await fetch(`http://127.0.0.1:${DBG}/json/list`)).json();
            const page = list.find((t) => t.type === 'page');
            if (page) return page.webSocketDebuggerUrl;
        } catch (e) { /* retry */ }
        await sleep(250);
    }
    throw new Error('CDP 连接超时');
}

(async () => {
    const server = await staticServer();
    if (fs.existsSync(PROFILE)) fs.rmSync(PROFILE, { recursive: true, force: true });
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox',
        `--remote-debugging-port=${DBG}`, `--user-data-dir=${PROFILE}`,
        `http://127.0.0.1:${PORT}/home.html`], { stdio: 'ignore' });

    let ws, id = 0;
    const pending = new Map();
    const send = (method, params) => new Promise((resolve) => {
        const myId = ++id;
        pending.set(myId, resolve);
        ws.send(JSON.stringify({ id: myId, method, params: params || {} }));
    });
    const evaluate = async (expression) => {
        const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        if (r.result && r.result.exceptionDetails) throw new Error('evaluate failed: ' + expression.slice(0, 60));
        return r.result && r.result.result ? r.result.result.value : undefined;
    };

    let failed = 0;
    const fail = (msg) => { failed++; console.log('  FAIL ' + msg); };
    const ok = (msg) => console.log('  ok   ' + msg);

    try {
        const url = await connect();
        ws = new WebSocket(url);
        await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
        ws.addEventListener('message', (ev) => {
            const m = JSON.parse(ev.data);
            if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
        });
        await send('Runtime.enable');
        await send('Page.enable');
        await sleep(1800);

        // ---- 英文模式 ----
        await evaluate("localStorage.setItem('pet-i18n','en')");
        console.log('\n== English mode ==');

        for (const page of PAGES) {
            await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/${page.file}` });
            await sleep(2300);

            const data = await evaluate(`JSON.stringify({
                title: document.title,
                offenders: [...document.querySelectorAll('[data-i18n]')]
                    .filter((e) => /[\\u4e00-\\u9fa5]/.test(e.textContent || ''))
                    .map((e) => e.getAttribute('data-i18n') + ' = ' + (e.textContent || '').trim().slice(0, 40))
            })`);
            const parsed = JSON.parse(data);
            const bad = parsed.offenders.filter((line) => {
                const text = line.split(' = ')[1] || '';
                return !ALLOW.some((re) => re.test(text));
            });

            if (bad.length) fail(`${page.file}: ${bad.length} 处未翻译 → ${bad.slice(0, 3).join(' | ')}`);
            else ok(`${page.file}: 文本已全部翻译`);

            if (CJK.test(parsed.title)) fail(`${page.file}: 标题仍是中文「${parsed.title}」`);
            else ok(`${page.file}: 标题 ${parsed.title}`);
        }

        // ---- 中文模式 ----
        await evaluate("localStorage.setItem('pet-i18n','zh')");
        console.log('\n== 中文模式 ==');
        for (const page of [{ file: 'home.html' }, { file: 'index.html' }]) {
            await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/${page.file}` });
            await sleep(2000);
            const title = await evaluate('document.title');
            if (CJK.test(title)) ok(`${page.file}: 标题 ${title}`);
            else fail(`${page.file}: 中文模式下标题是「${title}」`);
        }
    } catch (e) {
        fail(e.message);
    } finally {
        try { chrome.kill(); } catch (e) { /* ignore */ }
        await sleep(400);
        try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) { /* ignore */ }
        server.close();
    }

    console.log(`\n${failed === 0 ? 'i18n 全部通过' : failed + ' 项 i18n 检查失败'}`);
    process.exit(failed ? 1 : 0);
})();
