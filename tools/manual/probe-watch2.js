const { spawn } = require('child_process');
const fs = require('fs');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9398);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8143);

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,900',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-rv',
        `${BASE}/index.html`], { stdio: 'ignore' });

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
        await sleep(3000);

        const waitReload = async (label) => {
            await ev("window.__marker = 'alive'");
            await sleep(5000);
            const gone = await ev("window.__marker ? 'still here' : 'reloaded'");
            console.log(label, '→', gone);
        };

        // 1) 改 CSS（追加一行注释）
        const css = 'D:\\Users\\User\\pet-lab\\css\\deepseek-pet.css';
        const cssOrig = fs.readFileSync(css, 'utf8');
        fs.writeFileSync(css, cssOrig + '\n/* watcher probe */\n', 'utf8');
        console.log('已改 css');
        await waitReload('css 改动');
        fs.writeFileSync(css, cssOrig, 'utf8');
        await sleep(3000);

        // 2) 改模块（追加注释）
        const mod = 'D:\\Users\\User\\pet-lab\\js\\pet\\modules\\speech.js';
        const modOrig = fs.readFileSync(mod, 'utf8');
        fs.writeFileSync(mod, modOrig + '\n// watcher probe\n', 'utf8');
        console.log('已改 js/pet/modules/speech.js');
        await waitReload('模块改动');
        fs.writeFileSync(mod, modOrig, 'utf8');
    } finally {
        chrome.kill();
    }
})();
