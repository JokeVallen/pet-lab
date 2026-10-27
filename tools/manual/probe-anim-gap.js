const fs = require('fs');
const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9470);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8213);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1300,1200',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-a1',
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

        console.log('动作库几何:', await ev(`
            (function(){
                var f = [...document.querySelectorAll('.field')].find(x => /常驻待机/.test(x.textContent));
                var chips = f.querySelector('.chips.pick');
                var tools = f.querySelector('.ctrl-col > .inline');
                var r = (e) => e ? [Math.round(e.getBoundingClientRect().top), Math.round(e.getBoundingClientRect().bottom)] : null;
                return JSON.stringify({ chips: r(chips), tools: r(tools), gap: tools && chips ? Math.round(tools.getBoundingClientRect().top - chips.getBoundingClientRect().bottom) : null });
            })()
        `));

        console.log('状态行几何:', await ev(`
            (function(){
                var card = [...document.querySelectorAll('.card')].find(x => /状态/.test(x.querySelector('h2').textContent));
                var row = card.querySelector('.field');
                var inline = row.querySelector('.inline');
                var chips = row.querySelector('.chips.pick');
                return JSON.stringify({ gap: Math.round(chips.getBoundingClientRect().top - inline.getBoundingClientRect().bottom), cls: row.querySelector('.ctrl-col') ? 'ctrl-col' : 'none' });
            })()
        `));

        await ev(`
            (function(){
                var f = [...document.querySelectorAll('.field')].find(x => /常驻待机/.test(x.textContent));
                window.scrollTo(0, window.scrollY + f.getBoundingClientRect().top - 80);
            })()
        `);
        await sleep(400);
        const box = JSON.parse(await ev(`
            (function(){
                var f = [...document.querySelectorAll('.field')].find(x => /常驻待机/.test(x.textContent));
                var b = f.getBoundingClientRect();
                return JSON.stringify({ x: Math.round(b.left - 10), y: Math.round(b.top - 24 + window.scrollY), w: Math.round(b.width + 20), h: Math.round(b.height + 30) });
            })()
        `));
        const shot = await send('Page.captureScreenshot', {
            format: 'png',
            clip: { x: box.x, y: box.y, width: box.w, height: box.h, scale: 2 },
            captureBeyondViewport: true
        });
        fs.writeFileSync('D:/Users/User/pet-lab/docs/screenshots/config-anim-zoom.png', Buffer.from(shot.result.data, 'base64'));
    } finally {
        chrome.kill();
    }
})();
