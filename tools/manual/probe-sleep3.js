const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9546);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8296);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,860',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-sleep3',
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
    const click = async (x, y) => {
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, buttons: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, buttons: 0 });
    };
    const snap = () => ev(`
        (function(){
            var dbg = window.PetDebug['deepseek-pet'];
            return JSON.stringify({
                睡: dbg.director.isSleeping(),
                动作: dbg.player.name(),
                状态栏: (document.querySelector('.dp-status') || {}).textContent || '（无）',
                isSleep类: document.querySelector('.dp-root').classList.contains('is-sleep')
            });
        })()
    `);
    const sleepNow = async () => { await ev("window.PetDebug['deepseek-pet'].director.sleep(); document.querySelector('.dp-root').classList.add('is-sleep')"); await sleep(700); };

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
        await sleep(6000);

        const geo = JSON.parse(await ev(`
            (function(){
                var r = document.querySelector('.dp-character').getBoundingClientRect();
                return JSON.stringify({ cx: Math.round(r.left + r.width/2), cy: Math.round(r.top + r.height*0.35) });
            })()
        `));

        await sleepNow();
        console.log('1) 睡着:', await snap());

        await click(geo.cx, geo.cy);
        await sleep(600);
        console.log('2) 点一下:', await snap());
        await sleep(7500);
        console.log('3) 7.5s 后（应回 idle）:', await snap());

        await sleepNow();
        await ev("document.querySelector('[data-dp-action=chat]').click()");
        await sleep(600);
        console.log('4) 开着对话时再睡 → 打开对话:', await snap());
        await ev("document.querySelector('.dp-chat-close').click()");
        await sleep(400);

        await sleepNow();
        await ev("document.querySelector('[data-dp-action=feed]').click()");
        await sleep(600);
        console.log('5) 睡着时喂食:', await snap());

        await sleepNow();
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: geo.cx, y: geo.cy, button: 'left', clickCount: 1, buttons: 1 });
        for (let i = 1; i <= 4; i++) {
            await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: geo.cx - i * 18, y: geo.cy - i * 14, buttons: 1 });
            await sleep(70);
        }
        await sleep(300);
        console.log('6) 睡着时拖动:', await snap());
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: geo.cx - 72, y: geo.cy - 56, button: 'left', clickCount: 1, buttons: 0 });
        await sleep(4500);
        console.log('7) 松手 4.5s:', await snap());

        // 验证醒来后入睡计时被重置：再等 3s 不应重新入睡
        await sleep(3000);
        console.log('8) 再等 3s（不应再睡）:', await snap());
    } finally {
        chrome.kill();
    }
})();
