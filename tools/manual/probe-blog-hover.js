const fs = require('fs');
const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9515);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8273);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,860',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-bhover',
        BASE + '/'], { stdio: 'ignore' });

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
    const st = () => ev(`
        (function(){
            var r = document.querySelector('.dp-root');
            if (!r) return '未挂载';
            var a = r.querySelector('.dp-actions');
            return JSON.stringify({ o: getComputedStyle(a).opacity, pe: getComputedStyle(a).pointerEvents, cls: r.className.replace('dp-root','').trim() });
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
        await sleep(7000);

        const g = JSON.parse(await ev(`
            (function(){
                var ch = document.querySelector('.dp-character').getBoundingClientRect();
                var btn = document.querySelector('.dp-action[data-dp-action=chat]').getBoundingClientRect();
                return JSON.stringify({
                    ch: { left: Math.round(ch.left), cx: Math.round(ch.left + ch.width/2), cy: Math.round(ch.top + ch.height/2) },
                    btn: { cx: Math.round(btn.left + btn.width/2), cy: Math.round(btn.top + btn.height/2) }
                });
            })()
        `));

        console.log('初始:', await st());
        await move(g.ch.cx, g.ch.cy);
        await sleep(220);
        console.log('悬停角色:', await st());
        await move(g.ch.left - 3, g.ch.cy);
        await sleep(90);
        console.log('穿过缝隙:', await st());
        await move(g.btn.cx, g.btn.cy);
        await sleep(90);
        console.log('到达聊天按钮:', await st());
        await click(g.btn.cx, g.btn.cy);
        await sleep(500);
        console.log('点击结果:', await ev("document.querySelector('.dp-root').classList.contains('is-chatting') ? '聊天窗已打开' : '没打开'"));
    } finally {
        chrome.kill();
    }
})();
