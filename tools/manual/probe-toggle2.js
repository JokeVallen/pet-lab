const { spawn } = require('child_process');
const fs = require('fs');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9395);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8134);

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1400,1000',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-tg2',
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

        // 隐藏帮助面板，滚到「交互」卡片
        const info = await ev(`(function(){
            var hp = document.querySelector('.help-panel'); if (hp) hp.remove();
            var fields = [].slice.call(document.querySelectorAll('.field'));
            var f = fields.filter(function(x){ return /拖拽|Drag/.test(x.textContent); })[0] || fields[0];
            var r = f.getBoundingClientRect();
            return JSON.stringify({top: Math.round(r.top + window.scrollY), x: Math.round(r.left), w: Math.round(r.width)});
        })()`);
        const parsed = JSON.parse(info);
        await ev(`window.scrollTo(0, ${Math.max(0, parsed.top - 120)})`);
        await sleep(500);

        const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        fs.writeFileSync('D:\\Users\\User\\pet-lab\\docs\\screenshots\\toggle.png', Buffer.from(shot.result.data, 'base64'));
        console.log('saved; field top =', parsed.top);
    } finally {
        chrome.kill();
    }
})();
