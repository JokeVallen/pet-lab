const { spawn } = require('child_process');
const fs = require('fs');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9397);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8137);
const YAML = 'D:\\Users\\User\\pet-lab\\config\\pet.yaml';

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
    const original = fs.readFileSync(YAML, 'utf8');
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,900',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-wt',
        `${BASE}/demo.html`], { stdio: 'ignore' });

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

        await ev("window.__marker = 'alive'");
        console.log('页面已加载，标记已设置');

        // 手写 yaml（模拟外部编辑），不调用任何 API
        fs.writeFileSync(YAML, original.replace(/^(\s*blur:\s*).*$/m, '$1 15') + '\n', 'utf8');
        console.log('已直接改写 config/pet.yaml（blur → 15）');

        await sleep(6000);
        const state = await ev("JSON.stringify({marker: window.__marker || null, blur: (window.PetConfig || {}).shadow ? PetConfig.shadow.blur : 'n/a'})");
        console.log('6 秒后:', state, '（marker 为 null 表示页面已自动重载）');
    } finally {
        fs.writeFileSync(YAML, original, 'utf8');
        await sleep(500);
        chrome.kill();
    }
})();
