const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9409);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8154);

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,1000',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-tp',
        `${BASE}/tests.html`], { stdio: 'ignore' });

    let ws, id = 0;
    const pending = new Map();
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
        await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
        ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
        await send('Runtime.enable');
        await send('Page.enable');
        await sleep(1500);

        console.log('初始状态:', await ev("document.getElementById('status').textContent"));
        await ev("document.getElementById('runUnit').click()");
        await sleep(6000);
        console.log('跑完状态:', await ev("document.getElementById('status').textContent"));
        console.log('徽章:', await ev("document.getElementById('badge').textContent + ' / ' + document.getElementById('badge').className"));
        console.log('耗时:', await ev("document.getElementById('duration').textContent"));
        console.log('输出前 90 字:', await ev("document.getElementById('out').textContent.slice(0, 90).replace(/\\n/g, ' | ')"));
        console.log('输出含通过:', await ev("document.getElementById('out').textContent.indexOf('passed') >= 0"));
    } finally {
        chrome.kill();
    }
})();
