/* 审计：英文模式下残留的中文文本 */
const { spawn } = require('child_process');
const CHROME = process.env.CHROME_PATH || 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9408);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || '8105');

const PAGES = ['index.html', 'home.html', 'config-editor.html', 'zone-editor.html', 'rules-editor.html', 'docs.html?f=STATUS.md'];

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function connect() {
    for (let i = 0; i < 40; i++) {
        try {
            const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
            const page = list.find((t) => t.type === 'page');
            if (page) return page.webSocketDebuggerUrl;
        } catch (e) { /* wait */ }
        await sleep(250);
    }
    throw new Error('cdp timeout');
}

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-audit',
        `${BASE}/home.html`], { stdio: 'ignore' });

    let ws, id = 0;
    const pending = new Map();

    function send(method, params) {
        const myId = ++id;
        return new Promise((resolve) => {
            pending.set(myId, resolve);
            ws.send(JSON.stringify({ id: myId, method, params: params || {} }));
        });
    }

    async function evaluate(expression, awaitPromise) {
        const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: !!awaitPromise });
        return r.result.result.value;
    }

    try {
        const url = await connect();
        ws = new WebSocket(url);
        await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
        ws.addEventListener('message', (ev) => {
            const m = JSON.parse(ev.data);
            if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
        });
        await send('Runtime.enable');

        for (const page of PAGES) {
            await evaluate(`localStorage.setItem('pet-i18n','en')`);
            await evaluate(`location.href=${JSON.stringify(BASE + '/' + page)}`);
            await sleep(2200);

            const found = await evaluate(`(() => {
                const out = [];
                const skip = new Set(['SCRIPT','STYLE','CODE','PRE']);
                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                let n;
                while ((n = walker.nextNode())) {
                    const t = n.textContent.trim();
                    if (!t || !/[\\u4e00-\\u9fa5]/.test(t)) continue;
                    const el = n.parentElement;
                    if (!el || skip.has(el.tagName)) continue;
                    const cs = getComputedStyle(el);
                    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
                    if (el.closest('.i18n-btn') || el.classList.contains('i18n-btn')) continue;
                    out.push({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 40), text: t.slice(0, 60) });
                }
                const seen = new Set();
                return out.filter((x) => { const k = x.tag + '|' + x.text; if (seen.has(k)) return false; seen.add(k); return true; });
            })()`);

            console.log(`\\n### ${page} — ${found.length} 处`);
            found.forEach((f) => console.log(`  [${f.tag}.${f.cls}] ${f.text}`));
        }
    } finally {
        chrome.kill();
    }
})();
