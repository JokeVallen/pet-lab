const { spawn } = require('child_process');
const fs = require('fs');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9391);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8130);
const YAML = 'D:\\Users\\User\\pet-lab\\config\\pet.yaml';

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
    const original = fs.readFileSync(YAML, 'utf8');
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,900',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-sh2',
        `${BASE}/index.html`], { stdio: 'ignore' });

    let ws, id = 0;
    const pending = new Map();
    const send = (m, p) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
    const ev = async (expr) => {
        const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        if (r.result && r.result.exceptionDetails) return 'EXC';
        return r.result && r.result.result ? r.result.result.value : undefined;
    };

    const measure = () => ev(`(function(){
        var root = document.getElementById('deepseek-pet');
        var sh = root && root.querySelector('.dp-shadow');
        if (!sh) return 'no shadow';
        var r = sh.getBoundingClientRect();
        return JSON.stringify({
            x: root.style.getPropertyValue('--dp-shadow-x').trim(),
            center: Math.round(r.left + r.width / 2),
            transform: getComputedStyle(sh).transform
        });
    })()`);

    const setX = async (x) => {
        const changed = original.replace(/^(\s*offsetX:\s*).*$/m, '$1' + x);
        await fetch(BASE + '/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: 'config/pet.yaml', content: changed }) });
        await fetch(BASE + '/api/build', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
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

        console.log('offsetX=20（当前配置）:', await measure());

        await setX(0);
        await send('Page.reload');
        await sleep(2500);
        console.log('offsetX=0:', await measure());

        await setX(20);
        await send('Page.reload');
        await sleep(2500);
        console.log('offsetX=20（恢复）:', await measure());
    } finally {
        fs.writeFileSync(YAML, original, 'utf8');
        await fetch(BASE + '/api/build', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {});
        chrome.kill();
    }
})();
