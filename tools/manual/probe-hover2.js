const fs = require('fs');
const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9512);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8271);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,860',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-hover2',
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
    const st = () => ev(`
        (function(){
            var r = document.querySelector('.dp-root');
            var a = document.querySelector('.dp-actions');
            return JSON.stringify({
                o: getComputedStyle(a).opacity,
                pe: getComputedStyle(a).pointerEvents,
                cls: r.className.replace('dp-root', '').trim(),
                delay: getComputedStyle(r).getPropertyValue('--dp-actions-fade').trim()
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

        const c = JSON.parse(await ev(`
            (function(){
                var r = document.querySelector('.dp-character').getBoundingClientRect();
                return JSON.stringify({ cx: Math.round(r.left + r.width/2), cy: Math.round(r.top + r.height/2) });
            })()
        `));

        console.log('配置里的淡出时长:', await st());
        await move(c.cx, c.cy);
        await sleep(250);
        console.log('悬停:', await st());

        // 不打开聊天，直接离开
        await move(10, 10);
        const t0 = Date.now();
        let hidAt = null;
        for (let i = 0; i < 40; i++) {
            await sleep(40);
            const s = JSON.parse(await st());
            if (s.o === '0') { hidAt = Date.now() - t0; break; }
        }
        console.log('离开 → 收起耗时:', hidAt == null ? '>1600ms' : hidAt + 'ms', '（配置 320ms 宽限 + 140ms 淡出）');
        console.log('收起后:', await st());

        // 再回来一次，确认还能亮
        await move(c.cx, c.cy);
        await sleep(250);
        console.log('再次悬停:', await st());
    } finally {
        chrome.kill();
    }
})();
