const fs = require('fs');
const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9471);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8214);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1300,1200',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-f1',
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

        const stat = () => ev(`
            (function(){
                var card = [...document.querySelectorAll('.card')].find(x => /状态/.test(x.querySelector('h2').textContent));
                return JSON.stringify({
                    行数: card.querySelectorAll('.srow').length,
                    展开: card.querySelectorAll('.srow.open').length,
                    节点总数: card.querySelectorAll('*').length,
                    芯片: card.querySelectorAll('.chip').length,
                    可见按钮: [...card.querySelectorAll('button')].map(b => b.textContent.trim()).join('/')
                });
            })()
        `);

        console.log('初始:', await stat());

        await ev(`
            (function(){
                var card = [...document.querySelectorAll('.card')].find(x => /状态/.test(x.querySelector('h2').textContent));
                card.querySelector('.srow-btns button').click();
            })()
        `);
        await sleep(300);
        console.log('展开第一个:', await stat());

        await ev(`
            (function(){
                var card = [...document.querySelectorAll('.card')].find(x => /状态/.test(x.querySelector('h2').textContent));
                var rows = card.querySelectorAll('.srow');
                rows[1].querySelector('.srow-btns button').click();
            })()
        `);
        await sleep(300);
        console.log('展开第二个(第一个应收起):', await stat());

        await ev(`
            (function(){
                var card = [...document.querySelectorAll('.card')].find(x => /状态/.test(x.querySelector('h2').textContent));
                card.scrollIntoView({ block: 'start' });
            })()
        `);
        await sleep(300);
        const box = JSON.parse(await ev(`
            (function(){
                var card = [...document.querySelectorAll('.card')].find(x => /状态/.test(x.querySelector('h2').textContent));
                var b = card.getBoundingClientRect();
                return JSON.stringify({ x: Math.round(b.left), y: Math.round(b.top + window.scrollY), w: Math.round(b.width), h: Math.min(620, Math.round(b.height)) });
            })()
        `));
        const shot = await send('Page.captureScreenshot', {
            format: 'png',
            clip: { x: box.x, y: box.y, width: box.w, height: box.h, scale: 2 },
            captureBeyondViewport: true
        });
        fs.writeFileSync('D:/Users/User/pet-lab/docs/screenshots/config-states-fold.png', Buffer.from(shot.result.data, 'base64'));
    } finally {
        chrome.kill();
    }
})();
