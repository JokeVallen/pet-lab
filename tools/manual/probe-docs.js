const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9401);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8147);

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,1000',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-dc',
        `${BASE}/docs.html?f=docs/INTERACTION.md`], { stdio: 'ignore' });

    let ws, id = 0;
    const pending = new Map();
    const send = (m, p) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
    const ev = async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        if (r.result && r.result.exceptionDetails) return 'EXC';
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
        await sleep(2500);

        console.log('标题:', await ev('document.title'));
        console.log('首个标题:', await ev("(document.querySelector('#doc h1')||{}).textContent"));
        console.log('小节数:', await ev("document.querySelectorAll('#doc h2').length"));
        console.log('代码块数:', await ev("document.querySelectorAll('#doc pre').length"));
        console.log('导航项数:', await ev("document.querySelectorAll('header a[data-f]').length"));
        console.log('是否含草案字样:', await ev("document.getElementById('doc').textContent.indexOf('草案') >= 0"));
    } finally {
        chrome.kill();
    }
})();
