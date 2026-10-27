const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9418);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || '8115');
const PAGES = ['index.html', 'home.html', 'config-editor.html', 'zone-editor.html', 'rules-editor.html', 'docs.html?f=KNOWLEDGE.md'];

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-v1',
        `${BASE}/home.html`], { stdio: 'ignore' });

    let ws, id = 0;
    const pending = new Map();
    const send = (method, params) => new Promise((resolve) => {
        const myId = ++id;
        pending.set(myId, resolve);
        ws.send(JSON.stringify({ id: myId, method, params: params || {} }));
    });
    const evaluate = async (expression) => {
        const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        return r.result && r.result.result ? r.result.result.value : undefined;
    };

    try {
        let url;
        for (let i = 0; i < 60 && !url; i++) {
            try {
                const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
                const p = list.find((t) => t.type === 'page');
                if (p) url = p.webSocketDebuggerUrl;
            } catch (e) { /* retry */ }
            if (!url) await sleep(250);
        }
        ws = new WebSocket(url);
        await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
        ws.addEventListener('message', (ev) => {
            const m = JSON.parse(ev.data);
            if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
        });
        await send('Runtime.enable');
        await sleep(2000);

        // 先在本站设置语言，再逐页加载
        await evaluate("localStorage.setItem('pet-i18n','en')");
        console.log('stored lang:', await evaluate("localStorage.getItem('pet-i18n')"));

        for (const page of PAGES) {
            await send('Page.navigate', { url: BASE + '/' + page });
            await sleep(2600);
            const r = await evaluate(`JSON.stringify({
                path: location.pathname + location.search,
                title: document.title,
                cn: [...document.querySelectorAll('[data-i18n]') || []]
                      .filter(e => /[\\u4e00-\\u9fa5]/.test(e.textContent || ''))
                      .map(e => (e.textContent || '').slice(0, 40)).slice(0, 6)
            })`);
            console.log(`${page} ->`, r);
        }
    } finally {
        chrome.kill();
    }
})();
