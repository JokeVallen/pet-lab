/*!
 * smoke.js —— pet-lab 的端到端冒烟测试
 *
 * 自带静态服务器 + 无头 Chrome + CDP，跑完自动清理。
 * 用法：node tools/smoke.js
 *
 * 覆盖：挂载、待机、内核装配、语言通道、分区点击、动作意图、站内检索
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = 4460;
const DBG = 9381;
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
const PROFILE = path.join(ROOT, '.chrome-smoke');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.yaml': 'text/yaml; charset=utf-8',
    '.webm': 'video/webm',
    '.webp': 'image/webp',
    '.png': 'image/png'
};

/* ---------------- 静态服务器 ---------------- */

function serve() {
    const server = http.createServer((req, res) => {
        let p = decodeURIComponent(req.url.split('?')[0]);
        if (p === '/') p = '/demo.html';
        const file = path.join(ROOT, p);
        if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
            res.writeHead(404); res.end('not found'); return;
        }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        fs.createReadStream(file).pipe(res);
    });
    return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

/* ---------------- CDP ---------------- */

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function connect() {
    for (let i = 0; i < 40; i++) {
        try {
            const res = await fetch(`http://127.0.0.1:${DBG}/json/list`);
            const list = await res.json();
            const page = list.find((t) => t.type === 'page');
            if (page) return page.webSocketDebuggerUrl;
        } catch (e) { /* 还没起来 */ }
        await sleep(250);
    }
    throw new Error('CDP 连接超时');
}

function client(wsUrl) {
    const ws = new WebSocket(wsUrl);
    const pending = new Map();
    let id = 0;
    const ready = new Promise((resolve, reject) => {
        ws.addEventListener('open', resolve);
        ws.addEventListener('error', reject);
    });
    ws.addEventListener('message', (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.id && pending.has(msg.id)) {
            pending.get(msg.id)(msg);
            pending.delete(msg.id);
        }
    });
    return {
        ready,
        send(method, params) {
            const myId = ++id;
            return new Promise((resolve) => {
                pending.set(myId, resolve);
                ws.send(JSON.stringify({ id: myId, method, params: params || {} }));
            });
        },
        close() { try { ws.close(); } catch (e) { /* ignore */ } }
    };
}

async function evaluate(c, expression, awaitPromise) {
    const r = await c.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: !!awaitPromise
    });
    if (r.result && r.result.exceptionDetails) {
        throw new Error(r.result.exceptionDetails.text || 'evaluate 失败');
    }
    return r.result.result.value;
}

async function click(c, x, y) {
    await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await sleep(90);
    await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}

/* ---------------- 断言 ---------------- */

let pass = 0, fail = 0;
function ok(cond, name, detail) {
    if (cond) { pass++; console.log(`  \u2713 ${name}`); }
    else { fail++; console.log(`  \u2717 ${name}${detail ? '  → ' + detail : ''}`); }
}

/* ---------------- 主流程 ---------------- */

