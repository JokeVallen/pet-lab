const fs = require('fs');
const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9468);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8211);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1300,1200',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-cy',
        `${BASE}/config-editor.html`], { stdio: 'ignore' });

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
        await new Promise((res) => ws.addEventListener('open', res));
        ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
        await send('Runtime.enable');
        await send('Page.enable');
        await sleep(3000);

        const box = JSON.parse(await ev(`
            (function(){
                var card = [...document.querySelectorAll('.card')].find(x => /状态/.test(x.querySelector('h2').textContent));
                var b = card.getBoundingClientRect();
                window.scrollTo(0, Math.max(0, window.scrollY + b.top - 20));
                return JSON.stringify({ w: Math.round(b.width), h: Math.min(560, Math.round(b.height)) });
            })()
        `));
        await sleep(400);
        const box2 = JSON.parse(await ev(`
            (function(){
                var card = [...document.querySelectorAll('.card')].find(x => /状态/.test(x.querySelector('h2').textContent));
                var b = card.getBoundingClientRect();
                return JSON.stringify({ x: Math.round(b.left), y: Math.round(b.top + window.scrollY), w: Math.round(b.width), h: Math.min(560, Math.round(b.height)) });
            })()
        `));
        const shot = await send('Page.captureScreenshot', {
            format: 'png',
            clip: { x: box2.x, y: box2.y, width: box2.w, height: box2.h, scale: 2 },
            captureBeyondViewport: true
        });
        fs.writeFileSync('D:/Users/User/pet-lab/docs/screenshots/config-states-zoom.png', Buffer.from(shot.result.data, 'base64'));
        console.log('区域:', JSON.stringify(box2));
    } finally {
        chrome.kill();
    }
})();
