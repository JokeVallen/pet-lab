const fs = require('fs');
const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9467);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8227);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1300,1200',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-wc',
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
        await sleep(4000);

        await ev("window.__sc = [...document.querySelectorAll('.card')].find(x => /状态/.test(x.querySelector('h2').textContent))");
        await ev("window.__sc.querySelectorAll('.srow')[0].querySelector('.srow-btns button').click()");
        await sleep(300);

        console.log('展开行权重控件:', await ev("!!window.__sc.querySelector('.srow.open input[type=range]')"));
        console.log('初始读数:', await ev("[...window.__sc.querySelectorAll('.srow.open .wval, .srow.open .val')].map(e=>e.textContent).join(' | ')"));

        await ev(`
            (function(){
                var box = window.__sc.querySelector('.srow.open input[type=range]');
                box.value = 60; box.dispatchEvent(new Event('input'));
            })()
        `);
        console.log('拖动后:', await ev("JSON.stringify(cfg.states.idle.weight) + ' / ' + window.__sc.querySelector('.srow.open').querySelector('.val:last-of-type').textContent"));
        console.log('摘要同步:', await ev("window.__sc.querySelector('.srow.open .srow-meta').textContent"));

        // 第二条也改，看占比变化
        await ev("window.__sc.querySelectorAll('.srow')[1].querySelector('.srow-btns button').click()");
        await sleep(200);
        await ev(`
            (function(){
                var box = window.__sc.querySelector('.srow.open input[type=range]');
                box.value = 20; box.dispatchEvent(new Event('input'));
            })()
        `);
        console.log('两条都改后:', await ev("JSON.stringify(Object.keys(cfg.states).map(k=>k+':'+(cfg.states[k].weight||0)))"));

        await ev(`
            (function(){
                var box = window.__sc.querySelector('.srow.open input[type=range]');
                box.dispatchEvent(new Event('input'));
                return 1;
            })()
        `);
        console.log('当前行读数:', await ev("window.__sc.querySelector('.srow.open').querySelector('.inline').textContent.replace(/\\s+/g,' ').trim()"));

        await ev("window.__sc.scrollIntoView({ block: 'start' })");
        await sleep(300);
        const box = JSON.parse(await ev(`
            (function(){
                var c = window.__sc.getBoundingClientRect();
                return JSON.stringify({ x: Math.round(c.left), y: Math.round(c.top + window.scrollY), w: Math.round(c.width), h: Math.min(600, Math.round(c.height)) });
            })()
        `));
        const shot = await send('Page.captureScreenshot', {
            format: 'png',
            clip: { x: box.x, y: box.y, width: box.w, height: box.h, scale: 2 },
            captureBeyondViewport: true
        });
        fs.writeFileSync('D:/Users/User/pet-lab/docs/screenshots/config-weight-slider.png', Buffer.from(shot.result.data, 'base64'));
    } finally {
        chrome.kill();
    }
})();