(async () => {
    const server = await serve();
    const chrome = spawn(CHROME, [
        '--headless=new', '--disable-gpu', '--no-sandbox',
        '--autoplay-policy=no-user-gesture-required',
        `--remote-debugging-port=${DBG}`,
        `--user-data-dir=${PROFILE}`,
        '--window-size=1280,900',
        `http://127.0.0.1:${PORT}/`
    ], { stdio: 'ignore' });

    let c;
    try {
        const wsUrl = await connect();
        c = client(wsUrl);
        await c.ready;
        await c.send('Runtime.enable');
        await sleep(2500);

        console.log('1. 挂载与装配');
        const probe = await evaluate(c, `(async () => { try { await import('/js/pet/index.js'); return 'ok'; } catch (e) { return 'ERR: ' + e.message; } })()`, true);
        if (probe !== 'ok') console.log('   模块加载：' + probe);
        const boot = JSON.parse(await evaluate(c, `JSON.stringify({
            mounted: !!document.getElementById('deepseek-pet'),
            modules: window.PetKernel ? window.PetKernel.modules() : [],
            err: window.__petBootErr || null,
            clip: (function(){var f=document.querySelector('#deepseek-pet video.is-front');return f?f.getAttribute('data-clip'):null;})()
        })`));
        ok(boot.mounted, '宠物挂载');
        ok(!boot.err, '无启动异常', boot.err);
        ok(boot.modules.includes('speech') && boot.modules.includes('actions'), '内核装配 speech + actions', boot.modules.join(','));
        ok(!!boot.clip, '有待机动画', boot.clip);

        console.log('2. 语言通道');
        await evaluate(c, `PetKernel.emit('speech.act', { text: '通路测试', ttl: 4000, channel: 'bubble' })`);
        await sleep(350);
        const bubble = JSON.parse(await evaluate(c, `JSON.stringify({
            text: (document.querySelector('#deepseek-pet .dp-bubble') || {}).textContent || null,
            shown: (document.querySelector('#deepseek-pet .dp-bubble') || {classList:{contains:()=>false}}).classList.contains('is-show')
        })`));
        ok(bubble.text === '通路测试' && bubble.shown, '气泡渲染', JSON.stringify(bubble));

        console.log('3. 分区点击');
        const rect = JSON.parse(await evaluate(c, `(function(){
            var r = document.querySelector('#deepseek-pet .dp-character').getBoundingClientRect();
            return JSON.stringify({ l: r.left, t: r.top, w: r.width, h: r.height });
        })()`));
        const cx = rect.l + rect.w / 2;

        await click(c, cx, rect.t + rect.h * 0.08);   // 头顶
        await sleep(700);
        const head = JSON.parse(await evaluate(c, `JSON.stringify({
            clip: (function(){var f=document.querySelector('#deepseek-pet video.is-front');return f?f.getAttribute('data-clip'):null;})(),
            say: (document.querySelector('#deepseek-pet .dp-bubble')||{}).textContent || null
        })`));
        ok(/^click/.test(head.clip || ''), '点头顶 → 点击动画', head.clip);
        ok(!!head.say, '点头顶 → 有台词', head.say);

        await sleep(400);
        await click(c, cx, rect.t + rect.h * 0.95);   // 尾巴
        await sleep(700);
        const tail = JSON.parse(await evaluate(c, `JSON.stringify({
            clip: (function(){var f=document.querySelector('#deepseek-pet video.is-front');return f?f.getAttribute('data-clip'):null;})()
        })`));
        ok(tail.clip === 'tail', '点尾巴 → 甩尾', tail.clip);

        console.log('4. 动作意图');
        await evaluate(c, `PetKernel.emit('intent.action', { act: 'eat', level: 'direct', duration: 6000 })`);
        await sleep(600);
        const eat = JSON.parse(await evaluate(c, `JSON.stringify({
            clip: (function(){var f=document.querySelector('#deepseek-pet video.is-front');return f?f.getAttribute('data-clip'):null;})(),
            busy: PetKernel.busy()
        })`));
        ok(eat.clip === 'eat', '意图 → 播放 eat', eat.clip);
        ok(eat.busy && eat.busy.act === 'eat', '内核记录占用', JSON.stringify(eat.busy));

        console.log('5. 站内检索');
        const search = JSON.parse(await evaluate(c, `(async function(){
            var s = PetSearch.createSearch({ maxResults: 3 });
            s.ensure();
            await new Promise(function(r){ setTimeout(r, 1200); });
            return JSON.stringify({
                rows: (s.rows() || []).length,
                answer: s.answer('有没有讲冒泡排序的')
            });
        })()`, true));
        ok(search.rows > 100, '索引加载', search.rows);
        ok(/冒泡排序/.test(search.answer || ''), '检索命中正确卡片', search.answer);

    } catch (e) {
        fail++;
        console.log('  \u2717 运行时异常：' + e.message);
    } finally {
        if (c) c.close();
        chrome.kill();
        server.close();
        await sleep(300);
    }

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})();
