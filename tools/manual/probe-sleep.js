const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9540);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8290);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,860',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-sleep',
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
    const snap = () => ev(`
        (function(){
            var d = window.PetDebug['deepseek-pet'].director;
            var p = window.PetDebug['deepseek-pet'].player;
            var v = document.querySelector('.dp-video.is-front');
            return JSON.stringify({
                sleeping: d && d.isSleeping(),
                clip: p && p.name(),
                videoClip: v && v.getAttribute('data-clip'),
                videoTime: v ? Math.round(v.currentTime * 10) / 10 : null,
                status: (document.querySelector('.dp-status') || {}).textContent,
                isSleepClass: document.querySelector('.dp-root').classList.contains('is-sleep')
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
        await sleep(6000);

        const geo = JSON.parse(await ev(`
            (function(){
                var r = document.querySelector('.dp-character').getBoundingClientRect();
                return JSON.stringify({ cx: Math.round(r.left + r.width/2), cy: Math.round(r.top + r.height*0.35) });
            })()
        `));

        console.log('1) 初始:', await snap());

        // 手动入睡（等价于 idleSleepMs 到点）
        await ev("window.PetDebug['deepseek-pet'].director.sleep()");
        await sleep(1200);
        console.log('2) 入睡后:', await snap());

        // 点一下角色
        await move(geo.cx, geo.cy);
        await click(geo.cx, geo.cy);
        await sleep(1200);
        console.log('3) 点击后:', await snap());

        // 再点一次
        await click(geo.cx, geo.cy);
        await sleep(1200);
        console.log('4) 再点击:', await snap());

        // 喂食
        await ev("document.querySelector('[data-dp-action=feed]').click()");
        await sleep(1500);
        console.log('5) 喂食后:', await snap());

        // 拖一下
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: geo.cx, y: geo.cy, button: 'left', clickCount: 1, buttons: 1 });
        await move(geo.cx - 40, geo.cy - 60);
        await sleep(600);
        console.log('6) 拖拽中:', await snap());
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: geo.cx - 40, y: geo.cy - 60, button: 'left', clickCount: 1, buttons: 0 });
        await sleep(2500);
        console.log('7) 松手后:', await snap());
    } finally {
        chrome.kill();
    }
})();
