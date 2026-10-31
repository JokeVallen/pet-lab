const { spawn } = require('child_process');
const CHROME = 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9542);
const BASE = 'http://127.0.0.1:' + (process.argv[2] || 8292);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1200,860',
        `--remote-debugging-port=${PORT}`, '--user-data-dir=D:\\Users\\User\\pet-lab\\.chrome-sleep2',
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
            var dbg = window.PetDebug['deepseek-pet'];
            var d = dbg.director, p = dbg.player;
            var fronts = [...document.querySelectorAll('.dp-video.is-front')];
            var v = fronts[0];
            return JSON.stringify({
                睡: d.isSleeping(),
                动作: p.name(),
                前台片段: fronts.map(x => x.getAttribute('data-clip')).join('+') || '无',
                前台数: fronts.length,
                播放中: v ? !v.paused : null,
                状态: (document.querySelector('.dp-status') || {}).textContent,
                isSleep类: document.querySelector('.dp-root').classList.contains('is-sleep')
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

        console.log('A 初始:', await snap());
        await ev("window.PetDebug['deepseek-pet'].director.sleep()");
        await sleep(800);
        console.log('B 入睡:', await snap());

        await move(geo.cx, geo.cy);
        await click(geo.cx, geo.cy);
        await sleep(700);
        console.log('C 点击 0.7s:', await snap());
        await sleep(3500);
        console.log('D 点击 4.2s（应回待机）:', await snap());

        // 睡 → 拖 → 放
        await ev("window.PetDebug['deepseek-pet'].director.sleep()");
        await sleep(800);
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: geo.cx, y: geo.cy, button: 'left', clickCount: 1, buttons: 1 });
        await move(geo.cx - 50, geo.cy - 70);
        await sleep(500);
        console.log('E 睡眠中拖动:', await snap());
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: geo.cx - 50, y: geo.cy - 70, button: 'left', clickCount: 1, buttons: 0 });
        await sleep(4000);
        console.log('F 松手 4s:', await snap());

        // 睡 → 聊天
        await ev("window.PetDebug['deepseek-pet'].director.sleep()");
        await sleep(700);
        await ev("document.querySelector('[data-dp-action=chat]').click()");
        await sleep(900);
        console.log('G 打开聊天:', await snap());
        await ev("document.querySelector('.dp-chat-close').click()");
        await sleep(300);

        // 睡着后自己醒：等到 idleSleepMs
        await ev("window.PetDebug['deepseek-pet'].director.sleep()");
        await sleep(600);
        console.log('H 再入睡:', await snap());
        const woke = await ev(`
            new Promise(function (resolve) {
                var d = window.PetDebug['deepseek-pet'].director;
                var t0 = Date.now();
                var iv = setInterval(function () {
                    if (!d.isSleeping()) { clearInterval(iv); resolve('自己醒来，用时 ' + (Date.now() - t0) + 'ms'); }
                    if (Date.now() - t0 > 6000) { clearInterval(iv); resolve('6s 内没醒'); }
                }, 200);
            })
        `);
        console.log('I', woke, await snap());
    } finally {
        chrome.kill();
    }
})();
