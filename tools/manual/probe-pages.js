const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9468);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8228);
const PAGES = ['index.html', 'config-editor.html', 'rules-editor.html', 'zone-editor.html', 'demo.html'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1300,1000',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-smoke',
        `${BASE}/index.html`], { stdio: 'ignore' });

    let ws, id = 0;
    const pending = new Map();
    const errors = [];
    const send = (m, p) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
    const ev = async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        if (r.result && r.result.exceptionDetails) {
            const d = r.result.exceptionDetails.exception;
            return 'EXC ' + (d && d.description ? d.description.split('\n')[0] : '');
        }
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
        await new Promise((res) => ws.addEventListener('open', res));
        ws.addEventListener('message', (e) => {
            const m = JSON.parse(e.data);
            if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
            if (m.method === 'Runtime.exceptionThrown') {
                const d = m.params.exceptionDetails;
                errors.push((d.exception && d.exception.description ? d.exception.description.split('\n')[0] : d.text));
            }
        });
        await send('Runtime.enable');
        await send('Page.enable');

        for (const page of PAGES) {
            errors.length = 0;
            await send('Page.navigate', { url: `${BASE}/${page}` });
            await sleep(3500);
            const title = await ev("document.title");
            const status = await ev("(document.getElementById('status')||{}).textContent || ''");
            console.log(page.padEnd(20), '| 标题:', String(title).slice(0, 16), '| 状态:', String(status).slice(0, 22), '| 异常:', errors.length ? errors.join(' / ') : '无');
        }
    } finally {
        chrome.kill();
    }
})();
