const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9392);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8131);

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1400,1000',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-tg',
        `${BASE}/config-editor.html`], { stdio: 'ignore' });

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

        const info = await ev(`(function(){
            var sw = document.querySelector('.switch');
            if (!sw) return 'no switch';
            var span = sw.querySelector('span');
            var input = sw.querySelector('input');
            var cs = getComputedStyle(sw), ss = getComputedStyle(span), is = getComputedStyle(input);
            function box(el){ var r = el.getBoundingClientRect(); return {x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height)}; }
            return JSON.stringify({
                label: { box: box(sw), display: cs.display, width: cs.width, position: cs.position, justify: cs.justifySelf },
                span: { box: box(span), display: ss.display, inset: ss.inset, width: ss.width, borderRadius: ss.borderRadius },
                input: { box: box(input), width: is.width, height: is.height, opacity: is.opacity },
                parent: box(sw.parentElement)
            });
        })()`);
        console.log(info);

        // 截取包含 toggle 的区域
        await ev("document.querySelector('.switch').scrollIntoView({block:'center'})");
        await sleep(400);
        const rect = await ev(`(function(){
            var sw = document.querySelector('.switch');
            var r = sw.getBoundingClientRect();
            return JSON.stringify({x: Math.max(0, r.x - 260), y: Math.max(0, r.y - 40), width: 700, height: 120});
        })()`);
        const clip = JSON.parse(rect);
        const shot = await send('Page.captureScreenshot', { format: 'png', clip: Object.assign({ scale: 2 }, clip), captureBeyondViewport: true });
        require('fs').writeFileSync('D:\\Users\\User\\pet-lab\\docs\\screenshots\\toggle.png', Buffer.from(shot.result.data, 'base64'));
        console.log('shot saved');
    } finally {
        chrome.kill();
    }
})();
