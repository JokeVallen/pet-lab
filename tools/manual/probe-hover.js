const fs = require('fs');
const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9511);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8270);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,860',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-hover',
        BASE + '/demo.html'], { stdio: 'ignore' });

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
    const move = (x, y) => send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
    const click = async (x, y) => {
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, buttons: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, buttons: 0 });
    };
    const state = () => ev(`
        (function(){
            var acts = document.querySelector('.dp-actions');
            var s = getComputedStyle(acts);
            return JSON.stringify({
                opacity: s.opacity,
                pointerEvents: s.pointerEvents,
                cls: document.querySelector('.dp-root').className,
                chatting: document.querySelector('.dp-root').classList.contains('is-chatting')
            });
        })()
    `);

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
        await sleep(5000);

        const geo = JSON.parse(await ev(`
            (function(){
                var ch = document.querySelector('.dp-character').getBoundingClientRect();
                var btns = [...document.querySelectorAll('.dp-action')].map(function (b) {
                    var r = b.getBoundingClientRect();
                    return { cx: Math.round(r.left + r.width / 2), cy: Math.round(r.top + r.height / 2), t: b.dataset.dpAction };
                });
                var acts = document.querySelector('.dp-actions').getBoundingClientRect();
                return JSON.stringify({
                    ch: { left: Math.round(ch.left), top: Math.round(ch.top), cx: Math.round(ch.left + ch.width / 2), cy: Math.round(ch.top + ch.height / 2) },
                    actsRight: Math.round(acts.right),
                    btns: btns
                });
            })()
        `));
        console.log('几何:', JSON.stringify(geo));

        console.log('1) 初始:', await state());
        await move(geo.ch.cx, geo.ch.cy);
        await sleep(250);
        console.log('2) 移到角色上:', await state());

        // 关键场景：从角色挪到左侧按钮，中途经过 8px 缝隙
        const gapX = geo.ch.left - 4;
        await move(gapX, geo.ch.cy);
        await sleep(60);
        console.log('3) 停在缝隙里(60ms):', await state());
        await sleep(400);
        console.log('4) 缝隙里等 460ms:', await state());

        const btn = geo.btns.find((b) => b.t === 'chat') || geo.btns[0];
        await move(btn.cx, btn.cy);
        await sleep(80);
        console.log('5) 移到按钮上:', await state(), '| elementFromPoint:', await ev(`(function(){var e=document.elementFromPoint(${btn.cx}, ${btn.cy}); return e ? (e.className + '/' + (e.dataset.dpAction || '')) : 'null';})()`));
        await click(btn.cx, btn.cy);
        await sleep(400);
        console.log('6) 点击后:', await state());

        // 离开后多久收起
        await ev("document.querySelector('.dp-root').classList.remove('is-chatting')");
        await move(10, 10);
        const t0 = Date.now();
        let hid = null;
        for (let i = 0; i < 30; i++) {
            await sleep(50);
            const s = JSON.parse(await state());
            if (s.opacity === '0') { hid = Date.now() - t0; break; }
        }
        console.log('7) 离开后收起耗时:', hid == null ? '>1500ms' : hid + 'ms');

        await move(geo.ch.cx, geo.ch.cy);
        await sleep(300);
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('D:/Users/User/pet-lab/docs/screenshots/hover-actions.png', Buffer.from(shot.result.data, 'base64'));
    } finally {
        chrome.kill();
    }
})();
